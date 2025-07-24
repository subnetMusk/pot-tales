// ===================================================
// server/models/session.go
// ===================================================
// Modello per i documenti di sessione
// ---------------------------------------------------

package models

import "time"

type SessionDoc struct {
	ID        string    `bson:"_id"`
	CreatedAt time.Time `bson:"created_at"`
	ExpiresAt time.Time `bson:"expires_at"`
	Active    bool      `bson:"active"`
}
