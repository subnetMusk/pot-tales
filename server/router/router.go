// ===================================================
// server/router/router.go
// ===================================================
// Configura il router Gorilla Mux, applica i middleware
// globali e monta i sotto-router per le feature.
// ===================================================

package router

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/redis/go-redis/v9"
	"go.mongodb.org/mongo-driver/mongo"

	"github.com/subnetMusk/progetti_innovativi/server/helpers"
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
	registerAuth(r.PathPrefix("/auth").Subrouter(), m, rdb, ttlMin)

	// Game Routes (/game/position, /game/timer, /game/ping, /game/checkpoint, /game/reset)
	registerGame(r.PathPrefix("/game").Subrouter(), m, rdb)

	// 3. Log Ingestion (Frontend -> Backend -> Elastic)
	// La rotta è in whitelist (POST /log, senza auth nè schema): il middleware
	// globale la lascia passare, quindi basta un handler semplice.
	r.HandleFunc("/log", logIngestHandler).Methods(http.MethodPost)

	return r
}

// logIngestHandler riceve eventi dal frontend e li ristampa su stdout come log
// strutturati; Filebeat li raccoglie e li inoltra a Elasticsearch, taggati come
// dataset 'frontend.app' per distinguerli dai log del backend.
func logIngestHandler(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		Category string         `json:"category"`
		Action   string         `json:"action"`
		Details  map[string]any `json:"details"`
		Level    string         `json:"level"`
	}

	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		// Fail-silently (200) per non innescare loop di log d'errore dal frontend.
		w.WriteHeader(http.StatusOK)
		return
	}

	ctx := r.Context()

	if payload.Details == nil {
		payload.Details = make(map[string]any)
	}
	payload.Details["event.dataset"] = "frontend.app"

	if payload.Level == "error" {
		helpers.LogError(ctx, payload.Category, payload.Action, fmt.Errorf("frontend_error"), payload.Details)
	} else {
		helpers.LogBusiness(ctx, payload.Category, payload.Action, payload.Details)
	}

	w.WriteHeader(http.StatusOK)
}
