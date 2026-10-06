package middleware

import (
	"bytes"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/santhosh-tekuri/jsonschema/v5"
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
	v := validatorConRotte(RouteConfig{Method: http.MethodPost, Path: "/body-test"})

	var readErr error
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, readErr = io.ReadAll(r.Body)
	})

	body := bytes.Repeat([]byte("a"), int(maxBodyBytes)+1)
	req := httptest.NewRequest(http.MethodPost, "/body-test", bytes.NewReader(body))
	// Lunghezza non dichiarata, come in un corpo chunked: il rifiuto anticipato
	// non scatta e il limite resta affidato alla lettura.
	req.ContentLength = -1
	rec := httptest.NewRecorder()

	v.Handler(next).ServeHTTP(rec, req)

	var tooLarge *http.MaxBytesError
	if !errors.As(readErr, &tooLarge) {
		t.Fatalf("attesa lettura fallita oltre il limite, errore ottenuto: %v", readErr)
	}
}

// lettoreSpia registra se il body è stato letto.
type lettoreSpia struct {
	io.Reader
	letto bool
}

func (l *lettoreSpia) Read(p []byte) (int, error) {
	l.letto = true
	return l.Reader.Read(p)
}

// Con una lunghezza dichiarata oltre il limite il rifiuto deve arrivare prima
// di qualunque lettura: leggere farebbe partire il 100 Continue verso il client.
func TestContentLengthOltreIlLimiteRespintoSenzaLeggere(t *testing.T) {
	v := validatorConRotte(RouteConfig{Method: http.MethodPost, Path: "/body-test"})

	chiamato := false
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		chiamato = true
	})

	spia := &lettoreSpia{Reader: bytes.NewReader(bytes.Repeat([]byte("a"), int(maxBodyBytes)+1))}
	req := httptest.NewRequest(http.MethodPost, "/body-test", spia)
	req.ContentLength = maxBodyBytes + 1
	rec := httptest.NewRecorder()

	v.Handler(next).ServeHTTP(rec, req)

	if rec.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("status %d, atteso %d", rec.Code, http.StatusRequestEntityTooLarge)
	}
	if spia.letto {
		t.Fatal("body letto nonostante la lunghezza dichiarata oltre il limite")
	}
	if chiamato {
		t.Fatal("richiesta sovradimensionata arrivata all'handler")
	}
}

// Senza lunghezza dichiarata il superamento emerge durante la validazione di
// schema, e deve restare un 413 distinto dall'errore di schema.
func TestBodySenzaLunghezzaOltreIlLimiteRisponde413(t *testing.T) {
	v := validatorConRotte(RouteConfig{Method: http.MethodPost, Path: "/auth/session"})
	v.routesSchema = map[string]*jsonschema.Schema{
		http.MethodPost + " /auth/session": jsonschema.MustCompileString("schema.json", `{"type":"object"}`),
	}

	chiamato := false
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		chiamato = true
	})

	body := bytes.Repeat([]byte("a"), int(maxBodyBytes)+1)
	req := httptest.NewRequest(http.MethodPost, "/auth/session", bytes.NewReader(body))
	req.ContentLength = -1
	rec := httptest.NewRecorder()

	v.Handler(next).ServeHTTP(rec, req)

	if rec.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("status %d, atteso %d", rec.Code, http.StatusRequestEntityTooLarge)
	}
	if chiamato {
		t.Fatal("richiesta sovradimensionata arrivata all'handler")
	}
}

func TestBodySottoIlLimitePassa(t *testing.T) {
	v := validatorConRotte(RouteConfig{Method: http.MethodPost, Path: "/body-test"})

	var letti int
	var readErr error
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		b, err := io.ReadAll(r.Body)
		letti, readErr = len(b), err
	})

	body := bytes.Repeat([]byte("a"), 1024)
	req := httptest.NewRequest(http.MethodPost, "/body-test", bytes.NewReader(body))
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
	v := validatorConRotte(RouteConfig{Method: http.MethodGet, Path: "/game/position", RequiresAuth: true})

	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatal("handler a valle invocato con metodo non dichiarato")
	})

	req := httptest.NewRequest(http.MethodPost, "/game/position", nil)
	rec := httptest.NewRecorder()

	v.Handler(next).ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("atteso 404, ottenuto %d", rec.Code)
	}
}

func TestRottaAutenticataSenzaCookieRisponde401(t *testing.T) {
	v := validatorConRotte(RouteConfig{Method: http.MethodGet, Path: "/game/position", RequiresAuth: true})

	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatal("handler a valle invocato senza sessione valida")
	})

	req := httptest.NewRequest(http.MethodGet, "/game/position", nil)
	rec := httptest.NewRecorder()

	v.Handler(next).ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("atteso 401, ottenuto %d", rec.Code)
	}
}
