#!/usr/bin/env bash
# Avvia davvero i servizi e li interroga.
#
# E' la categoria di controllo che in questo progetto ha trovato piu' difetti: un
# flag non piu' valido di Filebeat, l'immagine del backend che non parte senza
# gli schemi, i permessi dei secret rifiutati, una regex che fa rifiutare l'
# intera configurazione di nginx. Tutti hanno superato la validazione statica,
# perche' esistono solo all'esecuzione.
#
# Non sostituisce la prova dello stack completo, che richiede la macchina: qui si
# verificano gli artefatti che la pipeline produce, uno per uno, contro il
# comportamento che il resto del sistema assume da loro.
#
# Immagini da provare, sovrascrivibili:
#   SERVER_IMAGE, FRONTEND_IMAGE, LANDING_IMAGE
set -uo pipefail

SERVER_IMAGE=${SERVER_IMAGE:-progetti-innovativi/server:locale}
FRONTEND_IMAGE=${FRONTEND_IMAGE:-progetti-innovativi/frontend:locale}
LANDING_IMAGE=${LANDING_IMAGE:-progetti-innovativi/landing:locale}

MONGO_IMAGE=${MONGO_IMAGE:-mongo:8.2.12@sha256:e0ce8c35124d4a9f9785532d1f268f39e9728ffa1cb38f46fa482436424c4bd3}
REDIS_IMAGE=${REDIS_IMAGE:-redis:8.10.0-alpine@sha256:978f0e01593e65eed801f2402944efcd936d43b5027e4908a7897baf88ed6241}

RETE=rc-net
PREFISSO=rc

falliti=0
eseguiti=0

# --- Infrastruttura di prova ------------------------------------------------

pulisci() {
  docker rm -f "$PREFISSO-server" "$PREFISSO-db" "$PREFISSO-redis" \
                "$PREFISSO-landing" "$PREFISSO-frontend" >/dev/null 2>&1
  docker network rm "$RETE" >/dev/null 2>&1
}
trap pulisci EXIT

# verifica <descrizione> <atteso> <ottenuto>
verifica() {
  eseguiti=$((eseguiti + 1))
  if [ "$2" = "$3" ]; then
    printf '  ok    %-52s %s\n' "$1" "$3"
  else
    printf '  FALLITO %-50s atteso %s, ottenuto %s\n' "$1" "$2" "$3"
    falliti=$((falliti + 1))
  fi
}

# contiene <descrizione> <sottostringa attesa> <testo>
contiene() {
  eseguiti=$((eseguiti + 1))
  case "$3" in
    *"$2"*) printf '  ok    %-52s\n' "$1" ;;
    *)      printf '  FALLITO %-50s non contiene "%s"\n' "$1" "$2"
            falliti=$((falliti + 1)) ;;
  esac
}

# attendi <descrizione> <comando...>
attendi() {
  local descrizione=$1; shift
  local i=0
  while [ $i -lt 60 ]; do
    if "$@" >/dev/null 2>&1; then return 0; fi
    i=$((i + 1)); sleep 2
  done
  echo "  PREMESSA FALLITA: $descrizione non pronto dopo 120s" >&2
  return 1
}

pulisci
docker network create "$RETE" >/dev/null

# ============================================================================
echo "== Backend =="
# ============================================================================

docker run -d --rm --name "$PREFISSO-db" --network "$RETE" "$MONGO_IMAGE" >/dev/null
docker run -d --rm --name "$PREFISSO-redis" --network "$RETE" "$REDIS_IMAGE" >/dev/null

# Nessun montaggio: se l'immagine non contiene gli schemi non arriva ad
# ascoltare, ed e' esattamente la regressione che questo controllo deve cogliere.
docker run -d --rm --name "$PREFISSO-server" --network "$RETE" -p 18080:3000 \
  -e MONGO_URI="mongodb://$PREFISSO-db:27017" \
  -e REDIS_URL="redis://$PREFISSO-redis:6379" \
  "$SERVER_IMAGE" >/dev/null

attendi "backend" curl -fsS -m 3 http://127.0.0.1:18080/health || { docker logs "$PREFISSO-server" 2>&1 | tail -20; exit 1; }

