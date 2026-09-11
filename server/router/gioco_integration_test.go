//go:build integration

// Prove degli handler di gioco che scrivono: ping, traguardi e azzeramento.
//
// Oltre alla risposta verificano lo stato persistito e i fatti di partita
// emessi. E' li' che questi handler producono i loro effetti: la risposta a un
// ping accettato e' la parte meno interessante di cio' che succede.

package router

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"slices"
	"strings"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"

	"github.com/subnetMusk/progetti_innovativi/server/helpers"
	"github.com/subnetMusk/progetti_innovativi/server/models"
)

// scenaIniziale e' la scena in cui nasce ogni partita, assegnata dalla
// creazione della sessione.
const scenaIniziale = "Stage2"

// postGioco esegue una POST su una rotta di gioco, autenticata se il cookie e'
// presente, e decodifica la risposta.
func (b *banco) postGioco(t *testing.T, cookie *http.Cookie, percorso, corpo string) (int, map[string]any) {
	t.Helper()

	richiesta, err := http.NewRequest(http.MethodPost, b.server.URL+percorso, strings.NewReader(corpo))
	if err != nil {
		t.Fatalf("costruzione della richiesta %s: %v", percorso, err)
	}
	richiesta.Header.Set("Content-Type", "application/json")
	if cookie != nil {
		richiesta.AddCookie(cookie)
	}

	risposta, err := http.DefaultClient.Do(richiesta)
	if err != nil {
		t.Fatalf("richiesta %s: %v", percorso, err)
	}
	defer risposta.Body.Close()

	var payload map[string]any
	_ = json.NewDecoder(risposta.Body).Decode(&payload)
	return risposta.StatusCode, payload
}

// statoDiGioco legge lo stato persistito. Il secondo valore e' false se il
// documento non esiste.
func (b *banco) statoDiGioco(t *testing.T, token string) (models.GameState, bool) {
	t.Helper()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var s models.GameState
	err := b.dbDiProva().Collection(helpers.GameStatesCollection).
		FindOne(ctx, bson.M{"_id": token}).Decode(&s)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return s, false
	}
	if err != nil {
		t.Fatalf("lettura dello stato di gioco: %v", err)
	}
	return s, true
}

// impostaStato porta lo stato di gioco nella condizione richiesta dalla prova,
// scrivendo direttamente sulla base dati.
func (b *banco) impostaStato(t *testing.T, token string, campi bson.M) {
	t.Helper()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if _, err := b.dbDiProva().Collection(helpers.GameStatesCollection).
		UpdateOne(ctx, bson.M{"_id": token}, bson.M{"$set": campi}); err != nil {
		t.Fatalf("preparazione dello stato di gioco: %v", err)
	}
}

// partitaInCorso prepara una partita con tempo gia' accumulato, ferma
// nell'origine della scena iniziale, con l'ultimo ping `fa` prima di adesso.
//
// E' la condizione in cui la validazione applica i controlli di tempo e di
// velocita': sul primo ping e sui cambi di scena li salta. I valori usati dalle
// prove stanno lontani dalle soglie, cosi' la latenza della richiesta non sposta
// un caso da una parte all'altra.
func (b *banco) partitaInCorso(t *testing.T, token string, fa time.Duration) {
	t.Helper()
	b.impostaStato(t, token, bson.M{
		"data.scene_id":      scenaIniziale,
		"data.x":             0.0,
		"data.y":             0.0,
		"data.total_time_ms": int64(1000),
		"meta.last_ping":     time.Now().Add(-fa),
	})
}

// catturaFatti esegue f e restituisce i fatti di partita emessi nel frattempo.
//
// L'uscita standard viene deviata su una pipe letta in parallelo: il server
// registra anche le richieste, e una pipe che nessuno legge si riempirebbe
// bloccando gli handler. I logger catturano il descrittore alla costruzione,
// quindi vanno ricostruiti sia dopo la deviazione sia dopo il ripristino.
//
// Il ripristino sta in un defer: se f interrompe la prova, l'uscita standard non
// deve restare deviata sulle prove successive.
func catturaFatti(t *testing.T, f func()) (fatti []map[string]any) {
	t.Helper()

	originale := os.Stdout
	lettura, scrittura, err := os.Pipe()
	if err != nil {
		t.Fatalf("creazione della pipe: %v", err)
	}
	os.Stdout = scrittura
	helpers.InitLogger("prova", "collaudo")

	letto := make(chan []byte, 1)
	go func() {
		grezzo, _ := io.ReadAll(lettura)
		letto <- grezzo
	}()

	defer func() {
		os.Stdout = originale
		helpers.InitLogger("prova", "collaudo")
		_ = scrittura.Close()
		grezzo := <-letto
		_ = lettura.Close()

		for _, riga := range strings.Split(string(grezzo), "\n") {
			var m map[string]any
			if json.Unmarshal([]byte(riga), &m) != nil {
				continue
			}
			if m["event.dataset"] == helpers.GameplayDataset {
				fatti = append(fatti, m)
			}
		}
	}()

	f()
	return nil
}

