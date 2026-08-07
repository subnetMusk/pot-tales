#!/usr/bin/env bash
# Genera i file di secret richiesti dallo stack, se non esistono gia'.
#
# Idempotente per costruzione: un file gia' presente non viene toccato. Una
# rigenerazione accidentale invaliderebbe le credenziali con cui i servizi si
# sono registrati, e il danno si manifesterebbe solo al riavvio successivo.
#
# Gli elenchi di utenze delle dashboard non sono generati qui: le credenziali
# vanno scelte e distribuite a persone, quindi si compilano a mano con
# `htpasswd -B`. Lo script si limita a segnalarne l'assenza.
set -uo pipefail

DEST=${1:-}
if [ -z "$DEST" ]; then
  echo "uso: $0 <directory dei secret>" >&2
  exit 1
fi

mkdir -p "$DEST"
chmod 0700 "$DEST"

genera() {
  local nome=$1 lunghezza=${2:-32}
  if [ -s "$DEST/$nome" ]; then
    echo "  $nome gia' presente, lasciato invariato"
    return
  fi
  # `tr -dc` scarta i byte fuori dall'alfabeto scelto: la lunghezza va quindi
  # ottenuta dopo il filtro, non prima.
  LC_ALL=C tr -dc 'A-Za-z0-9' < /dev/urandom | head -c "$lunghezza" > "$DEST/$nome"
  chmod 0400 "$DEST/$nome"
  echo "  $nome generato"
}

echo "Secret generati:"
genera elastic_password 32
genera kibana_system_password 32
# Chiave di cifratura dei saved object: Kibana ne richiede almeno 32 caratteri.
genera kibana_encryption_key 48
genera mongo_root_password 32
genera redis_password 32
genera crowdsec_bouncer_key 40

mancanti=""
for f in dashboard_users dashboard_users_esercizio dashboard_users_evento; do
  [ -s "$DEST/$f" ] || mancanti="$mancanti $f"
done

if [ -n "$mancanti" ]; then
  cat >&2 <<MSG

Elenchi di utenze da compilare a mano:$mancanti

Le credenziali che contengono valgono anche come utenze Kibana: il proxy non
rimuove l'intestazione di autorizzazione, quindi la stessa credenziale
autentica a valle e riceve il ruolo del proprio Space.

  htpasswd -cbB $DEST/dashboard_users_esercizio <utente> <password>
  htpasswd -cbB $DEST/dashboard_users_evento    <utente> <password>
  cat $DEST/dashboard_users_esercizio $DEST/dashboard_users_evento > $DEST/dashboard_users
  chmod 0400 $DEST/dashboard_users*
MSG
  exit 1
fi

echo "Tutti i secret sono presenti."
