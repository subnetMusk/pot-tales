// =========================================================================
// server/helpers/session_utils.go
// =========================================================================
// Gestisce la logica di sessione incapsulando le connessioni ai database
// (Redis/MongoDB) tramite il pattern SessionManager.
// =========================================================================

package helpers

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"time"

	"github.com/redis/go-redis/v9"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"

	"github.com/subnetMusk/progetti_innovativi/server/models"
)

// ContextKey è un tipo specifico per evitare collisioni nel context
type ContextKey string

const (
	// UserIDKey è la chiave usata per salvare il token/ID nel context
	UserIDKey ContextKey = "userID"

	// SessionTTL definisce la durata standard della sessione (es. 30 minuti)
	SessionTTL = 30 * time.Minute
)

var (
	ErrSessionExpired  = errors.New("session expired")
	ErrSessionNotFound = errors.New("session not found")
	ErrTokenMissing    = errors.New("token cookie missing")
)

// SessionManager incapsula le connessioni e la logica di sessione.
type SessionManager struct {
	rdb      *redis.Client
	mongoCol *mongo.Collection
}

// NewSessionManager crea una nuova istanza del manager con le dipendenze iniettate.
func NewSessionManager(rdb *redis.Client, col *mongo.Collection) *SessionManager {
	return &SessionManager{
		rdb:      rdb,
		mongoCol: col,
	}
}

// ValidateSession verifica se il token è valido.
// 1. Controlla Redis (Fast Path).
// 2. Controlla MongoDB (Slow Path/Source of Truth).
// 3. Esegue il refresh asincrono (Sliding Window).
// Restituisce il token stesso (che funge da ID) se valido.
func (sm *SessionManager) ValidateSession(ctx context.Context, token string) (string, error) {
	// 1. Fast Path: Redis
	// Controlliamo solo l'esistenza della chiave.
	if sm.rdb.Exists(ctx, "sess:"+token).Val() > 0 {
		return token, nil
	}

	// 2. Slow Path: MongoDB
	var doc models.SessionDoc
	err := sm.mongoCol.FindOne(ctx, bson.M{"_id": token}).Decode(&doc)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return "", ErrSessionNotFound
		}
		return "", err
	}

	// 3. Validazione Logica
	if !doc.Active {
		return "", ErrSessionNotFound
	}
	if time.Now().After(doc.ExpiresAt) {
		return "", ErrSessionExpired
	}

	// 4. Sliding Window Refresh (Asincrono)
	// Estendiamo la durata della sessione in background
	go sm.refreshSessionAsync(token)

	return token, nil
}

// refreshSessionAsync estende il TTL su Redis e MongoDB.
// È un metodo privato, gestito internamente dal Manager.
func (sm *SessionManager) refreshSessionAsync(token string) {
	// Usiamo un contesto slegato dalla richiesta HTTP originale
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Redis: Refresh TTL (valore "1" come placeholder)
	if err := sm.rdb.Set(ctx, "sess:"+token, "1", SessionTTL).Err(); err != nil {
		log.Printf("[session] redis refresh failed for %s: %v", token, err)
	}

	// MongoDB: Estensione expires_at
	newExpiry := time.Now().Add(SessionTTL)
	_, err := sm.mongoCol.UpdateOne(
		ctx,
		bson.M{"_id": token},
		bson.M{"$set": bson.M{"expires_at": newExpiry}},
	)
	if err != nil {
		log.Printf("[session] mongo extend failed for %s: %v", token, err)
	}
}

// --- Helper Stateless (Funzioni pure di utilità HTTP) ---

// ExtractToken legge il cookie "session_token".
func ExtractToken(r *http.Request) (string, error) {
	c, err := r.Cookie("session_token")
	if err != nil {
		return "", ErrTokenMissing
	}
	return c.Value, nil
}

// WriteJSON helper per risposte JSON standard.
func WriteJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(payload)
}

// DeleteCookies invalida i cookie specificati lato client.
func DeleteCookies(w http.ResponseWriter, r *http.Request, names ...string) {
	del := func(name string) {
		http.SetCookie(w, &http.Cookie{
			Name:     name,
			Value:    "",
			Path:     "/",
			Expires:  time.Unix(0, 0),
			MaxAge:   -1,
			HttpOnly: true,
			SameSite: http.SameSiteLaxMode,
		})
	}

	if len(names) == 0 {
		for _, c := range r.Cookies() {
			del(c.Name)
		}
		return
	}
	for _, name := range names {
		del(name)
	}
}
