// ===================================================
// server/router/router.go
// ===================================================
// Configura il router Gorilla Mux, applica i middleware
// globali e monta i sotto-router per le feature.
// ===================================================

package router

import (
	"net/http"

	"github.com/gorilla/mux"
	"github.com/redis/go-redis/v9"
	"go.elastic.co/apm/module/apmgorilla/v2"
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
	// Il matching precede APM; anche il validator vede la transazione.
	apmgorilla.Instrument(r)

	// Superficie uniforme: qualunque richiesta che non corrisponda a una rotta
	// dichiarata riceve la stessa risposta, indipendentemente dal motivo.
	//
	// Senza, un metodo non previsto su un percorso esistente riceve 405 e uno su
	// un percorso inesistente riceve 404: la differenza rivela quali percorsi
	// esistono. I middleware registrati con Use non intervengono, perche' vengono
	// eseguiti solo sulle rotte che corrispondono, quindi il controllo della
	// whitelist non viene raggiunto.
	r.NotFoundHandler = http.HandlerFunc(rottaInesistente)
	r.MethodNotAllowedHandler = http.HandlerFunc(rottaInesistente)

	// 1. Global Middleware
	// Applica il Validator (Whitelist + Schema + Auth Check) a TUTTE le richieste.
	r.Use(v.Handler)

	// 2. Feature Routing
	// Health Check (utile per Kubernetes/Docker probes)
	registerHealth(r, m, rdb)

	// Auth Routes (/auth/session, /auth/validate)
	registerAuth(r.PathPrefix("/auth").Subrouter(), m, rdb, ttlMin)

	// Game Routes (/game/position, /game/ping, /game/checkpoint, /game/reset)
	registerGame(r.PathPrefix("/game").Subrouter(), m, rdb)

	return r
}

// rottaInesistente risponde nello stesso formato del controllo di whitelist del
// middleware, cosi' che le due strade producano una risposta indistinguibile.
func rottaInesistente(w http.ResponseWriter, r *http.Request) {
	helpers.WriteJSON(w, http.StatusNotFound, map[string]string{"error": "route not found"})
}