// conAzione restituisce i fatti con l'azione indicata.
func conAzione(fatti []map[string]any, azione string) []map[string]any {
	var trovati []map[string]any
	for _, f := range fatti {
		if f["event.action"] == azione {
			trovati = append(trovati, f)
		}
	}
	return trovati
}

// --- Ping -------------------------------------------------------------------

// Il primo ping e i cambi di scena sono accettati senza controllo di velocita',
// e il cambio di scena e' l'unico punto in cui l'avanzamento diventa
// osservabile. Interessa la transizione, non la permanenza: un secondo ping
// sulla stessa scena non emette nulla.
func TestPingCambioDiScenaAggiornaLoStatoEdEmetteLaTransizione(t *testing.T) {
	b := nuovoBanco(t)
	token, cookie := b.creaSessione(t)

	var codice int
	var risposta map[string]any
	fatti := catturaFatti(t, func() {
		codice, risposta = b.postGioco(t, cookie, "/game/ping", `{"scene_id":"Stage3","x":12.5,"y":7}`)
	})

	if codice != http.StatusOK {
		t.Fatalf("codice = %d, atteso %d", codice, http.StatusOK)
	}
	if risposta["action"] != "accept" {
		t.Fatalf("azione = %v, attesa accept", risposta["action"])
	}
	if risposta["scene_id"] != "Stage3" || risposta["x"] != "12.500000" || risposta["y"] != "7.000000" {
		t.Errorf("risposta = %v, attese la scena e la posizione inviate", risposta)
	}

	s, esiste := b.statoDiGioco(t, token)
	if !esiste {
		t.Fatal("stato di gioco assente dopo un ping accettato")
	}
	if s.Data.SceneID != "Stage3" || s.Data.X != 12.5 || s.Data.Y != 7 {
		t.Errorf("stato persistito = %s (%v, %v), atteso Stage3 (12.5, 7)", s.Data.SceneID, s.Data.X, s.Data.Y)
	}
	// Il ping e' cio' che rende la posizione ripristinabile: senza l'ultimo
	// ping aggiornato lo stato risulterebbe mai posizionato.
	if !s.PositionRecorded() {
		t.Error("dopo un ping accettato lo stato non risulta posizionato")
	}

	transizioni := conAzione(fatti, "scena_iniziata")
	if len(transizioni) != 1 {
		t.Fatalf("transizioni emesse = %d, attesa 1", len(transizioni))
	}
	if transizioni[0]["partita.scena"] != "Stage3" || transizioni[0]["partita.scena_precedente"] != scenaIniziale {
		t.Errorf("transizione = %v, attesa da %s a Stage3", transizioni[0], scenaIniziale)
	}

	fatti = catturaFatti(t, func() {
		codice, _ = b.postGioco(t, cookie, "/game/ping", `{"scene_id":"Stage3","x":13,"y":7}`)
	})
	if codice != http.StatusOK {
		t.Fatalf("secondo ping: codice = %d, atteso %d", codice, http.StatusOK)
	}
	if n := len(conAzione(fatti, "scena_iniziata")); n != 0 {
		t.Errorf("un ping sulla stessa scena ha emesso %d transizioni", n)
	}
}

// A partita avviata il ping accettato accumula il tempo trascorso dall'ultimo:
// e' la sola fonte della durata di gioco.
func TestPingAccettatoAccumulaIlTempo(t *testing.T) {
	b := nuovoBanco(t)
	token, cookie := b.creaSessione(t)
	b.partitaInCorso(t, token, time.Second)

	codice, risposta := b.postGioco(t, cookie, "/game/ping",
		fmt.Sprintf(`{"scene_id":%q,"x":5,"y":0}`, scenaIniziale))
	if codice != http.StatusOK {
		t.Fatalf("codice = %d, atteso %d", codice, http.StatusOK)
	}
	if risposta["action"] != "accept" {
		t.Fatalf("azione = %v, attesa accept", risposta["action"])
	}

	s, _ := b.statoDiGioco(t, token)
	if s.Data.X != 5 {
		t.Errorf("posizione persistita = %v, attesa 5", s.Data.X)
	}
	// I 1000 ms gia' registrati piu' il secondo trascorso, con la latenza della
	// richiesta come unico scarto.
	if s.Data.TotalPlayTimeMs < 2000 || s.Data.TotalPlayTimeMs > 4000 {
		t.Errorf("tempo accumulato = %d ms, atteso fra 2000 e 4000", s.Data.TotalPlayTimeMs)
	}
}

