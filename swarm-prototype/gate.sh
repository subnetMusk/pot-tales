#!/usr/bin/env bash
# ==============================================================================
# Misura del tempo di convergenza dello stack
# ==============================================================================
# Uso:
#   ./gate.sh [iterazioni] [cold|warm]
#
#   cold  volumi rimossi a ogni ciclo: avvio da stato iniziale
#   warm  volumi conservati: riavvio con dati gia' presenti
#
# Un ciclo e' superato se, senza intervento manuale:
#   - il job `setup` raggiunge lo stato Complete senza essere rischedulato
#   - es01, kibana e filebeat raggiungono lo stato healthy entro il timeout
#
# Lo script non applica correzioni: qualunque intervento manuale invalida la
# misura.
# ==============================================================================
set -uo pipefail

STACK=${STACK:-elkproto}
ITERATIONS=${1:-5}
MODE=${2:-cold}
TIMEOUT=${TIMEOUT:-900}

HERE="$(cd "$(dirname "$0")" && pwd)"
cd "$HERE"

SERVICES=(es01 kibana filebeat)
mkdir -p runs
RUNLOG="runs/gate-$(date +%Y%m%d-%H%M%S)-${MODE}.log"

log() { printf '%s  %s\n' "$(date +%H:%M:%S)" "$*" | tee -a "$RUNLOG"; }

rand() { head -c 96 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 32; }

ensure_swarm() {
  local state
  state=$(docker info --format '{{.Swarm.LocalNodeState}}' 2>/dev/null)
  if [ "$state" != "active" ]; then
    log "Swarm inattivo: inizializzazione del nodo (reversibile con 'docker swarm leave --force')"
    docker swarm init >/dev/null 2>&1 || docker swarm init --advertise-addr 127.0.0.1 >/dev/null
  fi
}

ensure_secrets() {
  mkdir -p secrets
  local f
  for f in elastic_password kibana_system_password kibana_encryption_key; do
    if [ ! -s "secrets/$f" ]; then
      printf '%s' "$(rand)" > "secrets/$f"
      log "generato secrets/$f"
    fi
  done
}

# Numero di task creati per un servizio. Ogni riavvio ne crea uno nuovo, quindi
# il numero di task meno uno corrisponde ai riavvii.
task_count() {
  docker service ps "${STACK}_$1" --format '{{.ID}}' 2>/dev/null | wc -l | tr -d ' '
}

setup_complete() {
  docker service ps "${STACK}_setup" --format '{{.CurrentState}}' 2>/dev/null | grep -qi '^Complete'
}

all_healthy() {
  local s cid h
  for s in "${SERVICES[@]}"; do
    cid=$(docker ps -q --filter "label=com.docker.swarm.service.name=${STACK}_${s}" 2>/dev/null | head -1)
    [ -n "$cid" ] || return 1
    h=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}nohealth{{end}}' "$cid" 2>/dev/null)
    [ "$h" = "healthy" ] || return 1
  done
  return 0
}

diagnose() {
  log "--- diagnosi ---"
  docker stack ps "$STACK" --no-trunc 2>&1 | tee -a "$RUNLOG" | head -40
  local s cid
  for s in "${SERVICES[@]}"; do
    cid=$(docker ps -q --filter "label=com.docker.swarm.service.name=${STACK}_${s}" 2>/dev/null | head -1)
    if [ -n "$cid" ]; then
      log "[$s] health:"
      docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{range .State.Health.Log}} | {{.Output}}{{end}}{{else}}nohealth{{end}}' "$cid" 2>&1 | tail -3 | tee -a "$RUNLOG"
    fi
    log "[$s] ultimi log del servizio:"
    docker service logs --tail 15 "${STACK}_${s}" 2>&1 | tail -15 | tee -a "$RUNLOG"
  done
}

teardown() {
  docker stack rm "$STACK" >/dev/null 2>&1
  local i
  for i in $(seq 1 90); do
    if [ -z "$(docker service ls -q --filter "label=com.docker.stack.namespace=$STACK" 2>/dev/null)" ] &&
       [ -z "$(docker network ls -q --filter "name=${STACK}_elastic" 2>/dev/null)" ]; then
      break
    fi
    sleep 2
  done
  if [ "$MODE" = "cold" ]; then
    local v
    for v in certs esdata01 kibanadata; do
      for i in $(seq 1 30); do
        docker volume rm "${STACK}_${v}" >/dev/null 2>&1 && break
        docker volume inspect "${STACK}_${v}" >/dev/null 2>&1 || break
        sleep 2
      done
    done
  fi
}

# ------------------------------------------------------------------------------

ensure_swarm
ensure_secrets

log "gate: $ITERATIONS iterazioni, modalita' $MODE, timeout ${TIMEOUT}s per ciclo"
log "stack: $STACK   log: $RUNLOG"

passed=0
failed=0
times=()

for i in $(seq 1 "$ITERATIONS"); do
  log ""
  log "===== ciclo $i/$ITERATIONS ($MODE) ====="
  teardown

  start=$(date +%s)
  if ! docker stack deploy -c stack.yml "$STACK" --detach=true >>"$RUNLOG" 2>&1; then
    log "ciclo $i: deploy fallito"
    failed=$((failed + 1))
    diagnose
    continue
  fi

  deadline=$(( start + TIMEOUT ))
  ok=0
  tick=0
  while [ "$(date +%s)" -lt "$deadline" ]; do
    if setup_complete && all_healthy; then ok=1; break; fi
    sleep 3
    tick=$(( tick + 1 ))
    # Stato riportato ogni 30s per individuare il punto in cui un ciclo non
    # converge.
    if [ $(( tick % 10 )) -eq 0 ]; then
      st=""
      for s in "${SERVICES[@]}"; do
        cid=$(docker ps -q --filter "label=com.docker.swarm.service.name=${STACK}_${s}" 2>/dev/null | head -1)
        if [ -z "$cid" ]; then
          st="$st $s=assente"
        else
          st="$st $s=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}nohealth{{end}}' "$cid" 2>/dev/null)"
        fi
      done
      setup_complete && st="$st setup=Complete" || st="$st setup=inCorso"
      log "  +$(( $(date +%s) - start ))s:$st"
    fi
  done
  elapsed=$(( $(date +%s) - start ))

  setup_tasks=$(task_count setup)
  es_tasks=$(task_count es01)
  kb_tasks=$(task_count kibana)
  fb_tasks=$(task_count filebeat)

  if [ "$ok" = 1 ]; then
    # Il job setup deve avere prodotto un solo task, in stato Complete.
    if [ "$setup_tasks" -gt 1 ]; then
      log "ciclo $i: FALLITO — il job setup ha prodotto $setup_tasks task (atteso 1)"
      failed=$((failed + 1))
      diagnose
      continue
    fi
    log "ciclo $i: OK in ${elapsed}s"
    log "  task per servizio (1 = nessun riavvio): setup=$setup_tasks es01=$es_tasks kibana=$kb_tasks filebeat=$fb_tasks"
    passed=$((passed + 1))
    times+=("$elapsed")
  else
    log "ciclo $i: FALLITO — timeout dopo ${elapsed}s"
    log "  task per servizio: setup=$setup_tasks es01=$es_tasks kibana=$kb_tasks filebeat=$fb_tasks"
    failed=$((failed + 1))
    diagnose
  fi
done

log ""
log "===== esito ====="
log "passati: $passed / $ITERATIONS   falliti: $failed"
if [ "${#times[@]}" -gt 0 ]; then
  log "tempi fino a tutti healthy: ${times[*]} (secondi)"
fi
log "log completo: $RUNLOG"

[ "$failed" -eq 0 ]
