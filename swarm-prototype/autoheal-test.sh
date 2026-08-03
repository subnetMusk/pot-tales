#!/usr/bin/env bash
# Verifica che Swarm rischeduli un task che passa in stato unhealthy senza che
# il processo termini. Vedi autoheal-test.yml.
set -uo pipefail

STACK=${STACK:-autohealtest}
TIMEOUT=${TIMEOUT:-180}

HERE="$(cd "$(dirname "$0")" && pwd)"
cd "$HERE"

log() { printf '%s  %s\n' "$(date +%H:%M:%S)" "$*"; }

cleanup() { docker stack rm "$STACK" >/dev/null 2>&1; }
trap cleanup EXIT

container() { docker ps -q --filter "label=com.docker.swarm.service.name=${STACK}_canary" | head -1; }
health()    { docker inspect --format '{{.State.Health.Status}}' "$1" 2>/dev/null; }
tasks()     { docker service ps "${STACK}_canary" --format '{{.ID}}' 2>/dev/null | wc -l | tr -d ' '; }

cleanup
sleep 3
docker stack deploy -c autoheal-test.yml "$STACK" --detach=true >/dev/null 2>&1

log "attesa dello stato healthy"
for _ in $(seq 1 40); do
  cid=$(container)
  [ -n "$cid" ] && [ "$(health "$cid")" = "healthy" ] && break
  sleep 3
done

cid=$(container)
if [ -z "$cid" ] || [ "$(health "$cid")" != "healthy" ]; then
  log "il container non ha raggiunto lo stato healthy: prova non valida"
  exit 2
fi

before=$(tasks)
log "healthy (container ${cid:0:12}), task finora: $before"

log "invalidazione dell'healthcheck, processo lasciato attivo"
# MSYS_NO_PATHCONV: su Git Bash per Windows un argomento che inizia con "/"
# viene riscritto come percorso Windows, impedendo l'esecuzione del comando
# all'interno del container.
MSYS_NO_PATHCONV=1 docker exec "$cid" sh -c 'rm -f /tmp/ok'

# Verifica della premessa: se il file esiste ancora, l'esito della prova non
# sarebbe interpretabile.
if MSYS_NO_PATHCONV=1 docker exec "$cid" sh -c '[ -f /tmp/ok ]'; then
  log "guasto non iniettato: /tmp/ok esiste ancora. Prova non valida."
  exit 2
fi
log "guasto iniettato: /tmp/ok rimosso"

log "attesa di una rischedulazione automatica (max ${TIMEOUT}s)"
start=$(date +%s)
saw_unhealthy=0
while [ $(( $(date +%s) - start )) -lt "$TIMEOUT" ]; do
  h=$(health "$cid")
  [ "$h" = "unhealthy" ] && saw_unhealthy=1
  now=$(container)
  if [ -n "$now" ] && [ "$now" != "$cid" ]; then
    log "RISCHEDULATO dopo $(( $(date +%s) - start ))s: nuovo container ${now:0:12}, task totali $(tasks)"
    log "esito: rischedulazione automatica confermata"
    exit 0
  fi
  sleep 3
done

log "nessuna rischedulazione entro ${TIMEOUT}s (unhealthy osservato: $saw_unhealthy, task $(tasks))"
log "esito: rischedulazione automatica non confermata su questa versione di Docker"
exit 1
