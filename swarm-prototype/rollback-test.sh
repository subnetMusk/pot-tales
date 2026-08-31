#!/usr/bin/env bash
# ==============================================================================
# Verifica del rollback automatico degli aggiornamenti
# ==============================================================================
# `update_config.failure_action: rollback` riporta un servizio alla specifica
# precedente quando un aggiornamento non converge entro la finestra di
# osservazione.
#
# La prova applica a es01 una configurazione che ne impedisce l'avvio e osserva
# se l'orchestratore ripristina autonomamente la versione precedente.
#
#   ./rollback-test.sh
#
# Richiede lo stack gia' in esecuzione e healthy.
set -uo pipefail

STACK=${STACK:-elkproto}
SVC="${STACK}_es01"
TIMEOUT=${TIMEOUT:-240}

HERE="$(cd "$(dirname "$0")" && pwd)"
# Un cd fallito lascerebbe lo script a operare nella directory sbagliata,
# che e' esattamente il momento in cui i comandi distruttivi fanno danno.
cd "$HERE" || exit 1

log() { printf '%s  %s\n' "$(date +%H:%M:%S)" "$*"; }

healthy() {
  local cid
  cid=$(docker ps -q --filter "label=com.docker.swarm.service.name=$SVC" | head -1)
  [ -n "$cid" ] || return 1
  [ "$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}nohealth{{end}}' "$cid" 2>/dev/null)" = "healthy" ]
}

if ! docker service inspect "$SVC" >/dev/null 2>&1; then
  log "il servizio $SVC non esiste: avvia prima lo stack"
  exit 1
fi

log "attesa dello stato healthy di $SVC"
for _ in $(seq 1 60); do healthy && break; sleep 3; done
if ! healthy; then
  log "$SVC non e' healthy: prova non valida"
  exit 2
fi

before=$(docker service inspect "$SVC" --format '{{.Version.Index}}')
log "stato di partenza: healthy, version index $before"

# Un percorso di chiave TLS inesistente impedisce l'avvio di Elasticsearch: il
# task non raggiunge lo stato healthy e l'aggiornamento non converge.
log "applicazione di un aggiornamento non valido"
docker service update \
  --env-add "xpack.security.http.ssl.key=certs/inesistente/none.key" \
  --detach=true "$SVC" >/dev/null 2>&1

log "osservazione dello stato dell'aggiornamento (max ${TIMEOUT}s)"
start=$(date +%s)
last=""
while [ $(( $(date +%s) - start )) -lt "$TIMEOUT" ]; do
  state=$(docker service inspect "$SVC" --format '{{if .UpdateStatus}}{{.UpdateStatus.State}}{{else}}nessuno{{end}}' 2>/dev/null)
  if [ "$state" != "$last" ]; then
    log "  +$(( $(date +%s) - start ))s stato aggiornamento: $state"
    last="$state"
  fi
  case "$state" in
    rollback_completed)
      log "ESITO: rollback eseguito automaticamente"
      # Il rollback ripristina la specifica: va verificato anche il ritorno in
      # servizio.
      log "verifica del ritorno allo stato healthy"
      for _ in $(seq 1 60); do healthy && break; sleep 3; done
      if healthy; then
        log "confermato: $SVC nuovamente healthy dopo il rollback"
        exit 0
      fi
      log "specifica ripristinata ma servizio non healthy: rollback parziale"
      exit 1
      ;;
    rollback_paused)
      log "ESITO: rollback avviato ma messo in pausa da Swarm"
      exit 1
      ;;
  esac
  sleep 3
done

log "ESITO: nessun rollback entro ${TIMEOUT}s (ultimo stato: $last)"
log "il ripristino richiederebbe un intervento manuale"
exit 1
