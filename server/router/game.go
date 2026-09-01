// ===================================================
// server/router/game.go
// ===================================================

package router

import (
	"encoding/json"
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

	// Route POST (Scrittura progressi)
	r.HandleFunc("/ping", svc.handlePing).Methods(http.MethodPost)
	r.HandleFunc("/checkpoint", svc.handleCheckpoint).Methods(http.MethodPost)
	r.HandleFunc("/reset", svc.handleReset).Methods(http.MethodPost)
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

	checkpoints := state.Data.Checkpoints
	if checkpoints == nil {
		checkpoints = []string{}
	}

	// Formattazione DTO String
	response := map[string]any{
		"scene_id":    state.Data.SceneID,
		"last_ping":   state.Meta.LastPing.Format(time.RFC3339),
		"checkpoints": checkpoints,
	}

	// Le coordinate compaiono solo se il gioco le ha riportate almeno una volta.
	// Servire lo zero della creazione come se fosse una posizione salvata
	// riporterebbe il giocatore nell'angolo della scena invece che al suo punto
	// di ingresso; l'assenza del campo dice al client di usare lo spawn.
	if state.PositionRecorded() {
		response["x"] = fmt.Sprintf("%f", state.Data.X)
		response["y"] = fmt.Sprintf("%f", state.Data.Y)
	}

	helpers.WriteJSON(w, http.StatusOK, response)
}

// POST /game/ping
// Riceve la posizione corrente del client ogni 5-10s, la valida contro lo stato
// autoritativo salvato (anti-cheat) e risponde con lo stato aggiornato (o quello
// precedente, se il ping viene rifiutato) più l'azione che il client deve intraprendere.
func (g *gameSvc) handlePing(w http.ResponseWriter, r *http.Request) {
	sessionID := r.Context().Value(helpers.UserIDKey).(string)

	var payload struct {
		SceneID string  `json:"scene_id"`
		X       float64 `json:"x"`
		Y       float64 `json:"y"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		helpers.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "malformed request body"})
		return
	}

	ctx := r.Context()
	state, err := g.mgr.GetState(ctx, sessionID)
	if err != nil {
		helpers.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "db error"})
		return
	}

	now := time.Now()
	action, addTime := helpers.ValidatePing(state, payload.SceneID, payload.X, payload.Y, now)

	respond := func(sceneID string, x, y float64, lastPing time.Time, action string) {
		helpers.WriteJSON(w, http.StatusOK, map[string]any{
			"scene_id":  sceneID,
			"x":         fmt.Sprintf("%f", x),
			"y":         fmt.Sprintf("%f", y),
			"last_ping": lastPing.Format(time.RFC3339),
			"action":    action,
		})
	}

	switch action {
	case helpers.ActionAccept:
		if err := g.mgr.UpdateState(ctx, sessionID, payload.SceneID, payload.X, payload.Y, addTime, now); err != nil {
			helpers.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "db error"})
			return
		}
		respond(payload.SceneID, payload.X, payload.Y, now, "accept")
	case helpers.ActionRubberband, helpers.ActionKick:
		// Non persistiamo la posizione sospetta: rispondiamo con l'ultimo stato
		// autoritativo così il client può correggersi (snap-back).
		actionName := "rubberband"
		if action == helpers.ActionKick {
			actionName = "kick"
		}
		respond(state.Data.SceneID, state.Data.X, state.Data.Y, state.Meta.LastPing, actionName)
	case helpers.ActionBan:
		if err := g.mgr.DeleteState(ctx, sessionID); err != nil {
			helpers.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "db error"})
			return
		}
		respond(state.Data.SceneID, state.Data.X, state.Data.Y, now, "ban")
	}
}

// POST /game/checkpoint
func (g *gameSvc) handleCheckpoint(w http.ResponseWriter, r *http.Request) {
	sessionID := r.Context().Value(helpers.UserIDKey).(string)

	var payload struct {
		CheckpointID string `json:"checkpoint_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil || payload.CheckpointID == "" {
		helpers.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "malformed request body"})
		return
	}

	if err := g.mgr.AddCheckpoint(r.Context(), sessionID, payload.CheckpointID); err != nil {
		helpers.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "db error"})
		return
	}

	helpers.WriteJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// POST /game/reset
// Cancella lo stato di gioco salvato (usato dal bottone "Play" del menu per
// ripartire da zero anche se esistevano progressi salvati).
func (g *gameSvc) handleReset(w http.ResponseWriter, r *http.Request) {
	sessionID := r.Context().Value(helpers.UserIDKey).(string)

	if err := g.mgr.DeleteState(r.Context(), sessionID); err != nil {
		helpers.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "db error"})
		return
	}

	helpers.WriteJSON(w, http.StatusOK, map[string]string{"status": "ok"})
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
