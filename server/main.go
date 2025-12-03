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
	"log"
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
	mongoURI := getenv("MONGO_URI", "mongodb://db:27017")
	mongoDBName := getenv("MONGO_DB_NAME", "game_db") // Nome del DB esplicito
	redisURL := getenv("REDIS_URL", "redis://redis:6379")
	schemaDirServer := getenv("SCHEMA_DIR_SERVER", "/src/comms/server")

	// Nota: ttlMin potrebbe non servire più qui se è hardcodato in helpers,
	// ma lo lasciamo se il router lo richiede ancora per altre logiche.
	ttlMin := getenv("SESSION_TTL_MIN", "30")

	log.Printf("APM Agent initialized for service: %s", getenv("ELASTIC_APM_SERVICE_NAME", "go-backend"))

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// 2. Inizializzazione Driver (Infrastructure Layer)
	// MongoDB with APM
	mongoClient, err := mongo.Connect(ctx, options.Client().
		ApplyURI(mongoURI).
		SetMonitor(apmmongo.CommandMonitor()))
	if err != nil {
		log.Fatalf("mongo: %v", err)
	}

	// Redis Client
	redisOpt, err := redis.ParseURL(redisURL)
	if err != nil {
		log.Fatalf("redis parse: %v", err)
	}
	redisClient := redis.NewClient(redisOpt)
	if err := redisClient.Ping(ctx).Err(); err != nil {
		log.Fatalf("redis ping: %v", err)
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

	log.Printf("server listening on :%s with APM monitoring", port)
	log.Fatal(http.ListenAndServe(":"+port, apmgorilla.Middleware()(r)))
}
