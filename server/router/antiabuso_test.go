//go:build integration

// Prove del contenimento sulla creazione di sessioni.
//
// E' il meccanismo che sostituisce il blocco per indirizzo: dietro il NAT di
// una conferenza l'intera sala condivide una sola provenienza, e un rifiuto
// secco escluderebbe tutti i presenti al superamento della soglia. Al suo posto
// viene chiesta una prova di lavoro, che un visitatore risolve una volta e chi
// richiede sessioni in serie paga per ognuna.

package router

import (
	"crypto/sha256"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"testing"
)

// risolvi cerca una soluzione che porti il digest della sfida concatenata ad
// avere il numero richiesto di bit iniziali nulli. E' lo stesso lavoro che
// svolgerebbe il client.
func risolvi(t *testing.T, sfida string, difficolta uint) string {
	t.Helper()

	zeriIniziali := func(sum [32]byte, n uint) bool {
		interi := n / 8
		resto := n % 8
		for i := uint(0); i < interi; i++ {
			if sum[i] != 0 {
				return false
			}
		}
		if resto == 0 {
			return true
		}
		return sum[interi]>>(8-resto) == 0
	}

	for i := 0; i < 50_000_000; i++ {
		tentativo := strconv.Itoa(i)
		if zeriIniziali(sha256.Sum256([]byte(sfida+tentativo)), difficolta) {
			return tentativo
		}
	}
	t.Fatalf("nessuna soluzione trovata per difficolta' %d", difficolta)
	return ""
}

func creaConCorpo(t *testing.T, b *banco, intestazioni map[string]string) *http.Response {
	t.Helper()
	corpo := `{"device":"collaudo","consentGiven":true}`
	richiesta, err := http.NewRequest(http.MethodPost, b.server.URL+"/auth/session", strings.NewReader(corpo))
	if err != nil {
		t.Fatalf("costruzione della richiesta: %v", err)
	}
	richiesta.Header.Set("Content-Type", "application/json")
	for k, v := range intestazioni {
		richiesta.Header.Set(k, v)
	}
	risposta, err := http.DefaultClient.Do(richiesta)
	if err != nil {
		t.Fatalf("richiesta: %v", err)
	}
	return risposta
}

// Superata la soglia la risposta non e' un rifiuto ma una sfida: il visitatore
// legittimo prosegue, chi insiste paga.
func TestOltreLaSogliaVieneChiestaUnaProvaDiLavoro(t *testing.T) {
	// Soglia bassa e difficolta' minima: la prova verifica il meccanismo, non
	// il costo computazionale, che dipende da una taratura ancora da fare.
	t.Setenv("SESSION_CREATE_LIMIT", "2")
	t.Setenv("POW_DIFFICULTY", "8")
	t.Setenv("POW_SECRET", "segreto-di-prova")
	b := nuovoBanco(t)

	for i := 0; i < 2; i++ {
		r := creaConCorpo(t, b, nil)
		r.Body.Close()
		if r.StatusCode != http.StatusCreated {
			t.Fatalf("richiesta %d entro la soglia: codice = %d, atteso %d", i+1, r.StatusCode, http.StatusCreated)
		}
	}

	r := creaConCorpo(t, b, nil)
	defer r.Body.Close()

	if r.StatusCode != http.StatusTooManyRequests {
		t.Fatalf("oltre la soglia: codice = %d, atteso %d", r.StatusCode, http.StatusTooManyRequests)
	}
	sfida := r.Header.Get("X-PoW-Challenge")
	if sfida == "" {
		t.Fatal("nessuna sfida nelle intestazioni")
	}
	// Senza il tempo residuo il client non sa quando riprovare, e l'unica
	// strategia che gli resta e' martellare.
	if r.Header.Get("Retry-After") == "" {
		t.Error("tempo di attesa assente nelle intestazioni")
	}

	var payload map[string]any
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		t.Fatalf("risposta non in formato JSON: %v", err)
	}
	if payload["algorithm"] != "sha256-leading-zero-bits" {
		t.Errorf("algoritmo dichiarato = %v", payload["algorithm"])
	}
	if payload["challenge"] != sfida {
		t.Error("la sfida nel corpo non coincide con quella nelle intestazioni")
	}
}

