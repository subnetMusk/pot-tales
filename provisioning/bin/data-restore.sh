#!/usr/bin/env bash
# Le tre strade per tornare in servizio dopo un guasto ai dati, cronometrate.
#
# Quando MongoDB si corrompe durante un'apertura al pubblico due obiettivi
# entrano in conflitto: rimettere in piedi il servizio e salvare i dati. Le
# strade sono tre, e vanno percorse in quest'ordine.
#
#   --metti-in-sicurezza   copia lo stato corrente da parte, cosi' com'e'.
#                          Opera sul volume e non sul processo, quindi
#                          funziona anche quando mongod non parte piu'. E' il
#                          primo passo sempre: una ricreazione affrettata
#                          distrugge l'unica copia rimasta.
#
#   --ripristina <file>    riporta lo stato da un archivio di mongodump.
#                          Recupera i dati fino al momento della copia; quanto
#                          e' successo dopo e' perduto.
#
#   --ricrea               svuota la base dati e riparte da zero. E' la strada
#                          piu' rapida per tornare operativi, ed e' l'ultima
#                          scelta: va percorsa solo dopo aver messo al sicuro
#                          cio' che c'e'.
#
# Ogni strada stampa il tempo impiegato. I tre tempi vanno misurati prima di
# doverli confrontare sotto pressione: e' l'unico modo di sapere se il
# ripristino da copia rientra nella finestra disponibile o se non rientra.
#
# Gli strumenti girano nel contenitore di MongoDB, quindi mongorestore ha per
# costruzione la stessa versione del server che ha prodotto l'archivio.
#
#   ./data-restore.sh --metti-in-sicurezza
#   ./data-restore.sh --ripristina /srv/backup/mongodump/<stamp>/mongo/game_db.archive.gz
#   ./data-restore.sh --ricrea
#
# FORCE=1 salta la conferma sulle operazioni distruttive.
# Configurazione in /etc/stack-data.env.
set -uo pipefail

CONF=${CONF:-/etc/stack-data.env}
# shellcheck source=/dev/null
[ -r "$CONF" ] && . "$CONF"

MONGO_CONTAINER=${MONGO_CONTAINER:-pi_db}
MONGO_VOLUME=${MONGO_VOLUME:-pi_mongodata}
MONGO_DB=${MONGO_DB:-game_db}
MONGO_USER=${MONGO_USER:-root}
MONGO_PASSWORD_FILE=${MONGO_PASSWORD_FILE:-/run/secrets/mongo_root_password}
MONGO_IMAGE=${MONGO_IMAGE:-mongo:8.2.12@sha256:e0ce8c35124d4a9f9785532d1f268f39e9728ffa1cb38f46fa482436424c4bd3}

SAFEGUARD_DEST=${SAFEGUARD_DEST:-/srv/backup/sicurezza}
FORCE=${FORCE:-0}

export MSYS_NO_PATHCONV=1

# Disattivata la conversione, i percorsi di montaggio vanno tradotti a mano:
# sulla macchina di sviluppo il demone gira in una macchina virtuale Linux e un
# percorso POSIX vi si riferirebbe invece che all'host. Su Linux cygpath non
# esiste e il percorso passa invariato.
percorso_host() {
  if command -v cygpath >/dev/null 2>&1; then cygpath -m "$1"; else printf '%s' "$1"; fi
}

MODO=""
ARCHIVIO=""
case "${1:-}" in
  --metti-in-sicurezza) MODO=sicurezza ;;
  --ripristina)         MODO=ripristino; ARCHIVIO=${2:-} ;;
  --ricrea)             MODO=ricreazione ;;
  *)
    echo "uso: $0 --metti-in-sicurezza | --ripristina <archivio> | --ricrea" >&2
    exit 2
    ;;
esac

# Risoluzione a millisecondi: le tre strade differiscono per ordini di
# grandezza, e su una base dati piccola due di esse stanno sotto il secondo.
ora_ms() { date +%s%3N; }

conferma() {
  [ "$FORCE" = "1" ] && return 0
  printf '%s [s/N] ' "$1"
  read -r risposta
  [ "$risposta" = "s" ] || { echo "annullato"; exit 1; }
}

contenitore_mongo() {
  local elenco
  elenco=$(docker ps -q --filter "name=$MONGO_CONTAINER" --filter "status=running")
  printf '%s' "${elenco%%$'\n'*}"
}

# Le credenziali si compongono dentro il contenitore leggendo il secret che vi
# e' gia' montato: non transitano dall'host ne' compaiono fra gli argomenti di
# docker.
PREAMBOLO_AUTH='
  auth=""
  if [ -n "$ARCH_USER" ] && [ -r "$ARCH_PF" ]; then
    auth="--username $ARCH_USER --password $(cat "$ARCH_PF") --authenticationDatabase admin"
  fi
'

inizio=$(ora_ms)

