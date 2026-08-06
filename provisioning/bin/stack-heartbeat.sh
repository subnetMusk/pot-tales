#!/usr/bin/env bash
# Battito di liveness e sorveglianza locale delle risorse.
#
# Due responsabilita' distinte, deliberatamente separate su check diversi:
#
#   stack-liveness   il servizio risponde e sa servire. Il ping parte **solo se
#                    i controlli passano**: un battito incondizionato
#                    dimostrerebbe che il timer funziona, non che il servizio
#                    funziona. Il silenzio copre sia il degrado sia la macchina
#                    irraggiungibile, che e' l'unico segnale possibile quando la
#                    macchina non e' in grado di parlare.
#
#   host-resources   pressione su memoria, swap e disco, e terminazioni per
#                    esaurimento di memoria. Questi controlli non possono
#                    passare da Elasticsearch: quando la memoria finisce il
#                    cluster e' fra i primi a cedere, e la regola che avrebbe
#                    dovuto avvisare non viene valutata.
#
#   observability    il cluster e' interrogabile. Se cade si perde la capacita'
#                    di capire cosa succede, ma il servizio continua a servire:
#                    e' un guasto da segnalare, non da confondere con la
#                    liveness.
#
# I ping sui due relay partono solo sulle transizioni. Lo storico di un check e'
# limitato a 100 eventi, e un ping a ogni esecuzione lo riempirebbe di rumore
# facendo scorrere via proprio gli allarmi.
#
# Configurazione in /etc/stack-surveillance.env.
set -uo pipefail

CONF=${CONF:-/etc/stack-surveillance.env}
[ -r "$CONF" ] && . "$CONF"

