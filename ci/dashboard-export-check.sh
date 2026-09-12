#!/usr/bin/env bash
# Regressione del ciclo di export: Kibana puo' chiudere l'NDJSON senza newline.
# L'ultimo oggetto deve comunque sopravvivere e la data view va esclusa.
set -euo pipefail

RADICE=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
SCRATCH=$(mktemp -d)
trap 'rm -rf "$SCRATCH"' EXIT

mkdir -p "$SCRATCH/bin" "$SCRATCH/dashboards/esercizio"
cp "$RADICE/terraform/elk/dashboards/export.sh" "$SCRATCH/dashboards/export.sh"

cat >"$SCRATCH/bin/curl" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
url=""
body=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    -d) body=$2; shift 2 ;;
    http://*|https://*) url=$1; shift ;;
    *) shift ;;
  esac
done

case "$url" in
  */api/status)
    printf '%s\n' '{"version":{"number":"8.19.19"}}'
    ;;
  */api/saved_objects/_export)
    printf '%s\n' \
      '{"attributes":{},"coreMigrationVersion":"8.8.0","id":"vista-esercizio","references":[],"type":"index-pattern","typeMigrationVersion":"8.0.0"}' \
      '{"attributes":{},"coreMigrationVersion":"8.8.0","id":"pannello","references":[],"type":"lens","typeMigrationVersion":"8.9.0"}'
    # Nessun newline finale: e' il caso che in precedenza eliminava la dashboard.
    printf '%s' '{"attributes":{},"coreMigrationVersion":"8.8.0","id":"dashboard-prova","references":[],"type":"dashboard","typeMigrationVersion":"10.3.0"}'
    printf '%s' "$body" >"$MOCK_REQUEST_BODY"
    ;;
  *)
    echo "URL inatteso nel mock: $url" >&2
    exit 1
    ;;
esac
MOCK
chmod +x "$SCRATCH/bin/curl"

MOCK_REQUEST_BODY="$SCRATCH/request.json" \
PATH="$SCRATCH/bin:$PATH" \
KIBANA_PASSWORD=prova \
  "$SCRATCH/dashboards/export.sh" esercizio prova dashboard-prova >/dev/null

OUTPUT="$SCRATCH/dashboards/esercizio/prova.ndjson"
[ "$(wc -l <"$OUTPUT" | tr -d ' ')" = "2" ]
grep -q '"id":"pannello"' "$OUTPUT"
grep -q '"id":"dashboard-prova"' "$OUTPUT"
! grep -q '"type":"index-pattern"' "$OUTPUT"
jq -e '.objects == [{"type":"dashboard","id":"dashboard-prova"}]
  and .includeReferencesDeep == true
  and .excludeExportDetails == true' "$SCRATCH/request.json" >/dev/null

echo "export dashboard: test superato"
