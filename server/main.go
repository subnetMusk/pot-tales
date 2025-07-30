// ===================================================
// server/main.go
// ===================================================
// Main entry point for the server application.
// Initializes MongoDB and Redis clients, sets up the router,
// and starts the HTTP server with APM monitoring.
// ======================================================
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
	port      := getenv("PORT", "3000")
	mongoURI  := getenv("MONGO_URI", "mongodb://db:27017")
	redisURL  := getenv("REDIS_URL", "redis://redis:6379")
	schemaDirServer := getenv("SCHEMA_DIR_SERVER", "/src/comms/server")
	ttlMin    := getenv("SESSION_TTL_MIN", "30")

	log.Printf("APM Agent initialized for service: %s", getenv("ELASTIC_APM_SERVICE_NAME", "go-backend"))

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// MongoDB with APM instrumentation
	mongoClient, err := mongo.Connect(ctx, options.Client().
		ApplyURI(mongoURI).
		SetMonitor(apmmongo.CommandMonitor()))
	if err != nil { log.Fatalf("mongo: %v", err) }

	// Redis client (APM instrumentation will be added later)
	redisOpt, err := redis.ParseURL(redisURL)
	if err != nil { log.Fatalf("redis parse: %v", err) }
	redisClient := redis.NewClient(redisOpt)
	if err := redisClient.Ping(ctx).Err(); err != nil { log.Fatalf("redis ping: %v", err) }

	val := middleware.MustNew(schemaDirServer)

	r := router.New(mongoClient, redisClient, val, ttlMin)

	// Wrap router with APM middleware for automatic HTTP tracing
	log.Printf("server listening on :%s with APM monitoring", port)
	log.Fatal(http.ListenAndServe(":"+port, apmgorilla.Middleware()(r)))
}
