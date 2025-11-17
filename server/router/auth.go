// =========================================================
// router/auth.go   (path segment: "auth")
// =========================================================
// POST /auth/session  → {"token":string,"expires":string}
// GET /auth/validate  → {"state":"active"|"absent"}
// =========================================================

package router

import (
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"github.com/redis/go-redis/v9"
	"go.mongodb.org/mongo-driver/mongo"

	"github.com/subnetMusk/progetti_innovativi/server/helpers"
	"github.com/subnetMusk/progetti_innovativi/server/models"
)

// authSvc incapsula la logica di accesso a MongoDB e Redis per le sessioni.
type authSvc struct {
	col *mongo.Collection
	rdb *redis.Client
	ttl time.Duration
}

// registerAuth registra gli endpoint per l’autenticazione.
func registerAuth(r *mux.Router, m *mongo.Client, rd *redis.Client, ttl time.Duration) {
	svc := &authSvc{
		col: m.Database("app").Collection("sessions"),
		rdb: rd,
		ttl: ttl,
	}
	r.HandleFunc("/session", svc.create).Methods(http.MethodPost)
	r.HandleFunc("/validate", svc.validate).Methods(http.MethodGet)
}

// create gestisce POST /auth/session: crea una nuova sessione.
func (a *authSvc) create(w http.ResponseWriter, r *http.Request) {
	// Rifiuta se esiste già un cookie di sessione
	if _, err := r.Cookie("session_token"); err == nil {
		// PER IL MOMENTO RIMUOVIAMO IL COOKIE ESISTENTE E NE CREIAMO UNO NUOVO

		// potremmo restituire 409 Conflict invece di eliminare il cookie.
		helpers.DeleteCookies(w, r, "session_token")
	}

	token := uuid.NewString()
	now := time.Now()
	doc := models.SessionDoc{
		ID:        token,
		CreatedAt: now,
		ExpiresAt: now.Add(a.ttl),
		Active:    true,
	}

	// Inserisce il documento in MongoDB
	if _, err := a.col.InsertOne(r.Context(), doc); err != nil {
		helpers.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "mongo error"})
		return
	}

	// Popola la cache in Redis
	if err := a.rdb.Set(r.Context(), "sess:"+token, "1", a.ttl).Err(); err != nil {
		helpers.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "redis error"})
		return
	}

	// Imposta il cookie HTTP-only sul client
	http.SetCookie(w, &http.Cookie{
		Name:     "session_token",
		Value:    token,
		Path:     "/",
		Expires:  doc.ExpiresAt,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})

	// Restituisce 201 Created con token e scadenza
	helpers.WriteJSON(w, http.StatusCreated, map[string]any{
		"token":   token,
		"expires": doc.ExpiresAt.Format(time.RFC3339),
	})
}

// validate gestisce GET /auth/validate: verifica lo stato della sessione,
// utilizza helpers.DeleteCookies per rimuovere cookie invalidi e aggiorna Redis.
func (a *authSvc) validate(w http.ResponseWriter, r *http.Request) {
	token, err := helpers.ExtractToken(r)
	if err != nil {
		helpers.DeleteCookies(w, r, "session_token")
		helpers.WriteJSON(w, http.StatusUnauthorized, map[string]string{"state": "absent"})
		return
	}

	ctx := r.Context()

	// Redis
	_, redisErr := a.rdb.Get(ctx, "sess:"+token).Result()
	// Mongo
	doc, mongoErr := helpers.LoadSession(ctx, a.col, token)

	switch {
	case redisErr == nil && mongoErr == nil:
		_ = helpers.RefreshRedis(ctx, a.rdb, token, a.ttl)
		helpers.WriteJSON(w, http.StatusOK, map[string]string{"state": "active"})

	case redisErr != nil && mongoErr == nil:
		remaining := time.Until(doc.ExpiresAt)
		if remaining <= 0 {
			helpers.DeleteCookies(w, r, "session_token")
			helpers.WriteJSON(w, http.StatusUnauthorized, map[string]string{"state": "absent"})
			return
		}
		_ = helpers.RefreshRedis(ctx, a.rdb, token, remaining)
		helpers.WriteJSON(w, http.StatusOK, map[string]string{"state": "active"})

	default:
		helpers.DeleteCookies(w, r, "session_token")
		helpers.WriteJSON(w, http.StatusUnauthorized, map[string]string{"state": "absent"})
	}
}
