package helpers

import (
	"context"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
)

// redisDiProva avvia un Redis in memoria e restituisce il client e l'istanza,
// che consente di far avanzare il tempo senza attendere davvero.
func redisDiProva(t *testing.T) (*redis.Client, *miniredis.Miniredis) {
	t.Helper()
	srv := miniredis.RunT(t)
	client := redis.NewClient(&redis.Options{Addr: srv.Addr()})
	t.Cleanup(func() { _ = client.Close() })
	return client, srv
}

func TestRateLimiterEntroIlLimite(t *testing.T) {
	client, _ := redisDiProva(t)
	rl := NewRateLimiter(client)
	ctx := context.Background()

	for i := int64(1); i <= 3; i++ {
		consentito, conteggio, _ := rl.Allow(ctx, "chiave", 3, time.Minute)
		if !consentito {
			t.Fatalf("richiesta %d rifiutata entro il limite", i)
		}
		if conteggio != i {
			t.Errorf("conteggio = %d, atteso %d", conteggio, i)
		}
	}
}

func TestRateLimiterOltreIlLimite(t *testing.T) {
	client, _ := redisDiProva(t)
	rl := NewRateLimiter(client)
	ctx := context.Background()

	for i := 0; i < 3; i++ {
		rl.Allow(ctx, "chiave", 3, time.Minute)
	}

	consentito, conteggio, residuo := rl.Allow(ctx, "chiave", 3, time.Minute)
	if consentito {
		t.Error("la quarta richiesta e' stata consentita con limite 3")
	}
	if conteggio != 4 {
		t.Errorf("conteggio = %d, atteso 4", conteggio)
	}
	// Il tempo residuo serve a costruire l'intestazione che dice al client
	// quando riprovare: senza, l'unica strategia possibile e' martellare.
	if residuo <= 0 || residuo > time.Minute {
		t.Errorf("tempo residuo = %v, atteso entro la finestra", residuo)
	}
}

// La finestra e' fissa: alla scadenza della chiave il conteggio riparte da zero
// invece di scorrere.
func TestRateLimiterFinestraScaduta(t *testing.T) {
	client, srv := redisDiProva(t)
	rl := NewRateLimiter(client)
	ctx := context.Background()

	for i := 0; i < 3; i++ {
		rl.Allow(ctx, "chiave", 3, time.Minute)
	}
	if consentito, _, _ := rl.Allow(ctx, "chiave", 3, time.Minute); consentito {
		t.Fatal("premessa non soddisfatta: il limite non e' stato raggiunto")
	}

	srv.FastForward(2 * time.Minute)

	consentito, conteggio, _ := rl.Allow(ctx, "chiave", 3, time.Minute)
	if !consentito {
		t.Error("richiesta rifiutata dopo la scadenza della finestra")
	}
	if conteggio != 1 {
		t.Errorf("conteggio = %d, atteso 1 dopo la scadenza", conteggio)
	}
}

// La scadenza si imposta solo alla prima richiesta della finestra: se ogni
// incremento la rinnovasse, un flusso costante di richieste terrebbe la
// finestra aperta indefinitamente e il limite non scatterebbe mai.
func TestRateLimiterLaFinestraNonSiRinnovaAOgniRichiesta(t *testing.T) {
	client, srv := redisDiProva(t)
	rl := NewRateLimiter(client)
	ctx := context.Background()

	rl.Allow(ctx, "chiave", 100, time.Minute)
	srv.FastForward(50 * time.Second)
	rl.Allow(ctx, "chiave", 100, time.Minute)

	_, _, residuo := rl.Allow(ctx, "chiave", 100, time.Minute)
	if residuo > 15*time.Second {
		t.Errorf("tempo residuo = %v: la finestra si e' rinnovata", residuo)
	}
}

// Chiavi diverse contano separatamente: e' cio' che rende la quota per sessione
// e non globale.
func TestRateLimiterChiaviIndipendenti(t *testing.T) {
	client, _ := redisDiProva(t)
	rl := NewRateLimiter(client)
	ctx := context.Background()

	for i := 0; i < 3; i++ {
		rl.Allow(ctx, "prima", 3, time.Minute)
	}

	consentito, conteggio, _ := rl.Allow(ctx, "seconda", 3, time.Minute)
	if !consentito || conteggio != 1 {
		t.Errorf("chiave distinta: consentito=%v conteggio=%d, attesi true e 1", consentito, conteggio)
	}
}

func TestRateLimiterPeek(t *testing.T) {
	client, _ := redisDiProva(t)
	rl := NewRateLimiter(client)
	ctx := context.Background()

	if v := rl.Peek(ctx, "assente"); v != 0 {
		t.Errorf("conteggio su chiave assente = %d, atteso 0", v)
	}

	rl.Allow(ctx, "chiave", 10, time.Minute)
	rl.Allow(ctx, "chiave", 10, time.Minute)

	if v := rl.Peek(ctx, "chiave"); v != 2 {
		t.Errorf("conteggio = %d, atteso 2", v)
	}
	// La lettura non deve incrementare: se lo facesse, ogni ispezione
	// consumerebbe quota.
	if v := rl.Peek(ctx, "chiave"); v != 2 {
		t.Errorf("conteggio dopo seconda lettura = %d, atteso 2", v)
	}
}

// L'indisponibilita' del contatore non deve tradursi in indisponibilita' del
// servizio: se Redis non risponde la richiesta passa, perche' il contenimento
// dell'abuso e' meno importante del servire i visitatori.
func TestRateLimiterRedisIrraggiungibileConsente(t *testing.T) {
	client, srv := redisDiProva(t)
	rl := NewRateLimiter(client)
	srv.Close()

	consentito, conteggio, residuo := rl.Allow(context.Background(), "chiave", 1, time.Minute)
	if !consentito {
		t.Error("richiesta rifiutata con il contatore irraggiungibile")
	}
	if conteggio != 0 {
		t.Errorf("conteggio = %d, atteso 0 quando il contatore non risponde", conteggio)
	}
	if residuo != time.Minute {
		t.Errorf("tempo residuo = %v, attesa la finestra intera", residuo)
	}
}
