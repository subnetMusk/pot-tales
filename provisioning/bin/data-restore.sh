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

STACK_NAME=${STACK_NAME:-pi}
MONGO_CONTAINER=${MONGO_CONTAINER:-${STACK_NAME}_db}
MONGO_VOLUME=${MONGO_VOLUME:-${STACK_NAME}_mongodata}
MONGO_DB=${MONGO_DB:-game_db}
MONGO_USER=${MONGO_USER:-root}
MONGO_PASSWORD_FILE=${MONGO_PASSWORD_FILE:-/run/secrets/mongo_root_password}
MONGO_IMAGE=${MONGO_IMAGE:-mongo:8.2.12@sha256:e0ce8c35124d4a9f9785532d1f268f39e9728ffa1cb38f46fa482436424c4bd3}
BACKEND_SERVICE=${BACKEND_SERVICE:-${STACK_NAME}_server}
BACKEND_WAIT=${BACKEND_WAIT:-180}

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

# In produzione il ripristino non deve correre mentre il backend continua a
# scrivere nello stesso database. Se il servizio Swarm esiste viene fermato e
# riportato al numero di repliche precedente soltanto dopo un esito positivo.
repliche_backend=""
ferma_backend() {
  docker service inspect "$BACKEND_SERVICE" >/dev/null 2>&1 || return 0
  repliche_backend=$(docker service inspect "$BACKEND_SERVICE" \
    --format '{{.Spec.Mode.Replicated.Replicas}}')
  case "$repliche_backend" in
    ''|*[!0-9]*) echo "repliche di $BACKEND_SERVICE non determinabili" >&2; exit 1 ;;
  esac
  echo "arresto temporaneo di $BACKEND_SERVICE ($repliche_backend repliche)"
  docker service scale "$BACKEND_SERVICE=0" >/dev/null || exit 1
  deadline=$(( $(date +%s) + BACKEND_WAIT ))
  while [ "$(docker service ls --filter "name=$BACKEND_SERVICE" --format '{{.Replicas}}')" != "0/0" ]; do
    [ "$(date +%s)" -lt "$deadline" ] || {
      echo "$BACKEND_SERVICE non si e' arrestato entro ${BACKEND_WAIT}s" >&2
      exit 1
    }
    sleep 2
  done
}

riavvia_backend() {
  [ -n "$repliche_backend" ] || return 0
  echo "ripristino di $BACKEND_SERVICE a $repliche_backend repliche"
  docker service scale "$BACKEND_SERVICE=$repliche_backend" >/dev/null || return 1
  deadline=$(( $(date +%s) + BACKEND_WAIT ))
  attese="$repliche_backend/$repliche_backend"
  while [ "$(docker service ls --filter "name=$BACKEND_SERVICE" --format '{{.Replicas}}')" != "$attese" ]; do
    [ "$(date +%s)" -lt "$deadline" ] || {
      echo "$BACKEND_SERVICE non e' tornato a $attese entro ${BACKEND_WAIT}s" >&2
      return 1
    }
    sleep 2
  done
}

arresta_backend_sicurezza() {
  [ -n "$repliche_backend" ] || return 0
  docker service scale "$BACKEND_SERVICE=0" >/dev/null 2>&1 || {
    echo "ATTENZIONE: impossibile riportare $BACKEND_SERVICE a zero repliche" >&2
    return 1
  }
  echo "$BACKEND_SERVICE fermato: il database non ha superato la verifica" >&2
}

verifica_indici_ttl() {
  [ -n "$repliche_backend" ] || return 0
  [ "$repliche_backend" -gt 0 ] || return 0

  contenitore=$(contenitore_mongo)
  [ -n "$contenitore" ] || {
    echo "MongoDB non disponibile dopo il riavvio di $BACKEND_SERVICE" >&2
    return 1
  }

  ttl=$(docker exec \
    -e ARCH_DB="$MONGO_DB" \
    -e ARCH_USER="$MONGO_USER" \
    -e ARCH_PF="$MONGO_PASSWORD_FILE" \
    "$contenitore" sh -c "
      set -e
      $PREAMBOLO_AUTH
      # shellcheck disable=SC2086
      exec mongosh --quiet \$auth --eval \
        \"d=db.getSiblingDB('\$ARCH_DB'); print(['sessions','game_states'].map(c => d[c].getIndexes().filter(i => i.expireAfterSeconds !== undefined && i.key.created_at === 1).length).join(' '))\"
    ") || return 1

  ttl=$(printf '%s' "$ttl" | tr -d '\r\n')
  [ "$ttl" = "1 1" ] || {
    echo "indici TTL non ripristinati su sessions e game_states (conteggi: ${ttl:-assenti})" >&2
    return 1
  }
  echo "indici TTL verificati su sessions e game_states"
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
    ferma_backend

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
  # rapida. Il backend viene fermato prima della modifica e riavviato dopo,
  # perche' ricrei gli indici, TTL compreso. Senza indice di ritenzione i
  # documenti non scadrebbero piu' e nulla lo segnalerebbe.

  ricreazione)
    contenitore=$(contenitore_mongo)
    [ -n "$contenitore" ] || { echo "nessun contenitore in esecuzione corrisponde a $MONGO_CONTAINER" >&2; exit 1; }

    conferma "Svuotare $MONGO_DB? I dati non messi in sicurezza vengono persi."
    ferma_backend

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

if [ "$MODO" = "ripristino" ] || [ "$MODO" = "ricreazione" ]; then
  if [ "$uscita" -eq 0 ]; then
    if ! riavvia_backend || ! verifica_indici_ttl; then
      arresta_backend_sicurezza || true
      echo "dati modificati ma ritorno in servizio non completato o non verificato" >&2
      uscita=1
    fi
  elif [ -n "$repliche_backend" ]; then
    echo "$BACKEND_SERVICE resta fermo: il recupero e' fallito e il database puo' essere parziale" >&2
  fi
fi

durata=$(( $(ora_ms) - inizio ))

echo
printf 'strada: %s\ndurata: %d ms\nesito:  %d\n' "$MODO" "$durata" "$uscita"
[ "${byte:-}" ] && printf 'volume: %s byte\n' "$byte"

if [ "$MODO" = "ricreazione" ] && [ "$uscita" -eq 0 ] && [ -z "$repliche_backend" ]; then
  echo
  echo "Nessun servizio Swarm trovato. Riavviare il backend perche' ricrei gli indici, incluso quello di ritenzione:"
  echo "  docker service update --force ${STACK_NAME:-pi}_server"
fi

exit "$uscita"