// Un ping sospetto non viene persistito, e la risposta riporta l'ultimo stato
// autoritativo perche' il client possa riallinearsi.
func TestPingSospettoNonPersisteLaPosizione(t *testing.T) {
	casi := []struct {
		nome   string
		fa     time.Duration
		x      float64
		azione string
	}{
		{"velocita' oltre il consentito", time.Second, 50, "rubberband"},
		{"silenzio oltre la soglia grave", 10 * time.Second, 1, "rubberband"},
		{"silenzio oltre la soglia estrema", 20 * time.Second, 1, "kick"},
	}

	for _, c := range casi {
		t.Run(c.nome, func(t *testing.T) {
			b := nuovoBanco(t)
			token, cookie := b.creaSessione(t)
			b.partitaInCorso(t, token, c.fa)

			codice, risposta := b.postGioco(t, cookie, "/game/ping",
				fmt.Sprintf(`{"scene_id":%q,"x":%g,"y":0}`, scenaIniziale, c.x))
			if codice != http.StatusOK {
				t.Fatalf("codice = %d, atteso %d", codice, http.StatusOK)
			}
			if risposta["action"] != c.azione {
				t.Fatalf("azione = %v, attesa %s", risposta["action"], c.azione)
			}
			if risposta["x"] != "0.000000" {
				t.Errorf("posizione nella risposta = %v, attesa quella autoritativa 0.000000", risposta["x"])
			}

			s, esiste := b.statoDiGioco(t, token)
			if !esiste {
				t.Fatal("un ping sospetto ha cancellato lo stato di gioco")
			}
			if s.Data.X != 0 || s.Data.TotalPlayTimeMs != 1000 {
				t.Errorf("stato persistito = x %v, tempo %d; atteso invariato a x 0, tempo 1000",
					s.Data.X, s.Data.TotalPlayTimeMs)
			}
		})
	}
}

// Uno spostamento impossibile cancella la partita. La spazzata non la trovera'
// piu', quindi la conclusione va emessa qui: senza, l'imbuto conterebbe come
// abbandono un'espulsione.
func TestPingImpossibileEspelleEChiudeLaPartita(t *testing.T) {
	b := nuovoBanco(t)
	token, cookie := b.creaSessione(t)
	b.partitaInCorso(t, token, time.Second)
	b.impostaStato(t, token, bson.M{"data.checkpoints": []string{"a", "b"}})

	var codice int
	var risposta map[string]any
	fatti := catturaFatti(t, func() {
		codice, risposta = b.postGioco(t, cookie, "/game/ping",
			fmt.Sprintf(`{"scene_id":%q,"x":500,"y":0}`, scenaIniziale))
	})

	if codice != http.StatusOK {
		t.Fatalf("codice = %d, atteso %d", codice, http.StatusOK)
	}
	if risposta["action"] != "ban" {
		t.Fatalf("azione = %v, attesa ban", risposta["action"])
	}
	if _, esiste := b.statoDiGioco(t, token); esiste {
		t.Error("lo stato della partita espulsa esiste ancora")
	}

	conclusioni := conAzione(fatti, "sessione_conclusa")
	if len(conclusioni) != 1 {
		t.Fatalf("conclusioni emesse = %d, attesa 1", len(conclusioni))
	}
	c := conclusioni[0]
	if c["partita.motivo"] != helpers.MotivoEspulsione {
		t.Errorf("motivo = %v, atteso %s", c["partita.motivo"], helpers.MotivoEspulsione)
	}
	if c["partita.scena_finale"] != scenaIniziale {
		t.Errorf("scena finale = %v, attesa %s", c["partita.scena_finale"], scenaIniziale)
	}
	// I numeri arrivano dalla decodifica come float64.
	if c["partita.durata_ms"] != float64(1000) || c["partita.checkpoint_n"] != float64(2) {
		t.Errorf("durata e traguardi = %v e %v, attesi 1000 e 2", c["partita.durata_ms"], c["partita.checkpoint_n"])
	}
}

