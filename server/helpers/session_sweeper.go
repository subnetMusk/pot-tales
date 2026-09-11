// ===================================================
// server/helpers/session_sweeper.go
// ===================================================
// Chiusura differita delle partite abbandonate.
// ===================================================

package helpers

import (
	"context"
	"errors"
	"log/slog"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	"github.com/subnetMusk/progetti_innovativi/server/models"
)

// AvviaChiusuraSessioni emette l'evento di fine partita per le sessioni che
// hanno smesso di segnalare.
//
// Le partite non finiscono con una chiamata: finiscono quando qualcuno si alza
// dalla postazione. Senza questa spazzata l'evento che più conta per valutare
// l'impatto — quanto è durata la partita e a che punto si è fermata — non
// verrebbe emesso mai, perché non esiste una richiesta in cui emetterlo.
//
// Il contesto deve durare quanto il processo. Ereditare quello di avvio, che ha
// un timeout, fermerebbe la spazzata poco dopo la partenza senza che nulla lo
// segnali: i dati mancherebbero e la causa non comparirebbe da nessuna parte.
func AvviaChiusuraSessioni(ctx context.Context, db *mongo.Database, inattivita, cadenza time.Duration) {
	col := JournaledCollection(db, GameStatesCollection)

	go func() {
		t := time.NewTicker(cadenza)
		defer t.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-t.C:
				chiudiPartiteFerme(ctx, col, inattivita)
			}
		}
	}()
}

// chiudiPartiteFerme rivendica ed emette una alla volta le partite scadute.
//
// La rivendicazione è atomica: `FindOneAndUpdate` marca il documento e lo
// restituisce nella stessa operazione, quindi due repliche del backend non
// possono emettere l'evento due volte per la stessa partita. È il motivo per
// cui non serve un lock esterno, che sarebbe un pezzo mobile in più e un modo
// in più di restare bloccati.
func chiudiPartiteFerme(ctx context.Context, col *mongo.Collection, inattivita time.Duration) {
	adesso := time.Now()
	filtro := bson.M{
		"meta.last_ping": bson.M{"$lt": adesso.Add(-inattivita)},
		"meta.closed_at": bson.M{"$exists": false},
	}
	// Il documento restituito è quello precedente all'aggiornamento: serve lo
	// stato di gioco, non il marcatore appena scritto.
	opzioni := options.FindOneAndUpdate().SetReturnDocument(options.Before)

	for {
		var stato models.GameState
		err := col.FindOneAndUpdate(ctx, filtro,
			bson.M{"$set": bson.M{"meta.closed_at": adesso}}, opzioni).Decode(&stato)
		if err != nil {
			// Nessun documento residuo è la condizione di uscita normale, non un
			// errore. L'annullamento del contesto è l'arresto del processo.
			if !errors.Is(err, mongo.ErrNoDocuments) && !errors.Is(err, context.Canceled) {
				slog.Error("chiusura delle partite ferme fallita", "error", err)
			}
			return
		}

		emettiConclusione(ctx, &stato, MotivoInattivita)
	}
}

// Motivi per cui una partita si chiude. Sono l'unico modo di distinguere chi ha
// finito il gioco da chi si e' arreso: senza, l'abbandono e il completamento
// producono lo stesso evento e l'imbuto non li separa.
const (
	MotivoInattivita = "inattivita"
	MotivoEspulsione = "espulsione"
	MotivoCompletata = "completata"
)

// emettiConclusione e' l'unico punto in cui nasce `sessione_conclusa`: i campi
// devono coincidere fra le vie di chiusura, o i pannelli che li aggregano
// vedrebbero insiemi diversi a seconda di come e' finita la partita.
func emettiConclusione(ctx context.Context, stato *models.GameState, motivo string) {
	LogGameplay(ctx, stato.ID, "sessione_conclusa", map[string]any{
		"partita.motivo":       motivo,
		"partita.scena_finale": stato.Data.SceneID,
		"partita.durata_ms":    stato.Data.TotalPlayTimeMs,
		"partita.checkpoint_n": len(stato.Data.Checkpoints),
	})
}
