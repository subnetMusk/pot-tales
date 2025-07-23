// ===================================================
// server/middleware/validator.go
// ===================================================
// Carica *.req.json da /app/comms e valida il body
// delle richieste.  Package:  middleware
// ---------------------------------------------------
package middleware

import (
	"bytes"
	"io"
	"net/http"
	"path/filepath"
	"strings"

	"github.com/santhosh-tekuri/jsonschema/v5"
)

type Validator struct {
	schema map[string]*jsonschema.Schema // key = "METHOD /route"
}

// MustNew panics on compile errors; suitable for service start-up.
func MustNew(baseDir string) *Validator {
	v := &Validator{schema: make(map[string]*jsonschema.Schema)}

	files, _ := filepath.Glob(filepath.Join(baseDir, "**/*.req.json"))
	for _, p := range files {
		method, path := inferRoute(p)
		key := method + " " + path
		s, err := jsonschema.Compile(p)
		if err != nil {
			panic(err)
		}
		v.schema[key] = s
	}
	return v
}

func (v *Validator) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if s, ok := v.schema[r.Method+" "+r.URL.Path]; ok {
			body, _ := io.ReadAll(r.Body)

			// ① Fallback a {} SOLO se il body è effettivamente vuoto
			if len(body) == 0 {
				body = []byte("{}")
			}

			// ② Rimonta SEMPRE r.Body con la versione finale di `body`
			r.Body = io.NopCloser(bytes.NewReader(body))

			// ③ Valida il JSON appena preparato
			if err := s.Validate(bytes.NewReader(body)); err != nil {
				http.Error(w, "schema error: "+err.Error(), http.StatusBadRequest)
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}

// helper: map schema path → HTTP method + route
func inferRoute(f string) (string, string) {
	base := filepath.Base(f)                  // e.g. session.req.json
	action := strings.TrimSuffix(base, ".req.json")
	feature := filepath.Base(filepath.Dir(f)) // e.g. auth

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