case "$MODO" in

  # --- 1. Messa in sicurezza dello stato corrotto ---------------------------
  #
  # Copia a livello di volume: non passa da mongod, quindi non richiede che il
  # processo sia in grado di partire. Il contenitore che esegue la copia monta
  # il volume in sola lettura, cosi' un errore qui non puo' peggiorare uno
  # stato gia' compromesso.

  sicurezza)
    STAMP=$(date -u +%Y%m%dT%H%M%SZ)
    mkdir -p "$SAFEGUARD_DEST" || { echo "destinazione non scrivibile: $SAFEGUARD_DEST" >&2; exit 1; }
    destinazione="$SAFEGUARD_DEST/mongodata-$STAMP.tar.gz"

    if ! docker volume inspect "$MONGO_VOLUME" >/dev/null 2>&1; then
      echo "volume $MONGO_VOLUME inesistente" >&2
      exit 1
    fi

    echo "copia del volume $MONGO_VOLUME in $destinazione"
    docker run --rm \
      -v "$MONGO_VOLUME:/dati:ro" \
      -v "$(percorso_host "$SAFEGUARD_DEST"):/uscita" \
      "$MONGO_IMAGE" \
      tar czf "/uscita/mongodata-$STAMP.tar.gz" -C /dati .
    uscita=$?
    byte=$(wc -c < "$destinazione" 2>/dev/null | tr -d ' ')
    ;;

  # --- 2. Ripristino da copia ----------------------------------------------
  #
  # --drop rimuove ogni collezione presente nell'archivio prima di
  # reinserirla: senza, un ripristino su una base dati non vuota fonderebbe
  # documenti vecchi e nuovi, e il risultato non corrisponderebbe a nessuno
  # dei due stati.

  ripristino)
    [ -n "$ARCHIVIO" ] || { echo "archivio non indicato" >&2; exit 2; }
    [ -r "$ARCHIVIO" ] || { echo "archivio non leggibile: $ARCHIVIO" >&2; exit 1; }

    contenitore=$(contenitore_mongo)
    [ -n "$contenitore" ] || { echo "nessun contenitore in esecuzione corrisponde a $MONGO_CONTAINER" >&2; exit 1; }

    conferma "Ripristinare $MONGO_DB da $ARCHIVIO? Le collezioni presenti nell'archivio vengono sostituite."

    # L'archivio entra dallo stdin del processo remoto: nessuna copia
    # intermedia dentro il contenitore, che potrebbe non avere lo spazio.
    docker exec -i \
      -e ARCH_DB="$MONGO_DB" \
      -e ARCH_USER="$MONGO_USER" \
      -e ARCH_PF="$MONGO_PASSWORD_FILE" \
      "$contenitore" sh -c "
        set -e
        $PREAMBOLO_AUTH
        # shellcheck disable=SC2086
        exec mongorestore --archive --gzip --drop \
             --nsInclude \"\$ARCH_DB.*\" \$auth
      " < "$ARCHIVIO"
    uscita=$?
    ;;

  # --- 3. Ricreazione a vuoto ----------------------------------------------
  #
  # Non tocca il volume: rimuove il contenuto logico, che e' l'operazione piu'
  # rapida e non richiede di fermare il servizio. Gli indici, TTL compreso,
  # vengono creati dal backend all'avvio, quindi il servizio applicativo va
  # riavviato dopo: senza indice di ritenzione i documenti non scadrebbero
  # piu' e nulla lo segnalerebbe.

  ricreazione)
    contenitore=$(contenitore_mongo)
    [ -n "$contenitore" ] || { echo "nessun contenitore in esecuzione corrisponde a $MONGO_CONTAINER" >&2; exit 1; }

    conferma "Svuotare $MONGO_DB? I dati non messi in sicurezza vengono persi."

    docker exec \
      -e ARCH_DB="$MONGO_DB" \
      -e ARCH_USER="$MONGO_USER" \
      -e ARCH_PF="$MONGO_PASSWORD_FILE" \
      "$contenitore" sh -c "
        set -e
        $PREAMBOLO_AUTH
        # shellcheck disable=SC2086
        exec mongosh --quiet \$auth --eval \"db.getSiblingDB('\$ARCH_DB').dropDatabase()\"
      "
    uscita=$?
    ;;
esac

durata=$(( $(ora_ms) - inizio ))

echo
printf 'strada: %s\ndurata: %d ms\nesito:  %d\n' "$MODO" "$durata" "$uscita"
[ "${byte:-}" ] && printf 'volume: %s byte\n' "$byte"

if [ "$MODO" = "ricreazione" ] && [ "$uscita" -eq 0 ]; then
  echo
  echo "Riavviare il backend perche' ricrei gli indici, incluso quello di ritenzione:"
  echo "  docker service update --force ${STACK_NAME:-pi}_server"
fi

exit "$uscita"
