// ===================================================
// server/main.go
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

	"progetti_innovativi/server/middleware"
	"progetti_innovativi/server/router"
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
	schemaDir := getenv("SCHEMA_DIR", "/app/comms")
	ttlMin    := getenv("SESSION_TTL_MIN", "30")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	mongoClient, err := mongo.Connect(ctx, options.Client().ApplyURI(mongoURI))
	if err != nil { log.Fatalf("mongo: %v", err) }

	redisOpt, err := redis.ParseURL(redisURL)
	if err != nil { log.Fatalf("redis parse: %v", err) }
	redisClient := redis.NewClient(redisOpt)
	if err := redisClient.Ping(ctx).Err(); err != nil { log.Fatalf("redis ping: %v", err) }

	val := middleware.MustNew(schemaDir)

	r := router.New(mongoClient, redisClient, val, ttlMin)

	log.Printf("server listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, r))
}