HC_BASE=${HC_BASE:-https://hc-ping.com}
HC_PING_KEY=${HC_PING_KEY:-}
HEALTH_URL=${HEALTH_URL:-http://localhost/health}
ES_URL=${ES_URL:-}
ES_CA=${ES_CA:-}
STATE_DIR=${STATE_DIR:-/var/lib/stack-surveillance}
TIMEOUT=${TIMEOUT:-10}

# Soglie locali. Il disco si ferma prima del watermark di Elasticsearch, che al
# 95% impone agli indici il blocco in sola lettura e richiede un intervento
# manuale per essere rimosso.
MEM_MIN_PCT=${MEM_MIN_PCT:-15}
SWAP_MAX_PCT=${SWAP_MAX_PCT:-50}
DISK_MAX_PCT=${DISK_MAX_PCT:-85}
DISK_MOUNTS=${DISK_MOUNTS:-/ /srv/docker}

if [ -z "$HC_PING_KEY" ]; then
  echo "HC_PING_KEY non configurata in $CONF" >&2
  exit 1
fi

mkdir -p "$STATE_DIR"

# --- Recapito ---------------------------------------------------------------

# ping_check <slug> <suffisso> <corpo>
# Il suffisso e' vuoto per il successo, /fail per il guasto, /log per un evento
# che va registrato senza cambiare stato ne' notificare.
ping_check() {
  curl -fsS --max-time "$TIMEOUT" --data-raw "${3:-}" \
    "$HC_BASE/$HC_PING_KEY/$1${2}" >/dev/null 2>&1
}

# segnala <slug> <esito ok|ko> <corpo>
# Recapita solo quando l'esito cambia rispetto all'esecuzione precedente. Le
# notifiche del servizio sono legate alla transizione di stato, quindi ripetere
# lo stesso esito non produce nulla se non consumo di storico.
segnala() {
  local slug=$1 esito=$2 corpo=$3
  local marcatore="$STATE_DIR/$slug.stato"
  local precedente
  precedente=$(cat "$marcatore" 2>/dev/null || echo "")

  [ "$esito" = "$precedente" ] && return 0

  if [ "$esito" = "ko" ]; then
    ping_check "$slug" "/fail" "$corpo" || return 1
  else
    ping_check "$slug" "" "$corpo" || return 1
  fi
  printf '%s' "$esito" > "$marcatore"
}

# --- 1. Liveness: l'applicazione risponde e si dichiara sana ----------------

fallimenti=""
salute=$(curl -fsS --max-time "$TIMEOUT" "$HEALTH_URL" 2>/dev/null)
if [ -z "$salute" ]; then
  fallimenti="$fallimenti applicazione-irraggiungibile"
else
  # L'endpoint riporta lo stato delle dipendenze: un "false" qualsiasi indica
  # che il servizio risponde ma non e' in grado di servire.
  echo "$salute" | grep -q 'false' && fallimenti="$fallimenti dipendenza-degradata"
fi

# --- 2. Risorse dell'host ---------------------------------------------------

pressione=""

if [ -r /proc/meminfo ]; then
  mem_tot=$(awk '/^MemTotal:/ {print $2}' /proc/meminfo)
  mem_disp=$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)
  if [ -n "$mem_tot" ] && [ -n "$mem_disp" ] && [ "$mem_tot" -gt 0 ]; then
    mem_pct=$(( mem_disp * 100 / mem_tot ))
    [ "$mem_pct" -lt "$MEM_MIN_PCT" ] && \
      pressione="$pressione memoria-disponibile-${mem_pct}%"
  fi

  swap_tot=$(awk '/^SwapTotal:/ {print $2}' /proc/meminfo)
  swap_lib=$(awk '/^SwapFree:/ {print $2}' /proc/meminfo)
  if [ -n "$swap_tot" ] && [ "$swap_tot" -gt 0 ]; then
    swap_pct=$(( (swap_tot - swap_lib) * 100 / swap_tot ))
    [ "$swap_pct" -gt "$SWAP_MAX_PCT" ] && \
      pressione="$pressione swap-in-uso-${swap_pct}%"
  fi
fi

# Il contatore delle terminazioni per esaurimento di memoria e' cumulativo dal
# boot: conta la variazione, non il valore. Una terminazione va segnalata anche
# se al momento del controllo la memoria e' gia' tornata disponibile, perche'
# e' la traccia di un guasto che si e' consumato fra due esecuzioni.
if [ -r /proc/vmstat ]; then
  oom_ora=$(awk '/^oom_kill / {print $2}' /proc/vmstat)
  oom_prima=$(cat "$STATE_DIR/oom_kill" 2>/dev/null || echo "$oom_ora")
  if [ -n "$oom_ora" ]; then
    if [ "$oom_ora" -gt "${oom_prima:-0}" ]; then
      pressione="$pressione terminazioni-per-memoria-$(( oom_ora - oom_prima ))"
    fi
    printf '%s' "$oom_ora" > "$STATE_DIR/oom_kill"
  fi
fi

for punto in $DISK_MOUNTS; do
  [ -d "$punto" ] || continue
  uso=$(df --output=pcent "$punto" 2>/dev/null | tail -1 | tr -dc '0-9')
  [ -n "$uso" ] || continue
  [ "$uso" -gt "$DISK_MAX_PCT" ] && pressione="$pressione disco-${punto}-${uso}%"
done

if [ -n "$pressione" ]; then
  segnala host-resources ko "pressione sulle risorse:$pressione"
else
  segnala host-resources ok "risorse rientrate nelle soglie"
fi

# --- 3. Osservabilita': il cluster e' interrogabile -------------------------

if [ -n "$ES_URL" ]; then
  ca_opt=""
  [ -n "$ES_CA" ] && ca_opt="--cacert $ES_CA"
  stato=$(curl -fsS --max-time "$TIMEOUT" $ca_opt \
    -u "${ES_USER:-}:${ES_PASSWORD:-}" \
    "$ES_URL/_cluster/health" 2>/dev/null \
    | grep -o '"status":"[a-z]*"' | cut -d'"' -f4)
  case "$stato" in
    green|yellow) segnala observability ok "cluster $stato" ;;
    "")           segnala observability ko "cluster irraggiungibile" ;;
    *)            segnala observability ko "cluster in stato $stato" ;;
  esac
fi

# --- 4. Esito del battito ---------------------------------------------------

if [ -n "$fallimenti" ]; then
  # Il corpo viene conservato dal servizio e compare nella notifica: e' il primo
  # indizio disponibile senza accedere alla macchina.
  ping_check stack-liveness "/fail" "controlli falliti:$fallimenti"
  echo "controlli falliti:$fallimenti" >&2
  exit 1
fi

ping_check stack-liveness "" ""
exit 0
