#!/usr/bin/env bash
# Verifica end-to-end di uno stack Swarm gia' applicato e inizializzato con
# Fleet. Non crea risorse Docker e non modifica i servizi sotto osservazione.
set -euo pipefail

STACK_NAME=${STACK_NAME:-pi}
APP_HOST=${APP_HOST:-localhost}
BASE_URL=${BASE_URL:-https://$APP_HOST}
# Credenziale di una delle due platee, non quella amministrativa.
#
# Il bordo verifica la richiesta contro gli elenchi htpasswd delle platee e non
# rimuove l'intestazione di autorizzazione, che autentica poi la stessa utenza
# su Kibana. L'amministratore non compare in quegli elenchi e non deve
# comparirvi: raggiunge Kibana per altra via. Usarlo qui verificherebbe un
# percorso che in produzione non esiste, e il 401 sembrerebbe un guasto invece
# che un presupposto sbagliato.
#
# La password non e' ricavabile dall'elenco htpasswd, che conserva la sola
# impronta: va fornita dall'ambiente.
DASHBOARD_USER=${DASHBOARD_USER:-}
DASHBOARD_PASSWORD=${DASHBOARD_PASSWORD:-}

# Credenziale amministrativa, per le sole verifiche sullo stato interno dello
# stack che nessuna platea deve poter effettuare.
ADMIN_USER=${ADMIN_USER:-elastic}
ADMIN_PASSWORD_FILE=${ADMIN_PASSWORD_FILE:-secrets/elastic_password}

# Token dell'intake APM. E' lo stesso file che lo stack monta sul backend: la
# verifica deve leggere la fonte, non un valore ripetuto altrove, altrimenti
# proverebbe una credenziale che nessuno usa.
APM_TOKEN_FILE=${APM_TOKEN_FILE:-secrets/apm_secret_token}
KIBANA_INTERNAL_URL=${KIBANA_INTERNAL_URL:-http://kibana:5601/osservabilita}
CURL_IMAGE=${CURL_IMAGE:-curlimages/curl:8.11.1@sha256:c1fe1679c34d9784c1b0d1e5f62ac0a79fca01fb6377cdd33e90473c6f9f9a69}
STABILITY_SECONDS=${STABILITY_SECONDS:-30}
FILEBEAT_ERROR_WINDOW=${FILEBEAT_ERROR_WINDOW:-5m}
CURL_INSECURE=${CURL_INSECURE:-0}

EXPECTED_SERVICES="
proxy
crowdsec
frontend
export
server
db
redis
socket-proxy
setup
es01
kibana
filebeat
fleet-server
apm-agent
infra-agent
"

checks=0

fail() {
  printf 'FALLITO: %s\n' "$*" >&2
  exit 1
}

ok() {
  checks=$((checks + 1))
  printf 'ok  %s\n' "$*"
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "comando richiesto non trovato: $1"
}

assert_equal() {
  local description=$1 expected=$2 actual=$3
  [ "$actual" = "$expected" ] ||
    fail "$description: atteso '$expected', ottenuto '$actual'"
  ok "$description"
}

assert_contains() {
  local description=$1 expected=$2 actual=$3
  case "$actual" in
    *"$expected"*) ok "$description" ;;
    *) fail "$description: valore atteso non trovato" ;;
  esac
}

require_command docker
require_command curl
require_command grep
require_command mktemp

[ -n "$DASHBOARD_USER" ] && [ -n "$DASHBOARD_PASSWORD" ] ||
  fail "DASHBOARD_USER e DASHBOARD_PASSWORD non impostate: sono le credenziali di una delle due platee"

