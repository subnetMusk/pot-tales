// ===================================================
// server/helpers/env.go
// ===================================================
// Lettura delle variabili d'ambiente con valore di
// ripiego.
// ===================================================

package helpers

import (
	"log/slog"
	"os"
	"strconv"
)

// Env restituisce il valore della variabile, o il ripiego se non impostata.
func Env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// EnvInt restituisce il valore numerico della variabile. Un valore non
// numerico viene segnalato e sostituito dal ripiego, invece di essere
// interpretato come zero.
func EnvInt(key string, fallback int) int {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		slog.Warn("valore non numerico, uso il ripiego", "var", key, "value", v, "fallback", fallback)
		return fallback
	}
	return n
}
