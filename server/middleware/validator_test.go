package middleware

import (
	"bytes"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
)

// validatorConRotte costruisce un Validator senza schemi né SessionManager:
// whitelist e limite sul body non dipendono da questi.
func validatorConRotte(rotte ...RouteConfig) *Validator {
	v := &Validator{
		routesConfig: make(map[string]RouteConfig),
	}
	for _, r := range rotte {
		v.routesConfig[r.Method+" "+r.Path] = r
	}
	return v
}

// Il limite deve valere anche per gli handler che leggono il body per conto
// proprio, non solo per la validazione di schema.
func TestLimiteSulBodyValeAnchePerGliHandler(t *testing.T) {
	v := validatorConRotte(RouteConfig{Method: http.MethodPost, Path: "/log"})

	var readErr error
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, readErr = io.ReadAll(r.Body)
	})

	body := bytes.Repeat([]byte("a"), int(maxBodyBytes)+1)
	req := httptest.NewRequest(http.MethodPost, "/log", bytes.NewReader(body))
	rec := httptest.NewRecorder()

	v.Handler(next).ServeHTTP(rec, req)

	var tooLarge *http.MaxBytesError
	if !errors.As(readErr, &tooLarge) {
		t.Fatalf("attesa lettura fallita oltre il limite, errore ottenuto: %v", readErr)
	}
}

func TestBodySottoIlLimitePassa(t *testing.T) {
	v := validatorConRotte(RouteConfig{Method: http.MethodPost, Path: "/log"})

	var letti int
	var readErr error
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		b, err := io.ReadAll(r.Body)
		letti, readErr = len(b), err
	})

	body := bytes.Repeat([]byte("a"), 1024)
	req := httptest.NewRequest(http.MethodPost, "/log", bytes.NewReader(body))
	rec := httptest.NewRecorder()

	v.Handler(next).ServeHTTP(rec, req)

	if readErr != nil {
		t.Fatalf("lettura fallita su un body entro il limite: %v", readErr)
	}
	if letti != 1024 {
		t.Fatalf("letti %d byte, attesi 1024", letti)
	}
}

// Una rotta non dichiarata nella whitelist non deve essere raggiungibile,
// anche se un handler è registrato nel router.
func TestRottaFuoriWhitelistRisponde404(t *testing.T) {
	v := validatorConRotte(RouteConfig{Method: http.MethodGet, Path: "/health"})

	chiamato := false
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		chiamato = true
	})

	req := httptest.NewRequest(http.MethodGet, "/rotta-non-dichiarata", nil)
	rec := httptest.NewRecorder()

	v.Handler(next).ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("atteso 404, ottenuto %d", rec.Code)
	}
	if chiamato {
		t.Fatal("handler a valle invocato per una rotta fuori whitelist")
	}
}

// Il metodo fa parte della chiave di whitelist.
func TestMetodoSbagliatoRisponde404(t *testing.T) {
	v := validatorConRotte(RouteConfig{Method: http.MethodGet, Path: "/game/timer", RequiresAuth: true})

	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatal("handler a valle invocato con metodo non dichiarato")
	})

	req := httptest.NewRequest(http.MethodPost, "/game/timer", nil)
	rec := httptest.NewRecorder()

	v.Handler(next).ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("atteso 404, ottenuto %d", rec.Code)
	}
}

func TestRottaAutenticataSenzaCookieRisponde401(t *testing.T) {
	v := validatorConRotte(RouteConfig{Method: http.MethodGet, Path: "/game/timer", RequiresAuth: true})

	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatal("handler a valle invocato senza sessione valida")
	})

	req := httptest.NewRequest(http.MethodGet, "/game/timer", nil)
	rec := httptest.NewRecorder()

	v.Handler(next).ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("atteso 401, ottenuto %d", rec.Code)
	}
}
