package helpers

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"os"
	"strings"
	"testing"
)

// catturaLog esegue f dopo aver deviato lo standard output su una pipe, e
// restituisce le righe JSON prodotte. Il logger scrive direttamente su
// os.Stdout, quindi e' l'unico modo di osservarne l'esito senza modificarne la
// forma per comodita' del test.
func catturaLog(t *testing.T, f func()) []map[string]any {
	t.Helper()

	originale := os.Stdout
	lettura, scrittura, err := os.Pipe()
	if err != nil {
		t.Fatalf("creazione della pipe: %v", err)
	}
	os.Stdout = scrittura

	// Il logger cattura os.Stdout alla costruzione: va ricostruito dopo la
	// deviazione, altrimenti continuerebbe a scrivere sul descrittore vecchio.
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

	var righe []map[string]any
	for _, riga := range strings.Split(strings.TrimSpace(string(grezzo)), "\n") {
		if riga == "" {
			continue
		}
		var m map[string]any
		if err := json.Unmarshal([]byte(riga), &m); err != nil {
			t.Fatalf("riga non in formato JSON: %q", riga)
		}
		righe = append(righe, m)
	}
	return righe
}

// Ogni riga deve portare i campi su cui si costruiscono filtri e dashboard.
// Senza, i log restano leggibili da una persona ma inutilizzabili da una query.
func TestInitLoggerCampiComuni(t *testing.T) {
	righe := catturaLog(t, func() {
		LogSystem(context.Background(), "avvio", nil)
	})

	if len(righe) != 1 {
		t.Fatalf("righe prodotte = %d, attesa 1", len(righe))
	}
	attesi := map[string]string{
		"service.name":        "prova",
		"service.environment": "collaudo",
		"event.dataset":       "backend.api",
		"event.category":      "system",
		"event.action":        "avvio",
	}
	for chiave, valore := range attesi {
		if righe[0][chiave] != valore {
			t.Errorf("%s = %v, atteso %q", chiave, righe[0][chiave], valore)
		}
	}
}

func TestLogBusinessCategoriaEDettagli(t *testing.T) {
	righe := catturaLog(t, func() {
		LogBusiness(context.Background(), "gameplay", "scena_completata", map[string]any{
			"scene.id": "vaso",
			"durata":   12,
		})
	})

	if len(righe) != 1 {
		t.Fatalf("righe prodotte = %d, attesa 1", len(righe))
	}
	if righe[0]["event.category"] != "gameplay" {
		t.Errorf("categoria = %v, attesa gameplay", righe[0]["event.category"])
	}
	if righe[0]["scene.id"] != "vaso" {
		t.Errorf("dettaglio scene.id = %v, atteso vaso", righe[0]["scene.id"])
	}
	if righe[0]["durata"] != float64(12) {
		t.Errorf("dettaglio durata = %v, atteso 12", righe[0]["durata"])
	}
}

// L'errore deve arrivare con il messaggio e con l'origine: senza il punto del
// codice, un errore ricorrente costringe a cercarlo a mano fra i sorgenti.
func TestLogErrorMessaggioEOrigine(t *testing.T) {
	righe := catturaLog(t, func() {
		LogError(context.Background(), "persistenza", "scrittura_fallita",
			errors.New("connessione rifiutata"), nil)
	})

	if len(righe) != 1 {
		t.Fatalf("righe prodotte = %d, attesa 1", len(righe))
	}
	if righe[0]["level"] != "ERROR" {
		t.Errorf("livello = %v, atteso ERROR", righe[0]["level"])
	}
	if righe[0]["error.message"] != "connessione rifiutata" {
		t.Errorf("messaggio = %v", righe[0]["error.message"])
	}
	origine, ok := righe[0]["error.source"].(map[string]any)
	if !ok {
		t.Fatalf("origine assente o di tipo inatteso: %T", righe[0]["error.source"])
	}
	if origine["file"] == nil || origine["line"] == nil {
		t.Errorf("origine incompleta: %v", origine)
	}
	// L'origine deve indicare il chiamante, non il file del logger: e' proprio
	// lo scostamento che rende inutile l'informazione.
	if file, _ := origine["file"].(string); strings.HasSuffix(file, "logger.go") {
		t.Errorf("origine punta al logger invece che al chiamante: %v", file)
	}
}

// Un identificativo presente nel contesto deve comparire nella riga: e' cio'
// che consente di seguire una sessione attraverso servizi diversi.
func TestLogArricchitoConIdentificativoDiSessione(t *testing.T) {
	ctx := context.WithValue(context.Background(), UserIDKey, "sessione-123")
	righe := catturaLog(t, func() {
		LogSystem(ctx, "operazione", nil)
	})

	if len(righe) != 1 {
		t.Fatalf("righe prodotte = %d, attesa 1", len(righe))
	}
	if righe[0]["user.id"] != "sessione-123" {
		t.Errorf("user.id = %v, atteso sessione-123", righe[0]["user.id"])
	}
}

// Senza identificativo nel contesto il campo non deve comparire vuoto: un campo
// presente e vuoto e' indistinguibile da un identificativo perso.
func TestLogSenzaIdentificativoNonAggiungeIlCampo(t *testing.T) {
	righe := catturaLog(t, func() {
		LogSystem(context.Background(), "operazione", nil)
	})

	if len(righe) != 1 {
		t.Fatalf("righe prodotte = %d, attesa 1", len(righe))
	}
	if _, presente := righe[0]["user.id"]; presente {
		t.Errorf("user.id presente senza identificativo nel contesto: %v", righe[0]["user.id"])
	}
}
