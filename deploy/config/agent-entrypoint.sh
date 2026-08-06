#!/bin/bash
# Entrypoint degli agenti Elastic.
#
# L'enrollment token non esiste prima che Fleet sia stato inizializzato e le
# policy create, quindi non puo' essere dichiarato nella configurazione dello
# stack. Viene scritto su un volume condiviso dal processo di bootstrap.
#
# Se il file non c'e' ancora, l'entrypoint esce con codice diverso da zero e
# l'orchestratore rischedula il task: e' lo stesso comportamento con cui es01
# attende i certificati, e permette allo stack di convergere con un solo deploy
# invece che con un avvio in due fasi.
#
# Variabili riconosciute:
#   TOKEN_FILE            percorso del file contenente l'enrollment token
#   ELASTIC_PASSWORD_FILE percorso del segreto con la password di elastic
set -uo pipefail

TOKEN_FILE=${TOKEN_FILE:-}

if [ -z "$TOKEN_FILE" ]; then
  echo "[agent] TOKEN_FILE non impostata" >&2
  exit 1
fi

if [ ! -s "$TOKEN_FILE" ]; then
  echo "[agent] enrollment token non ancora disponibile in $TOKEN_FILE" >&2
  exit 1
fi

FLEET_ENROLLMENT_TOKEN="$(cat "$TOKEN_FILE")"
export FLEET_ENROLLMENT_TOKEN

# L'agente che assume il ruolo di Fleet Server si autentica verso Kibana con le
# credenziali dell'utente elastic, che arrivano come segreto e non come valore.
if [ -n "${ELASTIC_PASSWORD_FILE:-}" ] && [ -s "${ELASTIC_PASSWORD_FILE}" ]; then
  KIBANA_FLEET_PASSWORD="$(cat "$ELASTIC_PASSWORD_FILE")"
  export KIBANA_FLEET_PASSWORD
fi

exec /usr/local/bin/docker-entrypoint "$@"
