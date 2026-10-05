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

type gameSvc struct {
	mgr *helpers.GameManager
}

func registerGame(r *mux.Router, m *mongo.Client, rdb *redis.Client) {
	mgr := helpers.NewGameManager(rdb, m.Database("game_db"))
	svc := &gameSvc{mgr: mgr}

	// Route GET (Sincronizzazione Client)
	r.HandleFunc("/position", svc.getPosition).Methods(http.MethodGet)

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
// Salva la posizione dichiarata dal client dopo schema, sessione e quota.
// Non interpreta gli spostamenti del gioco come prove di abuso.
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
	if err := g.mgr.UpdateState(ctx, sessionID, payload.SceneID, payload.X, payload.Y, now); err != nil {
		helpers.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "db error"})
		return
	}
	if payload.SceneID != state.Data.SceneID {
		helpers.LogGameplay(ctx, sessionID, "scena_iniziata", map[string]any{
			"partita.scena":            payload.SceneID,
			"partita.scena_precedente": state.Data.SceneID,
		})
	}
	helpers.WriteJSON(w, http.StatusOK, map[string]any{
		"scene_id":  payload.SceneID,
		"x":         fmt.Sprintf("%f", payload.X),
		"y":         fmt.Sprintf("%f", payload.Y),
		"last_ping": now.Format(time.RFC3339),
		"action":    "accept",
	})
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

	aggiunto, err := g.mgr.AddCheckpoint(r.Context(), sessionID, payload.CheckpointID)
	if err != nil {
		helpers.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "db error"})
		return
	}

	// Un retry dello stesso checkpoint non e' un nuovo fatto di partita. Mongo
	// conserva gia' un insieme; applicare la stessa idempotenza anche al log
	// impedisce che un doppio click o una ritrasmissione gonfino le dashboard.
	if aggiunto {
		// L'identificativo resta opaco anche qui: il backend non interpreta i
		// checkpoint ordinari, e la dashboard li aggrega come etichette.
		helpers.LogGameplay(r.Context(), sessionID, "checkpoint_raggiunto", map[string]any{
			"partita.checkpoint": payload.CheckpointID,
		})

		// L'avvio si conta anche senza consenso, in forma anonima: e' il solo
		// modo di misurare l'affluenza complessiva. La stessa idempotenza del
		// checkpoint impedisce che un retry conti due partite.
		if payload.CheckpointID == "game_started" {
			helpers.LogPartitaAvviata(r.Context())
		}
	}

	// Questo e' l'unico checkpoint che ha semantica di ciclo di vita: chiude la
	// partita come completata prima che lo sweeper possa classificarla come
	// abbandonata per inattivita'. ConcludiPartita e' atomica e idempotente, per
	// cui un retry non produce una seconda conclusione.
	if payload.CheckpointID == "stage3_complete" {
		if _, err := g.mgr.ConcludiPartita(r.Context(), sessionID, helpers.MotivoCompletata); err != nil {
			helpers.LogError(r.Context(), "database", "game_complete_failed", err, nil)
			helpers.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "db error"})
			return
		}
	}

	helpers.WriteJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// POST /game/reset
// Cancella lo stato di gioco salvato (usato dal bottone "Play" del menu per
// ripartire da zero anche se esistevano progressi salvati).
func (g *gameSvc) handleReset(w http.ResponseWriter, r *http.Request) {
	sessionID := r.Context().Value(helpers.UserIDKey).(string)
	ctx := r.Context()

	// Lo stato viene letto prima di cancellarlo: dopo la cancellazione non
	// resterebbe nulla da riportare, e l'azzeramento comparirebbe nell'imbuto
	// senza dire da dove il giocatore è ripartito. L'errore di lettura non
	// impedisce l'azzeramento, che è cio' che l'utente ha chiesto.
	precedente, errStato := g.mgr.GetState(ctx, sessionID)

	if err := g.mgr.DeleteState(ctx, sessionID); err != nil {
		helpers.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "db error"})
		return
	}

	// Azione distinta dalla conclusione: la partita non è finita, è ricominciata.
	// Contarla come conclusione darebbe due fini per un solo inizio.
	if errStato == nil {
		helpers.LogGameplay(ctx, sessionID, "partita_azzerata", map[string]any{
			"partita.scena_finale": precedente.Data.SceneID,
			"partita.durata_ms":    precedente.DurataMs(),
			"partita.checkpoint_n": len(precedente.Data.Checkpoints),
		})
	}

	helpers.WriteJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