tmp_dir=$(mktemp -d "${TMPDIR:-/tmp}/stack-verify.XXXXXX")
cleanup() {
  rm -f -- \
    "$tmp_dir/health.body" \
    "$tmp_dir/home.body" \
    "$tmp_dir/kibana-anon.body" \
    "$tmp_dir/kibana-auth.body" \
    "$tmp_dir/telemetry.body" \
    "$tmp_dir/fleet-apm.body" \
    "$tmp_dir/fleet-infra.body" \
    "$tmp_dir/fleet-policies.body" \
    "$tmp_dir/dashboard.netrc"
  rmdir -- "$tmp_dir" 2>/dev/null || true
}
trap cleanup EXIT

curl_args=(--silent --show-error --connect-timeout 5 --max-time 30)
if [ "$CURL_INSECURE" = 1 ]; then
  curl_args+=(--insecure)
fi

# curl_request <file output> <stato atteso> [opzioni curl...] <URL>
curl_request() {
  local output=$1 expected=$2 code rc
  shift 2
  set +e
  code=$(curl "${curl_args[@]}" -o "$output" -w '%{http_code}' "$@")
  rc=$?
  set -e
  [ "$rc" -eq 0 ] || fail "curl terminato con codice $rc per ${*: -1}"
  assert_equal "HTTP ${*: -1}" "$expected" "$code"
}

printf '== Servizi Swarm ==\n'

service_lines=$(docker service ls \
  --filter "label=com.docker.stack.namespace=$STACK_NAME" \
  --format '{{.Name}}|{{.Replicas}}') || fail "lettura servizi dello stack fallita"

actual_count=0
while IFS='|' read -r service_name replicas; do
  [ -n "$service_name" ] || continue
  actual_count=$((actual_count + 1))
done <<< "$service_lines"
assert_equal "numero servizi" 15 "$actual_count"

while IFS= read -r short_name; do
  [ -n "$short_name" ] || continue
  full_name="${STACK_NAME}_${short_name}"
  case "$service_lines" in
    *"$full_name|"*) ;;
    *) fail "servizio mancante: $full_name" ;;
  esac
  replicas=$(docker service ls --filter "name=$full_name" \
    --format '{{.Name}}|{{.Replicas}}') ||
    fail "lettura repliche di $full_name fallita"
  if [ "$short_name" = setup ]; then
    expected_replicas="$full_name|0/1 (1/1 completed)"
  else
    expected_replicas="$full_name|1/1"
  fi
  assert_equal "repliche $short_name" "$expected_replicas" "$replicas"
done <<< "$EXPECTED_SERVICES"

current_task_snapshot() {
  local short_name full_name tasks count task_id current_state task_error
  while IFS= read -r short_name; do
    [ -n "$short_name" ] || continue
    [ "$short_name" != setup ] || continue
    full_name="${STACK_NAME}_${short_name}"
    tasks=$(docker service ps "$full_name" --no-trunc \
      --filter desired-state=running \
      --format '{{.ID}}|{{.CurrentState}}|{{.Error}}') || return 1
    count=0
    task_id=
    while IFS='|' read -r task_id current_state task_error; do
      [ -n "$task_id" ] || continue
      count=$((count + 1))
      case "$current_state" in
        Running*) ;;
        *) printf 'task non running per %s: %s\n' "$full_name" "$current_state" >&2
           return 1 ;;
      esac
      [ -z "$task_error" ] || {
        printf 'errore task per %s: %s\n' "$full_name" "$task_error" >&2
        return 1
      }
    done <<< "$tasks"
    [ "$count" -eq 1 ] || {
      printf 'task attivi inattesi per %s: %s\n' "$full_name" "$count" >&2
      return 1
    }
    printf '%s=%s\n' "$full_name" "$task_id"
  done <<< "$EXPECTED_SERVICES"
}

setup_tasks=$(docker service ps "${STACK_NAME}_setup" --no-trunc \
  --format '{{.CurrentState}}|{{.Error}}') || fail "lettura task setup fallita"
setup_current=
setup_error=
while IFS='|' read -r setup_current setup_error; do
  [ -n "$setup_current" ] && break
done <<< "$setup_tasks"
case "$setup_current" in
  Complete*) ;;
  *) fail "job setup non completato: $setup_current" ;;
