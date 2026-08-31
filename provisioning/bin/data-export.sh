#!/usr/bin/env bash
# Produce l'esportazione integrale dei dati strutturati.
#
# Due sorgenti, due formati, per due esigenze diverse:
#
#   Elasticsearch  NDJSON compresso, uno per indice, prodotto con point-in-time
#                  e search_after. Conserva i campi annidati senza perdite e si
#                  rilegge sia da uno strumento di analisi sia reindicizzando
#                  altrove. Le mappature vengono salvate a fianco.
#
#   MongoDB        archivio nativo di mongodump, unico formato che riporta in
#                  vita lo stato di gioco con i tipi originali.
#
# CSV e Parquet non vengono prodotti: sono derivabili dall'NDJSON a posteriori,
# fuori dalla macchina, e aggiungerli qui significherebbe una dipendenza in piu'
# nella catena.
#
# L'esecuzione e' possibile in qualsiasi momento, incluse le finestre di
# apertura al pubblico, ma con freno. Scorrere l'intero dataset compete per
# cache e banda di disco con la stessa Elasticsearch che sta ricevendo la
# telemetria, quindi:
#
#   - una sola esecuzione per volta, protetta da lock;
#   - priorita' di CPU e di I/O ridotte per i processi di scorrimento;
#   - scorrimento a lotti con pausa fra l'uno e l'altro.
#
# Il freno che conta su Elasticsearch e' la cadenza delle richieste: il lavoro
# pesante lo fa il cluster, non il client, e ridurre la quota di CPU del client
# non toglierebbe carico a chi legge i segmenti.
#
# Gli strumenti girano in contenitori ancorati per digest: sull'host non serve
# nulla oltre a Docker, e le versioni di mongodump e mongorestore restano
# allineate a quella del server.
#
# L'attivazione non passa dal web. L'unita' data-export.service la avvia
# l'operatore; servire gli archivi prodotti e' compito del bordo.
#
#   ./data-export.sh [--solo-es | --solo-mongo]
#
# Configurazione in /etc/stack-data.env.
set -uo pipefail

CONF=${CONF:-/etc/stack-data.env}
# Il percorso e' parametrico di proposito, quindi l'analizzatore non puo'
# seguirlo: la direttiva glielo dichiara invece di lasciarlo protestare.
# shellcheck source=/dev/null
[ -r "$CONF" ] && . "$CONF"

EXPORT_DEST=${EXPORT_DEST:-/srv/export}
EXPORT_KEEP=${EXPORT_KEEP:-5}
LOCK_DIR=${LOCK_DIR:-/var/lock/data-export.lock}

# Ancorata per digest come le altre immagini del progetto: un tag e' mutabile,
# e uno strumento che cambia sotto i piedi produce esiti non riproducibili.
PYTHON_IMAGE=${PYTHON_IMAGE:-python:3.13-alpine@sha256:399babc8b49529dabfd9c922f2b5eea81d611e4512e3ed250d75bd2e7683f4b0}
BIN_DIR=${BIN_DIR:-$(cd "$(dirname "$0")" && pwd)}

ES_NET=${ES_NET:-pi_elastic}
ES_URL=${ES_URL:-https://es01:9200}
ES_USER=${ES_USER:-elastic}
ES_PASSWORD_FILE=${ES_PASSWORD_FILE:-}
ES_PASSWORD=${ES_PASSWORD:-}
ES_CA=${ES_CA:-}
ES_INDICI=${ES_INDICI:-logs-*,metrics-*,traces-*,alerts-*}

# Il contenitore di MongoDB si raggiunge per exec e non per rete: la rete di
# persistenza e' dichiarata internal e non attachable, quindi un contenitore
# esterno allo stack non puo' collegarvisi. L'exec usa inoltre il mongodump
# della stessa immagine del server, che e' la versione giusta per definizione.
MONGO_CONTAINER=${MONGO_CONTAINER:-pi_db}
MONGO_DB=${MONGO_DB:-game_db}
MONGO_USER=${MONGO_USER:-root}
# Percorso interno al contenitore di MongoDB: la password non transita
# dall'host e non compare fra gli argomenti di docker.
MONGO_PASSWORD_FILE=${MONGO_PASSWORD_FILE:-/run/secrets/mongo_root_password}

LOTTO=${LOTTO:-1000}
PAUSA=${PAUSA:-0.2}
CPU_QUOTA=${CPU_QUOTA:-0.5}
MEM_LIMIT=${MEM_LIMIT:-256m}

SOLO=${SOLO:-tutto}
case "${1:-}" in
  --solo-es)    SOLO=es ;;
  --solo-mongo) SOLO=mongo ;;
  "")           ;;
  *)            echo "uso: $0 [--solo-es | --solo-mongo]" >&2; exit 2 ;;
esac

# Su Windows la shell converte gli argomenti che sembrano percorsi POSIX prima
# di passarli a Docker. La variabile disattiva la conversione ed e' inerte su
# Linux, dove il problema non esiste.
export MSYS_NO_PATHCONV=1

