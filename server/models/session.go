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

	// Metadati per Security & Analytics
	// Questi campi non vengono mai restituiti al client
	Device       string `bson:"device_info"`   // User-Agent o stringa device dal JSON
	ClientIP     string `bson:"client_ip"`     // L'IP reale estratto dagli header (Nginx)
	ReportedIP   string `bson:"reported_ip"`   // L'IP che il client DICE di avere (dal JSON)
	ConsentGiven bool   `bson:"consent_given"` // Consenso GDPR/Privacy
}