esac
[ -z "$setup_error" ] || fail "job setup con errore: $setup_error"
ok "job setup completato"

snapshot_before=$(current_task_snapshot) || fail "task correnti non sani"
printf 'attendo %ss per escludere riavvii ricorrenti...\n' "$STABILITY_SECONDS"
sleep "$STABILITY_SECONDS"
snapshot_after=$(current_task_snapshot) || fail "task non sani dopo l'attesa"
assert_equal "task stabili senza crash-loop" "$snapshot_before" "$snapshot_after"

printf '\n== Proxy e applicazione ==\n'

curl_request "$tmp_dir/health.body" 200 "$BASE_URL/health"
health_body=$(<"$tmp_dir/health.body")
assert_contains "health MongoDB" '"mongodb":true' "$health_body"
assert_contains "health Redis" '"redis":true' "$health_body"
assert_contains "health server" '"server":true' "$health_body"

curl_request "$tmp_dir/home.body" 200 "$BASE_URL/"
if grep -Eiq \
  "(src|href)[[:space:]]*=[[:space:]]*['\"]((https?:)?//)|url\\([[:space:]]*['\"]?(https?:)?//|@import[[:space:]]+['\"](https?:)?//" \
  "$tmp_dir/home.body"; then
  fail "la home contiene dipendenze esterne"
fi
ok "home priva di riferimenti esterni"

curl_request "$tmp_dir/health.body" 301 "$BASE_URL/info/"

curl_request "$tmp_dir/kibana-anon.body" 401 \
  "$BASE_URL/osservabilita/api/status"

