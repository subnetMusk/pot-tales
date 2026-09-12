// ===================================================
// server/models/game.go
// ===================================================
// Modello unificato dello stato di gioco.
// Include dati di gameplay (Data) e metadati di controllo (Meta).
// ===================================================

package models

import "time"

type GameState struct {
	ID string `bson:"_id"` // Session Token

	// Regge l'indice TTL di ritenzione dati, come in SessionDoc.
	CreatedAt time.Time `bson:"created_at"`

	// Dati di Gameplay (Posizione + Tempo accumulato)
	Data struct {
		SceneID         string   `bson:"scene_id"`
		X               float64  `bson:"x"`
		Y               float64  `bson:"y"`
		TotalPlayTimeMs int64    `bson:"total_time_ms"`         // Accumulatore tempo effettivo
		Checkpoints     []string `bson:"checkpoints,omitempty"` // ID opachi dei traguardi raggiunti (es. "stage2_turret_0")
	} `bson:"data"`

	// Metadati per la Validazione (Authority Server)
	Meta struct {
		LastPing time.Time `bson:"last_ping"` // Fondamentale per calcolare Delta T
		Warnings int       `bson:"warnings"`  // Contatore per logica di Soft-Ban (opzionale)
		// Copia della scelta facoltativa, usata dal job che chiude le partite
		// abbandonate quando non esiste più una richiesta HTTP da cui leggerla.
		AnalyticsConsent bool `bson:"analytics_consent"`

		// ClosedAt segna che la fine partita è già stata emessa verso
		// l'osservabilità. Non appartiene al gioco: esiste perché la
		// rivendicazione della partita da chiudere sia atomica fra le repliche
		// del backend, che altrimenti emetterebbero l'evento due volte.
		//
		// Puntatore con omitempty: il filtro di rivendicazione seleziona i
		// documenti in cui il campo non esiste, e gli stati creati prima di
		// questa aggiunta devono ricadere in quel caso.
		ClosedAt *time.Time `bson:"closed_at,omitempty"`
	} `bson:"meta"`
}

// PositionRecorded dice se il gioco ha mai riportato una posizione.
//
// Lo stato nasce con coordinate a zero, che non descrivono un punto della scena
// ma l'assenza di un punto: la sessione viene creata all'ingresso di Stage1, che
// non invia ancora la posizione. Solo il ping scrive le coordinate, e le scrive
// insieme a last_ping: finche' questo coincide con l'istante di creazione non
// c'e' nulla da ripristinare.
//
// Uno stato che non ha created_at, perche' precede l'introduzione del campo,
// risulta avere una posizione: e' il verso giusto in cui sbagliare, perche' quel
// dato una posizione vera ce l'ha.
func (g GameState) PositionRecorded() bool {
	return !g.Meta.LastPing.Equal(g.CreatedAt)
}
