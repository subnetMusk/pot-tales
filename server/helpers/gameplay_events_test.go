package helpers

import (
	"context"
	"encoding/json"
	"io"
	"os"
	"strings"
	"testing"
)

// catturaLogGrezzo restituisce il testo prodotto senza decodificarlo.
//
// Serve dove la proprieta' da verificare si perde nella decodifica: una chiave
// JSON ripetuta collassa in una sola voce della mappa, quindi un documento
// malformato passerebbe inosservato.
func catturaLogGrezzo(t *testing.T, f func()) string {
	t.Helper()

	originale := os.Stdout
	lettura, scrittura, err := os.Pipe()
	if err != nil {
		t.Fatalf("creazione della pipe: %v", err)
	}
	os.Stdout = scrittura

	// I logger catturano os.Stdout alla costruzione: vanno ricostruiti dopo la
	// deviazione, altrimenti scriverebbero sul descrittore precedente.
	InitLogger("prova", "collaudo")

	f()

	os.Stdout = originale
	if err := scrittura.Close(); err != nil {
		t.Fatalf("chiusura della pipe: %v", err)
	}
	grezzo, err := io.ReadAll(lettura)
	if err != nil {
		t.Fatalf("lettura della pipe: %v", err)
	}
	return string(grezzo)
}

// I fatti di partita finiscono in un indice che la platea divulgativa puo'
// leggere. Queste prove difendono le due proprieta' da cui dipende quella
// separazione: l'instradamento e cio' che non deve comparire nel documento.

// L'instradamento in ingestione si basa su `event.dataset`. Il logger tecnico
// dichiara gia' quel campo, e slog non sostituisce un attributo esistente ma lo
// affianca: se il logger dei fatti di partita ne derivasse, il documento
// porterebbe la chiave due volte e quale valore vince dipenderebbe dal parser.
func TestLogGameplayDatasetDedicato(t *testing.T) {
	righe := catturaLog(t, func() {
		LogGameplay(WithAnalyticsConsent(context.Background(), true), "sessione-x", "sessione_iniziata", nil)
	})

	if len(righe) != 1 {
		t.Fatalf("righe prodotte = %d, attesa 1", len(righe))
	}
	if got := righe[0]["event.dataset"]; got != GameplayDataset {
		t.Errorf("event.dataset = %v, atteso %s", got, GameplayDataset)
	}
	if got := righe[0]["event.category"]; got != "gameplay" {
		t.Errorf("event.category = %v, attesa gameplay", got)
	}
}

// La deduplicazione non e' osservabile dalla mappa decodificata, che tiene una
// sola chiave: va verificata sul testo grezzo.
func TestLogGameplayDatasetNonDuplicato(t *testing.T) {
	grezzo := catturaLogGrezzo(t, func() {
		LogGameplay(WithAnalyticsConsent(context.Background(), true), "sessione-x", "sessione_iniziata", nil)
	})

	if n := strings.Count(grezzo, `"event.dataset"`); n != 1 {
		t.Errorf("event.dataset compare %d volte, attesa 1: %s", n, grezzo)
	}
}

// Il token di sessione e' lo stesso valore che il visitatore porta nel cookie.
// Il logger tecnico lo inietta come `user.id` quando il contesto lo trasporta:
// qui non deve arrivarci, altrimenti la separazione degli indici non basterebbe
// piu' a impedire di collegare una riga a un browser preciso.
func TestLogGameplayNonEsponeLaSessione(t *testing.T) {
	const token = "token-di-sessione-riconoscibile"
	ctx := context.WithValue(WithAnalyticsConsent(context.Background(), true), UserIDKey, token)

	grezzo := catturaLogGrezzo(t, func() {
		LogGameplay(ctx, token, "checkpoint_raggiunto", map[string]any{
			"partita.checkpoint": "stage2_turret_0",
		})
	})

	if strings.Contains(grezzo, token) {
		t.Errorf("il token di sessione compare nel documento: %s", grezzo)
	}
	if strings.Contains(grezzo, `"user.id"`) {
		t.Errorf("il documento porta user.id: %s", grezzo)
	}
	if !strings.Contains(grezzo, `"partita.id"`) {
		t.Errorf("manca partita.id, senza il quale non si contano le partite: %s", grezzo)
	}
}

func TestLogGameplaySenzaConsensoNonProduceEventi(t *testing.T) {
	grezzo := catturaLogGrezzo(t, func() {
		LogGameplay(WithAnalyticsConsent(context.Background(), false), "sessione-x", "sessione_iniziata", nil)
	})
	if grezzo != "" {
		t.Fatalf("evento prodotto senza consenso: %s", grezzo)
	}
}

// Il conteggio dell'avvio e' l'unico fatto registrato senza consenso, e puo'
// esserlo solo finche' non porta nulla che distingua una partita dalle altre.
func TestLogPartitaAvviataSenzaConsensoEAnonima(t *testing.T) {
	const token = "token-di-sessione-riconoscibile"
	ctx := context.WithValue(WithAnalyticsConsent(context.Background(), false), UserIDKey, token)

	grezzo := catturaLogGrezzo(t, func() {
		LogPartitaAvviata(ctx)
	})

	righe := strings.Split(strings.TrimSpace(grezzo), "\n")
	if len(righe) != 1 || righe[0] == "" {
		t.Fatalf("righe prodotte = %d, attesa 1: %q", len(righe), grezzo)
	}
	var riga map[string]any
	if err := json.Unmarshal([]byte(righe[0]), &riga); err != nil {
		t.Fatalf("riga non JSON: %v", err)
	}
	if riga["event.dataset"] != GameplayDataset {
		t.Errorf("event.dataset = %v, atteso %s", riga["event.dataset"], GameplayDataset)
	}
	if riga["event.action"] != AzionePartitaAvviata {
		t.Errorf("event.action = %v, attesa %s", riga["event.action"], AzionePartitaAvviata)
	}
	if strings.Contains(grezzo, token) {
		t.Errorf("il token di sessione compare nel documento: %s", grezzo)
	}
	for campo := range riga {
		if strings.HasPrefix(campo, "partita.") || campo == "user.id" {
			t.Errorf("campo %s presente nel conteggio anonimo: %s", campo, grezzo)
		}
	}
}

// La classe risponde alla domanda "da cosa hanno giocato" senza conservare la
// stringa integrale, che distinguerebbe un visitatore dagli altri.
func TestClasseDispositivo(t *testing.T) {
	casi := map[string]string{
		"":                           "ignoto",
		"Mozilla/5.0 (iPad; CPU OS)": "tablet",
		"Mozilla/5.0 (iPhone) Mobi":  "telefono",
		"Mozilla/5.0 (X11; Linux)":   "computer",
	}
	for dichiarato, atteso := range casi {
		if got := ClasseDispositivo(dichiarato); got != atteso {
			t.Errorf("ClasseDispositivo(%q) = %q, atteso %q", dichiarato, got, atteso)
		}
	}
}

// Identificativi diversi per sessioni diverse, stabili per la stessa: e' la
// condizione perche' contare le partite distinte abbia senso.
func TestPartitaIDStabileEDistinto(t *testing.T) {
	InitLogger("prova", "collaudo")

	if PartitaID("a") != PartitaID("a") {
		t.Error("lo stesso token produce identificativi diversi: le partite non sarebbero raggruppabili")
	}
	if PartitaID("a") == PartitaID("b") {
		t.Error("token diversi producono lo stesso identificativo")
	}
	if n := len(PartitaID("a")); n != 16 {
		t.Errorf("lunghezza dell'identificativo = %d, attesa 16", n)
	}
}