// Senza stato di gioco il ping non ha nulla contro cui validare: la rotta
// dichiara il guasto invece di accettare una posizione non verificabile.
func TestPingSenzaStatoDiGiocoDichiaraIlGuasto(t *testing.T) {
	b := nuovoBanco(t)
	token, cookie := b.creaSessione(t)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if _, err := b.dbDiProva().Collection(helpers.GameStatesCollection).
		DeleteOne(ctx, bson.M{"_id": token}); err != nil {
		t.Fatalf("rimozione dello stato di gioco: %v", err)
	}

	codice, _ := b.postGioco(t, cookie, "/game/ping",
		fmt.Sprintf(`{"scene_id":%q,"x":1,"y":1}`, scenaIniziale))
	if codice != http.StatusInternalServerError {
		t.Errorf("codice = %d, atteso %d", codice, http.StatusInternalServerError)
	}
}

// --- Traguardi --------------------------------------------------------------

// I traguardi sono un insieme: ripetere lo stesso non lo duplica. Nella forma
// "chiave|valore" la voce precedente con la stessa chiave viene sostituita, e
// una chiave che ne estende un'altra non viene toccata. Il gioco riprende da
// cio' che la posizione riporta, quindi l'elenco va verificato anche li'.
func TestCheckpointRegistraSostituisceEDeduplica(t *testing.T) {
	b := nuovoBanco(t)
	token, cookie := b.creaSessione(t)

	inviati := []string{"stage2_turret_0", "stage2_turret_0", "torretta_1|nord", "torretta_10|est", "torretta_1|sud"}
	fatti := catturaFatti(t, func() {
		for _, id := range inviati {
			codice, risposta := b.postGioco(t, cookie, "/game/checkpoint", fmt.Sprintf(`{"checkpoint_id":%q}`, id))
			if codice != http.StatusOK || risposta["status"] != "ok" {
				t.Errorf("%s: codice = %d, risposta %v", id, codice, risposta)
			}
		}
	})

	atteso := []string{"stage2_turret_0", "torretta_10|est", "torretta_1|sud"}
	slices.Sort(atteso)

	s, _ := b.statoDiGioco(t, token)
	persistiti := slices.Clone(s.Data.Checkpoints)
	slices.Sort(persistiti)
	if !slices.Equal(persistiti, atteso) {
		t.Errorf("traguardi persistiti = %v, attesi %v", persistiti, atteso)
	}

	richiesta, _ := http.NewRequest(http.MethodGet, b.server.URL+"/game/position", nil)
	richiesta.AddCookie(cookie)
	risposta, err := http.DefaultClient.Do(richiesta)
	if err != nil {
		t.Fatalf("richiesta della posizione: %v", err)
	}
	defer risposta.Body.Close()
	var posizione struct {
		Checkpoints []string `json:"checkpoints"`
	}
	if err := json.NewDecoder(risposta.Body).Decode(&posizione); err != nil {
		t.Fatalf("risposta della posizione non in formato JSON: %v", err)
	}
	slices.Sort(posizione.Checkpoints)
	if !slices.Equal(posizione.Checkpoints, atteso) {
		t.Errorf("traguardi nella posizione = %v, attesi %v", posizione.Checkpoints, atteso)
	}

	// Ogni registrazione produce un fatto con l'identificativo opaco, che la
	// dashboard aggrega come etichetta.
	registrati := map[string]bool{}
	for _, f := range conAzione(fatti, "checkpoint_raggiunto") {
		if id, ok := f["partita.checkpoint"].(string); ok {
			registrati[id] = true
		}
	}
	for _, id := range inviati {
		if !registrati[id] {
			t.Errorf("nessun fatto emesso per il traguardo %s", id)
		}
	}
}

// --- Azzeramento ------------------------------------------------------------

