// ===================================================
// server/models/session.go
// ===================================================
// Modello per i documenti di sessione
// ---------------------------------------------------

package models

import "time"

type SessionDoc struct {
	ID string `bson:"_id"`

	// CreatedAt regge l'indice TTL di ritenzione, distinto da ExpiresAt che
	// rappresenta la scadenza della sessione.
	CreatedAt time.Time `bson:"created_at"`
	ExpiresAt time.Time `bson:"expires_at"`
	Active    bool      `bson:"active"`

	// Metadati per Security & Analytics
	// Questi campi non vengono mai restituiti al client
	Device string `bson:"device_info"` // User-Agent o stringa device dal JSON

	// ClientIP e' gia' anonimizzato quando arriva qui: ultimo ottetto a zero su
	// IPv4, ultimi 80 bit su IPv6. Vedi helpers.AnonymizeIP. Non scrivere mai in
	// questo campo un indirizzo completo.
	ClientIP string `bson:"client_ip"`

	ConsentGiven bool `bson:"consent_given"` // Consenso GDPR/Privacy
}
