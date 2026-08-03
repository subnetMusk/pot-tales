// ===================================================
// server/middleware/validator.go
// ===================================================
// Gestisce la whitelist delle rotte, la validazione JSON
// e delega l'autenticazione al SessionManager.
// ===================================================

package middleware

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"github.com/santhosh-tekuri/jsonschema/v5"
	"github.com/subnetMusk/progetti_innovativi/server/helpers"
)

// RouteConfig definisce le regole per ogni endpoint.
type RouteConfig struct {
	Method       string
	Path         string
	SchemaFile   string // Path relativo a baseDir (es. "public/auth/login.req.json")
	RequiresAuth bool   // Se true, blocca la richiesta se la sessione non è valida

	// Quota richieste per sessione nella finestra configurata. Zero disattiva
	// il controllo.
	//
	// La quota e' per sessione e non per indirizzo: un indirizzo pubblico e'
	// condiviso da tutti gli utenti dietro lo stesso NAT, quindi un limite per
	// indirizzo penalizzerebbe utenti estranei a chi lo supera.
	QuotaPerWindow int64
}

// Configurazione delle rotte esposte.
// I percorsi JSON includono "public/" come da struttura del file system.
var appRoutes = []RouteConfig{
	// --- Auth Feature ---
	// La creazione di sessioni ha un controllo dedicato nel proprio handler.
	{http.MethodPost, "/auth/session", "public/auth/session.req.json", false, 0},
	{http.MethodGet, "/auth/validate", "public/auth/validate.req.json", true, 600},

	// --- Game Feature ---
	{http.MethodGet, "/game/position", "public/game/position.req.json", true, 1200},
	{http.MethodGet, "/game/timer", "public/game/timer.req.json", true, 1200},

	// --- Health Feature ---
	{http.MethodGet, "/health", "public/health/health.req.json", false, 0},

	// --- Logging Feature ---
	// Endpoint per ricevere log dal frontend. Senza auth stretto per loggare errori di login.
	{http.MethodPost, "/log", "", false, 0}, // Schema opzionale per ora
}

// Validator mantiene lo stato necessario per la validazione.
type Validator struct {
	routesSchema map[string]*jsonschema.Schema
	routesConfig map[string]RouteConfig

	// Iniezione del Service: Il middleware non conosce i DB, parla solo col Manager.
	sessionMgr *helpers.SessionManager

	// Quote per sessione. Assente nei test, che non esercitano questo aspetto.
	limiter     *helpers.RateLimiter
	quotaWindow time.Duration
}

// WithQuota abilita le quote per sessione sulle rotte che le dichiarano.
func (v *Validator) WithQuota(limiter *helpers.RateLimiter, window time.Duration) *Validator {
	v.limiter = limiter
	v.quotaWindow = window
	return v
}

// MustNew inizializza il middleware.
// Richiede il SessionManager già istanziato (vedi main.go).
func MustNew(baseDir string, sm *helpers.SessionManager) *Validator {
	v := &Validator{
		routesSchema: make(map[string]*jsonschema.Schema),
		routesConfig: make(map[string]RouteConfig),
		sessionMgr:   sm,
	}

	slog.Info("initializing schemas", "baseDir", baseDir)

	for _, route := range appRoutes {
		// Chiave univoca per la rotta: "METHOD /path"
		key := route.Method + " " + route.Path
		v.routesConfig[key] = route

		// Se c'è uno schema JSON associato, lo compiliamo
		if route.SchemaFile != "" {
			fullPath := filepath.Join(baseDir, route.SchemaFile)

			// Fail-fast: se il file non esiste, panico all'avvio.
			if _, err := os.Stat(fullPath); err != nil {
				panic(fmt.Sprintf("Schema file missing for route %s: %s", key, fullPath))
			}

			compiler := jsonschema.NewCompiler()
			schema, err := compiler.Compile(fullPath)
			if err != nil {
				panic(fmt.Sprintf("Invalid schema for %s: %v", key, err))
			}
			v.routesSchema[key] = schema
			slog.Info("route registered", "route", key, "auth_required", route.RequiresAuth, "schema", "OK")
		} else {
			slog.Info("route registered", "route", key, "auth_required", route.RequiresAuth, "schema", "NONE")
		}
	}

	return v
}

