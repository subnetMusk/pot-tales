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
# Due modi di girare, secondo come e' avviato lo stack.
#
#   Compose   i servizi pubblicano porte sull'host: valgono i valori predefiniti
#   swarm     i servizi non pubblicano nulla e i nomi delle risorse portano il
#             prefisso dello stack. Basta indicare STACK_NAME: rete, volume dei
#             token, destinazione e indirizzo di Kibana si ricavano da li'
#
# La derivazione da un solo valore e' deliberata. Sono quattro impostazioni
# accoppiate, e impostarle una per una e' il modo in cui si finisce con meta'
# dello script adattato allo swarm e meta' no: le fasi che passano da un
# contenitore raggiungono i servizi, quelle che restano sull'host no.
#
# Variabili riconosciute: STACK_NAME, KIBANA_URL, KIBANA_BASE_PATH,
# ELASTIC_PASSWORD, TF_DIR, OUTPUT_FILE, TOKEN_SINK, TOKEN_VOLUME, TF_NETWORK.
# ==============================================================================
set -euo pipefail

_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$_ROOT"

ELASTIC_USER=${ELASTICSEARCH_USERNAME:-elastic}
TF_DIR=${TF_DIR:-terraform/elk}
OUTPUT_FILE=${OUTPUT_FILE:-.env.fleet}
WAIT_TIMEOUT=${WAIT_TIMEOUT:-300}

# Stessa versione di Terraform usata da ogni altro comando del progetto. Due
# versioni diverse sullo stesso stato non convivono: Terraform vi annota la
# propria e rifiuta di operare con una precedente, quindi un apply da qui
# renderebbe inutilizzabili i target che girano sull'immagine ancorata.
TF_IMAGE=${TF_IMAGE:-hashicorp/terraform:1.9@sha256:18f9986038bbaf02cf49db9c09261c778161c51dcc7fb7e355ae8938459428cd}
CURL_IMAGE=${CURL_IMAGE:-curlimages/curl:8.11.1@sha256:c1fe1679c34d9784c1b0d1e5f62ac0a79fca01fb6377cdd33e90473c6f9f9a69}

if [ -n "${STACK_NAME:-}" ]; then
  # Il base path fa parte dell'indirizzo anche all'interno: Kibana e' servita su
  # sottopercorso con la riscrittura attiva, quindi si aspetta di ricevere il
  # prefisso da chiunque, non solo dal proxy.
  KIBANA_URL=${KIBANA_URL:-http://kibana:5601${KIBANA_BASE_PATH:-/osservabilita}}
  TF_NETWORK=${TF_NETWORK:-${STACK_NAME}_elastic}
  TOKEN_VOLUME=${TOKEN_VOLUME:-${STACK_NAME}_fleettokens}
  # In swarm mode `env_file` non e' supportato e i secret devono esistere al
  # momento del deploy: i token vanno su un volume condiviso.
  TOKEN_SINK=${TOKEN_SINK:-volume}
  # Anche il provider Terraform gira dentro la rete dello stack: i valori
  # predefiniti del modulo puntano all'host e da li' non risolvono.
  TF_VAR_elasticsearch_endpoint=${TF_VAR_elasticsearch_endpoint:-https://es01:9200}
  TF_VAR_kibana_endpoint=${TF_VAR_kibana_endpoint:-$KIBANA_URL}
else
  KIBANA_URL=${KIBANA_URL:-http://localhost:5601}
  TF_NETWORK=${TF_NETWORK:-host}
  TOKEN_VOLUME=${TOKEN_VOLUME:-elkproto_fleettokens}
  TOKEN_SINK=${TOKEN_SINK:-file}
fi

log() { printf '%s  %s\n' "$(date +%H:%M:%S)" "$*"; }

# Interroga Kibana dalla stessa rete su cui gira Terraform.
#
# Con lo stack in swarm mode Kibana non pubblica porte: dall'host l'unico
# ingresso e' il proxy, che applica le proprie difese e presenta un certificato
# che il bootstrap non ha motivo di conoscere. Passare da li' introdurrebbe una
# dipendenza dalle utenze delle dashboard, che non esistono ancora perche' le
# crea proprio l'apply che questo script deve eseguire.
#
# La rete di osservabilita' e' dichiarata attaccabile esattamente per questo.
kbn() {
  if [ "$TF_NETWORK" = "host" ]; then
    curl "$@"
  else
    MSYS_NO_PATHCONV=1 docker run --rm --network "$TF_NETWORK" "$CURL_IMAGE" "$@"
  fi
}

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
until kbn -s -u "$ELASTIC_USER:$ELASTIC_PASSWORD" "$KIBANA_URL/api/status" \
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
setup_status=$(kbn -s -o /dev/null -w '%{http_code}' -X POST \
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
  # Solo le variabili valorizzate vengono trasmesse. Passarne una vuota non
  # equivale a ometterla: Terraform la considera impostata e sostituisce il
  # valore predefinito dichiarato dal modulo con la stringa vuota, quindi il
  # provider si troverebbe senza endpoint.
  local ambiente=()
  local nome
  for nome in TF_VAR_elasticsearch_endpoint TF_VAR_kibana_endpoint \
              TF_VAR_filebeat_password TF_VAR_apm_secret_token \
              TF_VAR_insecure_tls; do
    if [ -n "${!nome:-}" ]; then
      ambiente+=(-e "$nome=${!nome}")
    fi
  done

  MSYS_NO_PATHCONV=1 docker run --rm --network "$TF_NETWORK" \
    -v "$(pwd)/$TF_DIR:/tf" -w /tf \
    -e "TF_VAR_elastic_password=$ELASTIC_PASSWORD" \
    "${ambiente[@]}" \
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
