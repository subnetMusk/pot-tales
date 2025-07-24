// ===================================================
// server/middleware/validator.go
// ===================================================
// Validator per la validazione dei body JSON e whitelist delle rotte.
// Utilizza gli schemi *.req.json per le rotte esposte.
// Se uno schema non è registrato, la rotta viene bloccata.
// Se il body non rispetta lo schema, restituisce 400 Bad Request.
// ---------------------------------------------------


package middleware

import (
	"bytes"
	"encoding/json"
	"io"
	"io/fs"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/santhosh-tekuri/jsonschema/v5"
	"github.com/subnetMusk/progetti_innovativi/server/helpers"
)

// exposedRoutes elenca le sole rotte accessibili dall’esterno.
var exposedRoutes = map[string]struct{}{
	http.MethodPost + " /auth/session": {},
	http.MethodGet  + " /auth/validate": {},
	http.MethodGet  + " /health":        {},
}

// Validator incapsula gli schemi per la validazione.
type Validator struct {
	schema map[string]*jsonschema.Schema // key = "METHOD /route"
}


// MustNew compila tutti gli schemi *.req.json presenti in baseDir.
//  - Gli schemi di rotte NON presenti in exposedRoutes vengono ignorati.
//  - Se anche una sola rotta esposta non ha il relativo schema → panic.
func MustNew(baseDir string) *Validator {
	// Fail-fast se la directory non esiste.
	if fi, err := os.Stat(baseDir); err != nil || !fi.IsDir() {
		panic("schema directory not found or not a directory: " + baseDir)
	}

	log.Printf("[validator] loading JSON Schemas from %s", baseDir)
	v := &Validator{schema: make(map[string]*jsonschema.Schema)}

	err := filepath.WalkDir(baseDir, func(p string, d fs.DirEntry, walkErr error) error {
		if walkErr != nil || d.IsDir() || !strings.HasSuffix(p, ".req.json") {
			return walkErr // skip dir / non-json / propagate fs error
		}

		method, path := inferRoute(p)
		key := method + " " + path

		// Schema non destinato a questo servizio → ignora.
		if _, ok := exposedRoutes[key]; !ok {
			return nil
		}

		s, err := jsonschema.Compile(p)
		if err != nil {
			panic(err)
		}
		v.schema[key] = s
		return nil
	})
	if err != nil {
		panic("walking schema directory: " + err.Error())
	}

	// Fail-fast se manca lo schema di QUALSIASI rotta esposta.
	for key := range exposedRoutes {
		if _, ok := v.schema[key]; !ok {
			panic("missing schema for exposed route: " + key)
		}
	}
	return v
}

// inferRoute traduce il percorso <baseDir>/<feature>/<name>.req.json
// in “METHOD” e “/route”.
func inferRoute(f string) (string, string) {
	base := filepath.Base(f)                    // es. health.req.json
	action := strings.TrimSuffix(base, ".req.json")
	feature := filepath.Base(filepath.Dir(f))  // es. health

	switch feature {
	case "health":
		return http.MethodGet, "/health"
	case "auth":
		switch action {
		case "session":
			return http.MethodPost, "/auth/session"
		case "validate":
			return http.MethodGet, "/auth/validate"
		}
	}
	panic("unmapped schema: " + f)
}

// Middleware valida il body JSON (se esiste uno schema) e blocca rotte non esposte.
func (v *Validator) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		key := r.Method + " " + r.URL.Path

		// 1. route whitelist
		if _, allowed := exposedRoutes[key]; !allowed {
			helpers.WriteJSON(w, http.StatusNotFound,
				map[string]string{"error": "route not found"})
			return
		}

		// 2. schema validation (solo se registrato)
		if schema, ok := v.schema[key]; ok {
			body, _ := io.ReadAll(r.Body)
			if len(body) == 0 {
				body = []byte("{}")
			}
			// ripristina Body per gli handler successivi
			r.Body = io.NopCloser(bytes.NewReader(body))

			var data any
			if err := json.Unmarshal(body, &data); err != nil {
				helpers.WriteJSON(w, http.StatusBadRequest,
					map[string]string{"error": "invalid json: " + err.Error()})
				return
			}
			if err := schema.Validate(data); err != nil {
				helpers.WriteJSON(w, http.StatusBadRequest,
					map[string]string{"error": "schema validation failed: " + err.Error()})
				return
			}
		}

		// 3. avanti verso l’handler effettivo
		next.ServeHTTP(w, r)
	})
}