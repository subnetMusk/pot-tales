package helpers

import (
	"context"
	"log/slog"
	"os"
	"runtime"

	"go.elastic.co/apm/v2"
)

// LogSchema definisce la struttura fissa per i nostri log.
// Ispirato a Elastic Common Schema (ECS).
type LogSchema struct {
	Dataset  string // Es: backend.api
	Category string // Es: authentication, gameplay, system
	Action   string // Es: user_login, level_start
}

var globalLogger *slog.Logger
var serviceName string

// InitLogger configura il logger globale.
func InitLogger(name, environment string) {
	serviceName = name
	opts := &slog.HandlerOptions{
		Level: slog.LevelInfo,
		// Aggiungiamo la source (file:line) solo per gli errori per non verbosità eccessiva
		AddSource: false,
	}

	handler := slog.NewJSONHandler(os.Stdout, opts)

	globalLogger = slog.New(handler).With(
		slog.String("service.name", serviceName),
		slog.String("service.environment", environment),
		slog.String("event.dataset", "backend.api"), // Default dataset
	)

	slog.SetDefault(globalLogger)
}

// Private helper per arricchire il logger con contesto e tracciamento
func getEnrichedLogger(ctx context.Context) *slog.Logger {
	logger := globalLogger

	// 1. APM Tracing Correlation
	tx := apm.TransactionFromContext(ctx)
	if tx != nil {
		traceContext := tx.TraceContext()
		logger = logger.With(
			slog.String("trace.id", traceContext.Trace.String()),
			slog.String("transaction.id", traceContext.Span.String()),
		)
	}

	// 2. User Context (Se presente, iniettato dal Middleware)
	if userID, ok := ctx.Value(UserIDKey).(string); ok {
		logger = logger.With(slog.String("user.id", userID))
	}

	return logger
}

// --- API Pubbliche Semantiche ---

// LogSystem registra eventi tecnici interni (startup, db connection, cron jobs).
func LogSystem(ctx context.Context, action string, details map[string]any) {
	logWithCategory(ctx, "system", action, details, slog.LevelInfo)
}

// LogBusiness registra eventi di dominio (login, acquisto, inizio partita).
// Questi sono quelli che finiscono nelle dashboard di business.
func LogBusiness(ctx context.Context, category, action string, details map[string]any) {
	logWithCategory(ctx, category, action, details, slog.LevelInfo)
}

// LogError registra errori con stack trace e contesto.
func LogError(ctx context.Context, category, action string, err error, details map[string]any) {
	if details == nil {
		details = make(map[string]any)
	}
	details["error.message"] = err.Error()

	// Aggiungiamo info sul chiamante per debug
	_, file, line, ok := runtime.Caller(1)
	if ok {
		details["error.source"] = map[string]any{
			"file": file,
			"line": line,
		}
	}

	logWithCategory(ctx, category, action, details, slog.LevelError)
}

// logWithCategory è il cuore che formatta il JSON finale
func logWithCategory(ctx context.Context, category, action string, details map[string]any, level slog.Level) {
	logger := getEnrichedLogger(ctx).With(
		slog.String("event.category", category),
		slog.String("event.action", action),
	)

	// Convertiamo la mappa details in attributi slog
	attrs := make([]any, 0, len(details))
	for k, v := range details {
		attrs = append(attrs, slog.Any(k, v))
	}

	logger.Log(ctx, level, action, attrs...)
}