// L'azzeramento cancella lo stato e lo dichiara con un'azione propria, distinta
// dalla conclusione: la partita non e' finita, e' ricominciata. Contarla come
// conclusione darebbe due fini per un solo inizio.
func TestResetCancellaLoStatoEDichiaraDaDoveSiRiparte(t *testing.T) {
	b := nuovoBanco(t)
	token, cookie := b.creaSessione(t)
	b.impostaStato(t, token, bson.M{
		"data.scene_id":      "Stage3",
		"data.total_time_ms": int64(4200),
		"data.checkpoints":   []string{"a", "b", "c"},
	})

	var codice int
	var risposta map[string]any
	fatti := catturaFatti(t, func() {
		codice, risposta = b.postGioco(t, cookie, "/game/reset", `{}`)
	})

	if codice != http.StatusOK || risposta["status"] != "ok" {
		t.Fatalf("codice = %d, risposta %v", codice, risposta)
	}
	if _, esiste := b.statoDiGioco(t, token); esiste {
		t.Error("lo stato di gioco esiste ancora dopo l'azzeramento")
	}

	azzeramenti := conAzione(fatti, "partita_azzerata")
	if len(azzeramenti) != 1 {
		t.Fatalf("azzeramenti emessi = %d, atteso 1", len(azzeramenti))
	}
	a := azzeramenti[0]
	if a["partita.scena_finale"] != "Stage3" || a["partita.durata_ms"] != float64(4200) || a["partita.checkpoint_n"] != float64(3) {
		t.Errorf("azzeramento = %v, attesi scena Stage3, 4200 ms e 3 traguardi", a)
	}
	if n := len(conAzione(fatti, "sessione_conclusa")); n != 0 {
		t.Errorf("l'azzeramento ha emesso %d conclusioni", n)
	}
}

// Senza stato da azzerare l'operazione riesce lo stesso, perche' e' cio' che
// l'utente ha chiesto, ma non c'e' nulla da cui dire da dove si riparte.
func TestResetSenzaStatoRiesceSenzaEmettere(t *testing.T) {
	b := nuovoBanco(t)
	token, cookie := b.creaSessione(t)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if _, err := b.dbDiProva().Collection(helpers.GameStatesCollection).
		DeleteOne(ctx, bson.M{"_id": token}); err != nil {
		t.Fatalf("rimozione dello stato di gioco: %v", err)
	}

	var codice int
	fatti := catturaFatti(t, func() {
		codice, _ = b.postGioco(t, cookie, "/game/reset", `{}`)
	})
	if codice != http.StatusOK {
		t.Fatalf("codice = %d, atteso %d", codice, http.StatusOK)
	}
	if n := len(conAzione(fatti, "partita_azzerata")); n != 0 {
		t.Errorf("azzeramenti emessi senza stato = %d, attesi 0", n)
	}
}

// --- Superficie delle rotte in scrittura ------------------------------------

// Il corpo viene validato contro lo schema prima dell'handler: un campo
// mancante, inatteso o del tipo sbagliato non arriva a toccare lo stato.
func TestRotteDiGiocoRifiutanoCorpiNonConformi(t *testing.T) {
	b := nuovoBanco(t)
	token, cookie := b.creaSessione(t)

	casi := []struct{ percorso, corpo string }{
		{"/game/ping", `{"scene_id":"Stage3","x":1}`},
		{"/game/ping", `{"scene_id":"Stage3","x":1,"y":2,"z":3}`},
		{"/game/ping", `{"scene_id":"Stage3","x":"uno","y":2}`},
		{"/game/checkpoint", `{"checkpoint_id":""}`},
		{"/game/checkpoint", `{}`},
		{"/game/reset", `{"forza":true}`},
	}
	for _, c := range casi {
		codice, _ := b.postGioco(t, cookie, c.percorso, c.corpo)
		if codice != http.StatusBadRequest {
			t.Errorf("%s %s: codice = %d, atteso %d", c.percorso, c.corpo, codice, http.StatusBadRequest)
		}
	}

	s, esiste := b.statoDiGioco(t, token)
	if !esiste {
		t.Fatal("una richiesta rifiutata ha cancellato lo stato di gioco")
	}
	if s.Data.SceneID != scenaIniziale || len(s.Data.Checkpoints) != 0 {
		t.Errorf("stato modificato da richieste rifiutate: scena %s, traguardi %v", s.Data.SceneID, s.Data.Checkpoints)
	}
}

func TestRotteDiGiocoInScritturaRichiedonoAutenticazione(t *testing.T) {
	b := nuovoBanco(t)

	casi := map[string]string{
		"/game/ping":       fmt.Sprintf(`{"scene_id":%q,"x":1,"y":1}`, scenaIniziale),
		"/game/checkpoint": `{"checkpoint_id":"stage2_turret_0"}`,
		"/game/reset":      `{}`,
	}
	for percorso, corpo := range casi {
		codice, _ := b.postGioco(t, nil, percorso, corpo)
		if codice != http.StatusUnauthorized {
			t.Errorf("%s senza cookie: codice = %d, atteso %d", percorso, codice, http.StatusUnauthorized)
		}
	}
}
