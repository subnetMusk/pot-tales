// ===================================================
// server/helpers/network_utils.go
// ===================================================
// Funzioni per l'analisi della rete e l'estrazione IP
// dietro reverse proxy (Nginx).
// ===================================================

package helpers

import (
	"net"
	"net/http"
	"strings"
)

// GetRealIP estrae l'indirizzo IP reale del client.
// Dà priorità agli header X-Forwarded-For e X-Real-IP settati da Nginx.
func GetRealIP(r *http.Request) string {
	// 1. X-Forwarded-For: Standard de-facto per i proxy
	// Il formato è: "client_ip, proxy1_ip, proxy2_ip"
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		// Prendiamo il primo (il client originale), pulendo gli spazi
		return strings.TrimSpace(parts[0])
	}

	// 2. X-Real-IP: Configurato spesso in Nginx
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return xri
	}

	// 3. Fallback: RemoteAddr (Diretto)
	// Nota: Se siamo in Docker, questo sarà l'IP del Gateway interno (es. 172.18.0.1),
	// quindi è l'ultima spiaggia.
	ip, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return ip
}
