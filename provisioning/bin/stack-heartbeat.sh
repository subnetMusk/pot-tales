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
#   tls-pubblico     il certificato servito sul nome pubblico e' verificabile e
#                    non prossimo alla scadenza. Il controllo di liveness
#                    attraversa il proxy ma non verifica il certificato: se
#                    l'emissione automatica non riesce, il proxy serve un
#                    certificato non attendibile e l'applicazione continua a
#                    rispondere. Senza questo controllo ogni check resterebbe
#                    verde mentre il pubblico trova un avviso, che con HSTS
#                    dichiarato non e' aggirabile.
#
# I ping sui due relay partono solo sulle transizioni. Lo storico di un check e'
# limitato a 100 eventi, e un ping a ogni esecuzione lo riempirebbe di rumore
# facendo scorrere via proprio gli allarmi.
#
# Configurazione in /etc/stack-surveillance.env; il nome pubblico si legge da
# /etc/stack-deploy.env.
set -uo pipefail

CONF=${CONF:-/etc/stack-surveillance.env}
# Il percorso e' parametrico di proposito, quindi l'analizzatore non puo'
# seguirlo: la direttiva glielo dichiara invece di lasciarlo protestare.
# shellcheck source=/dev/null
[ -r "$CONF" ] && . "$CONF"

# Il nome pubblico viene dalla configurazione del deploy, la stessa da cui i
# router del proxy prendono la regola `Host`: una copia in questo file potrebbe
# divergere, e il controllo interrogherebbe un nome che nessun router serve. Il
# file si legge in una subshell, per non importare altro che quel valore.
CONF_DEPLOY=${CONF_DEPLOY:-/etc/stack-deploy.env}
if [ -z "${APP_HOST:-}" ] && [ -r "$CONF_DEPLOY" ]; then
  # shellcheck source=/dev/null
  APP_HOST=$(. "$CONF_DEPLOY" && printf '%s' "${APP_HOST:-}")
fi
APP_HOST=${APP_HOST:-}
HEALTH_CONNECT=${HEALTH_CONNECT:-127.0.0.1}

HC_BASE=${HC_BASE:-https://hc-ping.com}
HC_PING_KEY=${HC_PING_KEY:-}
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

# Certificato pubblico. Con TLS_HOST vuoto il controllo non viene eseguito, che
# e' lo stato corretto finche' un nome pubblico non esiste.
TLS_HOST=${TLS_HOST:-}
TLS_CONNECT=${TLS_CONNECT:-127.0.0.1}
TLS_MIN_DAYS=${TLS_MIN_DAYS:-10}

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

#
# La richiesta attraversa il proxy come quella di un visitatore. Un controllo su
# `localhost` misurerebbe il proxy e non l'applicazione: l'entrypoint in chiaro
# risponde con un reindirizzamento qualunque sia lo stato del backend, i router
# servono solo il nome pubblico, e con `sniStrict` gli handshake per altri nomi
# sono rifiutati. `--resolve` tiene il nome pubblico nella SNI e nell'intestazione
# Host ma dirige la connessione a HEALTH_CONNECT, quindi il controllo non dipende
# dal DNS ne' dal ritorno verso il proprio indirizzo pubblico.
#
# Il certificato non viene verificato: qui interessa che il backend risponda, e
# con quello dell'autorita' di prova il controllo fallirebbe a servizio sano. La
# validita' del certificato ha il controllo proprio, il 4.
#
# Conta solo una risposta 200 del backend. Un reindirizzamento o una pagina di
# errore del proxy hanno un corpo non vuoto, e non dicono nulla sull'applicazione.

fallimenti=""
if [ -z "$APP_HOST" ]; then
  fallimenti="$fallimenti nome-pubblico-non-configurato"
else
  risposta=$(curl -sS --insecure --max-time "$TIMEOUT" \
    --resolve "$APP_HOST:443:$HEALTH_CONNECT" \
    -w '\n%{http_code}' "https://$APP_HOST/health" 2>/dev/null)
  codice=${risposta##*$'\n'}
  salute=${risposta%$'\n'*}
  if [ "$codice" != "200" ]; then
    fallimenti="$fallimenti applicazione-irraggiungibile-http-${codice:-000}"
  elif ! echo "$salute" | grep -q '"server":true'; then
    # Il backend dichiara sempre se stesso: una risposta 200 senza quel campo
    # arriva da qualcos'altro.
    fallimenti="$fallimenti risposta-non-riconosciuta"
  else
    # L'endpoint riporta lo stato delle dipendenze: un "false" qualsiasi indica
    # che il servizio risponde ma non e' in grado di servire.
    echo "$salute" | grep -q 'false' && fallimenti="$fallimenti dipendenza-degradata"
  fi
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

# Elasticsearch non pubblica porte sull'host: il proxy e' l'unico servizio che
# lo fa, ed e' una proprieta' del disegno, non una dimenticanza. Interrogarlo su
# `localhost:9200` non funziona quindi sullo stack in servizio.
#
# Con ES_NETWORK valorizzata la richiesta parte da un contenitore collegato alla
# rete di osservabilita', che e' dichiarata `attachable` proprio perche' un
# processo esterno allo stack possa raggiungerla. Lasciandola vuota si usa curl
# dell'host, che resta la strada valida in sviluppo con Compose.
ES_NETWORK=${ES_NETWORK:-}
ES_CURL_IMAGE=${ES_CURL_IMAGE:-curlimages/curl:8.11.1@sha256:c1fe1679c34d9784c1b0d1e5f62ac0a79fca01fb6377cdd33e90473c6f9f9a69}

es_curl() {
  if [ -z "$ES_NETWORK" ]; then
    curl "$@"
    return
  fi
  local montaggi=()
  # Il CA vive sul filesystem dell'host. Si monta la directory che lo contiene,
  # non il singolo file, e allo stesso percorso: cosi' l'argomento --cacert
  # resta identico nei due casi, e una rotazione che sostituisce il file non
  # lascia il montaggio agganciato all'inode precedente.
  [ -n "${ES_CA:-}" ] && montaggi=(-v "$(dirname "$ES_CA"):$(dirname "$ES_CA"):ro")
  # `--user 0`: `setup-certs.sh` lascia il CA a 640 root:root e la sua directory
  # a 750, mentre l'immagine curl gira come utente non privilegiato e non
  # potrebbe leggerlo. Il contenitore vive il tempo di una richiesta, sulla
  # stessa macchina e con lo stesso file che lo script gia' potrebbe aprire da
  # se': non concede nulla che il chiamante non abbia gia'.
  docker run --rm --user 0:0 --network "$ES_NETWORK" "${montaggi[@]}"     "$ES_CURL_IMAGE" "$@"
}

# --- 3. Osservabilita': il cluster e' interrogabile -------------------------

if [ -n "$ES_URL" ]; then
  ca_opt=""
  [ -n "$ES_CA" ] && ca_opt="--cacert $ES_CA"
  stato=$(es_curl -fsS --max-time "$TIMEOUT" $ca_opt \
    -u "${ES_USER:-}:${ES_PASSWORD:-}" \
    "$ES_URL/_cluster/health" 2>/dev/null \
    | grep -o '"status":"[a-z]*"' | cut -d'"' -f4)
  case "$stato" in
    green|yellow) segnala observability ok "cluster $stato" ;;
    "")           segnala observability ko "cluster irraggiungibile" ;;
    *)            segnala observability ko "cluster in stato $stato" ;;
  esac
