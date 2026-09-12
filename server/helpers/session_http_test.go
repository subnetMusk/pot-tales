package helpers

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/redis/go-redis/v9"
)

func TestExtractToken(t *testing.T) {
	casi := []struct {
		nome      string
		cookie    *http.Cookie
		atteso    string
		erroreAtt error
	}{
		{
			nome:   "cookie presente",
			cookie: &http.Cookie{Name: SessionCookieName, Value: "abc123"},
			atteso: "abc123",
		},
		{
			nome:      "nessun cookie",
			erroreAtt: ErrTokenMissing,
		},
		{
			// Un cookie con un altro nome non e' il nostro: accettarlo
			// significherebbe farsi dettare l'identita' dal client.
			nome:      "cookie con nome diverso",
			cookie:    &http.Cookie{Name: "altro", Value: "abc123"},
			erroreAtt: ErrTokenMissing,
		},
		{
			nome:   "cookie presente ma vuoto",
			cookie: &http.Cookie{Name: SessionCookieName, Value: ""},
			atteso: "",
		},
	}

	for _, c := range casi {
		t.Run(c.nome, func(t *testing.T) {
			r := httptest.NewRequest(http.MethodGet, "/", nil)
			if c.cookie != nil {
				r.AddCookie(c.cookie)
			}

			got, err := ExtractToken(r)
			if c.erroreAtt != nil {
				if !errors.Is(err, c.erroreAtt) {
					t.Fatalf("errore = %v, atteso %v", err, c.erroreAtt)
				}
				return
			}
			if err != nil {
				t.Fatalf("errore inatteso: %v", err)
			}
			if got != c.atteso {
				t.Errorf("token = %q, atteso %q", got, c.atteso)
			}
		})
	}
}

func TestWriteJSON(t *testing.T) {
	w := httptest.NewRecorder()
	WriteJSON(w, http.StatusCreated, map[string]any{"stato": "creato", "quante": 2})

	if w.Code != http.StatusCreated {
		t.Errorf("codice = %d, atteso %d", w.Code, http.StatusCreated)
	}
	// Senza il tipo di contenuto il client indovina, e alcuni browser applicano
	// il rilevamento automatico: e' proprio cio' che `nosniff` deve impedire.
	if ct := w.Header().Get("Content-Type"); ct != "application/json" {
		t.Errorf("Content-Type = %q, atteso application/json", ct)
	}

	var corpo map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &corpo); err != nil {
		t.Fatalf("corpo non in formato JSON: %v", err)
	}
	if corpo["stato"] != "creato" || corpo["quante"] != float64(2) {
		t.Errorf("corpo = %v", corpo)
	}
}

// Senza nomi espliciti vanno invalidati tutti i cookie presenti nella
// richiesta: e' il comportamento su cui si appoggia la chiusura di sessione.
func TestDeleteCookiesSenzaNomiInvalidaTutti(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.AddCookie(&http.Cookie{Name: "primo", Value: "a"})
	r.AddCookie(&http.Cookie{Name: "secondo", Value: "b"})

	w := httptest.NewRecorder()
	DeleteCookies(w, r)

	impostati := w.Result().Cookies()
	if len(impostati) != 2 {
		t.Fatalf("cookie invalidati = %d, attesi 2", len(impostati))
	}
	for _, c := range impostati {
		if c.Value != "" || c.MaxAge != -1 {
			t.Errorf("cookie %q non invalidato: valore=%q maxAge=%d", c.Name, c.Value, c.MaxAge)
		}
	}
}

func TestDeleteCookiesConNomiInvalidaSoloQuelli(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.AddCookie(&http.Cookie{Name: "primo", Value: "a"})
	r.AddCookie(&http.Cookie{Name: "secondo", Value: "b"})

	w := httptest.NewRecorder()
	DeleteCookies(w, r, "primo")

	impostati := w.Result().Cookies()
	if len(impostati) != 1 {
		t.Fatalf("cookie invalidati = %d, atteso 1", len(impostati))
	}
	if impostati[0].Name != "primo" {
		t.Errorf("invalidato %q invece di primo", impostati[0].Name)
	}
}

// La cache di sessione risponde senza interrogare la base dati: e' la ragione
// per cui esiste, e una regressione qui si manifesterebbe come carico sul
// database anziche' come errore.
func TestValidateSessionPercorsoRapidoSuCache(t *testing.T) {
	client, srv := redisDiProva(t)
	// Nessuna collection: se il percorso rapido non funzionasse, il metodo
	// tenterebbe la base dati e il test fallirebbe invece di passare per caso.
	sm := NewSessionManager(client, nil)

	if err := srv.Set("sess:token-vivo", "1"); err != nil {
		t.Fatalf("preparazione della cache: %v", err)
	}

	got, err := sm.ValidateSession(context.Background(), "token-vivo")
	if err != nil {
		t.Fatalf("errore inatteso: %v", err)
	}
	if got != "token-vivo" {
		t.Errorf("token = %q, atteso token-vivo", got)
	}
}

func TestNewSessionManagerConservaLeDipendenze(t *testing.T) {
	client := redis.NewClient(&redis.Options{Addr: "127.0.0.1:0"})
	t.Cleanup(func() { _ = client.Close() })

	sm := NewSessionManager(client, nil)
	if sm == nil {
		t.Fatal("costruttore ha restituito nil")
	}
	if sm.rdb != client {
		t.Error("il client della cache non e' quello iniettato")
	}
}

// La difficolta' e' un parametro di costruzione: esporla in lettura serve a
// comunicarla al client, che senza non saprebbe quanto lavoro svolgere.
func TestPoWDifficultyRestituisceIlValoreDiCostruzione(t *testing.T) {
	client, _ := redisDiProva(t)
	for _, atteso := range []uint{0, 4, 12} {
		p := NewPoW("segreto", atteso, time.Minute, client)
		if got := p.Difficulty(); got != atteso {
			t.Errorf("Difficulty() = %d, attesa %d", got, atteso)
		}
	}
}

// Il nome del cookie e' un contratto con il frontend: cambiarlo scollega le
// sessioni esistenti senza che nulla fallisca in compilazione.
func TestNomeDelCookieStabile(t *testing.T) {
	if SessionCookieName != "session_token" {
		t.Errorf("nome del cookie = %q: cambiarlo invalida le sessioni in corso", SessionCookieName)
	}
	c := NewSessionCookie("v", time.Now().Add(time.Hour))
	if c.Name != SessionCookieName {
		t.Errorf("il cookie costruito usa il nome %q", c.Name)
	}
	if !strings.HasPrefix(c.Path, "/") {
		t.Errorf("percorso del cookie = %q", c.Path)
	}
}
