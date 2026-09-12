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
# Le utenze delle due platee di osservabilita' si passano come mappe HCL, e sono
# create dallo stesso apply che genera i token. Omettendole, Space e ruoli
# esistono ma nessuno puo' accedervi:
#
#   TF_VAR_utenze_esercizio='{"operatore" = "..."}' \
#   TF_VAR_utenze_evento='{"divulgazione" = "..."}' \
#     ./fleet-bootstrap.sh
#
# Nome e password devono coincidere con le righe dei corrispondenti elenchi
# htpasswd in `secrets/`: il bordo verifica la credenziale e lascia passare
# l'intestazione di autorizzazione, quindi la stessa credenziale autentica poi
# l'utente su Kibana. Il disallineamento non e' rilevabile dal modulo, perche'
# gli elenchi htpasswd contengono impronte e non password.
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
# ELASTIC_PASSWORD, TF_DIR, OUTPUT_FILE, TOKEN_SINK, TOKEN_VOLUME, TF_NETWORK,
# DASHBOARD_USERS_TFVARS, GAMEPLAY_MAPPINGS_FILE.
# ==============================================================================
set -euo pipefail

_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$_ROOT"

ELASTIC_USER=${ELASTICSEARCH_USERNAME:-elastic}
TF_DIR=${TF_DIR:-terraform/elk}
GAMEPLAY_MAPPINGS_FILE=${GAMEPLAY_MAPPINGS_FILE:-$TF_DIR/gameplay-mappings.json}
OUTPUT_FILE=${OUTPUT_FILE:-.env.fleet}
WAIT_TIMEOUT=${WAIT_TIMEOUT:-300}

# Stessa versione di Terraform usata da ogni altro comando del progetto. Due
# versioni diverse sullo stesso stato non convivono: Terraform vi annota la
# propria e rifiuta di operare con una precedente, quindi un apply da qui
# renderebbe inutilizzabili i target che girano sull'immagine ancorata.
TF_IMAGE=${TF_IMAGE:-hashicorp/terraform:1.9@sha256:18f9986038bbaf02cf49db9c09261c778161c51dcc7fb7e355ae8938459428cd}
CURL_IMAGE=${CURL_IMAGE:-curlimages/curl:8.11.1@sha256:c1fe1679c34d9784c1b0d1e5f62ac0a79fca01fb6377cdd33e90473c6f9f9a69}

# Lo stato di Terraform vive fuori dalla copia di lavoro. Senza
# `-backend-config` il backend locale dichiarato vuoto scrive `terraform.tfstate`
# nella directory del modulo, cioe' dentro il checkout: un `git clean` o una
# ridistribuzione lo cancellerebbero, e il file contiene in chiaro tutti i valori
# dichiarati `sensitive`, password delle utenze comprese.
#
# I permessi sono ristretti alla creazione perche' dopo il primo apply e' tardi:
# il file esiste gia' e lo ha letto chiunque potesse attraversare la directory.
TF_STATE_DIR=${TF_STATE_DIR:-/var/lib/pi-terraform/elk}

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

# La directory dei secret e' la fonte autorevole: e' da li' che lo stack monta i
# valori con cui i servizi si sono avviati. `.env` resta come ripiego per lo
# sviluppo con Compose, ma viene dopo: quando i due divergono, e' quello dei
# secret il valore che Elasticsearch accetta, e usare l'altro produce un 401 che
# sembra un guasto di Kibana.
SECRETS_DIR=${SECRETS_DIR:-secrets}

leggi_secret() {
  local nome=$1
  [ -s "$SECRETS_DIR/$nome" ] || return 1
  tr -d '\r\n' < "$SECRETS_DIR/$nome"
}

if [ -z "${ELASTIC_PASSWORD:-}" ]; then
  ELASTIC_PASSWORD=$(leggi_secret elastic_password || true)
fi
if [ -z "${ELASTIC_PASSWORD:-}" ] && [ -f .env ]; then
  ELASTIC_PASSWORD=$(grep -E '^ELASTIC_PASSWORD=' .env | head -1 | cut -d= -f2-)
fi
if [ -z "${ELASTIC_PASSWORD:-}" ]; then
  log "ELASTIC_PASSWORD non impostata e non ricavabile da $SECRETS_DIR o da .env"
  exit 1
fi

# Il token dell'intake APM deve essere lo stesso che il backend presenta. Il
# backend lo legge dal secret montato, quindi la policy Fleet va costruita sullo
# stesso file: passarne uno diverso farebbe rifiutare ogni traccia senza che
# l'agente lo segnali.
if [ -z "${TF_VAR_apm_secret_token:-}" ]; then
  TF_VAR_apm_secret_token=$(leggi_secret apm_secret_token || true)
  [ -n "$TF_VAR_apm_secret_token" ] && export TF_VAR_apm_secret_token
fi

# Password dell'utenza con cui Filebeat scrive: Filebeat la legge dal secret
# montato, quindi Terraform deve crearla dallo stesso file. Finche' l'utenza non
# esiste Filebeat riceve un 401 e ritenta, e i log restano sul disco ad
# attenderlo.
if [ -z "${TF_VAR_filebeat_password:-}" ]; then
  TF_VAR_filebeat_password=$(leggi_secret filebeat_writer_password || true)
  [ -n "$TF_VAR_filebeat_password" ] && export TF_VAR_filebeat_password
