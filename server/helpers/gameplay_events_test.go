package helpers

import (
	"context"
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
		LogGameplay(context.Background(), "sessione-x", "sessione_iniziata", nil)
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
		LogGameplay(context.Background(), "sessione-x", "sessione_iniziata", nil)
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
	ctx := context.WithValue(context.Background(), UserIDKey, token)

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
