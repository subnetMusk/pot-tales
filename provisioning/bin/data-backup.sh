#!/usr/bin/env bash
# Copia di sicurezza dei dati applicativi: snapshot LVM e archivio portabile.
#
# Due meccanismi con ruoli distinti.
#
#   Snapshot LVM     meccanismo primario. Cattura in un istante l'intero volume
#                    che ospita i dati Docker, quindi MongoDB e gli altri
#                    volumi con nome, senza fermare le scritture. Gli indici di
#                    Elasticsearch stanno su un volume proprio e non sono
#                    compresi: cio' che deve sopravvivere passa
#                    dall'esportazione.
#
#   mongodump        formato portabile, destinato al prelievo manuale a evento
#                    concluso. Si rilegge su un'altra macchina e su un'altra
#                    installazione, cosa che uno snapshot non consente.
#
# Sulla consistenza dello snapshot: con il journaling attivo e file dati e
# journal sullo stesso volume, uno snapshot a livello di volume cattura dati e
# journal come unita' singola, e al ripristino MongoDB rigioca il journal. La
# configurazione e' quella descritta in provisioning/README.md, quindi
# **fsyncLock non serve** e non viene eseguito: bloccherebbe le scritture per
# tutta la durata della copia, che e' esattamente cio' che si vuole evitare
# durante un'apertura al pubblico.
#
# Il motivo per cui lo snapshot e' primario e mongodump secondario: su
# un'istanza standalone mongodump non ha consistenza point-in-time fra
# collezioni, perche' --oplog richiede un replica set. Un dump preso durante le
# scritture puo' contenere una sessione senza il relativo stato di gioco.
#
# Lo snapshot resta sulla stessa macchina: copre corruzione applicativa,
# cancellazione accidentale e processo che muore lasciando il disco sano. Non
# copre la perdita della macchina: un server dedicato non ha snapshot del
# fornitore, e la copia fuori dalla macchina e' il prelievo dell'archivio
# portabile e delle esportazioni (docs/ESERCIZIO.md, chiusura di una giornata).
# Nulla qui dipende da uno spazio remoto: se in seguito se ne aggiungera' uno,
# la sincronizzazione sara' un passo in piu' dopo l'archivio, non un
# prerequisito.
#
#   ./data-backup.sh [--solo-snapshot | --solo-dump] [--check <slug>]
#
# Configurazione in /etc/stack-data.env.
set -uo pipefail

CONF=${CONF:-/etc/stack-data.env}
# shellcheck source=/dev/null
[ -r "$CONF" ] && . "$CONF"

# La chiave di ping vive con il resto della configurazione di sorveglianza. Un
# secondo file la duplicherebbe, e una rotazione che ne aggiorna uno solo
# lascerebbe un percorso muto senza che nulla lo segnali.
CONF_SORVEGLIANZA=${CONF_SORVEGLIANZA:-/etc/stack-surveillance.env}
# shellcheck source=/dev/null
[ -r "$CONF_SORVEGLIANZA" ] && . "$CONF_SORVEGLIANZA"

BIN_DIR=${BIN_DIR:-$(cd "$(dirname "$0")" && pwd)}

VG_NAME=${VG_NAME:-vg0}
LV_DOCKER=${LV_DOCKER:-docker}
# Spazio copy-on-write dello snapshot. Deve bastare a contenere le scritture
# che avvengono mentre lo snapshot esiste: uno snapshot che esaurisce lo spazio
# viene invalidato dal kernel e non e' piu' ripristinabile.
SNAP_SIZE=${SNAP_SIZE:-16G}
SNAP_KEEP=${SNAP_KEEP:-3}

BACKUP_DEST=${BACKUP_DEST:-/srv/backup}
DUMP_KEEP=${DUMP_KEEP:-7}

HC_BASE=${HC_BASE:-https://hc-ping.com}
HC_PING_KEY=${HC_PING_KEY:-}
TIMEOUT=${TIMEOUT:-10}

SOLO=tutto
CHECK=""
while [ $# -gt 0 ]; do
  case "$1" in
    --solo-snapshot) SOLO=snapshot ;;
    --solo-dump)     SOLO=dump ;;
    --check)         CHECK=${2:-}; shift ;;
    *) echo "uso: $0 [--solo-snapshot | --solo-dump] [--check <slug>]" >&2; exit 2 ;;
  esac
  shift
done

STAMP=$(date -u +%Y%m%dT%H%M%SZ)
riepilogo=""
esito=0

# --- Recapito ---------------------------------------------------------------
#
# Endpoint costruiti come <base>/<chiave>/<slug>, la stessa forma usata dal
# battito: una chiave sola raggiunge tutti i check.

ping_check() {
  [ -n "$CHECK" ] || return 0
  [ -n "$HC_PING_KEY" ] || { echo "HC_PING_KEY non configurata" >&2; return 1; }
  curl -fsS --max-time "$TIMEOUT" --data-raw "${2:-}" \
    "$HC_BASE/$HC_PING_KEY/$CHECK${1}" >/dev/null 2>&1
}

# Il segnale di inizio consente al servizio esterno di misurare la durata
# dell'esecuzione, non solo di constatare che e' avvenuta.
ping_check "/start" ""

