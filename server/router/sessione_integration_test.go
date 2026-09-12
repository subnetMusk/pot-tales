//go:build integration

// Prove sulla durata della sessione attraverso il router completo.

package router

import (
	"context"
	"fmt"
	"net/http"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson"

	"github.com/subnetMusk/progetti_innovativi/server/helpers"
)

// Una partita in corso non deve scadere allo scadere della durata ridotta con
// cui nasce la sessione. La creazione concede pochi minuti, pensati per le
// sessioni create e mai usate; la prima richiesta autenticata deve portarla
// alla durata piena. Senza, ping e traguardi vengono respinti a meta' gioco e la
// partita non si puo' piu' riprendere dal menu.
//
// La prova non attende i minuti veri: accorcia a pochi secondi la durata
// residua della sessione appena creata, in cache e sulla base dati, come se la
// durata ridotta stesse per finire.
func TestSessioneUsataSopravviveAllaDurataRidotta(t *testing.T) {
	b := nuovoBanco(t)
	token, cookie := b.creaSessione(t)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	const residuo = 2 * time.Second
	if err := b.redis.Expire(ctx, "sess:"+token, residuo).Err(); err != nil {
		t.Fatalf("riduzione della durata in cache: %v", err)
	}
	if _, err := b.dbDiProva().Collection(helpers.SessionsCollection).UpdateOne(ctx,
		bson.M{"_id": token},
		bson.M{"$set": bson.M{"expires_at": time.Now().Add(residuo)}},
	); err != nil {
		t.Fatalf("riduzione della durata sulla base dati: %v", err)
	}

	// Richiesta autenticata con la chiave ancora in cache: e' il caso di ogni
	// ping durante il gioco, e il primo traguardo arriva subito dopo la
	// creazione.
	if codice, _ := b.postGioco(t, cookie, "/game/checkpoint", `{"checkpoint_id":"game_started"}`); codice != http.StatusOK {
		t.Fatalf("traguardo appena dopo la creazione: codice = %d, atteso %d", codice, http.StatusOK)
	}

	// Il prolungamento avviene in background: si attende che la cache riporti
	// una durata ben oltre quella ridotta.
	prolungata := false
	for scadenza := time.Now().Add(5 * time.Second); time.Now().Before(scadenza); time.Sleep(100 * time.Millisecond) {
		if b.redis.TTL(ctx, "sess:"+token).Val() > time.Minute {
			prolungata = true
			break
		}
	}
	if !prolungata {
		t.Errorf("dopo una richiesta autenticata la durata in cache e' %v, attesa la durata piena",
			b.redis.TTL(ctx, "sess:"+token).Val())
	}

	// Oltre la durata ridotta la sessione deve essere ancora valida.
	time.Sleep(residuo + time.Second)
	codice, risposta := b.postGioco(t, cookie, "/game/ping",
		fmt.Sprintf(`{"scene_id":%q,"x":1,"y":1}`, scenaIniziale))
	if codice != http.StatusOK {
		t.Fatalf("ping oltre la durata ridotta: codice = %d, atteso %d (%v)", codice, http.StatusOK, risposta)
	}

	var sessione struct {
		ExpiresAt time.Time `bson:"expires_at"`
	}
	if err := b.dbDiProva().Collection(helpers.SessionsCollection).
		FindOne(ctx, bson.M{"_id": token}).Decode(&sessione); err != nil {
		t.Fatalf("rilettura della sessione: %v", err)
	}
	if time.Until(sessione.ExpiresAt) < time.Minute {
		t.Errorf("scadenza sulla base dati fra %v, attesa la durata piena", time.Until(sessione.ExpiresAt))
	}
}
