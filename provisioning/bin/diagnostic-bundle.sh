#!/usr/bin/env bash
# Raccoglie uno stato diagnostico su volume persistente.
#
# Invocato da diagnostic-bundle.service allo spegnimento ordinato, prima che
# Docker si fermi. Puo' essere eseguito anche a mano in qualunque momento.
#
# Copre soltanto gli arresti ordinati. Interruzione di alimentazione, panic del
# kernel e reset hardware non lasciano il tempo di eseguire nulla: per quei casi
# la fonte e' il journal persistente, che registra l'evento mentre accade.
set -uo pipefail

DEST_ROOT=${DIAGNOSTIC_DEST:-/srv/diagnostics}
KEEP=${DIAGNOSTIC_KEEP:-20}
TAIL_LINES=${DIAGNOSTIC_TAIL:-500}

STAMP=$(date -u +%Y%m%dT%H%M%SZ)
DEST="$DEST_ROOT/$STAMP"
mkdir -p "$DEST" || exit 0

exec 2>"$DEST/collector.err"

# Allo spegnimento systemd concede 90 secondi (TimeoutStopSec), poi termina la
# raccolta. Un solo comando bloccato consumava tutto il margine e lasciava un
# pacchetto a meta' senza dire dove si era fermato. Ogni comando ha quindi un
# tempo massimo, dentro un budget complessivo che lascia spazio alla
# ritenzione; chi sfora viene annotato in collector.err.
LIMITE=${DIAGNOSTIC_CMD_TIMEOUT:-10}
SCADENZA=$((SECONDS + ${DIAGNOSTIC_BUDGET:-70}))

# La nota va scritta direttamente nel file: lo stderr del comando e' spesso
# rediretto altrove, e l'informazione su chi ha sforato andrebbe persa.
limitato() {
  local resto=$((SCADENZA - SECONDS))
  if [ "$resto" -le 0 ]; then
    echo "saltato, budget esaurito: $*" >>"$DEST/collector.err"
    return 124
  fi
  [ "$resto" -lt "$LIMITE" ] || resto=$LIMITE
  timeout -k 2 "$resto" "$@"
  local esito=$?
  [ "$esito" -ne 124 ] || echo "tempo scaduto dopo ${resto}s: $*" >>"$DEST/collector.err"
  return "$esito"
}

# Stato di sistema
{
  echo "== data =="; date -u
  echo; echo "== uptime =="; uptime
  echo; echo "== memoria =="; free -m
  echo; echo "== filesystem =="; limitato df -h
  echo; echo "== volumi logici =="; limitato lvs 2>/dev/null; limitato vgs 2>/dev/null
} > "$DEST/system.txt"

# Eventi del kernel: terminazioni per memoria esaurita e panic precedenti
limitato journalctl -k -n "$TAIL_LINES" --no-pager > "$DEST/kernel.log" 2>/dev/null
limitato journalctl --no-pager -p err -n "$TAIL_LINES" > "$DEST/system-errors.log" 2>/dev/null

# Stato dell'orchestratore
if command -v docker >/dev/null 2>&1; then
  limitato docker version > "$DEST/docker-version.txt" 2>&1
  limitato docker info > "$DEST/docker-info.txt" 2>&1
  limitato docker service ls > "$DEST/service-ls.txt" 2>&1
  limitato docker stack ps "${STACK_NAME:-pi}" --no-trunc > "$DEST/stack-ps.txt" 2>&1
  limitato docker ps -a > "$DEST/containers.txt" 2>&1
  limitato docker stats --no-stream > "$DEST/stats.txt" 2>&1

  # Ultime righe per servizio: e' cio' che serve per capire chi ha ceduto
  mkdir -p "$DEST/services"
  limitato docker service ls --format '{{.Name}}' 2>/dev/null | while read -r svc; do
    limitato docker service logs --tail "$TAIL_LINES" --timestamps "$svc" \
      > "$DEST/services/${svc}.log" 2>&1
  done
fi

# Ritenzione: mantiene gli ultimi KEEP pacchetti. Solo le directory con la
# marca temporale: `lost+found`, alla radice del volume, non e' un pacchetto.
ls -1dt "$DEST_ROOT"/2*/ 2>/dev/null | tail -n "+$((KEEP + 1))" | while read -r old; do
  rm -rf "$old"
done

exit 0
