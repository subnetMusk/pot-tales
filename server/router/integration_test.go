//go:build integration

// Prove del router completo, con basi dati reali e gli schemi di validazione
// veri letti da `comms/`.
//
// Gli handler dipendono da tipi concreti — client MongoDB e Redis — quindi non
// sono sostituibili con doppi: l'unico modo di esercitarli e' farli girare.
// E' anche il modo in cui si comportano in produzione, quindi la prova dice
// qualcosa di piu' di una con le dipendenze finte.

package router

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/redis/go-redis/v9"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	"github.com/subnetMusk/progetti_innovativi/server/helpers"
	"github.com/subnetMusk/progetti_innovativi/server/middleware"
)

type banco struct {
	server *httptest.Server
	mongo  *mongo.Client
	redis  *redis.Client
}

// nuovoBanco costruisce l'applicazione come la costruisce il punto di ingresso:
// stessi componenti, stesso ordine, stessi schemi. Una prova su un assemblaggio
// diverso verificherebbe qualcosa che non viene mai messo in produzione.
func nuovoBanco(t *testing.T) *banco {
	t.Helper()

	uri := os.Getenv("MONGO_URI")
	redisURL := os.Getenv("REDIS_URL")
	if uri == "" || redisURL == "" {
		t.Skip("MONGO_URI o REDIS_URL non impostate")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	m, err := mongo.Connect(ctx, options.Client().ApplyURI(uri))
	if err != nil {
		t.Fatalf("connessione a MongoDB: %v", err)
	}
	if err := m.Ping(ctx, nil); err != nil {
		t.Fatalf("MongoDB non risponde: %v", err)
	}

	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		t.Fatalf("URL della cache non valida: %v", err)
	}
	rdb := redis.NewClient(opt)
	if err := rdb.Ping(ctx).Err(); err != nil {
		t.Fatalf("la cache non risponde: %v", err)
	}

	// Il router usa il database `game_db`: viene svuotato prima e dopo, cosi'
	// che l'esito non dipenda da cio' che ha lasciato la prova precedente.
	svuota := func() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = m.Database("game_db").Drop(ctx)
		rdb.FlushDB(ctx)
	}
	svuota()

	sessionCol := helpers.JournaledCollection(m.Database("game_db"), helpers.SessionsCollection)
	val := middleware.MustNew("../../comms/server", helpers.NewSessionManager(rdb, sessionCol)).
		WithQuota(helpers.NewRateLimiter(rdb), 10*time.Minute)

	srv := httptest.NewServer(New(m, rdb, val, "30"))

	b := &banco{server: srv, mongo: m, redis: rdb}
	t.Cleanup(func() {
		srv.Close()
		svuota()
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = m.Disconnect(ctx)
		_ = rdb.Close()
	})
	return b
}

// creaSessione esegue la creazione e restituisce il token e il cookie.
func (b *banco) creaSessione(t *testing.T) (string, *http.Cookie) {
	t.Helper()

	corpo := `{"device":"collaudo","ipAddress":"203.0.113.7","consentGiven":true}`
	risposta, err := http.Post(b.server.URL+"/auth/session", "application/json", strings.NewReader(corpo))
	if err != nil {
		t.Fatalf("richiesta di creazione: %v", err)
	}
	defer risposta.Body.Close()

	if risposta.StatusCode != http.StatusCreated {
		t.Fatalf("creazione: codice = %d, atteso %d", risposta.StatusCode, http.StatusCreated)
	}

	var payload struct {
		Token   string `json:"token"`
		Expires string `json:"expires"`
	}
	if err := json.NewDecoder(risposta.Body).Decode(&payload); err != nil {
		t.Fatalf("risposta non in formato JSON: %v", err)
	}

	for _, c := range risposta.Cookies() {
		if c.Name == helpers.SessionCookieName {
			return payload.Token, c
		}
	}
	t.Fatal("cookie di sessione assente nella risposta")
	return "", nil
}

// --- Salute -----------------------------------------------------------------

