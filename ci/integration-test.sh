#!/usr/bin/env bash
# Esegue i test di integrazione con MongoDB e Redis veri.
#
# I servizi vivono in container effimeri su una rete dedicata, e il contenitore
# che compila i test vi si collega: e' lo stesso schema con cui la verifica a
# runtime interroga gli artefatti, e non richiede nulla di installato sull'host.
set -uo pipefail

GO_IMAGE=${GO_IMAGE:-golang:1.26.6@sha256:0d1d3a794be25f809dd2cb3160d8c73276c4056a9f8242a138e908ddeee7b6b6}
MONGO_IMAGE=${MONGO_IMAGE:-mongo:8.2.12@sha256:e0ce8c35124d4a9f9785532d1f268f39e9728ffa1cb38f46fa482436424c4bd3}
REDIS_IMAGE=${REDIS_IMAGE:-redis:8.10.0-alpine@sha256:978f0e01593e65eed801f2402944efcd936d43b5027e4908a7897baf88ed6241}

RETE=${IT_NETWORK:-it-net}
PREFISSO=${IT_PREFIX:-it}

pulisci() {
  docker rm -f "$PREFISSO-db" "$PREFISSO-redis" >/dev/null 2>&1
  docker network rm "$RETE" >/dev/null 2>&1
}
trap pulisci EXIT
pulisci

docker network create "$RETE" >/dev/null
docker run -d --rm --name "$PREFISSO-db" --network "$RETE" "$MONGO_IMAGE" >/dev/null
docker run -d --rm --name "$PREFISSO-redis" --network "$RETE" "$REDIS_IMAGE" >/dev/null

# Attende che la base dati accetti comandi: partire prima produrrebbe
# fallimenti che sembrano difetti del codice.
pronto=0
for _ in $(seq 1 60); do
  if docker exec "$PREFISSO-db" mongosh --quiet --eval 'db.adminCommand({ping:1}).ok' 2>/dev/null | grep -q 1; then
    pronto=1
    break
  fi
  sleep 2
done
if [ "$pronto" -ne 1 ]; then
  echo "PREMESSA FALLITA: MongoDB non pronto" >&2
  exit 1
fi

MSYS_NO_PATHCONV=1 docker run --rm --network "$RETE" \
  -v "$(pwd)":/src:ro -w /src/server \
  -v pi-go-mod:/go/pkg/mod -v pi-go-build:/root/.cache/go-build \
  -e MONGO_URI="mongodb://$PREFISSO-db:27017" \
  -e REDIS_URL="redis://$PREFISSO-redis:6379" \
  -e GOMAXPROCS="${GOMAXPROCS:-}" -e GOFLAGS="${GOFLAGS:-}" \
  -e COVERAGE_FLOOR="${COVERAGE_FLOOR:-}" -e COVERAGE_TARGET="${COVERAGE_TARGET:-}"   -e GO_TAGS=integration   "$GO_IMAGE" ${COMANDO:-sh -c "go test -tags=integration -count=1 ./..."}
