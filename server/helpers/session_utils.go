// =========================================================================
// server/helpers/session_utils.go
// =========================================================================
// Funzioni di utilità per la gestione delle sessioni
// Gestisce il caricamento, la validazione e l'aggiornamento delle sessioni
// =========================================================================

package helpers

import (
    "context"
    "encoding/json"
    "net/http"
    "time"

    "github.com/redis/go-redis/v9"
    "go.mongodb.org/mongo-driver/bson"
    "go.mongodb.org/mongo-driver/mongo"

    "github.com/subnetMusk/progetti_innovativi/server/models"
)

// LoadSession recupera da MongoDB il documento di sessione.
// Ritorna ErrNoDocuments se non esiste alcun documento corrispondente.
func LoadSession(ctx context.Context, col *mongo.Collection, token string) (models.SessionDoc, error) {
    var doc models.SessionDoc
    err := col.FindOne(ctx, bson.M{"_id": token}).Decode(&doc)
    return doc, err
}

// RefreshRedis ripristina in Redis la chiave "sess:<token>" con il TTL specificato.
func RefreshRedis(ctx context.Context, rdb *redis.Client, token string, ttl time.Duration) error {
    return rdb.Set(ctx, "sess:"+token, "1", ttl).Err()
}

// ExtendMongoExpiry aggiorna il campo expires_at del documento di sessione.
func ExtendMongoExpiry(ctx context.Context, col *mongo.Collection, token string, ttl time.Duration) error {
    newExpiry := time.Now().Add(ttl)
    _, err := col.UpdateOne(
        ctx,
        bson.M{"_id": token},
        bson.M{"$set": bson.M{"expires_at": newExpiry}},
    )
    return err
}

// ExtractToken legge il cookie "session_token" e restituisce il suo valore.
// Restituisce un errore se il cookie non è presente.
func ExtractToken(r *http.Request) (string, error) {
    c, err := r.Cookie("session_token")
    if err != nil {
        return "", err
    }
    return c.Value, nil
}

// WriteJSON uniforma il Content-Type, lo status HTTP e la serializzazione JSON nella risposta.
func WriteJSON(w http.ResponseWriter, status int, payload any) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(status)
    json.NewEncoder(w).Encode(payload)
}

// DeleteCookies elimina uno o più cookie. Se names è vuoto, cancella tutti i cookie presenti.
func DeleteCookies(w http.ResponseWriter, r *http.Request, names ...string) {
    // funzione helper per eliminare un singolo cookie
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
        // cancella tutti i cookie
        for _, c := range r.Cookies() {
            del(c.Name)
        }
        return
    }
    // cancella solo quelli specificati
    for _, name := range names {
        del(name)
    }
}