func TestHealthRiportaLoStatoDelleDipendenze(t *testing.T) {
	b := nuovoBanco(t)

	risposta, err := http.Get(b.server.URL + "/health")
	if err != nil {
		t.Fatalf("richiesta: %v", err)
	}
	defer risposta.Body.Close()

	if risposta.StatusCode != http.StatusOK {
		t.Fatalf("codice = %d, atteso %d", risposta.StatusCode, http.StatusOK)
	}

	var stato map[string]bool
	if err := json.NewDecoder(risposta.Body).Decode(&stato); err != nil {
		t.Fatalf("risposta non in formato JSON: %v", err)
	}
	for _, chiave := range []string{"server", "mongodb", "redis"} {
		if !stato[chiave] {
			t.Errorf("%s = false con la dipendenza attiva", chiave)
		}
	}
}

// --- Sessione ---------------------------------------------------------------

func TestCreazioneSessionePersisteSessioneEStatoDiGioco(t *testing.T) {
	b := nuovoBanco(t)
	token, cookie := b.creaSessione(t)
	ctx := context.Background()

	if token == "" {
		t.Fatal("token vuoto nella risposta")
	}
	if !cookie.HttpOnly {
		t.Error("il cookie di sessione e' leggibile da script")
	}

	db := b.mongo.Database("game_db")

	var sessione bson.M
	if err := db.Collection(helpers.SessionsCollection).FindOne(ctx, bson.M{"_id": token}).Decode(&sessione); err != nil {
		t.Fatalf("documento di sessione assente: %v", err)
	}
	if sessione["active"] != true {
		t.Error("la sessione creata non risulta attiva")
	}
	// L'indirizzo dichiarato dal client non e' verificabile e non va persistito:
	// conservarlo significherebbe archiviare un dato personale su cui non si ha
	// alcuna garanzia.
	if _, presente := sessione["reported_ip"]; presente {
		t.Error("l'indirizzo dichiarato dal client e' stato persistito")
	}

	// Lo stato di gioco deve nascere insieme alla sessione: senza, la prima
	// richiesta di gioco troverebbe una partita inesistente.
	var gioco bson.M
	if err := db.Collection(helpers.GameStatesCollection).FindOne(ctx, bson.M{"_id": token}).Decode(&gioco); err != nil {
		t.Fatalf("stato di gioco assente: %v", err)
	}

	// La cache deve contenere la sessione con una durata ridotta: le sessioni
	// create e mai usate scadono in pochi minuti invece di occupare spazio per
	// l'intera durata nominale.
	durata := b.redis.TTL(ctx, "sess:"+token).Val()
	if durata <= 0 {
		t.Fatalf("durata in cache = %v, attesa positiva", durata)
	}
	if durata > 10*time.Minute {
		t.Errorf("durata in cache = %v: la sessione appena creata ha gia' la durata piena", durata)
	}
}

func TestValidateRichiedeIlCookie(t *testing.T) {
	b := nuovoBanco(t)

	risposta, err := http.Get(b.server.URL + "/auth/validate")
	if err != nil {
		t.Fatalf("richiesta: %v", err)
	}
	defer risposta.Body.Close()

	if risposta.StatusCode != http.StatusUnauthorized {
		t.Errorf("senza cookie: codice = %d, atteso %d", risposta.StatusCode, http.StatusUnauthorized)
	}
}

func TestValidateConCookieValido(t *testing.T) {
	b := nuovoBanco(t)
	token, cookie := b.creaSessione(t)

	richiesta, _ := http.NewRequest(http.MethodGet, b.server.URL+"/auth/validate", nil)
	richiesta.AddCookie(cookie)

	risposta, err := http.DefaultClient.Do(richiesta)
	if err != nil {
		t.Fatalf("richiesta: %v", err)
	}
	defer risposta.Body.Close()

	if risposta.StatusCode != http.StatusOK {
		t.Fatalf("codice = %d, atteso %d", risposta.StatusCode, http.StatusOK)
	}

	var payload map[string]string
	if err := json.NewDecoder(risposta.Body).Decode(&payload); err != nil {
		t.Fatalf("risposta non in formato JSON: %v", err)
	}
	if payload["state"] != "active" {
		t.Errorf("stato = %q, atteso active", payload["state"])
	}
	if payload["session"] != token {
		t.Errorf("sessione = %q, attesa %q", payload["session"], token)
	}
}

