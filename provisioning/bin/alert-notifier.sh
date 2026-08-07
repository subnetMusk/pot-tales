#!/usr/bin/env bash
# Inoltra gli allarmi scritti dalle regole Kibana verso il servizio di
# sorveglianza esterno, che li recapita sui canali configurati.
#
# Con licenza basic i soli connettori disponibili in Kibana sono `.index` e
# `.server-log`: la consegna verso l'esterno non e' realizzabile dalle regole,
# che quindi scrivono su un indice. Questo processo legge l'indice e recapita.
#
# Ogni documento dichiara a quale check appartiene. La destinazione non e' unica
# perche' le notifiche del servizio sono legate alla transizione di stato: su un
# check solo, un allarme che arriva mentre il check e' gia' in guasto non
# produrrebbe alcuna notifica. Un check per classe di guasto fa transitare ogni
# classe per conto suo.
#
# Il livello di gravita' sceglie l'endpoint:
#   info               /log, registra senza cambiare stato ne' notificare. E' il
#                      livello dei fatti che vanno conservati ma non svegliano
#                      nessuno, come i tentativi di intrusione sotto soglia: su
#                      un indirizzo pubblico sono rumore continuo, e notificarli
#                      tutti rende la notifica inutile nel giro di un'ora.
#   warning, critical  /fail, porta il check in guasto e notifica.
#   rientro            ping di successo, che riarma il relay per l'allarme
#                      successivo.
#
# Gira sulla macchina osservata, e va bene: recapita allarmi di degrado, che per
# definizione presuppongono una macchina viva. La condizione "macchina che non
# risponde" e' coperta dal battito.
#
# Configurazione in /etc/stack-surveillance.env.
set -uo pipefail

CONF=${CONF:-/etc/stack-surveillance.env}
# Il percorso e' parametrico di proposito, quindi l'analizzatore non puo'
# seguirlo: la direttiva glielo dichiara invece di lasciarlo protestare.
# shellcheck source=/dev/null
[ -r "$CONF" ] && . "$CONF"

HC_BASE=${HC_BASE:-https://hc-ping.com}
HC_PING_KEY=${HC_PING_KEY:-}
ES_URL=${ES_URL:-https://localhost:9200}
ES_CA=${ES_CA:-}
ALERT_INDEX=${ALERT_INDEX:-alerts-infra}
STATE_DIR=${STATE_DIR:-/var/lib/stack-surveillance}
STATE_FILE=${STATE_FILE:-$STATE_DIR/last-seen}
TIMEOUT=${TIMEOUT:-15}

# Destinazione dei documenti che non dichiarano un check. Un documento
# malformato e' esso stesso un difetto della catena di osservabilita'.
DEFAULT_CHECK=${DEFAULT_CHECK:-observability}

if [ -z "$HC_PING_KEY" ]; then
  echo "HC_PING_KEY non configurata in $CONF" >&2
  exit 1
fi

mkdir -p "$(dirname "$STATE_FILE")"
# Al primo avvio si parte dal momento corrente: senza marcatore, un indice gia'
# popolato produrrebbe una raffica di notifiche su eventi passati e conclusi.
DA=$(cat "$STATE_FILE" 2>/dev/null || date -u +%Y-%m-%dT%H:%M:%SZ)

ca_opt=""
[ -n "$ES_CA" ] && ca_opt="--cacert $ES_CA"

risposta=$(curl -fsS --max-time "$TIMEOUT" $ca_opt \
  -u "${ES_USER:-}:${ES_PASSWORD:-}" \
  -H 'Content-Type: application/json' \
  "$ES_URL/$ALERT_INDEX/_search" \
  -d "{
        \"size\": 20,
        \"sort\": [{\"@timestamp\": \"asc\"}],
        \"query\": {\"range\": {\"@timestamp\": {\"gt\": \"$DA\"}}}
      }" 2>/dev/null)

if [ -z "$risposta" ]; then
  # L'indice puo' non esistere finche' nessuna regola ha prodotto un allarme.
  exit 0
fi

# Il corpo viene conservato dal servizio e compare nella notifica: e' il
# contenuto dell'allarme, non un semplice segnale.
recapita() {
  curl -fsS --max-time "$TIMEOUT" --data-raw "$3" \
    "$HC_BASE/$HC_PING_KEY/$1${2}" >/dev/null 2>&1
}

# Separatore non stampabile invece del tabulatore: `read` accorpa i delimitatori
# consecutivi quando appartengono agli spazi bianchi, e un campo vuoto farebbe
# slittare tutti quelli successivi.
ultimo=""
while IFS=$'\x1f' read -r ts severita regola messaggio check stato; do
  [ -z "$ts" ] && continue
  [ -z "$check" ] && check=$DEFAULT_CHECK

  case "$stato:$severita" in
    recovered:*)  suffisso="";      etichetta="RIENTRO" ;;
    *:info)       suffisso="/log";  etichetta="INFO" ;;
    *)            suffisso="/fail"; etichetta=${severita^^} ;;
  esac

  if ! recapita "$check" "$suffisso" "[$etichetta] $regola
$messaggio
$ts"; then
    # Interrompere invece di proseguire: il marcatore e' un istante singolo e
    # non puo' rappresentare un recapito parziale. Fermarsi al primo errore
    # mantiene gli allarmi successivi dietro di esso, in ordine.
    echo "recapito fallito su $ts ($check), ritento al ciclo successivo" >&2
    break
  fi
  ultimo="$ts"
done < <(printf '%s' "$risposta" | python3 -c "
import sys, json
# Terminatore esplicito: in modalita' testo lo stdout tradurrebbe il fine riga
# secondo la piattaforma, e il carattere in piu' finirebbe nell'ultimo campo.
sys.stdout.reconfigure(newline='\n')
for h in json.load(sys.stdin).get('hits', {}).get('hits', []):
    s = h.get('_source', {})
    print('\x1f'.join([
        str(s.get('@timestamp', '')),
        str(s.get('severity', 'info')),
        str(s.get('rule', 'sconosciuta')),
        str(s.get('message', '')).replace('\n', ' '),
        str(s.get('check', '')),
        str(s.get('status', 'alert')),
    ]))
" 2>/dev/null)

# Il marcatore avanza solo sugli allarmi effettivamente recapitati: se il
# recapito fallisce, al giro successivo vengono ritentati invece di perdersi.
[ -n "$ultimo" ] && printf '%s' "$ultimo" > "$STATE_FILE"
exit 0
