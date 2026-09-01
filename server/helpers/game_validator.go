// ===================================================
// server/helpers/game_validator.go
// ===================================================
// Contiene la logica di validazione spaziale e temporale.
// Definisce le soglie per Lag, Warning e Cheating.
// ===================================================

package helpers

import (
	"math"
	"time"

	"github.com/subnetMusk/progetti_innovativi/server/models"
)

// Configurazioni di Tolleranza (Placeholder fittizi)
const (
	// Soglie Temporali (Basate su ping ogni 1s)
	LagMinor   = 1500 * time.Millisecond // D1: Lag accettabile
	LagMajor   = 5 * time.Second         // D2: Lag grave (Rubberband)
	LagExtreme = 15 * time.Second        // D3: Timeout (Kick/Pause)

	// Soglie Spaziali (Unità al secondo)
	MaxSpeedValid = 20.0  // Velocità massima del player + buffer
	MaxSpeedCheat = 100.0 // Velocità impossibile (Teleport/Speedhack)
)

// ValidationResult definisce l'azione che il server deve intraprendere
type ValidationResult int

const (
	ActionAccept     ValidationResult = iota // Tutto OK, aggiorna DB
	ActionRubberband                         // Dati sospetti/Lag: ignora input, rispondi con vecchio stato
	ActionKick                               // Lag estremo: metti in pausa / disconnetti
	ActionBan                                // Cheat evidente: cancella sessione
)

// ValidatePing analizza il nuovo input rispetto allo stato corrente.
func ValidatePing(curr *models.GameState, newSceneID string, newX, newY float64, now time.Time) (ValidationResult, int64) {
	// 1. Gestione Primo Ping (Start Session) o Cambio Scena.
	// Se il tempo giocato è 0 (inizializzazione) oppure la scena riportata è diversa
	// da quella salvata (transizione legittima tra scene), il confronto spaziale/velocità
	// non ha senso: la "distanza" tra due scene diverse non è un teletrasporto sospetto.
	// Accettiamo senza controlli di velocità, ma non accreditiamo tempo (evita di sommare
	// il gap dell'intera scena precedente come se fosse stato ping costante).
	if curr.Data.TotalPlayTimeMs == 0 || newSceneID != curr.Data.SceneID {
		return ActionAccept, 0
	}

	// 2. Validazione Temporale
	dt := now.Sub(curr.Meta.LastPing)
	dtMs := dt.Milliseconds()

	if dt < 0 {
		return ActionRubberband, 0 // Ping dal passato? Ignorare.
	}

	// Analisi Delta T (Lag)
	if dt > LagExtreme {
		return ActionKick, 0 // D3: Troppo tempo senza ping
	}
	if dt > LagMajor {
		return ActionRubberband, 0 // D2: Lag importante, non aggiorniamo posizione ne tempo
	}

	// Se siamo qui, il tempo è accettabile (D1 o poco più).
	// Possiamo procedere alla validazione spaziale.

	// 3. Validazione Spaziale (Anti-Cheat)
	// Calcolo distanza Euclidea
	dx := newX - curr.Data.X
	dy := newY - curr.Data.Y
	distance := math.Sqrt(dx*dx + dy*dy)

	// Calcolo Velocità Stimata (Unità / Secondo)
	// Evitiamo divisione per zero
	seconds := dt.Seconds()
	if seconds == 0 {
		seconds = 0.001
	}

	speed := distance / seconds

	if speed > MaxSpeedCheat {
		return ActionBan, 0 // Cheat evidente
	}
	if speed > MaxSpeedValid {
		return ActionRubberband, 0 // Movimento troppo veloce (magari lag spike o glitch)
	}

	// 4. Tutto OK
	// Restituiamo ActionAccept e il tempo da accumulare (solo se D1, ovvero lag minimo)
	timeToAdd := int64(0)
	if dt <= LagMinor {
		timeToAdd = dtMs
	} else {
		// Se siamo tra D1 e D2, accettiamo la posizione ma NON il tempo (penalità lag)
		// O viceversa, dipende dal game design. Qui assumiamo di contarlo.
		timeToAdd = dtMs
	}

	return ActionAccept, timeToAdd
}
