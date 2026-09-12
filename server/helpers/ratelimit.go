// ===================================================
// server/helpers/ratelimit.go
// ===================================================
// Contatori a finestra fissa su Redis, usati per le
// quote applicative.
// ===================================================

package helpers

import (
	"context"
	"time"

	"github.com/redis/go-redis/v9"
)

// RateLimiter applica quote conteggiando gli eventi in una finestra temporale.
//
// La finestra e' fissa: il contatore parte alla prima richiesta e viene
// azzerato dalla scadenza della chiave. E' meno preciso di una finestra
// scorrevole al confine fra due finestre, ma richiede una sola operazione per
// richiesta e non conserva la cronologia dei singoli eventi.
type RateLimiter struct {
	rdb *redis.Client
}

func NewRateLimiter(rdb *redis.Client) *RateLimiter {
	return &RateLimiter{rdb: rdb}
}

// Allow incrementa il contatore associato a key e indica se il valore risultante
// rientra nel limite. Restituisce anche il conteggio corrente e il tempo residuo
// della finestra, utili a costruire le intestazioni di risposta.
//
// In caso di errore su Redis la richiesta viene consentita: l'indisponibilita'
// del contatore non deve tradursi in indisponibilita' del servizio.
func (rl *RateLimiter) Allow(ctx context.Context, key string, limit int64, window time.Duration) (allowed bool, count int64, reset time.Duration) {
	pipe := rl.rdb.TxPipeline()
	incr := pipe.Incr(ctx, key)
	pipe.ExpireNX(ctx, key, window)
	ttl := pipe.TTL(ctx, key)

	if _, err := pipe.Exec(ctx); err != nil {
		return true, 0, window
	}

	count = incr.Val()
	reset = ttl.Val()
	if reset < 0 {
		reset = window
	}
	return count <= limit, count, reset
}

// Peek restituisce il conteggio corrente senza incrementarlo.
func (rl *RateLimiter) Peek(ctx context.Context, key string) int64 {
	v, err := rl.rdb.Get(ctx, key).Int64()
	if err != nil {
		return 0
	}
	return v
}
