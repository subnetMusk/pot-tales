// =========================================================
// router/auth.go
// =========================================================
// Gestione del ciclo di vita della sessione (Login/Verify).
// Inizializza anche lo stato del gioco (GameState) su Mongo.
// =========================================================

package router

import (
	"encoding/json" // Import necessario per decodificare il body
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"github.com/redis/go-redis/v9"
	"go.mongodb.org/mongo-driver/mongo"

	"github.com/subnetMusk/progetti_innovativi/server/helpers"
	"github.com/subnetMusk/progetti_innovativi/server/models"
)

// Struttura temporanea per leggere il body della richiesta.
// Rispetta lo schema JSON "CreateSessionRequest".
type sessionRequest struct {
	Device       string `json:"device"`
	IPAddress    string `json:"ipAddress"` // Quello dichiarato dal client
	ConsentGiven bool   `json:"consentGiven"`
}

// authSvc incapsula le dipendenze.
// Ora gestisce sia la collection delle sessioni che quella del gioco.
type authSvc struct {
	sessionCol *mongo.Collection
	gameCol    *mongo.Collection
	rdb        *redis.Client
	ttl        time.Duration
}

// registerAuth configura le rotte di autenticazione.
func registerAuth(r *mux.Router, m *mongo.Client, rd *redis.Client, ttlMinutes string) {
	// Parsing del TTL (con fallback sicuro)
	ttlDuration, _ := time.ParseDuration(ttlMinutes + "m")
	if ttlDuration == 0 {
		ttlDuration = 30 * time.Minute
	}

	// Riferimento al Database
	db := m.Database("game_db")

	svc := &authSvc{
		sessionCol: db.Collection("sessions"),
		gameCol:    db.Collection("game_states"), // <--- NUOVO: Collezione gioco
		rdb:        rd,
		ttl:        ttlDuration,
	}

	r.HandleFunc("/session", svc.create).Methods(http.MethodPost)
	r.HandleFunc("/validate", svc.validate).Methods(http.MethodGet)
}

// / create (POST /auth/session)
func (a *authSvc) create(w http.ResponseWriter, r *http.Request) {
	// 0. Pulizia cookie esistente
	if _, err := r.Cookie("session_token"); err == nil {
		helpers.DeleteCookies(w, r, "session_token")
	}

	// 1. Parsing del Body (Lettura dati Client)
	// Poiché il Middleware ha già validato che il JSON è corretto,
	// possiamo decodificarlo con sicurezza.
	var reqPayload sessionRequest
	if err := json.NewDecoder(r.Body).Decode(&reqPayload); err != nil {
		// Fallback difensivo se il body è strano (anche se validato)
		helpers.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "malformed request body"})
		return
	}

	// 2. Estrazione IP Reale (Security enforcement)
	realIP := helpers.GetRealIP(r)

	// --- QUI POSSIAMO INSERIRE LOGICHE DI BAN ---
	// if isBanned(realIP) { return 403 }
	// --------------------------------------------

	// 3. Generazione Identità
	token := uuid.NewString()
	now := time.Now()
	expiresAt := now.Add(a.ttl)

	// 4. Preparazione Documento Sessione
	sessDoc := models.SessionDoc{
		ID:        token,
		CreatedAt: now,
		ExpiresAt: expiresAt,
		Active:    true,
		// Campi Sicurezza salvati
		Device:       reqPayload.Device,
		ClientIP:     realIP,               // <--- QUELLO CHE CONTA (Nginx Header)
		ReportedIP:   reqPayload.IPAddress, // Quello che dice il client (metadata)
		ConsentGiven: reqPayload.ConsentGiven,
	}

	// 5. Preparazione GameState (uguale a prima)
	gameDoc := models.GameState{ID: token}
	gameDoc.Data.SceneID = "Stage2"
	gameDoc.Data.X = 0.0
	gameDoc.Data.Y = 0.0
	gameDoc.Data.TotalPlayTimeMs = 0
	gameDoc.Meta.LastPing = now
	gameDoc.Meta.Warnings = 0

	ctx := r.Context()

	// 6. Persistenza (Mongo Session)
	if _, err := a.sessionCol.InsertOne(ctx, sessDoc); err != nil {
		helpers.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to create session record"})
		return
	}

	// 7. Persistenza (Mongo GameState)
	if _, err := a.gameCol.InsertOne(ctx, gameDoc); err != nil {
		helpers.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to init game state"})
		return
	}

	// 8. Persistenza (Redis Cache)
	// Nota: Potremmo usare realIP come valore invece di "1" se volessimo
	// fare controlli veloci sull'IP anche da Redis in futuro.
	if err := a.rdb.Set(ctx, "sess:"+token, "1", a.ttl).Err(); err != nil {
		helpers.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to cache session"})
		return
	}

	// 9. Risposta
	http.SetCookie(w, &http.Cookie{
		Name:     "session_token",
		Value:    token,
		Path:     "/",
		Expires:  expiresAt,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})

	helpers.WriteJSON(w, http.StatusCreated, map[string]any{
		"token":   token,
		"expires": expiresAt.Format(time.RFC3339),
	})
}

// validate (GET /auth/validate)
func (a *authSvc) validate(w http.ResponseWriter, r *http.Request) {
	tokenID := r.Context().Value(helpers.UserIDKey).(string)

	helpers.WriteJSON(w, http.StatusOK, map[string]string{
		"state":   "active",
		"session": tokenID,
	})
}
