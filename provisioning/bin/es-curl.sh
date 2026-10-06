#!/usr/bin/env bash
# Libreria condivisa: riusa il task persistente dello stack per raggiungere ES.
# ES_NETWORK vuota mantiene la modalità Compose con curl sull'host.
es_curl() {
  if [ -z "${ES_NETWORK:-}" ]; then
    curl "$@"
    return
  fi
  local service container
  service=${ES_CURL_SERVICE:-${STACK_NAME:-pi}_surveillance-client}
  container=$(docker ps --filter "label=com.docker.swarm.service.name=$service" \
    --filter status=running --format '{{.ID}}' | head -n 1)
  if [ -z "$container" ]; then
    echo "Task locale di $service non disponibile" >&2
    return 1
  fi
  # La CA del volume certs è montata a un percorso fisso nel task. Gli altri
  # argomenti rimangono separati, inclusi password con spazi o metacaratteri.
  local args=() arg
  for arg in "$@"; do
    if [ -n "${ES_CA:-}" ] && [ "$arg" = "$ES_CA" ]; then
      args+=(/certs/ca/ca.crt)
    else
      args+=("$arg")
    fi
  done
  docker exec "$container" curl "${args[@]}"
}
