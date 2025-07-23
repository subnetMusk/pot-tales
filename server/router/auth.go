// ===================================================
// router/auth.go   (path segment: "auth")
// ===================================================
// • POST /auth/session   → create new session
// • GET  /auth/validate  → check session state
// ---------------------------------------------------
package router

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/gorilla/mux"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

type sessionDoc struct {
	ID        string    `bson:"_id"`
	CreatedAt time.Time `bson:"created_at"`
	ExpiresAt time.Time `bson:"expires_at"`
	Active    bool      `bson:"active"`
}

type authSvc struct {
	col *mongo.Collection
	rdb *redis.Client
	ttl time.Duration
}

func registerAuth(r *mux.Router, m *mongo.Client, rd *redis.Client, ttl time.Duration) {
	svc := &authSvc{
		col: m.Database("app").Collection("sessions"),
		rdb: rd,
		ttl: ttl,
	}
	r.HandleFunc("/session", svc.create).Methods(http.MethodPost)
	r.HandleFunc("/validate", svc.validate).Methods(http.MethodGet)
}

// POST /auth/session
func (a *authSvc) create(w http.ResponseWriter, r *http.Request) {
	if _, err := r.Cookie("session_token"); err == nil {
		http.Error(w, "session already exists", http.StatusBadRequest)
		return
	}
	token := uuid.NewString()
	now := time.Now()

	doc := sessionDoc{
		ID:        token,
		CreatedAt: now,
		ExpiresAt: now.Add(a.ttl),
		Active:    true,
	}
	if _, err := a.col.InsertOne(r.Context(), doc); err != nil {
		http.Error(w, "mongo error", http.StatusInternalServerError)
		return
	}
	if err := a.rdb.Set(r.Context(), "sess:"+token, "1", a.ttl).Err(); err != nil {
		http.Error(w, "redis error", http.StatusInternalServerError)
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "session_token",
		Value:    token,
		Path:     "/",
		Expires:  doc.ExpiresAt,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]any{
		"token":   token,
		"expires": doc.ExpiresAt.Format(time.RFC3339),
	})
}

// GET /auth/validate
func (a *authSvc) validate(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie("session_token")
	if err != nil {
		json.NewEncoder(w).Encode(map[string]string{"state": "absent"})
		return
	}
	ctx := r.Context()
	_, redisErr := a.rdb.Get(ctx, "sess:"+cookie.Value).Result()
	mongoErr := a.col.FindOne(ctx, bson.M{"_id": cookie.Value}).Err()

	switch {
	case redisErr == nil && mongoErr == nil:
		json.NewEncoder(w).Encode(map[string]string{"state": "active"})
	case redisErr != nil && mongoErr == nil:
		json.NewEncoder(w).Encode(map[string]string{"state": "inactive"})
	default:
		json.NewEncoder(w).Encode(map[string]string{"state": "absent"})
	}
}
