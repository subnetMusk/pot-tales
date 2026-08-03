package helpers

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func requestFrom(remoteAddr string, headers map[string]string) *http.Request {
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.RemoteAddr = remoteAddr
	for k, v := range headers {
		r.Header.Set(k, v)
	}
	return r
}

// Da un peer non fidato l'header non deve avere alcun effetto: vale RemoteAddr.
func TestGetRealIPIgnoraXFFDaPeerNonFidato(t *testing.T) {
	r := requestFrom("203.0.113.10:5555", map[string]string{
		"X-Forwarded-For": "1.2.3.4",
	})
	if got := GetRealIP(r); got != "203.0.113.10" {
		t.Fatalf("atteso 203.0.113.10, ottenuto %q", got)
	}
}

// Il proxy accoda l'indirizzo del peer, quindi il primo elemento della catena
// è il valore inviato dal client e non va usato.
func TestGetRealIPScartaIlPrefissoArbitrario(t *testing.T) {
	r := requestFrom("172.18.0.5:5555", map[string]string{
		"X-Forwarded-For": "1.2.3.4, 203.0.113.10",
	})
	if got := GetRealIP(r); got != "203.0.113.10" {
		t.Fatalf("atteso 203.0.113.10, ottenuto %q", got)
	}
}

// Con più proxy fidati in catena si risale fino al primo indirizzo che non
// appartiene a una rete fidata.
func TestGetRealIPRisaleLaCatenaDiProxyFidati(t *testing.T) {
	r := requestFrom("172.18.0.5:5555", map[string]string{
		"X-Forwarded-For": "203.0.113.10, 10.1.2.3, 172.18.0.9",
	})
	if got := GetRealIP(r); got != "203.0.113.10" {
		t.Fatalf("atteso 203.0.113.10, ottenuto %q", got)
	}
}

// Catena composta solo da indirizzi fidati: la richiesta ha origine interna.
func TestGetRealIPCatenaTuttaInterna(t *testing.T) {
	r := requestFrom("172.18.0.5:5555", map[string]string{
		"X-Forwarded-For": "172.18.0.7",
	})
	if got := GetRealIP(r); got != "172.18.0.7" {
		t.Fatalf("atteso 172.18.0.7, ottenuto %q", got)
	}
}

func TestGetRealIPIgnoraXRealIP(t *testing.T) {
	r := requestFrom("172.18.0.5:5555", map[string]string{
		"X-Real-IP": "1.2.3.4",
	})
	if got := GetRealIP(r); got != "172.18.0.5" {
		t.Fatalf("atteso 172.18.0.5, ottenuto %q", got)
	}
}

func TestAnonymizeIP(t *testing.T) {
	casi := []struct {
		nome   string
		in     string
		atteso string
	}{
		{"ipv4 ultimo ottetto azzerato", "203.0.113.42", "203.0.113.0"},
		{"ipv4 già azzerato", "203.0.113.0", "203.0.113.0"},
		{"ipv6 conserva il /48", "2001:db8:1234:5678::1", "2001:db8:1234::"},
		{"spazi in eccesso", "  203.0.113.42  ", "203.0.113.0"},
		{"stringa vuota", "", ""},
		{"non è un indirizzo", "non-un-ip", ""},
	}

	for _, c := range casi {
		t.Run(c.nome, func(t *testing.T) {
			if got := AnonymizeIP(c.in); got != c.atteso {
				t.Fatalf("AnonymizeIP(%q) = %q, atteso %q", c.in, got, c.atteso)
			}
		})
	}
}

func TestAnonymizeIPNonConservaLUltimoOttetto(t *testing.T) {
	for _, ip := range []string{"1.2.3.4", "192.168.1.255", "8.8.8.8"} {
		got := AnonymizeIP(ip)
		if got == ip {
			t.Fatalf("AnonymizeIP(%q) ha restituito l'indirizzo invariato", ip)
		}
		if got[len(got)-2:] != ".0" {
			t.Fatalf("AnonymizeIP(%q) = %q: non termina con .0", ip, got)
		}
	}
}
