// ===================================================
// router/health.go   (path segment: "health")
// ===================================================
// GET /health  → {"server":true,"redis":bool,"mongodb":bool}
// ---------------------------------------------------
package router

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/gorilla/mux"
	"go.mongodb.org/mongo-driver/mongo"
)

type healthSvc struct {
	mongo *mongo.Client
	redis *redis.Client
}

func registerHealth(r *mux.Router, m *mongo.Client, rd *redis.Client) {
	svc := &healthSvc{mongo: m, redis: rd}
	r.HandleFunc("/health", svc.check).Methods(http.MethodGet)
}

func (h *healthSvc) check(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()

	out := map[string]bool{
		"server":  true,
		"mongodb": h.mongo.Ping(ctx, nil) == nil,
		"redis":   h.redis.Ping(ctx).Err() == nil,
	}
	json.NewEncoder(w).Encode(out)
}
