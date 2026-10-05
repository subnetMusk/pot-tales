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
	"go.mongodb.org/mongo-driver/mongo/options"

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

// UpdateState aggiorna scena, coordinate e last_ping atomicamente.
func (gm *GameManager) UpdateState(ctx context.Context, sessionID string, sceneID string, x, y float64, now time.Time) error {
	update := bson.M{
		"$set": bson.M{
			"data.scene_id":  sceneID,
			"data.x":         x,
			"data.y":         y,
			"meta.last_ping": now,
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
// Il booleano restituito dice se lo stato e' cambiato: il chiamante lo usa per
// non emettere una seconda volta lo stesso fatto in caso di retry.
func (gm *GameManager) AddCheckpoint(ctx context.Context, sessionID string, checkpointID string) (bool, error) {
	if sepIndex := strings.Index(checkpointID, "|"); sepIndex >= 0 {
		keyPrefix := checkpointID[:sepIndex+1]
		pull := bson.M{
			"$pull": bson.M{
				"data.checkpoints": bson.M{"$regex": "^" + regexp.QuoteMeta(keyPrefix)},
			},
		}
		if _, err := gm.gameCol.UpdateOne(ctx, bson.M{"_id": sessionID}, pull); err != nil {
			return false, err
		}
	}

	update := bson.M{
		"$addToSet": bson.M{
			"data.checkpoints": checkpointID,
		},
	}
	risultato, err := gm.gameCol.UpdateOne(ctx, bson.M{"_id": sessionID}, update)
	if err != nil {
		return false, err
	}
	return risultato.ModifiedCount > 0, nil
}

// ConcludiPartita chiude una partita per un motivo noto ed emette l'evento.
//
// Esiste per il caso che la spazzata non puo' coprire: quando il gioco avra' un
// finale, chi lo raggiunge va distinto da chi si e' fermato. Senza questa
// distinzione l'evento di chiusura direbbe "inattivita" anche per chi ha
// completato, e il numero di partite portate a termine — che e' la misura
// d'impatto piu' diretta — non sarebbe ricavabile.
//
// La rivendicazione e' la stessa della spazzata e per la stessa ragione: il
// marcatore viene posto e letto in una sola operazione, quindi una partita
// conclusa qui non viene chiusa una seconda volta dalla spazzata quando smette
// di segnalare. Due conclusioni per un solo inizio falserebbero l'imbuto in modo
// silenzioso.
//
// Restituisce false senza errore se la partita era gia' conclusa: e' una corsa
// attesa, non un guasto.
func (gm *GameManager) ConcludiPartita(ctx context.Context, sessionID, motivo string) (bool, error) {
	var stato models.GameState
	err := gm.gameCol.FindOneAndUpdate(ctx,
		bson.M{"_id": sessionID, "meta.closed_at": bson.M{"$exists": false}},
		bson.M{"$set": bson.M{"meta.closed_at": time.Now()}},
		options.FindOneAndUpdate().SetReturnDocument(options.Before),
	).Decode(&stato)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return false, nil
		}
		return false, err
	}

	emettiConclusione(ctx, &stato, motivo)
	return true, nil
}

// DeleteState cancella la sessione di gioco (Ban/Wipe).
// Nota: questo non cancella il token dalla collection "sessions",
// ma rendendo orfano il gioco, il router darà errore.
// Idealmente si dovrebbe cancellare anche da "sessions".
func (gm *GameManager) DeleteState(ctx context.Context, sessionID string) error {
	_, err := gm.gameCol.DeleteOne(ctx, bson.M{"_id": sessionID})
	return err
}
