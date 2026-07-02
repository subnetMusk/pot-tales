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
	"log/slog"
	"net/http"
	"os"
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

func getenv(k, d string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return d
}

func main() {
	// 1. Configurazione Ambiente
	port := getenv("PORT", "3000")
	// GO_ENV non è impostato dal compose: ripieghiamo su ELASTIC_APM_ENVIRONMENT
	// (development/production) così l'etichetta service.environment nei log è corretta.
	env := getenv("GO_ENV", getenv("ELASTIC_APM_ENVIRONMENT", "development"))
	serviceName := getenv("ELASTIC_APM_SERVICE_NAME", "go-backend")

	// Inizializza il Logger Strutturato (JSON Protocol)
	helpers.InitLogger(serviceName, env)

	mongoURI := getenv("MONGO_URI", "mongodb://db:27017")
	mongoDBName := getenv("MONGO_DB_NAME", "game_db") // Nome del DB esplicito
	redisURL := getenv("REDIS_URL", "redis://redis:6379")
	schemaDirServer := getenv("SCHEMA_DIR_SERVER", "/src/comms/server")

	// Nota: ttlMin potrebbe non servire più qui se è hardcodato in helpers,
	// ma lo lasciamo se il router lo richiede ancora per altre logiche.
	ttlMin := getenv("SESSION_TTL_MIN", "30")

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
	// Selezioniamo la collection specifica per le sessioni
	sessionCol := mongoClient.Database(mongoDBName).Collection("sessions")

	// Creiamo il Manager che incapsula la logica di sessione
	sessionMgr := helpers.NewSessionManager(redisClient, sessionCol)

	// 4. Inizializzazione Middleware (Application Layer)
	// Iniettiamo il SessionManager nel middleware invece dei DB grezzi
	val := middleware.MustNew(schemaDirServer, sessionMgr)

	// 5. Setup Router e Server
	// Passiamo i client al router (se servono per le logiche di gioco) e il validator configurato
	r := router.New(mongoClient, redisClient, val, ttlMin)

	slog.Info("server listening with APM monitoring", "port", port)
	if err := http.ListenAndServe(":"+port, apmgorilla.Middleware()(r)); err != nil {
		slog.Error("server failed", "error", err)
		os.Exit(1)
	}
}
