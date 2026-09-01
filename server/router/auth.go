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
	"strconv"
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

	// TTL ridotto applicato alla sessione appena creata. La durata piena viene
	// concessa alla prima richiesta autenticata, cosi' che le sessioni create e
	// mai utilizzate scadano rapidamente.
	initialTTL time.Duration

	limiter      *helpers.RateLimiter
	pow          *helpers.PoW
	createLimit  int64
	createWindow time.Duration
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

	// Write concern j:true su entrambe le collection. Vedi
	// helpers.JournaledCollection.
	svc := &authSvc{
		sessionCol: helpers.JournaledCollection(db, helpers.SessionsCollection),
		gameCol:    helpers.JournaledCollection(db, helpers.GameStatesCollection),
		rdb:        rd,
		ttl:        ttlDuration,
		initialTTL: time.Duration(helpers.EnvInt("SESSION_UNUSED_TTL_MIN", 5)) * time.Minute,

		limiter: helpers.NewRateLimiter(rd),
		pow: helpers.NewPoW(
			helpers.Env("POW_SECRET", "change-me"),
			uint(helpers.EnvInt("POW_DIFFICULTY", 18)),
			5*time.Minute,
			rd,
		),
		createLimit:  int64(helpers.EnvInt("SESSION_CREATE_LIMIT", 500)),
		createWindow: time.Duration(helpers.EnvInt("SESSION_CREATE_WINDOW_MIN", 60)) * time.Minute,
	}

	r.HandleFunc("/session", svc.create).Methods(http.MethodPost)
	r.HandleFunc("/validate", svc.validate).Methods(http.MethodGet)
}

// requirePoW decide se la richiesta di creazione puo' proseguire.
//
// Il conteggio e' per indirizzo di provenienza, ma la soglia limita soltanto la
// creazione di sessioni: le sessioni gia' attive continuano a funzionare, quindi
// il superamento non interrompe il gioco a chi sta giocando.
//
// Al superamento non corrisponde un rifiuto ma una sfida a prova di lavoro:
// un utente legittimo la risolve e prosegue, mentre chi richiede sessioni in
// serie paga il costo per ognuna. Senza questa via d'uscita, un gruppo di
// utenti dietro lo stesso indirizzo resterebbe escluso al raggiungimento della
// soglia.
//
// La chiave di conteggio contiene l'indirizzo completo, non anonimizzato, ma
// vive solo per la durata della finestra e non viene persistita ne' registrata.
func (a *authSvc) allowCreate(w http.ResponseWriter, r *http.Request, clientIP string) bool {
	ctx := r.Context()
	key := "ratelimit:session-create:" + clientIP

	allowed, count, reset := a.limiter.Allow(ctx, key, a.createLimit, a.createWindow)
	if allowed {
		return true
	}

	challenge := r.Header.Get("X-PoW-Challenge")
	solution := r.Header.Get("X-PoW-Solution")
	if challenge != "" && solution != "" {
		if err := a.pow.Verify(ctx, challenge, solution); err == nil {
			helpers.LogBusiness(ctx, "security", "session_create_pow_accepted", map[string]any{
				"window_count": count,
			})
			return true
		}
	}

	issued, err := a.pow.Issue()
	if err != nil {
		// L'impossibilita' di emettere una sfida non deve impedire l'accesso.
		return true
	}

	helpers.LogBusiness(ctx, "security", "session_create_pow_required", map[string]any{
		"window_count": count,
		"limit":        a.createLimit,
	})

	w.Header().Set("X-PoW-Challenge", issued)
	w.Header().Set("X-PoW-Difficulty", strconv.Itoa(int(a.pow.Difficulty())))
	w.Header().Set("Retry-After", strconv.Itoa(int(reset.Seconds())))
	helpers.WriteJSON(w, http.StatusTooManyRequests, map[string]any{
		"error":      "proof of work required",
		"challenge":  issued,
		"difficulty": a.pow.Difficulty(),
		"algorithm":  "sha256-leading-zero-bits",
	})
	return false
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

	// 2. Quota sulla creazione di sessioni. L'indirizzo completo serve solo come
	// chiave di conteggio; quello persistito e' anonimizzato.
	if !a.allowCreate(w, r, helpers.GetRealIP(r)) {
		return
	}

	clientIP := helpers.AnonymizeIP(helpers.GetRealIP(r))

	// 3. Generazione Identità
	token := uuid.NewString()
	now := time.Now()
	expiresAt := now.Add(a.ttl)

	// 4. Preparazione Documento Sessione
	// ExpiresAt parte dal TTL ridotto e viene esteso alla prima richiesta
	// autenticata, coerentemente con la chiave Redis. Il cookie e la risposta
	// riportano invece la durata nominale, che e' quella effettiva per una
	// sessione utilizzata.
	sessDoc := models.SessionDoc{
		ID:        token,
		CreatedAt: now,
		ExpiresAt: now.Add(a.initialTTL),
		Active:    true,
		// Campi Sicurezza salvati
		Device: reqPayload.Device,
		// reqPayload.IPAddress non viene persistito: e' un valore dichiarato dal
		// client, quindi non verificabile e ridondante rispetto a ClientIP.
		// Resta accettato dallo schema per compatibilita' con i client esistenti.
		ClientIP:     clientIP,
		ConsentGiven: reqPayload.ConsentGiven,
	}

	// 5. Preparazione GameState (uguale a prima)
	gameDoc := models.GameState{ID: token, CreatedAt: now}
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
	// TTL ridotto: la durata piena viene concessa alla prima richiesta
	// autenticata (vedi SessionManager.refreshSessionAsync). Le sessioni create
	// e mai utilizzate scadono cosi' in pochi minuti anziche' occupare spazio
	// per l'intera durata nominale.
	if err := a.rdb.Set(ctx, "sess:"+token, "1", a.initialTTL).Err(); err != nil {
		helpers.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to cache session"})
		return
	}

	// 9. Risposta
	http.SetCookie(w, helpers.NewSessionCookie(token, expiresAt))

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
