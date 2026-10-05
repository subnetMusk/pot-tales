//go:build integration

// Prove che richiedono MongoDB e Redis reali.
//
// Sono separate dai test unitari da un tag di compilazione: senza, ogni
// esecuzione della suite dipenderebbe da due servizi esterni, e un fallimento
// di ambiente sarebbe indistinguibile da una regressione.
//
// L'indirizzo dei servizi arriva da MONGO_URI e REDIS_URL. Il target
// `go-test-integration` li avvia e li collega.

package helpers

import (
	"context"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/redis/go-redis/v9"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	"github.com/subnetMusk/progetti_innovativi/server/models"
)

// baseDati apre una connessione verso un database dedicato al test corrente e
// lo elimina alla fine. Database separati per test consentono di eseguirli in
// parallelo senza che si sovrascrivano a vicenda.
func baseDati(t *testing.T) *mongo.Database {
	t.Helper()

	uri := os.Getenv("MONGO_URI")
	if uri == "" {
		t.Skip("MONGO_URI non impostata")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	client, err := mongo.Connect(ctx, options.Client().ApplyURI(uri))
	if err != nil {
		t.Fatalf("connessione a MongoDB: %v", err)
	}
	if err := client.Ping(ctx, nil); err != nil {
		t.Fatalf("MongoDB non risponde: %v", err)
	}

	nome := "prova_" + t.Name()
	db := client.Database(nome)
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = db.Drop(ctx)
		_ = client.Disconnect(ctx)
	})
	return db
}

func cache(t *testing.T) *redis.Client {
	t.Helper()

	url := os.Getenv("REDIS_URL")
	if url == "" {
		t.Skip("REDIS_URL non impostata")
	}
	opt, err := redis.ParseURL(url)
	if err != nil {
		t.Fatalf("URL della cache non valida: %v", err)
	}
	client := redis.NewClient(opt)
	t.Cleanup(func() { _ = client.Close() })
	return client
}

// --- Stato di gioco ---------------------------------------------------------

func TestGameManagerCicloCompleto(t *testing.T) {
	db := baseDati(t)
	gm := NewGameManager(cache(t), db)
	ctx := context.Background()
	const sessione = "sessione-di-prova"

	// Uno stato inesistente deve produrre un errore riconoscibile, non un
	// documento vuoto: la differenza decide se il router risponde 404 o serve
	// una partita fantasma.
	if _, err := gm.GetState(ctx, sessione); err != ErrGameNotFound {
		t.Fatalf("stato assente: errore = %v, atteso ErrGameNotFound", err)
	}

	adesso := time.Now().UTC().Truncate(time.Millisecond)
	iniziale := models.GameState{ID: sessione, CreatedAt: adesso}
	iniziale.Data.X = 10
	iniziale.Data.Y = 20
	iniziale.Meta.LastPing = adesso
	if _, err := JournaledCollection(db, GameStatesCollection).InsertOne(ctx, iniziale); err != nil {
		t.Fatalf("inserimento dello stato iniziale: %v", err)
	}

	letto, err := gm.GetState(ctx, sessione)
	if err != nil {
		t.Fatalf("lettura dello stato: %v", err)
	}
	if letto.Data.X != 10 || letto.Data.Y != 20 {
		t.Errorf("posizione letta = (%v, %v), attesa (10, 20)", letto.Data.X, letto.Data.Y)
	}

	dopo := adesso.Add(2 * time.Second)
	if err := gm.UpdateState(ctx, sessione, "Stage1", 15, 25, dopo); err != nil {
		t.Fatalf("aggiornamento dello stato: %v", err)
	}

	aggiornato, err := gm.GetState(ctx, sessione)
	if err != nil {
		t.Fatalf("rilettura dello stato: %v", err)
	}
	if aggiornato.Data.X != 15 || aggiornato.Data.Y != 25 {
		t.Errorf("posizione aggiornata = (%v, %v), attesa (15, 25)", aggiornato.Data.X, aggiornato.Data.Y)
	}

	if err := gm.DeleteState(ctx, sessione); err != nil {
		t.Fatalf("cancellazione dello stato: %v", err)
	}
	if _, err := gm.GetState(ctx, sessione); err != ErrGameNotFound {
		t.Errorf("dopo la cancellazione: errore = %v, atteso ErrGameNotFound", err)
	}
}

// La cancellazione di uno stato inesistente non e' un errore: l'operazione e'
// idempotente, e trattarla come fallimento renderebbe fragile la ripetizione.
func TestGameManagerCancellazioneIdempotente(t *testing.T) {
	db := baseDati(t)
	gm := NewGameManager(cache(t), db)

	if err := gm.DeleteState(context.Background(), "mai-esistita"); err != nil {
		t.Errorf("cancellazione di uno stato assente: %v", err)
	}
}

// --- Indici -----------------------------------------------------------------