# Disattivata la conversione, i percorsi di montaggio vanno tradotti a mano:
# sulla macchina di sviluppo il demone gira in una macchina virtuale Linux e un
# percorso POSIX vi si riferirebbe invece che all'host. Su Linux cygpath non
# esiste e il percorso passa invariato.
percorso_host() {
  if command -v cygpath >/dev/null 2>&1; then cygpath -m "$1"; else printf '%s' "$1"; fi
}

# --- Esecuzione singola -----------------------------------------------------
#
# Il lock e' una directory e non un file con flock: deve reggere per l'intera
# durata dell'esecuzione, contenitori compresi, e mkdir e' atomico su qualunque
# filesystem senza dipendere da util-linux. L'unita' systemd aggiunge la propria
# garanzia, perche' systemd rifiuta di avviare una seconda istanza di un'unita'
# gia' attiva; il lock copre le invocazioni a mano, che non passano da li'.

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  precedente=$(cat "$LOCK_DIR/pid" 2>/dev/null || echo "")
  if [ -n "$precedente" ] && kill -0 "$precedente" 2>/dev/null; then
    echo "esportazione gia' in corso (pid $precedente)" >&2
    exit 1
  fi
  # Il processo che deteneva il lock non esiste piu': il lock e' residuo di
  # una terminazione brusca e va recuperato, altrimenti nessuna esecuzione
  # successiva potrebbe piu' partire.
  echo "lock residuo di un processo terminato (pid ${precedente:-ignoto}), recuperato" >&2
  rm -rf "$LOCK_DIR"
  mkdir "$LOCK_DIR" || { echo "lock non acquisibile: $LOCK_DIR" >&2; exit 1; }
fi
printf '%s' "$$" > "$LOCK_DIR/pid"
trap 'rm -rf "$LOCK_DIR"' EXIT

# --- Destinazione -----------------------------------------------------------

STAMP=$(date -u +%Y%m%dT%H%M%SZ)
DEST="$EXPORT_DEST/$STAMP"
mkdir -p "$DEST" || {
  echo "destinazione non scrivibile: $DEST" >&2
  exit 1
}
MANIFEST="$DEST/MANIFEST.txt"

# Il manifesto descrive cio' che e' stato esportato, non cio' che lo script
# saprebbe esportare: una riga su una sorgente non toccata farebbe sembrare
# completo un archivio parziale.
{
  echo "esportazione $STAMP"
  echo "host        $(hostname)"
  if [ "$SOLO" = "tutto" ] || [ "$SOLO" = "es" ]; then
    echo "sorgente es $ES_URL ($ES_INDICI)"
    echo "lotto       $LOTTO documenti, pausa ${PAUSA}s"
  fi
  if [ "$SOLO" = "tutto" ] || [ "$SOLO" = "mongo" ]; then
    echo "sorgente db $MONGO_CONTAINER/$MONGO_DB"
  fi
  echo
} > "$MANIFEST"

esito=0
inizio_totale=$(date +%s)

# --- Elasticsearch ----------------------------------------------------------

if [ "$SOLO" = "tutto" ] || [ "$SOLO" = "es" ]; then
  echo "== Elasticsearch =="
  mkdir -p "$DEST/elastic"
  monta_ca=""
  ca_interno=""
  if [ -n "$ES_CA" ] && [ -r "$ES_CA" ]; then
    monta_ca="-v $(percorso_host "$ES_CA"):/ca/ca.crt:ro"
    ca_interno=/ca/ca.crt
  elif [ -n "$ES_CA" ]; then
    echo "certificato dell'autorita' non leggibile: $ES_CA" >&2
    esito=1
  fi

  monta_password=""
  password_interna=""
  if [ -n "$ES_PASSWORD_FILE" ] && [ -r "$ES_PASSWORD_FILE" ]; then
    monta_password="-v $(percorso_host "$ES_PASSWORD_FILE"):/run/es_password:ro"
    password_interna=/run/es_password
  fi

  inizio=$(date +%s)
  # shellcheck disable=SC2086
  # Le variabili di montaggio contengono piu' argomenti e devono restare
  # soggette alla suddivisione in parole: virgolettarle le passerebbe a Docker
  # come un argomento unico.
  docker run --rm \
    --network "$ES_NET" \
    --cpus "$CPU_QUOTA" \
    --memory "$MEM_LIMIT" \
    -v "$(percorso_host "$BIN_DIR"):/opt/export:ro" \
    -v "$(percorso_host "$DEST/elastic"):/uscita" \
    $monta_ca $monta_password \
    -e ES_URL="$ES_URL" \
    -e ES_USER="$ES_USER" \
    -e ES_PASSWORD="$ES_PASSWORD" \
    -e ES_PASSWORD_FILE="$password_interna" \
    -e ES_CA="$ca_interno" \
    -e ES_INDICI="$ES_INDICI" \
    -e DEST=/uscita \
    -e LOTTO="$LOTTO" \
    -e PAUSA="$PAUSA" \
    "$PYTHON_IMAGE" \
    nice -n 19 python3 /opt/export/es-export.py > "$DEST/elastic.tsv" 2> "$DEST/elastic.err"
  es_uscita=$?
  durata=$(( $(date +%s) - inizio ))

  cat "$DEST/elastic.tsv"
  {
    echo "== Elasticsearch (${durata}s, uscita $es_uscita) =="
    echo "indice	documenti	byte	durata"
    cat "$DEST/elastic.tsv"
    [ -s "$DEST/elastic.err" ] && { echo "--- diagnostica ---"; cat "$DEST/elastic.err"; }
    echo
  } >> "$MANIFEST"

  if [ "$es_uscita" -ne 0 ]; then
    echo "esportazione Elasticsearch incompleta: vedere $DEST/elastic.err" >&2
    cat "$DEST/elastic.err" >&2
    esito=1
  fi