// Un cookie inventato non deve autorizzare: e' il caso che separa una sessione
// da un identificativo qualsiasi.
func TestValidateConTokenInventato(t *testing.T) {
	b := nuovoBanco(t)

	richiesta, _ := http.NewRequest(http.MethodGet, b.server.URL+"/auth/validate", nil)
	richiesta.AddCookie(&http.Cookie{Name: helpers.SessionCookieName, Value: "mai-emesso"})

	risposta, err := http.DefaultClient.Do(richiesta)
	if err != nil {
		t.Fatalf("richiesta: %v", err)
	}
	defer risposta.Body.Close()

	if risposta.StatusCode != http.StatusUnauthorized {
		t.Errorf("codice = %d, atteso %d", risposta.StatusCode, http.StatusUnauthorized)
	}
}

// --- Gioco ------------------------------------------------------------------

func TestPosizioneRestituisceLoStatoIniziale(t *testing.T) {
	b := nuovoBanco(t)
	_, cookie := b.creaSessione(t)

	richiesta, _ := http.NewRequest(http.MethodGet, b.server.URL+"/game/position", nil)
	richiesta.AddCookie(cookie)

	risposta, err := http.DefaultClient.Do(richiesta)
	if err != nil {
		t.Fatalf("richiesta: %v", err)
	}
	defer risposta.Body.Close()

	if risposta.StatusCode != http.StatusOK {
		t.Fatalf("codice = %d, atteso %d", risposta.StatusCode, http.StatusOK)
	}

	// La risposta non e' fatta di sole stringhe: accanto a scena e ultimo ping
	// porta l'elenco dei traguardi raggiunti.
	var payload struct {
		SceneID     string   `json:"scene_id"`
		LastPing    string   `json:"last_ping"`
		Checkpoints []string `json:"checkpoints"`
	}
	if err := json.NewDecoder(risposta.Body).Decode(&payload); err != nil {
		t.Fatalf("risposta non in formato JSON: %v", err)
	}
	if payload.SceneID == "" {
		t.Error("scena assente nella risposta")
	}
	if payload.LastPing == "" {
		t.Error("istante dell'ultimo ping assente")
	}
	// Su una sessione appena creata l'handler serve un elenco vuoto e non null:
	// decodificato, un campo assente o null resta nil.
	if payload.Checkpoints == nil {
		t.Error("elenco dei traguardi assente o null")
	}
	if len(payload.Checkpoints) != 0 {
		t.Errorf("traguardi su una sessione appena creata: %v", payload.Checkpoints)
	}
}

func TestTimerSuSessioneAppenaCreata(t *testing.T) {
	b := nuovoBanco(t)
	_, cookie := b.creaSessione(t)

	richiesta, _ := http.NewRequest(http.MethodGet, b.server.URL+"/game/timer", nil)
	richiesta.AddCookie(cookie)

	risposta, err := http.DefaultClient.Do(richiesta)
	if err != nil {
		t.Fatalf("richiesta: %v", err)
	}
	defer risposta.Body.Close()

	if risposta.StatusCode != http.StatusOK {
		t.Fatalf("codice = %d, atteso %d", risposta.StatusCode, http.StatusOK)
	}

	var payload map[string]any
	if err := json.NewDecoder(risposta.Body).Decode(&payload); err != nil {
		t.Fatalf("risposta non in formato JSON: %v", err)
	}
	// La sessione e' appena nata, quindi l'ultimo ping e' recente: il timer deve
	// considerarla attiva.
	if payload["is_active"] != true {
		t.Errorf("is_active = %v, atteso true su sessione appena creata", payload["is_active"])
	}
}

func TestRotteDiGiocoRichiedonoAutenticazione(t *testing.T) {
	b := nuovoBanco(t)

	for _, percorso := range []string{"/game/position", "/game/timer"} {
		risposta, err := http.Get(b.server.URL + percorso)
		if err != nil {
			t.Fatalf("richiesta %s: %v", percorso, err)
		}
		risposta.Body.Close()
		if risposta.StatusCode != http.StatusUnauthorized {
			t.Errorf("%s senza cookie: codice = %d, atteso %d",
				percorso, risposta.StatusCode, http.StatusUnauthorized)
		}
	}
}

// --- Ingestione degli eventi dal frontend -----------------------------------