func TestEnsureIndexesCreaScadenzaSuEntrambeLeCollection(t *testing.T) {
	db := baseDati(t)
	ctx := context.Background()
	const ritenzione = 45 * 24 * time.Hour

	if err := EnsureIndexes(ctx, db, ritenzione); err != nil {
		t.Fatalf("creazione degli indici: %v", err)
	}

	for _, collezione := range []string{SessionsCollection, GameStatesCollection} {
		cursore, err := db.Collection(collezione).Indexes().List(ctx)
		if err != nil {
			t.Fatalf("elenco degli indici di %s: %v", collezione, err)
		}
		var indici []bson.M
		if err := cursore.All(ctx, &indici); err != nil {
			t.Fatalf("lettura degli indici di %s: %v", collezione, err)
		}

		trovato := false
		for _, i := range indici {
			scadenza, presente := i["expireAfterSeconds"]
			if !presente {
				continue
			}
			trovato = true
			// La ritenzione dei documenti e' distinta dalla durata della
			// sessione: confonderle cancellerebbe i dati appena la sessione
			// scade, prima di poterli analizzare.
			if secondi := toInt64(scadenza); secondi != int64(ritenzione.Seconds()) {
				t.Errorf("%s: scadenza = %d secondi, attesi %d",
					collezione, secondi, int64(ritenzione.Seconds()))
			}
		}
		if !trovato {
			t.Errorf("%s: nessun indice con scadenza", collezione)
		}
	}
}

// Riapplicare gli indici non deve fallire: il servizio li dichiara a ogni
// avvio, e un errore al secondo avvio bloccherebbe ogni riavvio successivo.
func TestEnsureIndexesRipetibile(t *testing.T) {
	db := baseDati(t)
	ctx := context.Background()

	if err := EnsureIndexes(ctx, db, 24*time.Hour); err != nil {
		t.Fatalf("prima applicazione: %v", err)
	}
	if err := EnsureIndexes(ctx, db, 24*time.Hour); err != nil {
		t.Errorf("seconda applicazione: %v", err)
	}
}

func toInt64(v any) int64 {
	switch n := v.(type) {
	case int32:
		return int64(n)
	case int64:
		return n
	case float64:
		return int64(n)
	default:
		return -1
	}
}

// --- Sessioni ---------------------------------------------------------------

func TestValidateSessionSuBaseDati(t *testing.T) {
	db := baseDati(t)
	rdb := cache(t)
	col := JournaledCollection(db, SessionsCollection)
	sm := NewSessionManager(rdb, col)
	ctx := context.Background()
	adesso := time.Now()

	casi := []struct {
		nome      string
		documento *models.SessionDoc
		erroreAtt error
	}{
		{
			nome:      "sessione inesistente",
			erroreAtt: ErrSessionNotFound,
		},
		{
			// Una sessione disattivata non e' scaduta: e' stata chiusa, e va
			// distinta perche' la risposta al client e' diversa.
			nome: "sessione disattivata",
			documento: &models.SessionDoc{
				Active: false, ExpiresAt: adesso.Add(time.Hour),
			},
			erroreAtt: ErrSessionNotFound,
		},
		{
			nome: "sessione scaduta",
			documento: &models.SessionDoc{
				Active: true, ExpiresAt: adesso.Add(-time.Minute),
			},
			erroreAtt: ErrSessionExpired,
		},
		{
			nome: "sessione valida",
			documento: &models.SessionDoc{
				Active: true, ExpiresAt: adesso.Add(time.Hour),
			},
		},
	}

	for i, c := range casi {
		t.Run(c.nome, func(t *testing.T) {
			token := "token-" + string(rune('a'+i))
			// La cache va svuotata: con la chiave presente il metodo
			// risponderebbe dal percorso rapido senza consultare la base dati,
			// e il caso in prova non verrebbe eseguito.
			rdb.Del(ctx, "sess:"+token)

			if c.documento != nil {
				d := *c.documento
				d.ID = token
				d.CreatedAt = adesso
				if _, err := col.InsertOne(ctx, d); err != nil {
					t.Fatalf("inserimento del documento: %v", err)
				}
			}

			got, err := sm.ValidateSession(ctx, token)
			if c.erroreAtt != nil {
				if err != c.erroreAtt {
					t.Fatalf("errore = %v, atteso %v", err, c.erroreAtt)
				}
				return
			}
			if err != nil {
				t.Fatalf("errore inatteso: %v", err)
			}
			if got != token {
				t.Errorf("token = %q, atteso %q", got, token)
			}
		})
	}
}

