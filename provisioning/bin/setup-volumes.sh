#!/usr/bin/env bash
# Crea i volumi logici per dati applicativi e diagnostica.
#
# NON si applica a un layout dei dischi definito in fase di installazione, come
# quello della macchina di esercizio (provisioning/README.md, "Layout"): li' i
# volumi esistono gia', e questo script non va eseguito. Presuppone il volume
# group `ubuntu-vg`, crea volumi con nomi e dimensioni propri e li formatta.
# Serve solo su una macchina consegnata con il volume group quasi vuoto.
#
# Presuppone un volume group con spazio non allocato. La verifica iniziale
# esiste perche' una installazione che assegna tutto lo spazio al volume di
# sistema richiede di ridurre un filesystem in uso per correggerla.
#
#   ./setup-volumes.sh [--apply]
#
# Senza --apply stampa i comandi senza eseguirli.
set -euo pipefail

VG=${VG_NAME:-ubuntu-vg}
LV_DOCKER=${LV_DOCKER:-docker}
LV_DIAG=${LV_DIAG:-diagnostics}
SIZE_DOCKER=${SIZE_DOCKER:-80G}
SIZE_DIAG=${SIZE_DIAG:-10G}
MOUNT_DOCKER=/srv/docker
MOUNT_DIAG=/srv/diagnostics

APPLY=0
[ "${1:-}" = "--apply" ] && APPLY=1

run() {
  if [ "$APPLY" = 1 ]; then
    echo "+ $*"; "$@"
  else
    echo "  $*"
  fi
}

echo "== spazio non allocato nel volume group =="
vgs "$VG" -o vg_name,vg_size,vg_free --units g

FREE=$(vgs "$VG" -o vg_free --noheadings --units g --nosuffix 2>/dev/null | tr -d ' ')
NEEDED=$(( ${SIZE_DOCKER%G} + ${SIZE_DIAG%G} ))
if [ "${FREE%%.*}" -lt "$NEEDED" ]; then
  echo "Spazio libero insufficiente: ${FREE}G disponibili, ${NEEDED}G richiesti." >&2
  echo "Ridurre il volume di sistema o rivedere le dimensioni richieste." >&2
  exit 1
fi

echo
echo "== volumi =="
run lvcreate -L "$SIZE_DOCKER" -n "$LV_DOCKER" "$VG"
run lvcreate -L "$SIZE_DIAG" -n "$LV_DIAG" "$VG"
run mkfs.ext4 -L docker "/dev/$VG/$LV_DOCKER"
run mkfs.ext4 -L diagnostics "/dev/$VG/$LV_DIAG"
run mkdir -p "$MOUNT_DOCKER" "$MOUNT_DIAG"

echo
echo "== voci di /etc/fstab da aggiungere =="
echo "/dev/$VG/$LV_DOCKER  $MOUNT_DOCKER       ext4  defaults,noatime  0  2"
echo "/dev/$VG/$LV_DIAG    $MOUNT_DIAG         ext4  defaults,noatime  0  2"

if [ "$APPLY" = 1 ]; then
  echo
  echo "Aggiungere le voci sopra a /etc/fstab, poi: mount -a"
  echo "Dopo il mount, spostare i dati Docker esistenti e riavviare il servizio:"
  echo "  systemctl stop docker"
  echo "  rsync -aHAX /var/lib/docker/ $MOUNT_DOCKER/"
  echo "  systemctl start docker"
fi
