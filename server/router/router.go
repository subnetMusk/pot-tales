// ===================================================
// router/router.go
// ===================================================
// Monta i router per le funzionalità del server.
// ===================================================

package router

import (
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/gorilla/mux"
	"go.mongodb.org/mongo-driver/mongo"

	"github.com/subnetMusk/progetti_innovativi/server/middleware"
)

// New returns a mux.Router with global validation middleware
// and feature routers mounted.
func New(mongo *mongo.Client, redis *redis.Client, v *middleware.Validator, ttlMin string) *mux.Router {
	ttl, _ := strconv.Atoi(ttlMin)

	r := mux.NewRouter()
	r.Use(v.Middleware)

	registerHealth(r, mongo, redis)
	registerAuth(
		r.PathPrefix("/auth").Subrouter(),
		mongo,
		redis,
		time.Duration(ttl)*time.Minute,
	)

	return r
}
