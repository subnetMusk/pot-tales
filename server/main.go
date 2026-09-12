// ===================================================
// server/main.go
// ===================================================
// Main entry point.
// Assembla i componenti (Composition Root) iniettando
// le dipendenze necessarie.
// ===================================================
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/redis/go-redis/v9"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	// Elastic APM Agent imports
	"go.elastic.co/apm/module/apmgorilla/v2"
	"go.elastic.co/apm/module/apmmongo/v2"

	"github.com/subnetMusk/progetti_innovativi/server/helpers" // Importante: importiamo gli helpers
	"github.com/subnetMusk/progetti_innovativi/server/middleware"
	"github.com/subnetMusk/progetti_innovativi/server/router"
)

func main() {
	// 1. Configurazione Ambiente
	port := helpers.Env("PORT", "3000")
	// GO_ENV non è impostato dal compose: ripieghiamo su ELASTIC_APM_ENVIRONMENT
	// (development/production) così l'etichetta service.environment nei log è corretta.
	env := helpers.Env("GO_ENV", helpers.Env("ELASTIC_APM_ENVIRONMENT", "development"))
	serviceName := helpers.Env("ELASTIC_APM_SERVICE_NAME", "go-backend")

	// Inizializza il Logger Strutturato (JSON Protocol)
	helpers.InitLogger(serviceName, env)

	mongoURI := helpers.Env("MONGO_URI", "mongodb://db:27017")
	mongoDBName := helpers.Env("MONGO_DB_NAME", "game_db") // Nome del DB esplicito
	redisURL := helpers.Env("REDIS_URL", "redis://redis:6379")
	schemaDirServer := helpers.Env("SCHEMA_DIR_SERVER", "/src/comms/server")

	// Nota: ttlMin potrebbe non servire più qui se è hardcodato in helpers,
	// ma lo lasciamo se il router lo richiede ancora per altre logiche.
	ttlMin := helpers.Env("SESSION_TTL_MIN", "30")

	// Ritenzione dei documenti su Mongo, distinta dalla durata della sessione.
	// Vedi helpers.EnsureIndexes.
	retention := time.Duration(helpers.EnvInt("DATA_RETENTION_DAYS", 30)) * 24 * time.Hour

	slog.Info("APM Agent initialized", "service", serviceName)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// 2. Inizializzazione Driver (Infrastructure Layer)
	// MongoDB with APM
	mongoClient, err := mongo.Connect(ctx, options.Client().
		ApplyURI(mongoURI).
		SetMonitor(apmmongo.CommandMonitor()))
	if err != nil {
		slog.Error("mongo connection failed", "error", err)
		os.Exit(1)
	}

	// Redis Client
	redisOpt, err := redis.ParseURL(redisURL)
	if err != nil {
		slog.Error("redis parse failed", "error", err)
		os.Exit(1)
	}
	redisClient := redis.NewClient(redisOpt)
	if err := redisClient.Ping(ctx).Err(); err != nil {
		slog.Error("redis ping failed", "error", err)
		os.Exit(1)
	}

	// 3. Inizializzazione Services (Business Logic Layer)
	db := mongoClient.Database(mongoDBName)

	// La creazione degli indici non è bloccante: il servizio resta funzionante
	// anche senza, con la sola conseguenza che i documenti non scadono.
	if err := helpers.EnsureIndexes(ctx, db, retention); err != nil {
		slog.Error("mongo index setup failed, continuing", "error", err)
	}

	// Contesto di vita del processo, distinto da quello di avvio.
	//
	// `ctx` porta un timeout di dieci secondi: un'attività di fondo che lo
	// ereditasse smetterebbe di funzionare dieci secondi dopo la partenza, e il
	// sintomo sarebbe l'assenza di dati senza alcun errore da nessuna parte.
	fondoCtx, fermaFondo := context.WithCancel(context.Background())
	defer fermaFondo()

	// Le partite finiscono per abbandono e non con una chiamata: la chiusura
	// differita è ciò che rende osservabili la durata e il punto di uscita.
	helpers.AvviaChiusuraSessioni(fondoCtx, db,
		time.Duration(helpers.EnvInt("SESSION_IDLE_CLOSE_MIN", 5))*time.Minute,
		time.Duration(helpers.EnvInt("SESSION_SWEEP_SEC", 60))*time.Second,
	)

	sessionCol := helpers.JournaledCollection(db, helpers.SessionsCollection)

	// Creiamo il Manager che incapsula la logica di sessione
	sessionMgr := helpers.NewSessionManager(redisClient, sessionCol)

	// 4. Inizializzazione Middleware (Application Layer)
	// Iniettiamo il SessionManager nel middleware invece dei DB grezzi
	// Le quote per sessione sono applicate dal middleware sulle rotte che le
	// dichiarano.
	val := middleware.MustNew(schemaDirServer, sessionMgr).
		WithQuota(
			helpers.NewRateLimiter(redisClient),
			time.Duration(helpers.EnvInt("SESSION_QUOTA_WINDOW_MIN", 10))*time.Minute,
		)

	// 5. Setup Router e Server
	// Passiamo i client al router (se servono per le logiche di gioco) e il validator configurato
	r := router.New(mongoClient, redisClient, val, ttlMin)

	// Timeout espliciti su ogni fase della richiesta. Senza, una connessione
	// che non completa mai la propria fase tiene occupata una goroutine a
	// tempo indefinito.
	srv := &http.Server{
		Addr:    ":" + port,
		Handler: apmgorilla.Middleware()(r),

		// Tempo massimo per ricevere gli header, che chiude le connessioni
		// aperte senza inviare dati (Slowloris).
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		// Durata di una connessione keep-alive inattiva.
		IdleTimeout: 60 * time.Second,
		// Tetto sugli header, indipendente dal tetto sul body applicato dal
		// middleware di validazione.
		MaxHeaderBytes: 1 << 16, // 64 KB
	}

	// 6. Avvio e arresto controllato.
	// Lo shutdown lascia completare le richieste in volo invece di troncarle
	// alla chiusura del processo.
	serverErr := make(chan error, 1)
	go func() {
		slog.Info("server listening with APM monitoring", "port", port)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			serverErr <- err
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	select {
	case err := <-serverErr:
		slog.Error("server failed", "error", err)
		os.Exit(1)
	case sig := <-stop:
		slog.Info("shutdown requested", "signal", sig.String())
	}

	// Il grace period resta sotto i 10 secondi che Docker concede di default
	// fra SIGTERM e SIGKILL, così l'arresto ha modo di completarsi.
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		slog.Error("graceful shutdown failed", "error", err)
	}

	// Contesto separato: se Shutdown ha consumato l'intero grace period,
	// shutdownCtx risulta già scaduto e la disconnessione fallirebbe.
	closeCtx, closeCancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer closeCancel()

	if err := mongoClient.Disconnect(closeCtx); err != nil {
		slog.Error("mongo disconnect failed", "error", err)
	}
	if err := redisClient.Close(); err != nil {
		slog.Error("redis close failed", "error", err)
	}

	slog.Info("shutdown complete")
}
