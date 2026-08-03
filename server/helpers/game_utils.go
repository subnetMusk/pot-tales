// ===================================================
// server/helpers/game_utils.go
// ===================================================

package helpers

import (
	"context"
	"errors"
	"time"

	"github.com/redis/go-redis/v9"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"

	"github.com/subnetMusk/progetti_innovativi/server/models"
)

var (
	ErrGameNotFound = errors.New("game state not found")
)

type GameManager struct {
	rdb     *redis.Client
	gameCol *mongo.Collection
}

func NewGameManager(rdb *redis.Client, db *mongo.Database) *GameManager {
	return &GameManager{
		rdb:     rdb,
		gameCol: JournaledCollection(db, GameStatesCollection),
	}
}

// GetState recupera l'intero stato (Data + Meta) per la validazione.
func (gm *GameManager) GetState(ctx context.Context, sessionID string) (*models.GameState, error) {
	var state models.GameState
	err := gm.gameCol.FindOne(ctx, bson.M{"_id": sessionID}).Decode(&state)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, ErrGameNotFound
		}
		return nil, err
	}
	return &state, nil
}

// UpdatePosition aggiorna coordinate, tempo e last_ping atomicamente.
func (gm *GameManager) UpdateState(ctx context.Context, sessionID string, x, y float64, addTime int64, now time.Time) error {
	update := bson.M{
		"$set": bson.M{
			"data.x":         x,
			"data.y":         y,
			"meta.last_ping": now,
		},
		"$inc": bson.M{
			"data.total_time_ms": addTime,
		},
	}
	_, err := gm.gameCol.UpdateOne(ctx, bson.M{"_id": sessionID}, update)
	return err
}

// DeleteState cancella la sessione di gioco (Ban/Wipe).
// Nota: questo non cancella il token dalla collection "sessions",
// ma rendendo orfano il gioco, il router darà errore.
// Idealmente si dovrebbe cancellare anche da "sessions".
func (gm *GameManager) DeleteState(ctx context.Context, sessionID string) error {
	_, err := gm.gameCol.DeleteOne(ctx, bson.M{"_id": sessionID})
	return err
}
