// ===================================================
// router/health.go
// ===================================================
// Endpoint di diagnostica per verificare la connettività
// verso i servizi di persistenza (Redis, MongoDB).
// ===================================================

package router

import (
	"context"
	"net/http"
	"time"

	"github.com/gorilla/mux"
	"github.com/redis/go-redis/v9"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/readpref"

	"github.com/subnetMusk/progetti_innovativi/server/helpers"
)

// healthSvc mantiene i riferimenti ai client DB.
type healthSvc struct {
	m   *mongo.Client
	rdb *redis.Client
}

// registerHealth associa l'handler alla rotta.
func registerHealth(r *mux.Router, m *mongo.Client, rdb *redis.Client) {
	svc := &healthSvc{
		m:   m,
		rdb: rdb,
	}
	// Nota: mux.Router applica già il middleware globale, quindi questa rotta
	// sarà soggetta alla validazione schema (se health.req.json esiste) e whitelist.
	r.HandleFunc("/health", svc.check).Methods(http.MethodGet)
}

// check esegue i ping verso i database e restituisce lo stato.
func (h *healthSvc) check(w http.ResponseWriter, r *http.Request) {
	// Timeout aggressivo: un health check non deve mai appendere la richiesta a lungo.
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()

	// 1. Check MongoDB
	// Usiamo readpref.Primary() per assicurarci di poter scrivere, se necessario.
	mongoStatus := true
	if err := h.m.Ping(ctx, readpref.Primary()); err != nil {
		mongoStatus = false
	}

	// 2. Check Redis
	redisStatus := true
	if err := h.rdb.Ping(ctx).Err(); err != nil {
		redisStatus = false
	}

	// 3. Costruzione Risposta
	payload := map[string]bool{
		"server":  true, // Se siamo qui, il server Go sta girando
		"mongodb": mongoStatus,
		"redis":   redisStatus,
	}

	// Nota: Restituiamo 200 OK anche se un servizio è giù, lasciando al client
	// (es. Kubernetes o Dashboard) l'interpretazione dei flag booleani.
	// Se volessimo fallire a livello HTTP, potremmo controllare i bool qui.
	helpers.WriteJSON(w, http.StatusOK, payload)
}
