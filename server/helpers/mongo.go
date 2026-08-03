// ===================================================
// server/helpers/mongo.go
// ===================================================
// Collection con write concern esplicito e creazione
// idempotente degli indici.
// ===================================================

package helpers

import (
	"context"
	"log/slog"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"go.mongodb.org/mongo-driver/mongo/writeconcern"
)

// Nomi delle collection che contengono dati di sessione e di partita.
const (
	SessionsCollection   = "sessions"
	GameStatesCollection = "game_states"
)

// ttlField è il campo su cui agisce l'indice di ritenzione.
const ttlField = "created_at"

// JournaledCollection restituisce una collection con write concern j:true.
//
// Il write concern di default conferma la scrittura quando il documento è in
// memoria; con j:true la conferma arriva dopo la scrittura sul journal, quindi
// una scrittura confermata sopravvive a un arresto non pulito del processo o
// della macchina. Il costo è latenza aggiuntiva per operazione.
//
// Va usata per ogni scrittura di sessione e stato di gioco: prendere la
// collection con db.Collection() riporta il write concern al default.
func JournaledCollection(db *mongo.Database, name string) *mongo.Collection {
	return db.Collection(name, options.Collection().SetWriteConcern(writeconcern.Journaled()))
}

// EnsureIndexes crea gli indici richiesti. È idempotente: MongoDB ignora la
// creazione di un indice già esistente con la stessa specifica.
//
// L'indice TTL agisce su created_at e non su expires_at. I due campi hanno
// significati distinti:
//
//   - expires_at: validità della sessione, nell'ordine dei minuti
//   - created_at: ritenzione del documento, nell'ordine delle settimane
//
// Un TTL su expires_at cancellerebbe i documenti alla scadenza della sessione,
// rendendo impossibile qualunque analisi successiva.
func EnsureIndexes(ctx context.Context, db *mongo.Database, retention time.Duration) error {
	for _, s := range indexSpecs(retention) {
		if _, err := db.Collection(s.collection).Indexes().CreateOne(ctx, s.model); err != nil {
			return err
		}
	}

	slog.Info("mongo indexes ensured",
		"retention_days", retention.Hours()/24,
		"ttl_field", ttlField,
	)
	return nil
}

type indexSpec struct {
	collection string
	model      mongo.IndexModel
}

func indexSpecs(retention time.Duration) []indexSpec {
	seconds := int32(retention.Seconds())

	return []indexSpec{
		{
			collection: SessionsCollection,
			model: mongo.IndexModel{
				Keys:    bson.D{{Key: ttlField, Value: 1}},
				Options: options.Index().SetName("ttl_created_at").SetExpireAfterSeconds(seconds),
			},
		},
		{
			collection: GameStatesCollection,
			model: mongo.IndexModel{
				Keys:    bson.D{{Key: ttlField, Value: 1}},
				Options: options.Index().SetName("ttl_created_at").SetExpireAfterSeconds(seconds),
			},
		},
		{
			// Indice di lookup senza TTL: expires_at viene letto a ogni
			// validazione che non trova la sessione in cache.
			collection: SessionsCollection,
			model: mongo.IndexModel{
				Keys:    bson.D{{Key: "expires_at", Value: 1}},
				Options: options.Index().SetName("expires_at_lookup"),
			},
		},
	}
}