salute=$(curl -sS -m 5 http://127.0.0.1:18080/health)
contiene "salute: mongodb raggiungibile"  '"mongodb":true' "$salute"
contiene "salute: redis raggiungibile"    '"redis":true'   "$salute"

verifica "schema: corpo non conforme rifiutato" 400 \
  "$(curl -sS -m 5 -o /dev/null -w '%{http_code}' 2>/dev/null -X POST -H 'Content-Type: application/json' \
      -d '{"campo_inesistente":1}' http://127.0.0.1:18080/auth/session)"

verifica "schema: corpo assente rifiutato" 400 \
  "$(curl -sS -m 5 -o /dev/null -w '%{http_code}' 2>/dev/null -X POST -H 'Content-Type: application/json' \
      http://127.0.0.1:18080/auth/session)"

# Il tetto sul corpo e' applicato dal middleware di validazione: una richiesta
# sovradimensionata deve essere respinta invece di essere letta per intero.
#
# Il corpo passa da un file: tre megabyte su riga di comando superano il limite
# degli argomenti del processo, e il controllo fallirebbe per un motivo che non
# ha nulla a che vedere con cio' che sta verificando.
# Percorso relativo e non /tmp: la conversione dei percorsi della shell Windows
# e' disattivata perche' Docker la richiede, e un percorso assoluto in stile
# POSIX non verrebbe risolto dal client HTTP nativo.
corpo=./corpo-oltre-soglia.tmp
{ printf '{"x":"'; head -c 3000000 /dev/zero | tr '\0' 'a'; printf '"}'; } > "$corpo"
verifica "tetto sul corpo: richiesta sovradimensionata respinta" 413 \
  "$(curl -sS -m 15 -o /dev/null -w '%{http_code}' 2>/dev/null -X POST -H 'Content-Type: application/json' \
      --data-binary "@$corpo" http://127.0.0.1:18080/auth/session)"
rm -f "$corpo"

verifica "rotta inesistente" 404 \
  "$(curl -sS -m 5 -o /dev/null -w '%{http_code}' 2>/dev/null http://127.0.0.1:18080/non/esiste)"

# L'arresto deve lasciare completare le richieste in volo invece di troncarle.
docker stop -t 15 "$PREFISSO-server" >/dev/null 2>&1
verifica "arresto controllato entro il periodo di grazia" 0 "$?"

# ============================================================================
echo "== Pagina di ingresso =="
# ============================================================================

docker run -d --rm --name "$PREFISSO-landing" --network "$RETE" -p 18081:80 "$LANDING_IMAGE" >/dev/null
attendi "pagina di ingresso" curl -fsS -m 3 http://127.0.0.1:18081/nginx-health || exit 1

verifica "raggiungibile" 200 \
  "$(curl -sS -m 5 -o /dev/null -w '%{http_code}' 2>/dev/null http://127.0.0.1:18081/)"

# La pagina esiste per parlare quando il resto tace: una dipendenza esterna la
# renderebbe muta proprio in quel momento.
verifica "nessuna dipendenza esterna" 0 \
  "$(curl -sS -m 5 http://127.0.0.1:18081/ | grep -cE '<script|src=|https?://')"

docker rm -f "$PREFISSO-landing" >/dev/null 2>&1

# ============================================================================
echo "== Gioco =="
# ============================================================================

if docker image inspect "$FRONTEND_IMAGE" >/dev/null 2>&1; then
  docker run -d --rm --name "$PREFISSO-frontend" --network "$RETE" -p 18082:80 "$FRONTEND_IMAGE" >/dev/null
  attendi "gioco" curl -fsS -m 3 http://127.0.0.1:18082/nginx-health || exit 1

  verifica "documento di ingresso servito" 200 \
    "$(curl -sS -m 5 -o /dev/null -w '%{http_code}' 2>/dev/null http://127.0.0.1:18082/)"

  # Il documento di ingresso indica quali artefatti caricare: servirne una copia
  # vecchia significa servire l'applicazione vecchia.
  contiene "documento di ingresso non messo in cache" "no-cache" \
    "$(curl -sS -m 5 -D- -o /dev/null http://127.0.0.1:18082/ | tr -d '\r')"

  # Gli artefatti con impronta nel nome sono il motivo per cui le postazioni non
  # riscaricano tutto a ogni partita.
  artefatto=$(curl -sS -m 5 http://127.0.0.1:18082/ \
    | grep -oE '/assets/[A-Za-z0-9_.-]+-[A-Za-z0-9_]{8,}\.js' | head -1)
  if [ -n "$artefatto" ]; then
    intestazioni=$(curl -sS -m 5 -D- -o /dev/null "http://127.0.0.1:18082$artefatto" | tr -d '\r')
    contiene "artefatto con impronta dichiarato immutabile" "immutable" "$intestazioni"
    verifica "una sola intestazione di cache sull'artefatto" 1 \
      "$(printf '%s' "$intestazioni" | grep -ci '^cache-control')"
  else
    echo "  saltato: nessun artefatto con impronta nel documento servito"
  fi

  # La compressione ha una soglia minima: sotto, costa piu' di quanto rende. Il
  # bersaglio giusto e' quindi l'artefatto, non il documento di ingresso, che
  # pesa poche centinaia di byte e non deve essere compresso.
  if [ -n "$artefatto" ]; then
    contiene "compressione attiva sull'artefatto" "gzip" \
      "$(curl -sS -m 5 -D- -o /dev/null -H 'Accept-Encoding: gzip' "http://127.0.0.1:18082$artefatto" 2>/dev/null | tr -d '\r')"
  fi

  verifica "documento sotto soglia non compresso" 0 \
    "$(curl -sS -m 5 -D- -o /dev/null -H 'Accept-Encoding: gzip' http://127.0.0.1:18082/ 2>/dev/null | grep -ci 'content-encoding')"
else
  echo "  saltato: immagine $FRONTEND_IMAGE non presente"
fi

# ============================================================================
echo
echo "controlli eseguiti: $eseguiti, falliti: $falliti"
[ "$falliti" -eq 0 ] || exit 1
