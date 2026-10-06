package models

import (
	"testing"
	"time"
)

// Le coordinate a zero di una sessione appena creata non sono una posizione, e
// distinguerle da una posizione vera e' cio' che evita di far ricomparire il
// giocatore nell'angolo della scena dopo un ripristino affrettato.
func TestPositionRecorded(t *testing.T) {
	creazione := time.Date(2026, 9, 15, 10, 0, 0, 0, time.UTC)

	casi := []struct {
		nome     string
		creato   time.Time
		ultimo   time.Time
		registra bool
	}{
		{
			nome:   "appena creata, nessun ping",
			creato: creazione, ultimo: creazione,
			registra: false,
		},
		{
			nome:   "dopo il primo ping",
			creato: creazione, ultimo: creazione.Add(7 * time.Second),
			registra: true,
		},
		{
			// Stato precedente all'introduzione di created_at: la posizione che
			// porta e' vera, e va servita.
			nome:   "stato senza istante di creazione",
			creato: time.Time{}, ultimo: creazione,
			registra: true,
		},
	}

	for _, c := range casi {
		t.Run(c.nome, func(t *testing.T) {
			var stato GameState
			stato.CreatedAt = c.creato
			stato.Meta.LastPing = c.ultimo

			if stato.PositionRecorded() != c.registra {
				t.Errorf("PositionRecorded() = %v, atteso %v", stato.PositionRecorded(), c.registra)
			}
		})
	}
}

// La durata usa solo gli istanti del ciclo di vita della partita.
func TestDurataMs(t *testing.T) {
	creazione := time.Date(2026, 9, 15, 10, 0, 0, 0, time.UTC)

	casi := []struct {
		nome     string
		creato   time.Time
		ultimo   time.Time
		attesaMs int64
	}{
		{
			nome:   "appena creata, nessun ping",
			creato: creazione, ultimo: creazione,
			attesaMs: 0,
		},
		{
			nome:   "durata dall'inizio all'ultimo ping",
			creato: creazione, ultimo: creazione.Add(90 * time.Second),
			attesaMs: 90000,
		},
		{
			// Senza created_at la durata non è ricostruibile.
			nome:   "stato senza istante di creazione",
			creato: time.Time{}, ultimo: creazione,
			attesaMs: 0,
		},
		{
			nome:   "ultimo ping anteriore alla creazione",
			creato: creazione, ultimo: creazione.Add(-time.Second),
			attesaMs: 0,
		},
	}

	for _, c := range casi {
		t.Run(c.nome, func(t *testing.T) {
			var stato GameState
			stato.CreatedAt = c.creato
			stato.Meta.LastPing = c.ultimo

			if got := stato.DurataMs(); got != c.attesaMs {
				t.Errorf("DurataMs() = %d, atteso %d", got, c.attesaMs)
			}
		})
	}
}