// Una soluzione valida riapre la strada: e' la via d'uscita che impedisce a una
// sala intera di restare esclusa.
func TestSoluzioneValidaConsenteLaCreazione(t *testing.T) {
	t.Setenv("SESSION_CREATE_LIMIT", "1")
	t.Setenv("POW_DIFFICULTY", "8")
	t.Setenv("POW_SECRET", "segreto-di-prova")
	b := nuovoBanco(t)

	primo := creaConCorpo(t, b, nil)
	primo.Body.Close()
	if primo.StatusCode != http.StatusCreated {
		t.Fatalf("premessa: prima creazione = %d", primo.StatusCode)
	}

	sfidato := creaConCorpo(t, b, nil)
	sfidato.Body.Close()
	if sfidato.StatusCode != http.StatusTooManyRequests {
		t.Fatalf("premessa: seconda creazione = %d, attesa la sfida", sfidato.StatusCode)
	}
	sfida := sfidato.Header.Get("X-PoW-Challenge")
	difficolta, err := strconv.Atoi(sfidato.Header.Get("X-PoW-Difficulty"))
	if err != nil {
		t.Fatalf("difficolta' non leggibile: %v", err)
	}

	soluzione := risolvi(t, sfida, uint(difficolta))

	risolto := creaConCorpo(t, b, map[string]string{
		"X-PoW-Challenge": sfida,
		"X-PoW-Solution":  soluzione,
	})
	defer risolto.Body.Close()

	if risolto.StatusCode != http.StatusCreated {
		t.Errorf("con soluzione valida: codice = %d, atteso %d", risolto.StatusCode, http.StatusCreated)
	}
}

// Una soluzione errata non deve valere: senza questa verifica la sfida sarebbe
// un ostacolo che basta dichiarare di aver superato.
func TestSoluzioneErrataNonConsenteLaCreazione(t *testing.T) {
	t.Setenv("SESSION_CREATE_LIMIT", "1")
	t.Setenv("POW_DIFFICULTY", "12")
	t.Setenv("POW_SECRET", "segreto-di-prova")
	b := nuovoBanco(t)

	primo := creaConCorpo(t, b, nil)
	primo.Body.Close()

	sfidato := creaConCorpo(t, b, nil)
	sfidato.Body.Close()
	sfida := sfidato.Header.Get("X-PoW-Challenge")
	if sfida == "" {
		t.Fatal("premessa: nessuna sfida emessa")
	}

	risposta := creaConCorpo(t, b, map[string]string{
		"X-PoW-Challenge": sfida,
		"X-PoW-Solution":  "non-e-una-soluzione",
	})
	defer risposta.Body.Close()

	if risposta.StatusCode != http.StatusTooManyRequests {
		t.Errorf("con soluzione errata: codice = %d, atteso %d", risposta.StatusCode, http.StatusTooManyRequests)
	}
}

// Le sessioni gia' attive continuano a funzionare anche quando la creazione e'
// contingentata: il contenimento non deve interrompere chi sta giocando.
func TestLaSogliaNonInterrompeLeSessioniAttive(t *testing.T) {
	t.Setenv("SESSION_CREATE_LIMIT", "1")
	t.Setenv("POW_DIFFICULTY", "8")
	t.Setenv("POW_SECRET", "segreto-di-prova")
	b := nuovoBanco(t)

	_, cookie := b.creaSessione(t)

	esaurito := creaConCorpo(t, b, nil)
	esaurito.Body.Close()
	if esaurito.StatusCode != http.StatusTooManyRequests {
		t.Fatalf("premessa: la soglia non e' stata raggiunta (codice %d)", esaurito.StatusCode)
	}

	richiesta, _ := http.NewRequest(http.MethodGet, b.server.URL+"/auth/validate", nil)
	richiesta.AddCookie(cookie)
	risposta, err := http.DefaultClient.Do(richiesta)
	if err != nil {
		t.Fatalf("richiesta: %v", err)
	}
	defer risposta.Body.Close()

	if risposta.StatusCode != http.StatusOK {
		t.Errorf("sessione attiva durante il contingentamento: codice = %d, atteso %d",
			risposta.StatusCode, http.StatusOK)
	}
}
