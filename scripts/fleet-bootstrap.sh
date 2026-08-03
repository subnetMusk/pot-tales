#!/usr/bin/env bash
# ==============================================================================
# Inizializzazione di Fleet e generazione degli enrollment token
# ==============================================================================
# Gli agenti Elastic si registrano presentando un enrollment token, che pero'
# esiste solo dopo che Kibana ha inizializzato Fleet e sono state create le
# policy. Su un'installazione vuota il token non e' noto in anticipo, quindi non
# puo' essere scritto a mano nella configurazione.
#
# Lo script risolve la dipendenza eseguendo le fasi nell'ordine necessario:
#
#   1. attende che Kibana risponda
#   2. richiama l'inizializzazione di Fleet
#   3. applica la configurazione Terraform, che crea policy e integrazioni
#   4. legge i token generati e li scrive nel file letto dallo stack
#
# E' idempotente in tutte le fasi: l'inizializzazione di Fleet e l'apply
# Terraform non producono effetti se lo stato e' gia' quello atteso, quindi lo
# script puo' essere eseguito a ogni avvio.
#
#   ./fleet-bootstrap.sh
#
# Variabili riconosciute: KIBANA_URL, ELASTIC_PASSWORD, TF_DIR, OUTPUT_FILE.
# ==============================================================================
set -euo pipefail

_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$_ROOT"

KIBANA_URL=${KIBANA_URL:-http://localhost:5601}
ELASTIC_USER=${ELASTICSEARCH_USERNAME:-elastic}
TF_DIR=${TF_DIR:-terraform/elk}
OUTPUT_FILE=${OUTPUT_FILE:-.env.fleet}
WAIT_TIMEOUT=${WAIT_TIMEOUT:-300}
TF_IMAGE=${TF_IMAGE:-hashicorp/terraform:1.14}

log() { printf '%s  %s\n' "$(date +%H:%M:%S)" "$*"; }

if [ -z "${ELASTIC_PASSWORD:-}" ]; then
  # Ripiego sul file di ambiente, che e' dove la password vive normalmente.
  if [ -f .env ]; then
    ELASTIC_PASSWORD=$(grep -E '^ELASTIC_PASSWORD=' .env | head -1 | cut -d= -f2-)
  fi
fi
if [ -z "${ELASTIC_PASSWORD:-}" ]; then
  log "ELASTIC_PASSWORD non impostata e non ricavabile da .env"
  exit 1
fi

# ------------------------------------------------------------------ 1. attesa
log "attendo Kibana su $KIBANA_URL"
deadline=$(( $(date +%s) + WAIT_TIMEOUT ))
until curl -s -u "$ELASTIC_USER:$ELASTIC_PASSWORD" "$KIBANA_URL/api/status" \
      | grep -q '"level":"available"'; do
  if [ "$(date +%s)" -ge "$deadline" ]; then
    log "Kibana non disponibile entro ${WAIT_TIMEOUT}s"
    exit 1
  fi
  sleep 5
done
log "Kibana disponibile"

# ------------------------------------------------- 2. inizializzazione di Fleet
# Crea le strutture di base di Fleet. Ripetibile senza effetti collaterali.
log "inizializzo Fleet"
setup_status=$(curl -s -o /dev/null -w '%{http_code}' -X POST \
  -u "$ELASTIC_USER:$ELASTIC_PASSWORD" \
  -H 'kbn-xsrf: true' \
  "$KIBANA_URL/api/fleet/setup")

if [ "$setup_status" != "200" ]; then
  log "inizializzazione di Fleet non riuscita (HTTP $setup_status)"
  exit 1
fi

# ------------------------------------------------------------- 3. configurazione
log "applico la configurazione Terraform in $TF_DIR"
tf() {
  docker run --rm --network host \
    -v "$(pwd)/$TF_DIR:/tf" -w /tf \
    -e "TF_VAR_elastic_password=$ELASTIC_PASSWORD" \
    "$TF_IMAGE" "$@"
}

tf init -input=false >/dev/null
tf apply -input=false -auto-approve >/dev/null

# --------------------------------------------------------------------- 4. token
log "leggo i token generati"
read_output() {
  tf output -raw "$1" 2>/dev/null
}

FLEET_TOKEN=$(read_output fleet_enrollment_token_server)
APM_TOKEN=$(read_output fleet_enrollment_token_apm)
INFRA_TOKEN=$(read_output fleet_enrollment_token_infra)
POLICY_ID=$(read_output fleet_server_policy_id)

for pair in "FLEET_TOKEN:$FLEET_TOKEN" "APM_TOKEN:$APM_TOKEN" "INFRA_TOKEN:$INFRA_TOKEN"; do
  if [ -z "${pair#*:}" ]; then
    log "token mancante: ${pair%%:*}"
    exit 1
  fi
done

# Un file per agente, ciascuno con la sola variabile che quell'agente legge.
# Un file unico richiederebbe di rimappare il nome della variabile nel compose,
# reintroducendo l'interpolazione che questo meccanismo evita.
umask 077
OUT_DIR=$(dirname "$OUTPUT_FILE")
BASE=$(basename "$OUTPUT_FILE")

write_env() {
  local suffix=$1
  shift
  local path="$OUT_DIR/$BASE.$suffix"
  {
    echo "# Generato da scripts/fleet-bootstrap.sh. Non modificare a mano."
    printf '%s\n' "$@"
  } > "$path"
  log "scritto $path"
}

write_env server \
  "FLEET_SERVER_POLICY_ID=$POLICY_ID" \
  "FLEET_ENROLLMENT_TOKEN=$FLEET_TOKEN"
write_env apm "FLEET_ENROLLMENT_TOKEN=$APM_TOKEN"
write_env infra "FLEET_ENROLLMENT_TOKEN=$INFRA_TOKEN"

log "bootstrap completato: gli agenti possono essere avviati"
