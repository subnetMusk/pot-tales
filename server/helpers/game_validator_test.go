package helpers

import (
	"testing"
	"time"

	"github.com/subnetMusk/progetti_innovativi/server/models"
)

// stato costruisce uno stato di gioco con posizione, tempo giocato e istante
// dell'ultimo ping.
func stato(x, y float64, tempoGiocatoMs int64, ultimoPing time.Time) *models.GameState {
	s := &models.GameState{}
	s.Data.X = x
	s.Data.Y = y
	s.Data.TotalPlayTimeMs = tempoGiocatoMs
	s.Meta.LastPing = ultimoPing
	return s
}

func TestValidatePing(t *testing.T) {
	adesso := time.Date(2026, 9, 15, 10, 0, 0, 0, time.UTC)

	casi := []struct {
		nome        string
		stato       *models.GameState
		x, y        float64
		istante     time.Time
		azione      ValidationResult
		tempoAtteso int64
	}{
		{
			// Il primo ping non ha un precedente con cui confrontarsi: qualunque
			// posizione e' legittima, perche' e' quella di partenza.
			nome:  "primo ping accettato senza vincoli",
			stato: stato(0, 0, 0, adesso.Add(-time.Hour)),
			x:     9999, y: 9999,
			istante: adesso,
			azione:  ActionAccept,
		},
		{
			// Un ping datato prima dell'ultimo registrato non e' interpretabile:
			// l'orologio del client non e' una fonte attendibile.
			nome:  "ping dal passato ignorato",
			stato: stato(0, 0, 1000, adesso),
			x:     1, y: 1,
			istante: adesso.Add(-time.Second),
			azione:  ActionRubberband,
		},
		{
			nome:  "silenzio oltre la soglia estrema",
			stato: stato(0, 0, 1000, adesso),
			x:     0, y: 0,
			istante: adesso.Add(LagExtreme + time.Second),
			azione:  ActionKick,
		},
		{
			nome:  "silenzio fra soglia grave ed estrema",
			stato: stato(0, 0, 1000, adesso),
			x:     0, y: 0,
			istante: adesso.Add(LagMajor + time.Second),
			azione:  ActionRubberband,
		},
		{
			// Spostamento impossibile: nessun ritardo di rete lo giustifica.
			nome:  "velocita' impossibile",
			stato: stato(0, 0, 1000, adesso),
			x:     1000, y: 0,
			istante: adesso.Add(time.Second),
			azione:  ActionBan,
		},
		{
			// Sopra la velocita' consentita ma sotto quella impossibile: puo'
			// essere un picco di latenza, quindi si ignora l'input invece di
			// interrompere la partita.
			nome:  "velocita' sospetta ma non impossibile",
			stato: stato(0, 0, 1000, adesso),
			x:     50, y: 0,
			istante: adesso.Add(time.Second),
			azione:  ActionRubberband,
		},
		{
			nome:  "movimento regolare, tempo accumulato",
			stato: stato(0, 0, 1000, adesso),
			x:     5, y: 0,
			istante:     adesso.Add(time.Second),
			azione:      ActionAccept,
			tempoAtteso: 1000,
		},
		{
			// Fra la soglia minore e quella grave il movimento resta accettabile.
			nome:  "ritardo moderato accettato",
			stato: stato(0, 0, 1000, adesso),
			x:     10, y: 0,
			istante:     adesso.Add(3 * time.Second),
			azione:      ActionAccept,
			tempoAtteso: 3000,
		},
		{
			// Due ping nello stesso istante: la divisione per il tempo
			// trascorso userebbe zero, e il calcolo della velocita' non
			// sarebbe definito.
			nome:  "ping simultaneo senza divisione per zero",
			stato: stato(0, 0, 1000, adesso),
			x:     0, y: 0,
			istante:     adesso,
			azione:      ActionAccept,
			tempoAtteso: 0,
		},
	}

	for _, c := range casi {
		t.Run(c.nome, func(t *testing.T) {
			azione, tempo := ValidatePing(c.stato, c.x, c.y, c.istante)
			if azione != c.azione {
				t.Errorf("azione = %v, attesa %v", azione, c.azione)
			}
			if tempo != c.tempoAtteso {
				t.Errorf("tempo accumulato = %d, atteso %d", tempo, c.tempoAtteso)
			}
		})
	}
}

// Uno spostamento identico valutato su intervalli diversi deve cambiare
// verdetto: e' la proprieta' su cui si regge l'intero controllo, e un errore di
// segno o di unita' la ribalterebbe senza rompere alcun caso singolo.
func TestValidatePingVelocitaDipendeDalTempo(t *testing.T) {
	adesso := time.Date(2026, 9, 15, 10, 0, 0, 0, time.UTC)
	const distanza = 60.0

	azioneVeloce, _ := ValidatePing(stato(0, 0, 1000, adesso), distanza, 0, adesso.Add(time.Second))
	azioneLenta, _ := ValidatePing(stato(0, 0, 1000, adesso), distanza, 0, adesso.Add(4*time.Second))

	if azioneVeloce != ActionRubberband {
		t.Errorf("stessa distanza in un secondo: azione = %v, attesa Rubberband", azioneVeloce)
	}
	if azioneLenta != ActionAccept {
		t.Errorf("stessa distanza in quattro secondi: azione = %v, attesa Accept", azioneLenta)
	}
}

// La distanza e' euclidea: un movimento diagonale copre piu' spazio di uno
// sullo stesso delta di un singolo asse.
func TestValidatePingDistanzaEuclidea(t *testing.T) {
	adesso := time.Date(2026, 9, 15, 10, 0, 0, 0, time.UTC)

	// 15 su un asse solo: sotto la soglia consentita.
	sePiano, _ := ValidatePing(stato(0, 0, 1000, adesso), 15, 0, adesso.Add(time.Second))
	if sePiano != ActionAccept {
		t.Errorf("movimento su un asse: azione = %v, attesa Accept", sePiano)
	}

	// 15 su entrambi gli assi: la diagonale vale circa 21, sopra la soglia.
	seDiagonale, _ := ValidatePing(stato(0, 0, 1000, adesso), 15, 15, adesso.Add(time.Second))
	if seDiagonale != ActionRubberband {
		t.Errorf("movimento diagonale: azione = %v, attesa Rubberband", seDiagonale)
	}
}