fi

# --- 4. Certificato servito sul nome pubblico -------------------------------
#
# `--resolve` tiene il nome pubblico nella SNI e nella verifica, ma dirige la
# connessione all'indirizzo indicato. Serve a due cose: sulla macchina stessa il
# nome puo' risolvere altrove, e il ritorno dall'esterno verso il proprio
# indirizzo pubblico non e' garantito da tutte le reti. Cosi' si verifica
# esattamente il certificato che il proxy presenta per quel nome.
#
# Non si usa `-f`: qui interessa che la sessione TLS si stabilisca, non quale
# stato HTTP torni. Lo stato dell'applicazione e' il controllo 1, e confondere i
# due farebbe segnalare un certificato rotto quando la rotta risponde 404.
#
# E' un relay e non un fallimento del battito: con un certificato non valido il
# servizio sta comunque servendo, e sommarlo alla liveness renderebbe ambiguo il
# silenzio del battito, che e' l'unico segnale su cui si distingue una macchina
# morta.

if [ -n "$TLS_HOST" ]; then
  tls_problema=""

  if ! curl -sS -o /dev/null --max-time "$TIMEOUT" \
       --resolve "$TLS_HOST:443:$TLS_CONNECT" \
       "https://$TLS_HOST/" 2>/dev/null; then
    tls_problema="catena-non-verificabile"
  else
    # La scadenza si legge separatamente: una catena valida oggi ma prossima
    # alla scadenza va segnalata prima che diventi un guasto, perche' rimediare
    # richiede un'emissione che a sua volta puo' fallire.
    fine=$(echo | openssl s_client -connect "$TLS_CONNECT:443" \
             -servername "$TLS_HOST" 2>/dev/null \
           | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
    if [ -n "$fine" ]; then
      scade=$(date -d "$fine" +%s 2>/dev/null)
      adesso=$(date +%s)
      if [ -n "$scade" ]; then
        giorni=$(( (scade - adesso) / 86400 ))
        [ "$giorni" -lt "$TLS_MIN_DAYS" ] && \
          tls_problema="scadenza-fra-${giorni}-giorni"
      fi
    fi
  fi

  if [ -n "$tls_problema" ]; then
    segnala tls-pubblico ko "certificato su $TLS_HOST: $tls_problema"
  else
    segnala tls-pubblico ok "certificato su $TLS_HOST valido"
  fi
fi

# --- 5. Esito del battito ---------------------------------------------------

if [ -n "$fallimenti" ]; then
  # Il corpo viene conservato dal servizio e compare nella notifica: e' il primo
  # indizio disponibile senza accedere alla macchina.
  ping_check stack-liveness "/fail" "controlli falliti:$fallimenti"
  echo "controlli falliti:$fallimenti" >&2
  exit 1
fi

ping_check stack-liveness "" ""
exit 0