fi

# --- MongoDB ----------------------------------------------------------------

if [ "$SOLO" = "tutto" ] || [ "$SOLO" = "mongo" ]; then
  echo "== MongoDB =="
  # La prima riga soltanto: un filtro per nome puo' corrispondere a piu' di un
  # contenitore, e su un servizio a replica singola il primo e' quello giusto.
  elenco=$(docker ps -q --filter "name=$MONGO_CONTAINER" --filter "status=running")
  contenitore=${elenco%%$'\n'*}

  if [ -z "$contenitore" ]; then
    echo "nessun contenitore in esecuzione corrisponde a $MONGO_CONTAINER" >&2
    echo "== MongoDB: PREMESSA FALLITA, contenitore assente ==" >> "$MANIFEST"
    esito=1
  else
    mkdir -p "$DEST/mongo"
    archivio="$DEST/mongo/$MONGO_DB.archive.gz"
    inizio=$(date +%s)
    # L'archivio esce sullo stdout del processo remoto e viene scritto qui:
    # nessuna pipe, quindi il codice di uscita e' quello di mongodump.
    #
    # Le credenziali si compongono dentro il contenitore leggendo il secret
    # che vi e' gia' montato: non transitano dall'host ne' compaiono fra gli
    # argomenti di docker. Con --numParallelCollections=1 la lettura resta
    # sequenziale, che e' la parte del freno che riguarda MongoDB.
    docker exec \
      -e ARCH_DB="$MONGO_DB" \
      -e ARCH_USER="$MONGO_USER" \
      -e ARCH_PF="$MONGO_PASSWORD_FILE" \
      "$contenitore" sh -c '
        set -e
        auth=""
        if [ -n "$ARCH_USER" ] && [ -r "$ARCH_PF" ]; then
          auth="--username $ARCH_USER --password $(cat "$ARCH_PF") --authenticationDatabase admin"
        fi
        # shellcheck disable=SC2086
        exec nice -n 19 mongodump --db "$ARCH_DB" --archive --gzip \
             --numParallelCollections=1 $auth
      ' > "$archivio" 2> "$DEST/mongo.err"
    mongo_uscita=$?
    durata=$(( $(date +%s) - inizio ))
    byte=$(wc -c < "$archivio" 2>/dev/null | tr -d ' ')

    {
      echo "== MongoDB (${durata}s, uscita $mongo_uscita) =="
      echo "archivio	$MONGO_DB.archive.gz	${byte:-0} byte"
      [ -s "$DEST/mongo.err" ] && { echo "--- diagnostica ---"; cat "$DEST/mongo.err"; }
      echo
    } >> "$MANIFEST"

    if [ "$mongo_uscita" -ne 0 ] || [ "${byte:-0}" -eq 0 ]; then
      echo "mongodump fallito: vedere $DEST/mongo.err" >&2
      cat "$DEST/mongo.err" >&2
      esito=1
    else
      echo "archivio $MONGO_DB: ${byte} byte in ${durata}s"
    fi
  fi
fi

# --- Integrita' e ritenzione ------------------------------------------------

{
  echo "durata complessiva $(( $(date +%s) - inizio_totale ))s"
  echo "esito $esito"
} >> "$MANIFEST"

# Le somme accompagnano gli archivi: dopo un trasferimento sono l'unico modo di
# distinguere una copia integra da una troncata. Vengono calcolate per ultime,
# a manifesto completo: una somma presa prima dell'ultima riga scritta
# descriverebbe un file che non esiste piu'.
( cd "$DEST" && find . -type f ! -name SHA256SUMS -print0 \
  | xargs -0 sha256sum > SHA256SUMS ) 2>/dev/null

# Ritenzione: le esportazioni piu' vecchie oltre EXPORT_KEEP vengono rimosse.
# Il disco che le ospita e' lo stesso che serve agli indici, e riempirlo
# porterebbe Elasticsearch in sola lettura.
mapfile -t vecchie < <(find "$EXPORT_DEST" -mindepth 1 -maxdepth 1 -type d \
  | sort -r | tail -n "+$((EXPORT_KEEP + 1))")
for vecchia in "${vecchie[@]}"; do
  [ -n "$vecchia" ] && rm -rf "$vecchia"
done

echo
echo "esportazione in $DEST (esito $esito)"
cat "$MANIFEST"
exit "$esito"
