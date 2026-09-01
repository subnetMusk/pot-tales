// ===================================================
// server/helpers/game_utils.go
// ===================================================

package helpers

import (
	"context"
	"errors"
	"regexp"
	"strings"
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

// UpdateState aggiorna scena, coordinate, tempo e last_ping atomicamente.
func (gm *GameManager) UpdateState(ctx context.Context, sessionID string, sceneID string, x, y float64, addTime int64, now time.Time) error {
	update := bson.M{
		"$set": bson.M{
			"data.scene_id":  sceneID,
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

// AddCheckpoint registra il raggiungimento di un traguardo. Il backend non interpreta il
// significato dell'ID (resta opaco), ma riconosce una convenzione facoltativa "chiave|valore":
// se il checkpoint contiene "|", qualunque voce precedente con lo stesso prefisso "chiave|"
// viene rimossa prima di aggiungere la nuova — permette di tracciare uno stato che cambia nel
// tempo (es. l'orientamento corrente di un turret) senza accumulare uno storico infinito.
// Senza "|" il comportamento resta un semplice insieme deduplicato (comportamento originale).
func (gm *GameManager) AddCheckpoint(ctx context.Context, sessionID string, checkpointID string) error {
	if sepIndex := strings.Index(checkpointID, "|"); sepIndex >= 0 {
		keyPrefix := checkpointID[:sepIndex+1]
		pull := bson.M{
			"$pull": bson.M{
				"data.checkpoints": bson.M{"$regex": "^" + regexp.QuoteMeta(keyPrefix)},
			},
		}
		if _, err := gm.gameCol.UpdateOne(ctx, bson.M{"_id": sessionID}, pull); err != nil {
			return err
		}
	}

	update := bson.M{
		"$addToSet": bson.M{
			"data.checkpoints": checkpointID,
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