func TestIngestioneEventiAccettaEventiValidi(t *testing.T) {
	b := nuovoBanco(t)

	corpo := `{"category":"gameplay","action":"scena_avviata","level":"info","details":{"scene":"vaso"}}`
	risposta, err := http.Post(b.server.URL+"/log", "application/json", strings.NewReader(corpo))
	if err != nil {
		t.Fatalf("richiesta: %v", err)
	}
	defer risposta.Body.Close()

	if risposta.StatusCode != http.StatusOK {
		t.Errorf("codice = %d, atteso %d", risposta.StatusCode, http.StatusOK)
	}
}

// Un corpo malformato non deve produrre un errore: la risposta d'errore
// verrebbe registrata dal frontend, che la rispedirebbe, innescando un ciclo
// che si alimenta da solo.
func TestIngestioneEventiNonRispondeConErroreSuCorpoMalformato(t *testing.T) {
	b := nuovoBanco(t)

	risposta, err := http.Post(b.server.URL+"/log", "application/json", strings.NewReader("{non valido"))
	if err != nil {
		t.Fatalf("richiesta: %v", err)
	}
	defer risposta.Body.Close()

	if risposta.StatusCode != http.StatusOK {
		t.Errorf("codice = %d, atteso %d", risposta.StatusCode, http.StatusOK)
	}
}

// --- Superficie esposta -----------------------------------------------------

// Solo le rotte dichiarate rispondono: il resto non deve nemmeno risultare
// esistente.
func TestRotteNonDichiarateNonEsistono(t *testing.T) {
	b := nuovoBanco(t)

	for _, percorso := range []string{"/admin", "/auth", "/game", "/debug/pprof/"} {
		risposta, err := http.Get(b.server.URL + percorso)
		if err != nil {
			t.Fatalf("richiesta %s: %v", percorso, err)
		}
		risposta.Body.Close()
		if risposta.StatusCode != http.StatusNotFound {
			t.Errorf("%s: codice = %d, atteso %d", percorso, risposta.StatusCode, http.StatusNotFound)
		}
	}
}

// Il metodo fa parte della dichiarazione della rotta: la creazione di sessione
// esiste in POST e non in GET.
func TestMetodoNonPrevistoNonEsiste(t *testing.T) {
	b := nuovoBanco(t)

	risposta, err := http.Get(b.server.URL + "/auth/session")
	if err != nil {
		t.Fatalf("richiesta: %v", err)
	}
	defer risposta.Body.Close()

	if risposta.StatusCode != http.StatusNotFound {
		t.Errorf("codice = %d, atteso %d", risposta.StatusCode, http.StatusNotFound)
	}
}

// Il corpo viene validato contro lo schema prima di raggiungere l'handler.
func TestCreazioneSessioneRifiutaCorpoNonConforme(t *testing.T) {
	b := nuovoBanco(t)

	casi := map[string]string{
		"campo inatteso":  `{"campo_inesistente":1}`,
		"corpo vuoto":     ``,
		"tipo sbagliato":  `{"device":123,"consentGiven":true}`,
		"JSON malformato": `{"device":`,
	}

	for nome, corpo := range casi {
		t.Run(nome, func(t *testing.T) {
			risposta, err := http.Post(b.server.URL+"/auth/session", "application/json", strings.NewReader(corpo))
			if err != nil {
				t.Fatalf("richiesta: %v", err)
			}
			defer risposta.Body.Close()
			if risposta.StatusCode != http.StatusBadRequest {
				t.Errorf("codice = %d, atteso %d", risposta.StatusCode, http.StatusBadRequest)
			}
		})
	}
}

// dbDiProva restituisce la base dati usata dall'applicazione sotto prova. Il
// nome e' cablato perche' lo e' anche in `registerGame`: ricavarlo altrimenti
// farebbe puntare la verifica a una collezione che il codice non tocca.
func (b *banco) dbDiProva() *mongo.Database {
	return b.mongo.Database("game_db")
}