fi

# Gli htpasswd non contengono password recuperabili: da soli consentono a
# Traefik di verificare una credenziale, ma non permettono a Terraform di creare
# la stessa utenza in Elasticsearch. Il comando di configurazione scrive quindi
# una copia root-only in JSON, montata soltanto nel contenitore effimero di
# Terraform. Le variabili d'ambiente restano supportate per sviluppo e CI, ma
# devono essere fornite entrambe per non creare una sola platea.
dashboard_mount=()
dashboard_var_args=()
if [ -n "${TF_VAR_utenze_esercizio:-}" ] || [ -n "${TF_VAR_utenze_evento:-}" ]; then
  if [ -z "${TF_VAR_utenze_esercizio:-}" ] || [ -z "${TF_VAR_utenze_evento:-}" ]; then
    log "TF_VAR_utenze_esercizio e TF_VAR_utenze_evento vanno impostate insieme"
    exit 1
  fi
else
  DASHBOARD_USERS_TFVARS=${DASHBOARD_USERS_TFVARS:-$SECRETS_DIR/dashboard_users.tfvars.json}
  case "$DASHBOARD_USERS_TFVARS" in
    /*) dashboard_vars_host=$DASHBOARD_USERS_TFVARS ;;
    *)  dashboard_vars_host=$_ROOT/$DASHBOARD_USERS_TFVARS ;;
  esac
  if [ ! -s "$dashboard_vars_host" ]; then
    log "credenziali Terraform delle dashboard assenti: $dashboard_vars_host"
    log "eseguire provisioning/bin/configure-dashboard-users.py $SECRETS_DIR"
    exit 1
  fi
  dashboard_mount=(-v "$dashboard_vars_host:/run/dashboard_users.tfvars.json:ro")
  dashboard_var_args=(-var-file=/run/dashboard_users.tfvars.json)
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
tf() (
  # MSYS_NO_PATHCONV: su Git Bash per Windows un argomento che inizia con "/"
  # viene riscritto come percorso Windows, e i percorsi interni al contenitore
  # diventerebbero invalidi. Sui sistemi Linux la variabile non ha effetto.
  # Solo le variabili valorizzate vengono trasmesse. Passarne una vuota non
  # equivale a ometterla: Terraform la considera impostata e sostituisce il
  # valore predefinito dichiarato dal modulo con la stringa vuota, quindi il
  # provider si troverebbe senza endpoint.
  # Le due mappe delle utenze vanno trasmesse qui: senza, l'apply crea gli Space
  # e i ruoli ma nessuna utenza, e le dashboard restano irraggiungibili anche
  # superando il basicAuth del bordo. Le password devono coincidere con quelle
  # negli elenchi htpasswd, perche' Traefik non rimuove l'intestazione di
  # autorizzazione e la stessa credenziale autentica su Kibana.
  local ambiente_file nome
  umask 077
  ambiente_file=$(mktemp "${TMPDIR:-/tmp}/fleet-bootstrap-tf-env.XXXXXX")
  trap 'rm -f -- "$ambiente_file"' EXIT

  # `docker run -e NOME=valore` rende il valore visibile nella process list
  # dell'host. L'env-file root-only lascia negli argomenti soltanto il percorso
  # temporaneo e viene cancellato anche quando Terraform fallisce.
  printf 'TF_VAR_elastic_password=%s\n' "$ELASTIC_PASSWORD" > "$ambiente_file"
  for nome in TF_VAR_elasticsearch_endpoint TF_VAR_kibana_endpoint \
              TF_VAR_filebeat_password TF_VAR_apm_secret_token \
              TF_VAR_insecure_tls \
              TF_VAR_utenze_esercizio TF_VAR_utenze_evento; do
    if [ -n "${!nome:-}" ]; then
      printf '%s=%s\n' "$nome" "${!nome}" >> "$ambiente_file"
    fi
  done

  MSYS_NO_PATHCONV=1 docker run --rm --network "$TF_NETWORK" \
    -v "$(pwd)/$TF_DIR:/tf" -w /tf \
    -v "$TF_STATE_DIR:/stato" \
    "${dashboard_mount[@]}" \
    --env-file "$ambiente_file" \
    "$TF_IMAGE" "$@"
)

if [ ! -d "$TF_STATE_DIR" ]; then
  log "creo la directory di stato $TF_STATE_DIR"
  mkdir -p "$TF_STATE_DIR"
  chmod 700 "$TF_STATE_DIR"
fi

# Uno stato nella directory del modulo e' il residuo di un'inizializzazione
# senza percorso esplicito. Terraform lo rileva e chiede di migrarlo, ma non
# puo' chiederlo con l'input disabilitato: si fermerebbe qui con un messaggio
# che parla di input interattivo e non della causa.
#
# La decisione non e' automatizzabile. Migrare sovrascriverebbe lo stato
# operativo con uno piu' vecchio; cancellare butterebbe l'unico registro delle
# risorse create da quell'esecuzione. Chi interviene deve guardare le date.
if [ -f "$TF_DIR/terraform.tfstate" ]; then
  log "stato residuo dentro la copia di lavoro: $TF_DIR/terraform.tfstate"
  log "  Va spostato o rimosso prima di proseguire. Contiene in chiaro i valori"
  log "  dichiarati sensibili, quindi non allegarlo a segnalazioni e non copiarlo"
  log "  fuori dalla macchina. Lo stato in servizio e' in $TF_STATE_DIR."
  exit 1
fi

# `-reconfigure` perche' la directory del modulo conserva la configurazione del
# backend fra un'esecuzione e l'altra, e `make terraform-validate` vi lascia
# quella di `-backend=false`. Senza, l'inizializzazione successiva si interrompe
# chiedendo di migrare uno stato che non esiste. Il percorso e' sempre lo stesso,
# quindi non c'e' nulla da migrare: c'e' una sola collocazione valida.
tf init -input=false -reconfigure -backend-config=path=/stato/terraform.tfstate >/dev/null
tf apply -input=false -auto-approve "${dashboard_var_args[@]}" >/dev/null

# Il component template rende lo schema disponibile ai nuovi backing index. Il
# data stream puo' pero' esistere gia': aggiornare la mappatura e' idempotente e
# permette alle dashboard di mostrare zero invece di "campo non disponibile"
# anche prima che siano arrivati checkpoint o conclusioni reali.
[ -s "$GAMEPLAY_MAPPINGS_FILE" ] || {
  log "mappatura dei fatti di partita assente: $GAMEPLAY_MAPPINGS_FILE"
  exit 1
}

if [ -n "${STACK_NAME:-}" ]; then
  es_container=$(docker ps \
    --filter "label=com.docker.swarm.service.name=${STACK_NAME}_es01" \
    --format '{{.ID}}' | head -n 1)
else
  es_container=$(docker ps \
    --filter "label=com.docker.compose.service=es01" \
    --format '{{.ID}}' | head -n 1)
fi
[ -n "$es_container" ] || {
  log "contenitore Elasticsearch non trovato per aggiornare la mappatura"
  exit 1
}

mapping_result=$(MSYS_NO_PATHCONV=1 docker exec -i "$es_container" bash -c '
  set -euo pipefail
  auth_file=$(mktemp /tmp/fleet-bootstrap-netrc.XXXXXX)
  cleanup_auth() { rm -f -- "$auth_file"; }
  trap cleanup_auth EXIT
  umask 077
  {
    printf "machine localhost\nlogin elastic\npassword "
    cat /run/secrets/elastic_password
    printf "\n"
  } > "$auth_file"

  stream_status=$(curl --silent --show-error --output /dev/null \
    --write-out "%{http_code}" --netrc-file "$auth_file" \
    --cacert /usr/share/elasticsearch/config/certs/ca/ca.crt \
    https://localhost:9200/_data_stream/logs-gioco.partita-default)
  case "$stream_status" in
    200)
      curl --silent --show-error --fail --netrc-file "$auth_file" \
        --cacert /usr/share/elasticsearch/config/certs/ca/ca.crt \
        -X PUT -H "Content-Type: application/json" --data-binary @- \
        https://localhost:9200/logs-gioco.partita-default/_mapping >/dev/null
      printf updated
      ;;
    404)
      # Il component template appena applicato copre la prima creazione.
      printf pending
      ;;
    *)
      printf "stato inatteso del data stream: HTTP %s\n" "$stream_status" >&2
      exit 1
      ;;
  esac
' < "$GAMEPLAY_MAPPINGS_FILE") || {
  log "aggiornamento della mappatura dei fatti di partita non riuscito"
  exit 1
}
case "$mapping_result" in
  updated) log "mappatura dei fatti di partita aggiornata sul data stream" ;;
  pending) log "data stream dei fatti di partita non ancora creato; schema pronto nel template" ;;
  *)
    log "risposta inattesa dall'aggiornamento della mappatura: $mapping_result"
    exit 1
    ;;
esac

# Le dashboard fanno parte del risultato del bootstrap, non sono un passo
# manuale successivo. Un file mancante o un'importazione che non ha creato
# l'oggetto deve fermare l'unita' prima che dichiari il setup concluso.
for requisito in \
  esercizio:esercizio-salute-risorse \
  esercizio:esercizio-servizio-funnel \
  esercizio:esercizio-latenza-errori \
  evento:evento-andamento \
  evento:evento-impatto; do
  spazio=${requisito%%:*}
  dashboard=${requisito##*:}
  codice=$(kbn -s -o /dev/null -w '%{http_code}' \
    -u "$ELASTIC_USER:$ELASTIC_PASSWORD" \
    "$KIBANA_URL/s/$spazio/api/saved_objects/dashboard/$dashboard")
  if [ "$codice" != "200" ]; then
    log "dashboard $spazio/$dashboard assente dopo Terraform (HTTP $codice)"
    exit 1
  fi
done
log "dashboard obbligatorie presenti nei due Space"

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
