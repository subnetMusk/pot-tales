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

# Stato di sistema
{
  echo "== data =="; date -u
  echo; echo "== uptime =="; uptime
  echo; echo "== memoria =="; free -m
  echo; echo "== filesystem =="; df -h
  echo; echo "== volumi logici =="; lvs 2>/dev/null; vgs 2>/dev/null
} > "$DEST/system.txt"

# Eventi del kernel: terminazioni per memoria esaurita e panic precedenti
journalctl -k -n "$TAIL_LINES" --no-pager > "$DEST/kernel.log" 2>/dev/null
journalctl --no-pager -p err -n "$TAIL_LINES" > "$DEST/system-errors.log" 2>/dev/null

# Stato dell'orchestratore
if command -v docker >/dev/null 2>&1; then
  docker version > "$DEST/docker-version.txt" 2>&1
  docker info > "$DEST/docker-info.txt" 2>&1
  docker service ls > "$DEST/service-ls.txt" 2>&1
  docker stack ps "${STACK_NAME:-pi}" --no-trunc > "$DEST/stack-ps.txt" 2>&1
  docker ps -a > "$DEST/containers.txt" 2>&1
  docker stats --no-stream > "$DEST/stats.txt" 2>&1

  # Ultime righe per servizio: e' cio' che serve per capire chi ha ceduto
  mkdir -p "$DEST/services"
  docker service ls --format '{{.Name}}' 2>/dev/null | while read -r svc; do
    docker service logs --tail "$TAIL_LINES" --timestamps "$svc" \
      > "$DEST/services/${svc}.log" 2>&1
  done
fi

# Ritenzione: mantiene gli ultimi KEEP pacchetti
ls -1dt "$DEST_ROOT"/*/ 2>/dev/null | tail -n "+$((KEEP + 1))" | while read -r old; do
  rm -rf "$old"
done

exit 0
