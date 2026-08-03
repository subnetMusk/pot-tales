// ===================================================
// server/helpers/networks.go
// ===================================================
// Estrazione dell'IP client dietro reverse proxy e
// anonimizzazione degli indirizzi.
// ===================================================

package helpers

import (
	"net"
	"net/http"
	"os"
	"strings"
)

// Reti considerate proxy fidati. Il default copre le reti private usate dalle
// bridge network di Docker. Sovrascrivibile con TRUSTED_PROXY_CIDRS, elenco di
// CIDR separati da virgola.
var defaultTrustedProxyCIDRs = []string{
	"127.0.0.0/8",
	"::1/128",
	"10.0.0.0/8",
	"172.16.0.0/12",
	"192.168.0.0/16",
	"fc00::/7",
}

var trustedProxyNets = parseTrustedProxies()

func parseTrustedProxies() []*net.IPNet {
	raw := defaultTrustedProxyCIDRs
	if env := os.Getenv("TRUSTED_PROXY_CIDRS"); env != "" {
		raw = strings.Split(env, ",")
	}

	nets := make([]*net.IPNet, 0, len(raw))
	for _, c := range raw {
		if _, n, err := net.ParseCIDR(strings.TrimSpace(c)); err == nil {
			nets = append(nets, n)
		}
	}
	return nets
}

func isTrustedProxy(ip net.IP) bool {
	if ip == nil {
		return false
	}
	for _, n := range trustedProxyNets {
		if n.Contains(ip) {
			return true
		}
	}
	return false
}

// GetRealIP restituisce l'indirizzo IP del client.
//
// I reverse proxy aggiungono in coda a X-Forwarded-For l'indirizzo del peer da
// cui ricevono la richiesta. Un client che invia già un X-Forwarded-For proprio
// produce quindi una catena "valore-arbitrario, indirizzo-reale": il primo
// elemento è controllato dal client e non va usato.
//
// L'algoritmo applicato:
//  1. se il peer non è un proxy fidato, X-Forwarded-For viene ignorato e vale
//     RemoteAddr;
//  2. altrimenti la catena viene percorsa da destra verso sinistra e si
//     restituisce il primo indirizzo che non appartiene a un proxy fidato.
//
// X-Real-IP non viene consultato: è un canale di fiducia equivalente ma senza
// informazione sulla catena, quindi non distinguibile da un valore arbitrario.
func GetRealIP(r *http.Request) string {
	remoteIP := remoteAddrIP(r)

	if !isTrustedProxy(remoteIP) {
		if remoteIP == nil {
			return ""
		}
		return remoteIP.String()
	}

	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		for i := len(parts) - 1; i >= 0; i-- {
			candidate := net.ParseIP(strings.TrimSpace(parts[i]))
			if candidate == nil {
				continue
			}
			if !isTrustedProxy(candidate) {
				return candidate.String()
			}
		}
		// Catena composta solo da proxy fidati: la richiesta ha origine interna.
		if first := net.ParseIP(strings.TrimSpace(parts[0])); first != nil {
			return first.String()
		}
	}

	if remoteIP == nil {
		return ""
	}
	return remoteIP.String()
}

func remoteAddrIP(r *http.Request) net.IP {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	return net.ParseIP(host)
}

// AnonymizeIP azzera l'ultimo ottetto di un indirizzo IPv4 e gli ultimi 80 bit
// di un indirizzo IPv6, conservandone il prefisso /48. Restituisce stringa
// vuota se l'ingresso non è un indirizzo valido.
//
// Va applicata prima della persistenza: una normalizzazione successiva lascia
// l'indirizzo completo negli indici e nei backup già scritti.
func AnonymizeIP(raw string) string {
	ip := net.ParseIP(strings.TrimSpace(raw))
	if ip == nil {
		return ""
	}

	if v4 := ip.To4(); v4 != nil {
		return net.IP{v4[0], v4[1], v4[2], 0}.String()
	}

	v6 := ip.To16()
	if v6 == nil {
		return ""
	}
	masked := make(net.IP, net.IPv6len)
	copy(masked, v6[:6])
	return masked.String()
}