// maxBodyBytes limita la quantità di dati letti dal corpo di una richiesta.
// Senza un tetto, la lettura completa del body permette a un singolo client di
// far crescere la memoria del processo in modo arbitrario. Configurabile con
// MAX_BODY_BYTES.
var maxBodyBytes = func() int64 {
	if v := os.Getenv("MAX_BODY_BYTES"); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil && n > 0 {
			return n
		}
	}
	return 64 << 10
}()

// Handler è il middleware principale che intercetta le richieste.
func (v *Validator) Handler(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Applicato prima di qualunque lettura. Sostituendo r.Body, il limite
		// vale anche per gli handler a valle.
		if r.Body != nil {
			r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)
		}

		key := r.Method + " " + r.URL.Path
		config, allowed := v.routesConfig[key]

		// 1. Whitelist Check (Security by Default)
		// Se la rotta non è mappata, restituiamo 404 immediato.
		if !allowed {
			helpers.WriteJSON(w, http.StatusNotFound, map[string]string{"error": "route not found"})
			return
		}

		// 2. Authentication Check (Delegata al SessionManager)
		if config.RequiresAuth {
			// A. Estrazione Token
			rawToken, err := helpers.ExtractToken(r)
			if err != nil {
				helpers.DeleteCookies(w, r, "session_token")
				helpers.WriteJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing session token"})
				return
			}

			// B. Validazione tramite Manager (Logica Redis/Mongo incapsulata)
			validTokenID, err := v.sessionMgr.ValidateSession(r.Context(), rawToken)
			if err != nil {
				helpers.DeleteCookies(w, r, "session_token")
				helpers.WriteJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid or expired session"})
				return
			}

			// C. Context Injection
			// Iniettiamo l'ID nel contesto per gli handler successivi
			ctx := context.WithValue(r.Context(), helpers.UserIDKey, validTokenID)
			r = r.WithContext(ctx)

			// D. Quota per sessione
			if v.limiter != nil && config.QuotaPerWindow > 0 {
				quotaKey := "quota:" + key + ":" + validTokenID
				ok, count, reset := v.limiter.Allow(ctx, quotaKey, config.QuotaPerWindow, v.quotaWindow)
				if !ok {
					helpers.LogBusiness(ctx, "security", "session_quota_exceeded", map[string]any{
						"route": key,
						"count": count,
						"limit": config.QuotaPerWindow,
					})
					w.Header().Set("Retry-After", strconv.Itoa(int(reset.Seconds())))
					helpers.WriteJSON(w, http.StatusTooManyRequests, map[string]string{
						"error": "session quota exceeded",
					})
					return
				}
			}
		}

		// 3. Schema Validation (Se presente)
		if schema, hasSchema := v.routesSchema[key]; hasSchema {
			if err := validateBody(r, schema); err != nil {
				// Il superamento del limite non è un errore di schema e va
				// segnalato con un codice di stato distinto.
				var tooLarge *http.MaxBytesError
				if errors.As(err, &tooLarge) {
					helpers.WriteJSON(w, http.StatusRequestEntityTooLarge, map[string]string{
						"error": "request body too large",
					})
					return
				}
				helpers.WriteJSON(w, http.StatusBadRequest, map[string]string{
					"error":   "schema validation failed",
					"details": err.Error(),
				})
				return
			}
		}

		// 4. Passaggio al prossimo handler
		next.ServeHTTP(w, r)
	})
}

// validateBody legge, valida e ripristina il body della richiesta.
func validateBody(r *http.Request, schema *jsonschema.Schema) error {
	bodyBytes, err := io.ReadAll(r.Body)
	if err != nil {
		// Propagato così com'è per permettere al chiamante di distinguere il
		// superamento del limite dagli altri errori di lettura.
		return err
	}

	// Gestione body vuoto per endpoint che si aspettano JSON (es. "{}")
	if len(bodyBytes) == 0 {
		bodyBytes = []byte("{}")
	}

	// Ripristina il body per l'handler successivo (io.ReadCloser è stream one-shot)
	r.Body = io.NopCloser(bytes.NewReader(bodyBytes))

	var data interface{}
	if err := json.Unmarshal(bodyBytes, &data); err != nil {
		return fmt.Errorf("invalid json format")
	}

	if err := schema.Validate(data); err != nil {
		return err
	}

	return nil
}