# --- Snapshot LVM -----------------------------------------------------------

if [ "$SOLO" = "tutto" ] || [ "$SOLO" = "snapshot" ]; then
  echo "== snapshot LVM =="
  if ! command -v lvcreate >/dev/null 2>&1; then
    echo "lvcreate assente: volume non gestito da LVM" >&2
    riepilogo="$riepilogo snapshot=non-disponibile"
    esito=1
  else
    libero=$(vgs "$VG_NAME" -o vg_free --noheadings --units g --nosuffix 2>/dev/null | tr -d ' ')
    richiesto=${SNAP_SIZE%G}
    if [ -z "$libero" ]; then
      echo "volume group $VG_NAME non trovato" >&2
      riepilogo="$riepilogo snapshot=vg-assente"
      esito=1
    elif [ "${libero%%.*}" -lt "$richiesto" ]; then
      # Senza spazio non allocato lo snapshot non e' creabile, e la copia
      # primaria semplicemente non esiste. E' un guasto, non un avviso.
      echo "spazio non allocato insufficiente: ${libero}G liberi, ${richiesto}G richiesti" >&2
      riepilogo="$riepilogo snapshot=spazio-insufficiente-${libero}G"
      esito=1
    else
      nome="${LV_DOCKER}-snap-${STAMP}"
      if lvcreate --snapshot --permission r --name "$nome" \
           --size "$SNAP_SIZE" "/dev/$VG_NAME/$LV_DOCKER"; then
        echo "snapshot $nome creato"
        riepilogo="$riepilogo snapshot=$nome"
      else
        echo "creazione dello snapshot fallita" >&2
        riepilogo="$riepilogo snapshot=fallito"
        esito=1
      fi
    fi

    # Uno snapshot il cui spazio copy-on-write si riempie viene invalidato dal
    # kernel: resta elencato ma non e' piu' ripristinabile. L'occupazione va
    # quindi letta, non presunta.
    lvs --noheadings -o lv_name,data_percent --select "lv_attr=~^s" "$VG_NAME" 2>/dev/null \
      | while read -r lv occupazione; do
          intero=${occupazione%%.*}
          [ -n "$intero" ] || continue
          if [ "$intero" -ge 80 ]; then
            echo "snapshot $lv al ${occupazione}% dello spazio copy-on-write" >&2
          fi
        done

    # Ritenzione: gli snapshot piu' vecchi oltre SNAP_KEEP vengono rimossi.
    # Ognuno consuma spazio non allocato del volume group in proporzione alle
    # scritture avvenute da quando esiste.
    mapfile -t vecchi < <(lvs --noheadings -o lv_name --select "lv_attr=~^s" "$VG_NAME" 2>/dev/null \
      | tr -d ' ' | grep "^${LV_DOCKER}-snap-" | sort -r | tail -n "+$((SNAP_KEEP + 1))")
    for vecchio in "${vecchi[@]}"; do
      [ -n "$vecchio" ] || continue
      echo "rimozione dello snapshot $vecchio"
      lvremove -f "/dev/$VG_NAME/$vecchio" >/dev/null 2>&1
    done
  fi
fi

# --- Archivio portabile -----------------------------------------------------

if [ "$SOLO" = "tutto" ] || [ "$SOLO" = "dump" ]; then
  echo
  echo "== archivio portabile =="
  # Lo stesso percorso dell'esportazione, con destinazione e ritenzione
  # proprie: mongodump ha una implementazione sola, e il lock condiviso
  # impedisce che una copia notturna e un export manuale si sovrappongano.
  # Non lasciare che data-export.sh rilegga /etc/stack-data.env: quel file
  # contiene EXPORT_DEST per l'esportazione manuale e sovrascriverebbe la
  # destinazione notturna passata qui. Gli altri valori necessari a MongoDB
  # vengono inoltrati esplicitamente dopo essere stati letti sopra.
  if CONF=/dev/null \
     EXPORT_DEST="$BACKUP_DEST/mongodump" EXPORT_KEEP="$DUMP_KEEP" \
     MONGO_CONTAINER="${MONGO_CONTAINER:-pi_db}" \
     MONGO_DB="${MONGO_DB:-game_db}" \
     MONGO_USER="${MONGO_USER:-root}" \
     MONGO_PASSWORD_FILE="${MONGO_PASSWORD_FILE:-/run/secrets/mongo_root_password}" \
     "$BIN_DIR/data-export.sh" --solo-mongo; then
    riepilogo="$riepilogo dump=ok"
  else
    echo "archivio portabile non prodotto" >&2
    riepilogo="$riepilogo dump=fallito"
    esito=1
  fi
fi

# --- Esito ------------------------------------------------------------------

if [ "$esito" -eq 0 ]; then
  ping_check "" "backup $STAMP:$riepilogo"
else
  # Il corpo viene conservato dal servizio e compare nella notifica: e' il primo
  # indizio disponibile senza accedere alla macchina.
  ping_check "/fail" "backup $STAMP fallito:$riepilogo"
fi

echo
echo "backup $STAMP:$riepilogo (esito $esito)"
exit "$esito"
