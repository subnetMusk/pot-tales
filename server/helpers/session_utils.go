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
	"os"
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
	// AnalyticsConsentKey rende disponibile la scelta facoltativa agli handler
	// senza confonderla con la validità della sessione tecnica.
	AnalyticsConsentKey ContextKey = "analyticsConsent"

	// SessionTTL e' la durata piena predefinita della sessione, usata quando
	// SESSION_TTL_MIN non e' impostata.
	SessionTTL = 30 * time.Minute

	// Risposte di Redis a TTL per una chiave assente o senza scadenza: la
	// libreria le restituisce come durate di -2 e -1 nanosecondi.
	ttlChiaveAssente = -2 * time.Nanosecond
	ttlSenzaScadenza = -1 * time.Nanosecond
)

const (
	sessionCacheAnalytics = "analytics"
	sessionCacheNecessary = "necessary"
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

	// Durata piena della sessione, la stessa che il router dichiara nel cookie.
	ttl time.Duration
}

// NewSessionManager crea una nuova istanza del manager con le dipendenze iniettate.
//
// La durata piena si legge da SESSION_TTL_MIN, come nel router che imposta il
// cookie: con due valori distinti browser e server smetterebbero di considerare
// valida la sessione in momenti diversi.
func NewSessionManager(rdb *redis.Client, col *mongo.Collection) *SessionManager {
	return &SessionManager{
		rdb:      rdb,
		mongoCol: col,
		ttl:      time.Duration(EnvInt("SESSION_TTL_MIN", int(SessionTTL/time.Minute))) * time.Minute,
	}
}

// ValidateSession verifica se il token è valido.
// 1. Controlla Redis (Fast Path).
// 2. Controlla MongoDB (Slow Path/Source of Truth).
// 3. Esegue il refresh asincrono (Sliding Window).
// Restituisce il token stesso (che funge da ID) se valido.
func (sm *SessionManager) ValidateSession(ctx context.Context, token string) (string, error) {
	// 1. Fast Path: Redis
	//
	// Oltre all'esistenza della chiave si legge la durata residua. La sessione
	// nasce con una durata ridotta, pensata per quelle create e mai usate, e la
	// prima richiesta autenticata deve portarla alla durata piena: senza, una
	// partita in corso scadrebbe allo scadere di quella durata, con ping e
	// traguardi respinti a meta' gioco e nessuna partita da riprendere.
	//
	// Il prolungamento parte quando resta meno di meta' della durata piena: la
	// prima richiesta dopo la creazione lo ottiene sempre, le successive lo
	// rinnovano al piu' una volta ogni mezza durata invece che a ogni ping, che
	// raddoppierebbe le scritture sulla base dati.
	if residuo, err := sm.rdb.TTL(ctx, "sess:"+token).Result(); err == nil && residuo != ttlChiaveAssente {
		if residuo != ttlSenzaScadenza && residuo < sm.ttl/2 {
			go sm.refreshSessionAsync(token, nil)
		}
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
	go sm.refreshSessionAsync(token, &doc.ConsentGiven)

	return token, nil
}

// refreshSessionAsync estende il TTL su Redis e MongoDB.
// È un metodo privato, gestito internamente dal Manager.
func (sm *SessionManager) refreshSessionAsync(token string, consent *bool) {
	// Usiamo un contesto slegato dalla richiesta HTTP originale
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Redis: sul percorso rapido prolunga la chiave senza sovrascrivere la
	// scelta. Sul percorso Mongo ricrea invece valore e TTL insieme.
	var redisErr error
	if consent == nil {
		redisErr = sm.rdb.Expire(ctx, "sess:"+token, sm.ttl).Err()
	} else {
		redisErr = sm.rdb.Set(ctx, "sess:"+token, SessionCacheValue(*consent), sm.ttl).Err()
	}
	if redisErr != nil {
		log.Printf("[session] redis refresh failed for %s: %v", token, redisErr)
	}

	// MongoDB: Estensione expires_at
	newExpiry := time.Now().Add(sm.ttl)
	_, err := sm.mongoCol.UpdateOne(
		ctx,
		bson.M{"_id": token},
		bson.M{"$set": bson.M{"expires_at": newExpiry}},
	)
	if err != nil {
		log.Printf("[session] mongo extend failed for %s: %v", token, err)
	}
}

// SessionCacheValue codifica nella cache la sola distinzione necessaria al
// logging. Non contiene dati identificativi aggiuntivi rispetto alla chiave.
func SessionCacheValue(consent bool) string {
	if consent {
		return sessionCacheAnalytics
	}
	return sessionCacheNecessary
}

// AnalyticsConsent legge la scelta associata a una sessione. La cache è il
// percorso ordinario; Mongo resta la fonte di verità e copre sessioni create
// prima dell'introduzione del nuovo valore Redis.
func (sm *SessionManager) AnalyticsConsent(ctx context.Context, token string) (bool, error) {
	value, err := sm.rdb.Get(ctx, "sess:"+token).Result()
	if err == nil {
		switch value {
		case sessionCacheAnalytics:
			return true, nil
		case sessionCacheNecessary:
			return false, nil
		}
	} else if !errors.Is(err, redis.Nil) {
		return false, err
	}

	var doc struct {
		ConsentGiven bool `bson:"consent_given"`
	}
	if err := sm.mongoCol.FindOne(ctx, bson.M{"_id": token}).Decode(&doc); err != nil {
		return false, err
	}
	return doc.ConsentGiven, nil
}

// WithAnalyticsConsent applica la scelta a un contesto di richiesta o job.
func WithAnalyticsConsent(ctx context.Context, consent bool) context.Context {
	return context.WithValue(ctx, AnalyticsConsentKey, consent)
}

// HasAnalyticsConsent è volutamente conservativa: un contesto che non porta
// una scelta esplicita non può produrre eventi analitici.
func HasAnalyticsConsent(ctx context.Context) bool {
	consent, ok := ctx.Value(AnalyticsConsentKey).(bool)
	return ok && consent
}

// --- Helper Stateless (Funzioni pure di utilità HTTP) ---

// SessionCookieName è il nome dell'unico cookie impostato dal backend.
const SessionCookieName = "session_token"

// cookieSecure vale true salvo COOKIE_SECURE="false". Il default marca il
// cookie come Secure, quindi il browser lo invia solo su HTTPS; va disattivato
// negli ambienti serviti su HTTP, dove altrimenti il cookie viene scartato.
var cookieSecure = os.Getenv("COOKIE_SECURE") != "false"

// NewSessionCookie costruisce il cookie di sessione con i relativi attributi
// di sicurezza, mantenendoli definiti in un unico punto.
func NewSessionCookie(value string, expires time.Time) *http.Cookie {
	return &http.Cookie{
		Name:     SessionCookieName,
		Value:    value,
		Path:     "/",
		Expires:  expires,
		HttpOnly: true,
		Secure:   cookieSecure,
		SameSite: http.SameSiteLaxMode,
	}
}

// ExtractToken legge il cookie di sessione.
func ExtractToken(r *http.Request) (string, error) {
	c, err := r.Cookie(SessionCookieName)
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
			// Gli attributi devono combaciare con quelli del cookie da
			// invalidare: il browser identifica un cookie anche per Path,
			// Secure e SameSite, e con attributi diversi ne creerebbe uno nuovo
			// lasciando valido quello originale.
			Secure:   cookieSecure,
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
