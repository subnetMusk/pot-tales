#!/usr/bin/env bash
# Verifica end-to-end di uno stack Swarm gia' applicato e inizializzato con
# Fleet. Non crea risorse Docker e non modifica i servizi sotto osservazione.
set -euo pipefail

STACK_NAME=${STACK_NAME:-pi}
APP_HOST=${APP_HOST:-localhost}
BASE_URL=${BASE_URL:-https://$APP_HOST}
DASHBOARD_USER=${DASHBOARD_USER:-elastic}
DASHBOARD_PASSWORD_FILE=${DASHBOARD_PASSWORD_FILE:-secrets/elastic_password}
STABILITY_SECONDS=${STABILITY_SECONDS:-30}
CURL_INSECURE=${CURL_INSECURE:-0}

EXPECTED_SERVICES="
proxy
crowdsec
landing
frontend
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

[ -r "$DASHBOARD_PASSWORD_FILE" ] ||
  fail "file password dashboard non leggibile: $DASHBOARD_PASSWORD_FILE"

tmp_dir=$(mktemp -d "${TMPDIR:-/tmp}/stack-verify.XXXXXX")
cleanup() {
  rm -f -- \
    "$tmp_dir/health.body" \
    "$tmp_dir/landing.body" \
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

curl_request "$tmp_dir/landing.body" 200 "$BASE_URL/info/"
if grep -Eiq \
  "(src|href)[[:space:]]*=[[:space:]]*['\"]((https?:)?//)|url\\([[:space:]]*['\"]?(https?:)?//|@import[[:space:]]+['\"](https?:)?//" \
  "$tmp_dir/landing.body"; then
  fail "la landing contiene dipendenze esterne"
fi
ok "landing priva di riferimenti esterni"

landing_networks=$(docker service inspect "${STACK_NAME}_landing" \
  --format '{{len .Spec.TaskTemplate.Networks}}') ||
  fail "lettura reti landing fallita"
assert_equal "landing collegata a una sola rete" 1 "$landing_networks"
for field in Env Mounts Secrets; do
  value=$(docker service inspect "${STACK_NAME}_landing" \
    --format "{{json .Spec.TaskTemplate.ContainerSpec.$field}}") ||
    fail "lettura $field landing fallita"
  case "$value" in
    null|'[]') ;;
    *) fail "landing con dipendenza Docker inattesa in $field: $value" ;;
  esac
done
ok "landing senza env, mount o secret"

curl_request "$tmp_dir/kibana-anon.body" 401 \
  "$BASE_URL/osservabilita/api/status"

url_authority=${BASE_URL#*://}
url_authority=${url_authority%%/*}
netrc_machine=${url_authority%%:*}
IFS= read -r dashboard_password < "$DASHBOARD_PASSWORD_FILE" || true
[ -n "$dashboard_password" ] || fail "password dashboard vuota"
umask 077
{
  printf 'machine %s\n' "$netrc_machine"
  printf 'login %s\n' "$DASHBOARD_USER"
  printf 'password %s\n' "$dashboard_password"
} > "$tmp_dir/dashboard.netrc"
unset dashboard_password

curl_request "$tmp_dir/kibana-auth.body" 200 \
  --netrc-file "$tmp_dir/dashboard.netrc" \
  "$BASE_URL/osservabilita/api/status"
assert_contains "Kibana disponibile" '"level":"available"' \
  "$(<"$tmp_dir/kibana-auth.body")"

curl_request "$tmp_dir/telemetry.body" 200 "$BASE_URL/telemetria/"

printf '\n== Fleet e hardening ==\n'

for agent in apm-agent infra-agent; do
  output="$tmp_dir/fleet-${agent%%-agent}.body"
  query="local_metadata.host.hostname%3A%22${agent}%22%20and%20status%3Aonline"
  curl_request "$output" 200 \
    --netrc-file "$tmp_dir/dashboard.netrc" \
    -H 'kbn-xsrf: true' \
    "$BASE_URL/osservabilita/api/fleet/agents?perPage=100&kuery=$query"
  body=$(<"$output")
  assert_contains "Fleet: $agent online" '"total":1' "$body"
  assert_contains "Fleet: hostname $agent" "\"hostname\":\"$agent\"" "$body"
done

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

curl_request "$tmp_dir/fleet-policies.body" 200 \
  --netrc-file "$tmp_dir/dashboard.netrc" \
  -H 'kbn-xsrf: true' \
  "$BASE_URL/osservabilita/api/fleet/package_policies?perPage=100"
fleet_policies=$(<"$tmp_dir/fleet-policies.body")
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

printf '\nPASS: %s controlli completati sullo stack %s\n' "$checks" "$STACK_NAME"
