// ===================================================
// server/helpers/pow.go
// ===================================================
// Sfida a prova di lavoro per la creazione di sessioni
// oltre la soglia consentita.
// ===================================================

package helpers

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

var (
	ErrChallengeMalformed = errors.New("challenge malformed")
	ErrChallengeExpired   = errors.New("challenge expired")
	ErrChallengeInvalid   = errors.New("challenge signature invalid")
	ErrChallengeUsed      = errors.New("challenge already used")
	ErrSolutionInvalid    = errors.New("solution does not satisfy difficulty")
)

// PoW emette e verifica sfide a prova di lavoro.
//
// Il costo di risoluzione cresce esponenzialmente con la difficolta', mentre la
// verifica resta una singola operazione di hash. L'asimmetria e' il punto: chi
// richiede una sessione paga una volta, chi ne richiede molte paga per ognuna.
//
// Il meccanismo non identifica il richiedente e non osserva l'indirizzo di
// provenienza, quindi non e' influenzato dalla condivisione dell'indirizzo fra
// piu' utenti.
//
// Non impedisce la risoluzione automatica: un client puo' implementare il
// solutore. Ne aumenta il costo, che e' il comportamento voluto.
type PoW struct {
	secret     []byte
	difficulty uint
	ttl        time.Duration
	rdb        *redis.Client
}

func NewPoW(secret string, difficulty uint, ttl time.Duration, rdb *redis.Client) *PoW {
	return &PoW{
		secret:     []byte(secret),
		difficulty: difficulty,
		ttl:        ttl,
		rdb:        rdb,
	}
}

// Difficulty restituisce il numero di bit nulli iniziali richiesti.
func (p *PoW) Difficulty() uint { return p.difficulty }

// Issue produce una sfida firmata. Non viene conservato alcuno stato lato
// server: la validita' e' verificabile dalla firma, e la scadenza e' inclusa
// nel valore firmato.
func (p *PoW) Issue() (string, error) {
	nonce := make([]byte, 16)
	if _, err := rand.Read(nonce); err != nil {
		return "", err
	}

	payload := fmt.Sprintf("%s.%d.%d",
		base64.RawURLEncoding.EncodeToString(nonce),
		time.Now().Add(p.ttl).Unix(),
		p.difficulty,
	)
	return payload + "." + p.sign(payload), nil
}

func (p *PoW) sign(payload string) string {
	mac := hmac.New(sha256.New, p.secret)
	mac.Write([]byte(payload))
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

// Verify controlla firma, scadenza, difficolta' e riuso della sfida.
//
// La sfida risolta viene registrata su Redis per la sua durata residua, cosi'
// che una singola soluzione non possa essere riutilizzata per ottenere piu'
// sessioni.
func (p *PoW) Verify(ctx context.Context, challenge, solution string) error {
	parts := strings.Split(challenge, ".")
	if len(parts) != 4 {
		return ErrChallengeMalformed
	}
	payload := strings.Join(parts[:3], ".")

	if !hmac.Equal([]byte(p.sign(payload)), []byte(parts[3])) {
		return ErrChallengeInvalid
	}

	expiry, err := strconv.ParseInt(parts[1], 10, 64)
	if err != nil {
		return ErrChallengeMalformed
	}
	if time.Now().Unix() > expiry {
		return ErrChallengeExpired
	}

	difficulty, err := strconv.ParseUint(parts[2], 10, 32)
	if err != nil {
		return ErrChallengeMalformed
	}

	if !hasLeadingZeroBits(sha256.Sum256([]byte(challenge+solution)), uint(difficulty)) {
		return ErrSolutionInvalid
	}

	// Registrazione del riuso: SetNX riesce solo la prima volta.
	if p.rdb != nil {
		key := "pow:used:" + hex.EncodeToString([]byte(parts[0]))
		ok, err := p.rdb.SetNX(ctx, key, "1", time.Until(time.Unix(expiry, 0))).Result()
		if err == nil && !ok {
			return ErrChallengeUsed
		}
	}

	return nil
}

// hasLeadingZeroBits verifica che i primi n bit del digest siano nulli.
func hasLeadingZeroBits(sum [32]byte, n uint) bool {
	full := n / 8
	rest := n % 8

	for i := uint(0); i < full; i++ {
		if sum[i] != 0 {
			return false
		}
	}
	if rest == 0 {
		return true
	}
	return sum[full]>>(8-rest) == 0
}
