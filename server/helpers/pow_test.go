package helpers

import (
	"context"
	"crypto/sha256"
	"strconv"
	"strings"
	"testing"
	"time"
)

// solve cerca una soluzione con la difficolta' richiesta. Usata dai test al
// posto di un client.
func solve(t *testing.T, challenge string, difficulty uint) string {
	t.Helper()
	for i := 0; i < 50_000_000; i++ {
		s := strconv.Itoa(i)
		if hasLeadingZeroBits(sha256.Sum256([]byte(challenge+s)), difficulty) {
			return s
		}
	}
	t.Fatalf("nessuna soluzione trovata per difficolta' %d", difficulty)
	return ""
}

func TestPoWAccettaUnaSoluzioneValida(t *testing.T) {
	p := NewPoW("segreto-di-prova", 12, time.Minute, nil)

	challenge, err := p.Issue()
	if err != nil {
		t.Fatalf("emissione fallita: %v", err)
	}

	if err := p.Verify(context.Background(), challenge, solve(t, challenge, 12)); err != nil {
		t.Fatalf("soluzione valida rifiutata: %v", err)
	}
}

func TestPoWRifiutaUnaSoluzioneErrata(t *testing.T) {
	p := NewPoW("segreto-di-prova", 12, time.Minute, nil)

	challenge, _ := p.Issue()
	if err := p.Verify(context.Background(), challenge, "non-una-soluzione"); err != ErrSolutionInvalid {
		t.Fatalf("atteso ErrSolutionInvalid, ottenuto %v", err)
	}
}

// Una sfida non emessa da noi non deve essere accettata: senza questo controllo
// un client potrebbe costruirsi difficolta' e scadenza a piacere.
func TestPoWRifiutaUnaSfidaNonFirmata(t *testing.T) {
	p := NewPoW("segreto-di-prova", 12, time.Minute, nil)

	falsa := "AAAAAAAAAAAAAAAAAAAAAA." + strconv.FormatInt(time.Now().Add(time.Hour).Unix(), 10) + ".1.firma-inventata"
	if err := p.Verify(context.Background(), falsa, solve(t, falsa, 1)); err != ErrChallengeInvalid {
		t.Fatalf("atteso ErrChallengeInvalid, ottenuto %v", err)
	}
}

// La firma e' legata al segreto: una sfida emessa con un segreto diverso non
// deve essere accettata.
func TestPoWRifiutaUnaSfidaDiUnAltroSegreto(t *testing.T) {
	emittente := NewPoW("segreto-a", 8, time.Minute, nil)
	verificatore := NewPoW("segreto-b", 8, time.Minute, nil)

	challenge, _ := emittente.Issue()
	if err := verificatore.Verify(context.Background(), challenge, solve(t, challenge, 8)); err != ErrChallengeInvalid {
		t.Fatalf("atteso ErrChallengeInvalid, ottenuto %v", err)
	}
}

func TestPoWRifiutaUnaSfidaScaduta(t *testing.T) {
	p := NewPoW("segreto-di-prova", 8, -time.Minute, nil)

	challenge, _ := p.Issue()
	if err := p.Verify(context.Background(), challenge, "0"); err != ErrChallengeExpired {
		t.Fatalf("atteso ErrChallengeExpired, ottenuto %v", err)
	}
}

func TestPoWRifiutaUnaSfidaMalformata(t *testing.T) {
	p := NewPoW("segreto-di-prova", 8, time.Minute, nil)

	for _, c := range []string{"", "a", "a.b", "a.b.c.d.e"} {
		if err := p.Verify(context.Background(), c, "0"); err != ErrChallengeMalformed {
			t.Errorf("challenge %q: atteso ErrChallengeMalformed, ottenuto %v", c, err)
		}
	}
}

// La difficolta' e' inclusa nel valore firmato: modificarla invalida la firma,
// altrimenti un client potrebbe abbassarla e risolvere senza costo.
func TestPoWDifficoltaNonModificabile(t *testing.T) {
	p := NewPoW("segreto-di-prova", 20, time.Minute, nil)

	challenge, _ := p.Issue()
	parts := strings.Split(challenge, ".")
	parts[2] = "1"
	manomessa := strings.Join(parts, ".")

	if err := p.Verify(context.Background(), manomessa, solve(t, manomessa, 1)); err != ErrChallengeInvalid {
		t.Fatalf("atteso ErrChallengeInvalid, ottenuto %v", err)
	}
}

func TestHasLeadingZeroBits(t *testing.T) {
	var sum [32]byte

	if !hasLeadingZeroBits(sum, 0) || !hasLeadingZeroBits(sum, 256) {
		t.Error("un digest interamente nullo deve soddisfare qualunque difficolta'")
	}

	sum[0] = 0x0F // 0000 1111: quattro bit nulli iniziali
	if !hasLeadingZeroBits(sum, 4) {
		t.Error("attesi 4 bit nulli riconosciuti")
	}
	if hasLeadingZeroBits(sum, 5) {
		t.Error("il quinto bit non e' nullo e non doveva essere accettato")
	}
}
