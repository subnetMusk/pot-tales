// ===================================================
// server/router/game.go
// ===================================================

package router

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gorilla/mux"
	"github.com/redis/go-redis/v9"
	"go.mongodb.org/mongo-driver/mongo"

	"github.com/subnetMusk/progetti_innovativi/server/helpers"
)

const InactivityThreshold = 3 * time.Second

type gameSvc struct {
	mgr *helpers.GameManager
}

func registerGame(r *mux.Router, m *mongo.Client, rdb *redis.Client) {
	mgr := helpers.NewGameManager(rdb, m.Database("game_db"))
	svc := &gameSvc{mgr: mgr}

	// Route GET (Sincronizzazione Client)
	r.HandleFunc("/position", svc.getPosition).Methods(http.MethodGet)
	r.HandleFunc("/timer", svc.getTimer).Methods(http.MethodGet)

	// Route POST (Ping & Validazione) -> Da implementare prossimamente
	// r.HandleFunc("/ping", svc.handlePing).Methods(http.MethodPost)
}

// GET /game/position
func (g *gameSvc) getPosition(w http.ResponseWriter, r *http.Request) {
	sessionID := r.Context().Value(helpers.UserIDKey).(string)

	state, err := g.mgr.GetState(r.Context(), sessionID)
	if err != nil {
		// Gestione errore standard
		helpers.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "db error"})
		return
	}

	// Formattazione DTO String
	response := map[string]string{
		"scene_id":  state.Data.SceneID,
		"x":         fmt.Sprintf("%f", state.Data.X),
		"y":         fmt.Sprintf("%f", state.Data.Y),
		"last_ping": state.Meta.LastPing.Format(time.RFC3339),
	}

	helpers.WriteJSON(w, http.StatusOK, response)
}

// GET /game/timer
func (g *gameSvc) getTimer(w http.ResponseWriter, r *http.Request) {
	sessionID := r.Context().Value(helpers.UserIDKey).(string)

	state, err := g.mgr.GetState(r.Context(), sessionID)
	if err != nil {
		helpers.WriteJSON(w, http.StatusOK, map[string]any{"total_playtime_seconds": 0, "is_active": false})
		return
	}

	now := time.Now()
	gap := now.Sub(state.Meta.LastPing)

	var currentSessionMs int64 = 0
	isActive := false

	// Logica Visualizzazione Timer (Proiezione lato client)
	// Se l'utente è attivo (gap < 3s), aggiungiamo il tempo corrente al totale.
	if gap < InactivityThreshold {
		isActive = true
		// Aggiungiamo il tempo trascorso dall'ultimo ping convalidato
		currentSessionMs = gap.Milliseconds()
	} else {
		// Se l'utente è inattivo, non proiettiamo tempo extra.
		currentSessionMs = 0
	}

	totalMs := state.Data.TotalPlayTimeMs + currentSessionMs

	helpers.WriteJSON(w, http.StatusOK, map[string]any{
		"total_playtime_seconds": float64(totalMs) / 1000.0,
		"is_active":              isActive,
		"gap_ms":                 gap.Milliseconds(),
	})
}
