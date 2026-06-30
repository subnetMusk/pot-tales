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

	// --- Health Check ---
	r.Handle("/health", val.Handler(http.HandlerFunc(HealthHandler))).Methods("GET")

	// --- Log Ingestion (Frontend -> Backend -> Elastic) ---
	r.Handle("/log", val.Handler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Decodifica veloce del log dal frontend
		var payload struct {
			Category string         `json:"category"`
			Action   string         `json:"action"`
			Details  map[string]any `json:"details"`
			Level    string         `json:"level"`
		}
		if err := helpers.ReadJSON(r, &payload); err != nil {
			return // Fail silently per non creare loop di errori
		}

		// Arricchiamo il contesto con 'frontend.app' come dataset
		ctx := r.Context()
		
		// Usiamo il logger del backend per stampare questo evento su stdout
		// Filebeat lo raccoglierà come se fosse un log del backend, ma taggato 'frontend'
		// Nota: ridefiniamo event.dataset qui
		if payload.Level == "error" {
			helpers.LogError(ctx, payload.Category, payload.Action, fmt.Errorf("frontend_error"), payload.Details)
		} else {
			// Usiamo LogBusiness ma forziamo il dataset nei details se necessario o lo gestiamo nel logger
			// Per semplicità, lo logghiamo come business event, aggiungendo un campo speciale
			if payload.Details == nil {
				payload.Details = make(map[string]any)
			}
			payload.Details["event.dataset"] = "frontend.app"
			helpers.LogBusiness(ctx, payload.Category, payload.Action, payload.Details)
		}

		w.WriteHeader(http.StatusOK)
	}))).Methods("POST")

	return r
}
