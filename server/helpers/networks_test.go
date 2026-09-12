package helpers

import (
	"net"
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

// Un RemoteAddr privo di porta non è un errore: alcuni server lo passano già
// normalizzato, e scartarlo significherebbe perdere l'unico indirizzo noto.
func TestGetRealIPAccettaRemoteAddrSenzaPorta(t *testing.T) {
	r := requestFrom("203.0.113.10", nil)
	if got := GetRealIP(r); got != "203.0.113.10" {
		t.Fatalf("atteso 203.0.113.10, ottenuto %q", got)
	}
}

// Un RemoteAddr che non contiene un indirizzo valido non deve produrre una
// stringa arbitraria: quel valore finisce nei log e nelle quote, dove un
// indirizzo inventato è peggio di nessun indirizzo.
func TestGetRealIPRestituisceVuotoSuRemoteAddrNonValido(t *testing.T) {
	for _, raw := range []string{"", "non-un-indirizzo", "999.999.999.999:80"} {
		r := requestFrom(raw, nil)
		if got := GetRealIP(r); got != "" {
			t.Fatalf("da %q atteso vuoto, ottenuto %q", raw, got)
		}
	}
}

// Da un proxy fidato, una catena composta solo da valori non analizzabili non
// deve promuovere nessuno di essi: si ricade sull'indirizzo del peer.
func TestGetRealIPIgnoraElementiNonValidiNellaCatena(t *testing.T) {
	r := requestFrom("172.18.0.5:5555", map[string]string{
		"X-Forwarded-For": "non-un-ip, neanche-questo",
	})
	if got := GetRealIP(r); got != "172.18.0.5" {
		t.Fatalf("atteso 172.18.0.5, ottenuto %q", got)
	}
}

// Stessa condizione con un peer fidato il cui indirizzo non è analizzabile:
// non resta alcun indirizzo utilizzabile, e il risultato deve essere vuoto.
func TestGetRealIPRestituisceVuotoSenzaAlcunIndirizzoUtilizzabile(t *testing.T) {
	r := requestFrom("non-un-indirizzo", map[string]string{
		"X-Forwarded-For": "neanche-questo",
	})
	if got := GetRealIP(r); got != "" {
		t.Fatalf("atteso vuoto, ottenuto %q", got)
	}
}

// L'elenco delle reti fidate è configurabile: senza questa lettura il valore
// predefinito varrebbe anche su una topologia diversa, e il proxy reale non
// sarebbe riconosciuto.
func TestParseTrustedProxiesLeggeLAmbiente(t *testing.T) {
	t.Setenv("TRUSTED_PROXY_CIDRS", "192.0.2.0/24, non-un-cidr ,198.51.100.0/24")
	reti := parseTrustedProxies()

	if len(reti) != 2 {
		t.Fatalf("attese 2 reti valide, ottenute %d", len(reti))
	}
	// Le voci non analizzabili vengono scartate senza interrompere le altre:
	// una configurazione con un refuso non deve azzerare la fiducia sul proxy.
	for _, caso := range []struct {
		ip     string
		atteso bool
	}{
		{"192.0.2.7", true},
		{"198.51.100.7", true},
		{"203.0.113.7", false},
	} {
		ip := net.ParseIP(caso.ip)
		trovato := false
		for _, n := range reti {
			if n.Contains(ip) {
				trovato = true
			}
		}
		if trovato != caso.atteso {
			t.Fatalf("%s: atteso %v, ottenuto %v", caso.ip, caso.atteso, trovato)
		}
	}
}

// Un indirizzo assente non appartiene ad alcuna rete fidata. Senza questo
// controllo la funzione dereferenzierebbe un valore nullo.
func TestIsTrustedProxyRifiutaIndirizzoAssente(t *testing.T) {
	if isTrustedProxy(nil) {
		t.Fatal("un indirizzo assente non deve risultare fidato")
	}
}

// Un ingresso che non è un indirizzo non deve produrre un risultato: scriverlo
// negli indici significherebbe conservare un dato inventato.
func TestAnonymizeIPRifiutaIngressiNonValidi(t *testing.T) {
	for _, raw := range []string{"", "  ", "non-un-ip", "1.2.3", "::gg"} {
		if got := AnonymizeIP(raw); got != "" {
			t.Fatalf("da %q atteso vuoto, ottenuto %q", raw, got)
		}
	}
}