// La validazione dal percorso lento estende la durata: e' il comportamento a
// finestra scorrevole, senza il quale una sessione scadrebbe mentre e' in uso.
func TestValidateSessionEstendeLaDurata(t *testing.T) {
	db := baseDati(t)
	rdb := cache(t)
	col := JournaledCollection(db, SessionsCollection)
	sm := NewSessionManager(rdb, col)
	ctx := context.Background()

	const token = "token-da-estendere"
	scadenzaIniziale := time.Now().Add(2 * time.Minute)
	_, err := col.InsertOne(ctx, models.SessionDoc{
		ID: token, Active: true, CreatedAt: time.Now(), ExpiresAt: scadenzaIniziale,
	})
	if err != nil {
		t.Fatalf("inserimento del documento: %v", err)
	}
	rdb.Del(ctx, "sess:"+token)

	if _, err := sm.ValidateSession(ctx, token); err != nil {
		t.Fatalf("validazione: %v", err)
	}

	// L'estensione avviene in una goroutine separata per non aggiungere
	// latenza alla richiesta: va attesa invece di darla per immediata.
	var doc models.SessionDoc
	for i := 0; i < 50; i++ {
		time.Sleep(100 * time.Millisecond)
		if err := col.FindOne(ctx, bson.M{"_id": token}).Decode(&doc); err != nil {
			t.Fatalf("rilettura del documento: %v", err)
		}
		if doc.ExpiresAt.After(scadenzaIniziale.Add(time.Minute)) {
			return
		}
	}
	t.Errorf("scadenza non estesa entro il tempo atteso: %v", doc.ExpiresAt)
}

// La conclusione esplicita e la spazzata possono rivendicare la stessa partita:
// quando il gioco avra' un finale, chi lo raggiunge smettera' anche di segnalare
// poco dopo. Due conclusioni per un solo inizio falserebbero l'imbuto senza che
// nulla lo segnali, quindi la rivendicazione deve riuscire una volta sola.
func TestConcludiPartitaRivendicaUnaVoltaSola(t *testing.T) {
	db := baseDati(t)
	ctx := context.Background()

	mgr := NewGameManager(nil, db)
	col := JournaledCollection(db, GameStatesCollection)

	stato := models.GameState{ID: "partita-di-prova", CreatedAt: time.Now()}
	stato.Data.SceneID = "Stage3"
	stato.Meta.LastPing = time.Now()
	if _, err := col.InsertOne(ctx, stato); err != nil {
		t.Fatalf("inserimento dello stato: %v", err)
	}

	emesso, err := mgr.ConcludiPartita(ctx, stato.ID, MotivoCompletata)
	if err != nil {
		t.Fatalf("prima conclusione: %v", err)
	}
	if !emesso {
		t.Fatal("la prima conclusione non ha emesso nulla")
	}

	emesso, err = mgr.ConcludiPartita(ctx, stato.ID, MotivoInattivita)
	if err != nil {
		t.Fatalf("seconda conclusione: %v", err)
	}
	if emesso {
		t.Error("la seconda conclusione ha emesso un secondo evento per la stessa partita")
	}

	// La spazzata non deve trovarla: il marcatore la esclude dal filtro.
	chiudiPartiteFerme(ctx, col, 0)

	var dopo models.GameState
	if err := col.FindOne(ctx, bson.M{"_id": stato.ID}).Decode(&dopo); err != nil {
		t.Fatalf("rilettura dello stato: %v", err)
	}
	if dopo.Meta.ClosedAt == nil {
		t.Error("il marcatore di chiusura non e' stato scritto")
	}
}

// Due repliche del backend spazzano in parallelo. La rivendicazione atomica e'
// cio' che impedisce a entrambe di emettere la conclusione della stessa partita.
func TestConcludiPartitaSottoConcorrenza(t *testing.T) {
	db := baseDati(t)
	ctx := context.Background()

	mgr := NewGameManager(nil, db)
	col := JournaledCollection(db, GameStatesCollection)

	stato := models.GameState{ID: "partita-contesa", CreatedAt: time.Now()}
	stato.Data.SceneID = "Stage2"
	stato.Meta.LastPing = time.Now()
	if _, err := col.InsertOne(ctx, stato); err != nil {
		t.Fatalf("inserimento dello stato: %v", err)
	}

	const concorrenti = 8
	esiti := make(chan bool, concorrenti)
	var pronti sync.WaitGroup
	pronti.Add(concorrenti)
	via := make(chan struct{})

	for i := 0; i < concorrenti; i++ {
		go func() {
			pronti.Done()
			<-via
			emesso, err := mgr.ConcludiPartita(ctx, stato.ID, MotivoCompletata)
			if err != nil {
				t.Errorf("conclusione concorrente: %v", err)
			}
			esiti <- emesso
		}()
	}
	pronti.Wait()
	close(via)

	vincitori := 0
	for i := 0; i < concorrenti; i++ {
		if <-esiti {
			vincitori++
		}
	}
	if vincitori != 1 {
		t.Errorf("conclusioni emesse = %d, attesa 1", vincitori)
	}
}
