package helpers

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestSessionCookieFlags(t *testing.T) {
	c := NewSessionCookie("token-di-prova", time.Now().Add(time.Hour))

	if !c.HttpOnly {
		t.Error("HttpOnly deve essere true: rende il cookie non leggibile da JavaScript")
	}
	if !c.Secure {
		t.Error("Secure deve essere true per default: limita l'invio del cookie a HTTPS")
	}
	if c.SameSite != http.SameSiteLaxMode {
		t.Errorf("SameSite atteso Lax, ottenuto %v", c.SameSite)
	}
	if c.Path != "/" {
		t.Errorf("Path atteso /, ottenuto %q", c.Path)
	}
	if c.Name != SessionCookieName {
		t.Errorf("nome atteso %q, ottenuto %q", SessionCookieName, c.Name)
	}
}

// Il browser identifica un cookie anche per Path, Secure e SameSite: un cookie
// di cancellazione con attributi diversi ne crea uno nuovo invece di
// sovrascrivere quello esistente.
func TestDeleteCookiesUsaGliStessiAttributi(t *testing.T) {
	rec := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/", nil)

	DeleteCookies(rec, r, SessionCookieName)

	cookies := rec.Result().Cookies()
	if len(cookies) != 1 {
		t.Fatalf("atteso 1 cookie, ottenuti %d", len(cookies))
	}

	originale := NewSessionCookie("x", time.Now())
	del := cookies[0]

	if del.HttpOnly != originale.HttpOnly {
		t.Errorf("HttpOnly non combacia: %v contro %v", del.HttpOnly, originale.HttpOnly)
	}
	if del.Secure != originale.Secure {
		t.Errorf("Secure non combacia: %v contro %v", del.Secure, originale.Secure)
	}
	if del.SameSite != originale.SameSite {
		t.Errorf("SameSite non combacia: %v contro %v", del.SameSite, originale.SameSite)
	}
	if del.Path != originale.Path {
		t.Errorf("Path non combacia: %q contro %q", del.Path, originale.Path)
	}
	if del.MaxAge >= 0 {
		t.Errorf("MaxAge deve essere negativo per invalidare il cookie, ottenuto %d", del.MaxAge)
	}
}
