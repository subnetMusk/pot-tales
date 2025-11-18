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

	// Dati di Gameplay (Posizione + Tempo accumulato)
	Data struct {
		SceneID         string  `bson:"scene_id"`
		X               float64 `bson:"x"`
		Y               float64 `bson:"y"`
		TotalPlayTimeMs int64   `bson:"total_time_ms"` // Accumulatore tempo effettivo
	} `bson:"data"`

	// Metadati per la Validazione (Authority Server)
	Meta struct {
		LastPing time.Time `bson:"last_ping"` // Fondamentale per calcolare Delta T
		Warnings int       `bson:"warnings"`  // Contatore per logica di Soft-Ban (opzionale)
	} `bson:"meta"`
}
