//go:build integration

// Prove sui traguardi e sulla chiusura differita delle partite, con MongoDB
// reale.

package helpers

import (
	"context"
	"os"
	"slices"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	"github.com/subnetMusk/progetti_innovativi/server/models"
)

// inserisciPartita crea uno stato di gioco sulla scena indicata, con l'ultimo
// ping `fa` prima di adesso.
func inserisciPartita(t *testing.T, db *mongo.Database, id, scena string, fa time.Duration) {
	t.Helper()

	s := models.GameState{ID: id, CreatedAt: time.Now().Add(-fa)}
	s.Data.SceneID = scena
	s.Meta.LastPing = time.Now().Add(-fa)
	if _, err := JournaledCollection(db, GameStatesCollection).InsertOne(context.Background(), s); err != nil {
		t.Fatalf("inserimento della partita %s: %v", id, err)
	}
}

func abilitaAnaliticaPartita(t *testing.T, db *mongo.Database, id string) {
	t.Helper()
	if _, err := JournaledCollection(db, GameStatesCollection).UpdateOne(
		context.Background(),
		bson.M{"_id": id},
		bson.M{"$set": bson.M{"meta.analytics_consent": true}},
	); err != nil {
		t.Fatalf("abilitazione analitica della partita %s: %v", id, err)
	}
}

// leggiPartita rilegge lo stato di gioco dalla base dati.
func leggiPartita(t *testing.T, db *mongo.Database, id string) models.GameState {
	t.Helper()

	var s models.GameState
	if err := db.Collection(GameStatesCollection).FindOne(context.Background(), bson.M{"_id": id}).Decode(&s); err != nil {
		t.Fatalf("lettura della partita %s: %v", id, err)
	}
	return s
}

// --- Traguardi --------------------------------------------------------------

// Nella forma "chiave|valore" il prefisso diventa un'espressione regolare per la
// rimozione della voce precedente, e va citato. Senza, il separatore stesso
// sarebbe un'alternativa che corrisponde a qualunque stringa, e registrare un
// traguardo cancellerebbe tutti gli altri.
func TestAddCheckpointCitaLaChiave(t *testing.T) {
	db := baseDati(t)
	gm := NewGameManager(nil, db)
	ctx := context.Background()
	inserisciPartita(t, db, "partita", "Stage2", 0)

	for _, id := range []string{"semplice", "a.b|1", "axb|1", "a.b|2"} {
		if _, err := gm.AddCheckpoint(ctx, "partita", id); err != nil {
			t.Fatalf("registrazione di %s: %v", id, err)
		}
	}

	ottenuti := leggiPartita(t, db, "partita").Data.Checkpoints
	slices.Sort(ottenuti)
	attesi := []string{"a.b|2", "axb|1", "semplice"}
	if !slices.Equal(ottenuti, attesi) {
		t.Errorf("traguardi = %v, attesi %v", ottenuti, attesi)
	}
}

// --- Chiusura differita -----------------------------------------------------

// La spazzata chiude le partite che hanno smesso di segnalare, e soltanto
// quelle, emettendo la conclusione per inattivita'. Con il contesto annullato si
// ferma: una partita che scade dopo non viene piu' chiusa.
func TestAvviaChiusuraSessioniChiudeSoloLePartiteFerme(t *testing.T) {
	db := baseDati(t)
	inserisciPartita(t, db, "ferma", "Stage3", time.Hour)
	abilitaAnaliticaPartita(t, db, "ferma")
	inserisciPartita(t, db, "attiva", "Stage2", 0)

	ctx, annulla := context.WithCancel(context.Background())
	defer annulla()

	// Dentro la cattura non si interrompe la prova: l'uscita standard resterebbe
	// deviata sulle prove successive. L'esito si raccoglie e si verifica dopo.
	chiusa, fermata := false, false
	righe := catturaLog(t, func() {
		fine := AvviaChiusuraSessioni(ctx, db, time.Minute, 20*time.Millisecond)
		scadenza := time.Now().Add(5 * time.Second)
		for time.Now().Before(scadenza) {
			if leggiPartita(t, db, "ferma").Meta.ClosedAt != nil {
				chiusa = true
				break
			}
			time.Sleep(20 * time.Millisecond)
		}
		annulla()

		// La partita risulta chiusa appena la rivendicazione e' scritta, e
		// l'evento segue: chiudere la cattura a quel punto lo perderebbe, perche'
		// il logger scriverebbe su una pipe gia' chiusa. Si attende che la
		// spazzata si sia fermata.
		select {
		case <-fine:
			fermata = true
		case <-time.After(5 * time.Second):
		}
	})

	if !chiusa {
		t.Fatal("la partita ferma non e' stata chiusa entro cinque secondi")
	}
	if !fermata {
		t.Fatal("la spazzata non si e' fermata entro cinque secondi dall'annullamento")
	}
	if leggiPartita(t, db, "attiva").Meta.ClosedAt != nil {
		t.Error("una partita che segnala e' stata chiusa")
	}

	var conclusioni []map[string]any
	for _, r := range righe {
		if r["event.action"] == "sessione_conclusa" {
			conclusioni = append(conclusioni, r)
		}
	}
	if len(conclusioni) != 1 {
		t.Fatalf("conclusioni emesse = %d, attesa 1", len(conclusioni))
	}
	c := conclusioni[0]
	if c["partita.motivo"] != MotivoInattivita || c["partita.scena_finale"] != "Stage3" {
		t.Errorf("conclusione = %v, attesa per inattivita' su Stage3", c)
	}
	if c["partita.id"] != PartitaID("ferma") {
		t.Errorf("identificativo = %v, atteso quello della partita ferma", c["partita.id"])
	}

	// Dieci volte la cadenza: se la spazzata fosse ancora attiva, la partita
	// scaduta dopo l'annullamento verrebbe chiusa ben prima.
	inserisciPartita(t, db, "scaduta-dopo", "Stage2", time.Hour)
	time.Sleep(200 * time.Millisecond)
	if leggiPartita(t, db, "scaduta-dopo").Meta.ClosedAt != nil {
		t.Error("la spazzata ha continuato dopo l'annullamento del contesto")
	}
}

// Un guasto della base dati durante la spazzata va registrato: il silenzio
// sarebbe indistinguibile da "nessuna partita da chiudere".
func TestChiudiPartiteFermeRegistraIlGuasto(t *testing.T) {
	db := baseDati(t)
	ctx := context.Background()

	// Un client disconnesso fa fallire ogni operazione senza fermare il servizio
	// condiviso con le altre prove.
	client, err := mongo.Connect(ctx, options.Client().ApplyURI(os.Getenv("MONGO_URI")))
	if err != nil {
		t.Fatalf("connessione a MongoDB: %v", err)
	}
	if err := client.Disconnect(ctx); err != nil {
		t.Fatalf("disconnessione: %v", err)
	}
	col := client.Database(db.Name()).Collection(GameStatesCollection)

	righe := catturaLog(t, func() {
		chiudiPartiteFerme(ctx, col, time.Minute)
	})

	for _, r := range righe {
		if r["level"] == "ERROR" && r["msg"] == "chiusura delle partite ferme fallita" {
			return
		}
	}
	t.Errorf("guasto della base dati non registrato: %v", righe)
}
