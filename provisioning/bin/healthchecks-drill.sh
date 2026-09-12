#!/usr/bin/env bash
# Collaudo controllato delle otto destinazioni Healthchecks.io.
#
# Ogni destinazione riceve un segnale esplicito di guasto e il relativo
# rientro. I messaggi sono numerati per poter seguire la sequenza anche sul
# canale di notifica. Questo script non modifica i marcatori locali usati dai
# timer e non interagisce con proxy, ACME, certificati o HSTS.
set -uo pipefail

CONF=${CONF:-/etc/stack-surveillance.env}
FORCE=${FORCE:-0}

if [ ! -r "$CONF" ]; then
  echo "configurazione non leggibile: $CONF" >&2
  echo "eseguire come root o tramite sudo" >&2
  exit 1
fi

# shellcheck source=/dev/null
. "$CONF"

HC_BASE=${HC_BASE:-https://hc-ping.com}
HC_PING_KEY=${HC_PING_KEY:-}
TIMEOUT=${TIMEOUT:-10}

if [ -z "$HC_PING_KEY" ]; then
  echo "HC_PING_KEY non configurata in $CONF" >&2
  exit 1
fi

checks=(
  stack-liveness
  app-degradation
  host-resources
  observability
  security
  alert-relay
  tls-pubblico
  backup-nightly
)
totale=${#checks[@]}

if [ "$FORCE" != 1 ]; then
  if [ ! -t 0 ]; then
    echo "il drill genera notifiche: rieseguire con FORCE=1" >&2
    exit 1
  fi
  printf 'Inviare segnale e rientro a %s check? [s/N] ' "$totale"
  read -r risposta
  [ "$risposta" = s ] || { echo "annullato"; exit 0; }
fi

ping() {
  local slug=$1 suffisso=$2 corpo=$3
  curl --silent --show-error --max-time "$TIMEOUT" --retry 2 \
    --data-raw "$corpo" --output /dev/null --write-out '%{http_code}' \
    "$HC_BASE/$HC_PING_KEY/$slug$suffisso"
}

pendente_slug=
pendente_corpo=

rientro_pendente() {
  [ -n "$pendente_slug" ] || return 0
  codice=$(ping "$pendente_slug" "" "$pendente_corpo" 2>/dev/null || true)
  printf 'rientro di sicurezza %-18s HTTP %s\n' "$pendente_slug" "${codice:-000}" >&2
  pendente_slug=
  pendente_corpo=
}

trap rientro_pendente EXIT
trap 'exit 130' HUP INT TERM

fallimenti=0
indice=0
for slug in "${checks[@]}"; do
  indice=$((indice + 1))
  segnale="[$indice/$totale] TEST CONTROLLATO - segnale di guasto su $slug"
  rientro="[$indice/$totale] TEST CONTROLLATO - rientro su $slug"

  codice_fail=$(ping "$slug" /fail "$segnale" 2>/dev/null || true)
  case "$codice_fail" in
    2??) ;;
    *) fallimenti=$((fallimenti + 1)) ;;
  esac

  pendente_slug=$slug
  pendente_corpo=$rientro
  sleep 1

  codice_ok=$(ping "$slug" "" "$rientro" 2>/dev/null || true)
  case "$codice_ok" in
    2??) pendente_slug=; pendente_corpo= ;;
    *) fallimenti=$((fallimenti + 1)) ;;
  esac

  printf '%s/%s %-18s segnale=%s rientro=%s\n' \
    "$indice" "$totale" "$slug" "${codice_fail:-000}" "${codice_ok:-000}"
done

if [ "$fallimenti" -ne 0 ]; then
  echo "drill incompleto: $fallimenti richieste non riuscite" >&2
  exit 1
fi

echo "drill completato: $totale/$totale check rientrati"
