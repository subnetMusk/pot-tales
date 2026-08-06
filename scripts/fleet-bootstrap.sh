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
# Due destinazioni possibili per i token, secondo come gira lo stack:
#
#   file    file di ambiente locali, letti come env_file dai servizi Compose
#   volume  volume Docker condiviso, letto dagli agenti in swarm mode, dove
#           env_file non e' supportato e i secret devono esistere al momento
#           del deploy
#
# Variabili riconosciute: KIBANA_URL, ELASTIC_PASSWORD, TF_DIR, OUTPUT_FILE,
# TOKEN_SINK, TOKEN_VOLUME.
# ==============================================================================
set -euo pipefail

_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$_ROOT"

KIBANA_URL=${KIBANA_URL:-http://localhost:5601}
ELASTIC_USER=${ELASTICSEARCH_USERNAME:-elastic}
TF_DIR=${TF_DIR:-terraform/elk}
OUTPUT_FILE=${OUTPUT_FILE:-.env.fleet}
TOKEN_SINK=${TOKEN_SINK:-file}
TOKEN_VOLUME=${TOKEN_VOLUME:-elkproto_fleettokens}
WAIT_TIMEOUT=${WAIT_TIMEOUT:-300}
TF_IMAGE=${TF_IMAGE:-hashicorp/terraform:1.14}
# Rete su cui eseguire Terraform. Con lo stack in swarm mode i servizi non
# sono raggiungibili dall'host, quindi va indicata la rete dello stack.
TF_NETWORK=${TF_NETWORK:-host}

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
  # MSYS_NO_PATHCONV: su Git Bash per Windows un argomento che inizia con "/"
  # viene riscritto come percorso Windows, e i percorsi interni al contenitore
  # diventerebbero invalidi. Sui sistemi Linux la variabile non ha effetto.
  MSYS_NO_PATHCONV=1 docker run --rm --network "$TF_NETWORK" \
    -v "$(pwd)/$TF_DIR:/tf" -w /tf \
    -e "TF_VAR_elastic_password=$ELASTIC_PASSWORD" \
    -e "TF_VAR_elasticsearch_endpoint=${TF_VAR_elasticsearch_endpoint:-}" \
    -e "TF_VAR_kibana_endpoint=${TF_VAR_kibana_endpoint:-}" \
    -e "TF_VAR_filebeat_password=${TF_VAR_filebeat_password:-}" \
    -e "TF_VAR_apm_secret_token=${TF_VAR_apm_secret_token:-}" \
    -e "TF_VAR_telegram_webhook_url=${TF_VAR_telegram_webhook_url:-}" \
    -e "TF_VAR_telegram_chat_id=${TF_VAR_telegram_chat_id:-}" \
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

# Un file per agente, ciascuno con la sola variabile o il solo valore che
# quell'agente legge. Un file unico richiederebbe di rimappare il nome della
# variabile a valle, reintroducendo l'indirezione che questo meccanismo evita.
umask 077

write_file_sink() {
  local out_dir base path
  out_dir=$(dirname "$OUTPUT_FILE")
  base=$(basename "$OUTPUT_FILE")
  path="$out_dir/$base.$1"
  shift
  {
    echo "# Generato da scripts/fleet-bootstrap.sh. Non modificare a mano."
    printf '%s\n' "$@"
  } > "$path"
  log "scritto $path"
}

# In swarm mode i token finiscono su un volume condiviso: gli agenti lo leggono
# in sola lettura e ripartono finche' il file che li riguarda non compare.
write_volume_sink() {
  local nome=$1 valore=$2
  printf '%s' "$valore" | docker run --rm -i \
    -v "$TOKEN_VOLUME:/out" \
    alpine:3.24@sha256:28bd5fe8b56d1bd048e5babf5b10710ebe0bae67db86916198a6eec434943f8b \
    sh -c "cat > /out/$nome.token && chmod 0444 /out/$nome.token"
  log "scritto $nome.token nel volume $TOKEN_VOLUME"
}

case "$TOKEN_SINK" in
  file)
    write_file_sink server \
      "FLEET_SERVER_POLICY_ID=$POLICY_ID" \
      "FLEET_ENROLLMENT_TOKEN=$FLEET_TOKEN"
    write_file_sink apm "FLEET_ENROLLMENT_TOKEN=$APM_TOKEN"
    write_file_sink infra "FLEET_ENROLLMENT_TOKEN=$INFRA_TOKEN"
    ;;
  volume)
    write_volume_sink server "$FLEET_TOKEN"
    write_volume_sink apm "$APM_TOKEN"
    write_volume_sink infra "$INFRA_TOKEN"
    ;;
  *)
    log "TOKEN_SINK non riconosciuta: $TOKEN_SINK"
    exit 1
    ;;
esac

log "bootstrap completato: gli agenti possono essere avviati"