url_authority=${BASE_URL#*://}
url_authority=${url_authority%%/*}
netrc_machine=${url_authority%%:*}
umask 077
{
  printf 'machine %s\n' "$netrc_machine"
  printf 'login %s\n' "$DASHBOARD_USER"
  printf 'password %s\n' "$DASHBOARD_PASSWORD"
} > "$tmp_dir/dashboard.netrc"

curl_request "$tmp_dir/kibana-auth.body" 200 \
  --netrc-file "$tmp_dir/dashboard.netrc" \
  "$BASE_URL/osservabilita/api/status"
assert_contains "Kibana disponibile" '"level":"available"' \
  "$(<"$tmp_dir/kibana-auth.body")"

curl_request "$tmp_dir/telemetry.body" 200 "$BASE_URL/telemetria/"

# Prelievo degli archivi. Le due asserzioni coprono le due proprieta' che
# contano: il percorso non e' anonimo, e non elenca.
#
# Autenticato, la radice risponde 404 e non 200 con un indice: `autoindex` e'
# disattivato e non esiste un file di ripiego, quindi chi entra deve gia'
# conoscere il nome dell'archivio, che sta nel manifesto dell'esportazione. Un
# 200 qui significherebbe che l'elenco e' tornato raggiungibile.
#
# La credenziale usata e' quella della platea tecnica, la stessa che il bordo
# verifica su questo percorso. Quella divulgativa riceverebbe 401, ed e' il
# comportamento voluto.
curl_request "$tmp_dir/export-anon.body" 401 "$BASE_URL/export/"
curl_request "$tmp_dir/export-auth.body" 404 \
  --netrc-file "$tmp_dir/dashboard.netrc" \
  "$BASE_URL/export/"

printf '\n== Fleet e hardening ==\n'

# Lo stato di Fleet si interroga come operatore, non come visitatore.
#
# Le credenziali delle platee autorizzano la lettura delle proprie dashboard e
# nient'altro: chiedere loro l'elenco degli agenti riceve 403, ed e' il
# comportamento voluto. La verifica passa quindi dall'interno della rete di
# osservabilita' con la credenziale amministrativa, che e' anche la via per cui
# quell'informazione si consulta davvero: Kibana non e' raggiungibile dall'host
# se non attraverso il proxy, dove quella credenziale non e' ammessa.
[ -r "$ADMIN_PASSWORD_FILE" ] ||
  fail "password amministrativa non leggibile: $ADMIN_PASSWORD_FILE"
IFS= read -r admin_password < "$ADMIN_PASSWORD_FILE" || true
[ -n "$admin_password" ] || fail "password amministrativa vuota"

kibana_interna() {
  docker run --rm --network "${STACK_NAME}_elastic" "$CURL_IMAGE" \
    --silent --show-error --connect-timeout 5 --max-time 30 \
    -u "$ADMIN_USER:$admin_password" -H 'kbn-xsrf: true' "$@"
}

for agent in apm-agent infra-agent; do
  query="local_metadata.host.hostname%3A%22${agent}%22%20and%20status%3Aonline"
  body=$(kibana_interna     "$KIBANA_INTERNAL_URL/api/fleet/agents?perPage=100&kuery=$query") ||
    fail "interrogazione di Fleet per $agent non riuscita"
  assert_contains "Fleet: $agent online" '"total":1' "$body"
  assert_contains "Fleet: hostname $agent" "\"hostname\":\"$agent\"" "$body"
done

# ---------------------------------------------------------------------------
# Intake APM
# ---------------------------------------------------------------------------
# Il guasto che queste asserzioni intercettano e' silenzioso per costruzione:
# l'agente Go non distingue una consegna da un rifiuto, quindi il backend
# dichiara "APM monitoring" identicamente sia che le tracce arrivino sia che
# vengano scartate. Senza un controllo esplicito la regressione si scopre da una
# dashboard vuota, cioe' quando i dati servono e non ci sono piu'.
#
# Non si asserisce la presenza di tracce: subito dopo un deploy non c'e' stato
# traffico, e un'asserzione che dipende dal carico sarebbe intermittente. Si
# asseriscono invece le tre condizioni che rendono possibile la consegna.

apm_intake_url="https://apm-agent:8200"

server_env=$(docker service inspect "${STACK_NAME}_server" \
  --format '{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}') ||
  fail "lettura della specifica del servizio server non riuscita"

# La destinazione e' `apm-agent`, non il Fleet Server: su quest'ultimo la porta
# 8200 non ascolta, e in chiaro non ascolta nessuno dei due.
assert_contains "backend: destinazione dell'intake APM" \
  "ELASTIC_APM_SERVER_URL=$apm_intake_url" "$server_env"
assert_contains "backend: CA per l'intake APM" \
  "ELASTIC_APM_SERVER_CA_CERT_FILE=" "$server_env"

server_secrets=$(docker service inspect "${STACK_NAME}_server" \
  --format '{{range .Spec.TaskTemplate.ContainerSpec.Secrets}}{{println .File.Name}}{{end}}') ||
  fail "lettura dei secret del servizio server non riuscita"
assert_contains "backend: token dell'intake APM montato" \
  "apm_secret_token" "$server_secrets"

[ -r "$APM_TOKEN_FILE" ] || fail "token APM non leggibile: $APM_TOKEN_FILE"
IFS= read -r apm_token < "$APM_TOKEN_FILE" || true
[ -n "$apm_token" ] || fail "token APM vuoto"

# Una sola riga di metadati e' un corpo valido per l'intake v2. Il ritorno a
# capo finale fa parte del formato: senza, il server risponde 400 lamentando
# metadati troncati, e l'esito dell'autenticazione resta indistinguibile.
apm_metadata='{"metadata":{"service":{"name":"stack-verify","agent":{"name":"go","version":"2.0.0"},"language":{"name":"go"}}}}
'

apm_intake() {
  docker run --rm --network "${STACK_NAME}_elastic" "$CURL_IMAGE" \
    --silent --output /dev/null --write-out '%{http_code}' \
    --insecure --connect-timeout 5 --max-time 30 \
    -X POST "$apm_intake_url/intake/v2/events" \
    -H 'Content-Type: application/x-ndjson' \
    --data-binary "$apm_metadata" "$@"
}

# Il token e' imposto: una credenziale inventata non entra. E' l'asserzione che
# distingue un intake protetto da uno che accetta qualunque cosa.
codice=$(apm_intake -H 'Authorization: Bearer credenziale-non-valida') ||
  fail "intake APM non raggiungibile"
assert_equal "intake APM: rifiuta un token non valido" 401 "$codice"

# Il token che il backend possiede e' accettato. E' l'asserzione che intercetta
# la regressione vera: destinazione sbagliata o token disallineato si
# manifestano qui, invece che in una dashboard vuota settimane dopo.
codice=$(apm_intake -H "Authorization: Bearer $apm_token") ||
  fail "intake APM non raggiungibile con il token"
assert_equal "intake APM: accetta il token del backend" 202 "$codice"

# Le richieste anonime sono accettate, e deve restare cosi': il RUM parte dal
# browser, che non puo' custodire un segreto. Se questa asserzione cadesse, la
# telemetria del gioco smetterebbe di arrivare senza alcun errore lato server.
codice=$(apm_intake) || fail "intake APM non raggiungibile in anonimo"
assert_equal "intake APM: accetta il RUM anonimo" 202 "$codice"

get_service_container() {
  local service=$1 ids count id
  ids=$(docker ps -q --filter "label=com.docker.swarm.service.name=${STACK_NAME}_${service}") ||
    return 1
  count=0
  id=
  while IFS= read -r candidate; do
    [ -n "$candidate" ] || continue
    id=$candidate
    count=$((count + 1))
  done <<< "$ids"
  [ "$count" -eq 1 ] || return 1
  printf '%s\n' "$id"
}

kibana_container=$(get_service_container kibana) ||
  fail "container Kibana attivo non univoco"
filebeat_container=$(get_service_container filebeat) ||
  fail "container Filebeat attivo non univoco"
infra_container=$(get_service_container infra-agent) ||
  fail "container infra-agent attivo non univoco"
es_container=$(get_service_container es01) ||
  fail "container Elasticsearch attivo non univoco"

filebeat_mounts=$(docker service inspect "${STACK_NAME}_filebeat" \
  --format '{{range .Spec.TaskTemplate.ContainerSpec.Mounts}}{{println .Target}}{{end}}') ||
  fail "lettura mount Filebeat fallita"
assert_contains "Filebeat: registry persistente" "/usr/share/filebeat/data" "$filebeat_mounts"
assert_contains "Filebeat: access log Traefik montato" "/var/log/traefik" "$filebeat_mounts"

socket_log_driver=$(docker service inspect "${STACK_NAME}_socket-proxy" \
  --format '{{.Spec.TaskTemplate.LogDriver.Name}}') ||
  fail "lettura logging socket-proxy fallita"
assert_equal "socket-proxy senza ciclo di log" "none" "$socket_log_driver"

filebeat_recent=$(docker logs --since "$FILEBEAT_ERROR_WINDOW" "$filebeat_container" 2>&1) ||
  fail "lettura log recenti di Filebeat fallita"
case "$filebeat_recent" in
  *'Failed to index '*'events'*) fail "Filebeat ha scartato eventi negli ultimi $FILEBEAT_ERROR_WINDOW" ;;
  *) ok "Filebeat senza eventi scartati negli ultimi $FILEBEAT_ERROR_WINDOW" ;;
esac

kibana_keys=$(MSYS_NO_PATHCONV=1 docker exec "$kibana_container" \
  /usr/share/kibana/bin/kibana-keystore list) ||
  fail "lettura keystore Kibana fallita"
for key in \
  elasticsearch.password \
  xpack.security.encryptionKey \
  xpack.encryptedSavedObjects.encryptionKey \
  xpack.reporting.encryptionKey; do
  assert_contains "keystore Kibana: $key" "$key" "$kibana_keys"
done

filebeat_keys=$(MSYS_NO_PATHCONV=1 docker exec "$filebeat_container" \
  filebeat keystore list --strict.perms=false) ||
  fail "lettura keystore Filebeat fallita"
assert_contains "keystore Filebeat: username" ELASTICSEARCH_USERNAME "$filebeat_keys"
assert_contains "keystore Filebeat: password" ELASTICSEARCH_PASSWORD "$filebeat_keys"

assert_env_absent() {
  local container=$1 variable=$2 rc
  set +e
  MSYS_NO_PATHCONV=1 docker exec "$container" /bin/sh -c \
    "grep -aq '${variable}=' /proc/1/environ" >/dev/null 2>&1
  rc=$?
  set -e
  case "$rc" in
    0) fail "$variable presente nell'ambiente del processo" ;;
    1) ok "$variable assente dall'ambiente del processo" ;;
    *) fail "impossibile leggere l'ambiente per verificare $variable" ;;
  esac
}

assert_env_absent "$kibana_container" ELASTICSEARCH_PASSWORD
assert_env_absent "$kibana_container" XPACK_SECURITY_ENCRYPTIONKEY
assert_env_absent "$kibana_container" XPACK_ENCRYPTEDSAVEDOBJECTS_ENCRYPTIONKEY
assert_env_absent "$kibana_container" XPACK_REPORTING_ENCRYPTIONKEY
assert_env_absent "$filebeat_container" ELASTICSEARCH_PASSWORD

infra_mounts=$(docker service inspect "${STACK_NAME}_infra-agent" \
  --format '{{range .Spec.TaskTemplate.ContainerSpec.Mounts}}{{println .Target}}{{end}}') ||
  fail "lettura mount infra-agent fallita"
case "$infra_mounts" in
  *'/var/run/docker.sock'*) fail "infra-agent monta direttamente docker.sock" ;;
  *) ok "infra-agent senza mount diretto di docker.sock" ;;
esac

socket_network_id=$(docker network inspect "${STACK_NAME}_socket" \
  --format '{{.Id}}') || fail "rete socket dello stack non trovata"
infra_networks=$(docker service inspect "${STACK_NAME}_infra-agent" \
  --format '{{range .Spec.TaskTemplate.Networks}}{{println .Target}}{{end}}') ||
  fail "lettura reti infra-agent fallita"
assert_contains "infra-agent collegato alla rete socket" "$socket_network_id" "$infra_networks"

# Anche l'elenco delle policy e' informazione amministrativa: stessa via
# interna usata per lo stato degli agenti.
fleet_policies=$(kibana_interna \
  "$KIBANA_INTERNAL_URL/api/fleet/package_policies?perPage=100") ||
  fail "lettura delle policy Fleet non riuscita"
assert_contains "policy Docker indirizzata al socket-proxy" \
  'tcp://socket-proxy:2375' "$fleet_policies"
case "$fleet_policies" in
  *'unix:///var/run/docker.sock'*)
    fail "la policy Docker contiene ancora il socket locale" ;;
  *) ok "policy Docker senza socket locale" ;;
esac

infra_status=$(MSYS_NO_PATHCONV=1 docker exec "$infra_container" \
  elastic-agent status --output json) || fail "infra-agent degradato"
assert_contains "componenti infra-agent sani" '"state": 2' "$infra_status"

for requisito in \
  esercizio:esercizio-salute-risorse \
  esercizio:esercizio-servizio-funnel \
  evento:evento-andamento; do
  spazio=${requisito%%:*}
  dashboard=${requisito##*:}
  oggetto=$(kibana_interna \
    "$KIBANA_INTERNAL_URL/s/$spazio/api/saved_objects/dashboard/$dashboard") ||
    fail "dashboard $spazio/$dashboard assente"
  assert_contains "dashboard $spazio/$dashboard leggibile" \
    "\"id\":\"$dashboard\"" "$oggetto"
done

# L'export dello Space divulgativo e' anche il controllo piu' vicino al dato
# che viene realmente condiviso. Non basta limitare gli indici: una
# visualizzazione potrebbe aggregare e mostrare un identificativo sensibile.
evento_export=$(kibana_interna -X POST \
  -H 'Content-Type: application/json' \
  -d '{"objects":[{"type":"dashboard","id":"evento-andamento"}],"includeReferencesDeep":true,"excludeExportDetails":true}' \
  "$KIBANA_INTERNAL_URL/s/evento/api/saved_objects/_export") ||
  fail "export di controllo della dashboard evento fallito"
for vietato in partita.id ClientHost ClientAddr source.ip client.ip user_agent host.name container.name; do
  case "$evento_export" in
    *"$vietato"*) fail "dashboard evento espone o usa il campo vietato $vietato" ;;
  esac
done
ok "dashboard evento priva dei campi tecnici e identificativi vietati"

printf '\n== Elasticsearch ==\n'

es_query() {
  local endpoint=$1
  MSYS_NO_PATHCONV=1 docker exec "$es_container" bash -c '
  set -euo pipefail
  auth_file=$(mktemp /tmp/stack-verify-netrc.XXXXXX)
  cleanup_auth() { rm -f -- "$auth_file"; }
  trap cleanup_auth EXIT
  umask 077
  {
    printf "machine localhost\\nlogin elastic\\npassword "
    cat /run/secrets/elastic_password
    printf "\\n"
  } > "$auth_file"
  curl --silent --show-error --fail \
    --netrc-file "$auth_file" \
    --cacert /usr/share/elasticsearch/config/certs/ca/ca.crt \
    "https://localhost:9200${1}"
' _ "$endpoint"
}

es_health=$(es_query '/_cluster/health') || fail "query health Elasticsearch fallita"
assert_contains "cluster Elasticsearch verde" '"status":"green"' "$es_health"
assert_contains "Elasticsearch senza shard non assegnati" \
  '"unassigned_shards":0' "$es_health"

filebeat_template=$(es_query '/_index_template/filebeat-*') ||
  fail "query template Filebeat fallita"
assert_contains "template Filebeat con repliche a zero" \
  '"number_of_replicas":"0"' "$filebeat_template"

gameplay_stream=$(es_query '/_data_stream/logs-gioco.partita-default') ||
  fail "data stream dei fatti di partita assente"
assert_contains "data stream dei fatti di partita disponibile" \
  '"name":"logs-gioco.partita-default"' "$gameplay_stream"

access_count_body=$(es_query \
  '/filebeat-%2A/_count?q=event.dataset%3Atraefik.access') ||
  fail "conteggio degli access log fallito"
access_count=$(printf '%s' "$access_count_body" |
  sed -n 's/.*"count":\([0-9][0-9]*\).*/\1/p')
case "$access_count" in
  ''|*[!0-9]*) fail "conteggio degli access log non interpretabile" ;;
esac
[ "$access_count" -gt 0 ] || fail "nessun access log Traefik indicizzato"
ok "access log Traefik indicizzato ($access_count documenti)"

access_sensitive_body=$(es_query \
  '/filebeat-%2A/_count?q=event.dataset%3Atraefik.access%20AND%20(_exists_%3AClientHost%20OR%20_exists_%3AClientAddr%20OR%20_exists_%3Arequest_Authorization%20OR%20_exists_%3Arequest_Cookie)') ||
  fail "controllo dei campi sensibili negli access log fallito"
access_sensitive_count=$(printf '%s' "$access_sensitive_body" |
  sed -n 's/.*"count":\([0-9][0-9]*\).*/\1/p')
assert_equal "access log senza indirizzi o credenziali HTTP" "0" "$access_sensitive_count"

printf '\nPASS: %s controlli completati sullo stack %s\n' "$checks" "$STACK_NAME"
