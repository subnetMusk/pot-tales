// ===================================================
// server/helpers/gameplay_events.go
// ===================================================
// Fatti di partita, emessi verso un dataset separato da quello tecnico.
// ===================================================

package helpers

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"log/slog"
	"os"
	"strings"
)

// GameplayDataset è la destinazione dei fatti di partita.
//
// La separazione dal dataset tecnico non è cosmetica. Con licenza basic la
// sicurezza a livello di documento non è disponibile: non esiste modo di
// concedere un sottoinsieme di documenti dentro un indice condiviso. L'unico
// modo di dare la vista divulgativa senza dare con essa i log di sistema è che
// i due stiano in indici diversi, e l'instradamento in ingestione avviene su
// questo valore.
const GameplayDataset = "gioco.partita"

var (
	gameplayLogger *slog.Logger
	salePseudonimo []byte
)

// initGameplay prepara il logger dei fatti di partita e il sale degli
// identificativi. Chiamata da InitLogger.
//
// Il logger non deriva da quello globale: quello dichiara `event.dataset` a
// `backend.api`, e slog non sostituisce un attributo già presente ma lo
// affianca. Ne uscirebbe un documento con la chiave due volte, e quale delle
// due vince l'instradamento dipenderebbe dal parser.
func initGameplay(nome, ambiente string) {
	gameplayLogger = slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	})).With(
		slog.String("service.name", nome),
		slog.String("service.environment", ambiente),
		slog.String("event.dataset", GameplayDataset),
	)

	if s := Env("GAMEPLAY_ID_SALT", ""); s != "" {
		salePseudonimo = []byte(s)
		return
	}

	// Senza sale configurato se ne genera uno per processo. L'identificativo
	// resta utilizzabile per contare e raggruppare, ma cambia a ogni riavvio:
	// una partita a cavallo di un riavvio viene contata due volte. È il verso
	// giusto in cui sbagliare rispetto a un sale fisso e prevedibile, che
	// renderebbe l'identificativo ricalcolabile da chiunque conosca il token.
	salePseudonimo = make([]byte, 32)
	if _, err := rand.Read(salePseudonimo); err != nil {
		slog.Error("sale degli identificativi di partita non generato", "error", err)
	}
}

// PartitaID deriva dal token di sessione l'identificativo usato nelle dashboard.
//
// Serve a contare le partite e a raggruppare gli eventi della stessa, non a
// risalire alla sessione. La distinzione conta perché questi eventi finiscono
// in un indice leggibile dalla platea divulgativa, e il token di sessione è lo
// stesso valore che il visitatore porta nel proprio cookie: pubblicarlo
// consentirebbe a chi ha entrambi di collegare una riga a un browser preciso.
func PartitaID(sessionID string) string {
	h := sha256.New()
	h.Write(salePseudonimo)
	h.Write([]byte(sessionID))
	return hex.EncodeToString(h.Sum(nil))[:16]
}

// ClasseDispositivo riduce a una categoria la stringa dichiarata dal client.
//
// La stringa integrale è un vettore di riconoscimento: conservarla in un indice
// condiviso permetterebbe di distinguere un visitatore dagli altri. La classe
// risponde alla domanda che interessa davvero — da cosa hanno giocato — senza
// quel costo.
//
// I tablet Android non dichiarano "mobi" e finiscono fra i computer: la
// classificazione è grossolana per costruzione, e affinarla richiederebbe una
// libreria di riconoscimento, cioè una dipendenza per un dato marginale.
func ClasseDispositivo(dichiarato string) string {
	s := strings.ToLower(dichiarato)
	switch {
	case s == "":
		return "ignoto"
	case strings.Contains(s, "ipad"), strings.Contains(s, "tablet"):
		return "tablet"
	case strings.Contains(s, "mobi"), strings.Contains(s, "iphone"):
		return "telefono"
	default:
		return "computer"
	}
}

// LogGameplay registra un fatto di partita.
//
// Non passa da getEnrichedLogger, che inietta `user.id` con il token di
// sessione: questi eventi vanno in un indice condiviso con la platea
// divulgativa, e il token non deve comparirvi. Non porta nemmeno la
// correlazione di tracciamento, che appartiene alla diagnosi tecnica e non a
// una dashboard di affluenza.
//
// I campi sono solo quelli che le dashboard interrogano. Ogni campo in più qui
// è un campo che qualcuno potrà leggere senza che nessuno lo abbia deciso.
func LogGameplay(ctx context.Context, sessionID, azione string, dettagli map[string]any) {
	if !HasAnalyticsConsent(ctx) {
		return
	}

	attrs := make([]any, 0, len(dettagli)+3)
	attrs = append(attrs,
		slog.String("event.category", "gameplay"),
		slog.String("event.action", azione),
	)
	if sessionID != "" {
		attrs = append(attrs, slog.String("partita.id", PartitaID(sessionID)))
	}
	for k, v := range dettagli {
		attrs = append(attrs, slog.Any(k, v))
	}

	loggerDeiFatti().InfoContext(ctx, azione, attrs...)
}

// AzionePartitaAvviata e' l'unico fatto registrato anche senza consenso.
const AzionePartitaAvviata = "partita_avviata"

// LogPartitaAvviata registra che una partita e' cominciata, a prescindere dal
// consenso analitico.
//
// Serve all'impatto dell'evento: senza, l'affluenza conterebbe soltanto chi ha
// accettato gli analitici. Puo' prescindere dalla scelta perche' il documento
// non porta nulla oltre all'azione: niente `partita.id`, che lo collegherebbe
// agli altri fatti della stessa partita, niente classe di dispositivo ne' altri
// dettagli. Dice soltanto che in quell'istante una partita e' iniziata.
func LogPartitaAvviata(ctx context.Context) {
	loggerDeiFatti().InfoContext(ctx, AzionePartitaAvviata,
		slog.String("event.category", "gameplay"),
		slog.String("event.action", AzionePartitaAvviata),
	)
}

func loggerDeiFatti() *slog.Logger {
	if gameplayLogger == nil {
		// Stessa scelta difensiva del logger tecnico: una riga registrata prima
		// dell'inizializzazione non deve dereferenziare un puntatore nullo.
		return slog.Default().With(slog.String("event.dataset", GameplayDataset))
	}
	return gameplayLogger
}