// Lo stato di gioco puo' mancare anche con una sessione valida: il documento
// vive in una collezione separata e ha una propria ritenzione. La rotta deve
// dichiarare il guasto invece di rispondere con coordinate inventate, che il
// client userebbe per posizionare il giocatore da qualche parte.
func TestPositionSenzaStatoDiGiocoDichiaraIlGuasto(t *testing.T) {
	b := nuovoBanco(t)
	token, cookie := b.creaSessione(t)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if _, err := b.dbDiProva().Collection(helpers.GameStatesCollection).
		DeleteOne(ctx, bson.M{"_id": token}); err != nil {
		t.Fatalf("rimozione dello stato di gioco: %v", err)
	}

	richiesta, _ := http.NewRequest(http.MethodGet, b.server.URL+"/game/position", nil)
	richiesta.AddCookie(cookie)
	risposta, err := http.DefaultClient.Do(richiesta)
	if err != nil {
		t.Fatalf("richiesta: %v", err)
	}
	defer risposta.Body.Close()

	if risposta.StatusCode != http.StatusInternalServerError {
		t.Fatalf("codice = %d, atteso %d", risposta.StatusCode, http.StatusInternalServerError)
	}
}

// Il timer, a differenza della posizione, degrada invece di fallire: un
// contatore assente non impedisce di giocare, e un errore qui interromperebbe
// l'interfaccia per un dato accessorio.
func TestTimerSenzaStatoDiGiocoDegradaAZero(t *testing.T) {
	b := nuovoBanco(t)
	token, cookie := b.creaSessione(t)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if _, err := b.dbDiProva().Collection(helpers.GameStatesCollection).
		DeleteOne(ctx, bson.M{"_id": token}); err != nil {
		t.Fatalf("rimozione dello stato di gioco: %v", err)
	}

	richiesta, _ := http.NewRequest(http.MethodGet, b.server.URL+"/game/timer", nil)
	richiesta.AddCookie(cookie)
	risposta, err := http.DefaultClient.Do(richiesta)
	if err != nil {
		t.Fatalf("richiesta: %v", err)
	}
	defer risposta.Body.Close()

	if risposta.StatusCode != http.StatusOK {
		t.Fatalf("codice = %d, atteso %d", risposta.StatusCode, http.StatusOK)
	}

	var payload map[string]any
	if err := json.NewDecoder(risposta.Body).Decode(&payload); err != nil {
		t.Fatalf("risposta non in formato JSON: %v", err)
	}
	if attivo, _ := payload["is_active"].(bool); attivo {
		t.Error("senza stato di gioco la sessione non puo' risultare attiva")
	}
}

// Oltre la soglia di inattivita' il tempo corrente non viene proiettato: il
// totale resta quello registrato. Senza questa distinzione una scheda lasciata
// aperta accumulerebbe tempo di gioco che nessuno ha giocato.
func TestTimerNonProiettaTempoSuSessioneInattiva(t *testing.T) {
	b := nuovoBanco(t)
	token, cookie := b.creaSessione(t)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	passato := time.Now().Add(-1 * time.Hour)
	if _, err := b.dbDiProva().Collection(helpers.GameStatesCollection).UpdateOne(ctx,
		bson.M{"_id": token},
		bson.M{"$set": bson.M{"meta.last_ping": passato, "data.total_time_ms": int64(4200)}},
	); err != nil {
		t.Fatalf("invecchiamento dello stato di gioco: %v", err)
	}

	richiesta, _ := http.NewRequest(http.MethodGet, b.server.URL+"/game/timer", nil)
	richiesta.AddCookie(cookie)
	risposta, err := http.DefaultClient.Do(richiesta)
	if err != nil {
		t.Fatalf("richiesta: %v", err)
	}
	defer risposta.Body.Close()

	var payload map[string]any
	if err := json.NewDecoder(risposta.Body).Decode(&payload); err != nil {
		t.Fatalf("risposta non in formato JSON: %v", err)
	}
	if attivo, _ := payload["is_active"].(bool); attivo {
		t.Error("dopo un'ora di silenzio la sessione non e' attiva")
	}
	// Il totale deve restare quello scritto, in secondi frazionari: nessuna
	// proiezione aggiuntiva sopra i 4200 ms registrati.
	if secondi, _ := payload["total_playtime_seconds"].(float64); secondi != 4.2 {
		t.Errorf("secondi totali = %v, attesi 4.2", secondi)
	}
}
