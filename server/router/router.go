// ===================================================
// server/router/router.go
// ===================================================
// Configura il router Gorilla Mux, applica i middleware
// globali e monta i sotto-router per le feature.
// ===================================================

package router

import (
	"github.com/gorilla/mux"
	"github.com/redis/go-redis/v9"
	"go.mongodb.org/mongo-driver/mongo"

	"github.com/subnetMusk/progetti_innovativi/server/middleware"
)

// New inizializza il router principale.
// Parametri:
// - m, rdb: client DB necessari per inizializzare i sotto-servizi (Auth, Game, Health).
// - v: il middleware di validazione già configurato con SessionManager.
// - ttlMin: configurazione TTL passata come stringa.
func New(m *mongo.Client, rdb *redis.Client, v *middleware.Validator, ttlMin string) *mux.Router {
	r := mux.NewRouter()

	// 1. Global Middleware
	// Applica il Validator (Whitelist + Schema + Auth Check) a TUTTE le richieste.
	r.Use(v.Handler)

	// 2. Feature Routing

	// Health Check (utile per Kubernetes/Docker probes)
	registerHealth(r, m, rdb)

	// Auth Routes (/auth/session, /auth/validate)
	// Passiamo ttlMin grezzo, registerAuth farà il parsing.
	registerAuth(
		r.PathPrefix("/auth").Subrouter(),
		m,
		rdb,
		ttlMin,
	)

	registerGame(
		r.PathPrefix("/game").Subrouter(),
		m,
		rdb,
	)

	return r
}
