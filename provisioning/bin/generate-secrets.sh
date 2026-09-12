#!/usr/bin/env bash
# Genera i file di secret richiesti dallo stack, se non esistono gia'.
#
# Idempotente per costruzione: un file gia' presente non viene toccato. Una
# rigenerazione accidentale invaliderebbe le credenziali con cui i servizi si
# sono registrati, e il danno si manifesterebbe solo al riavvio successivo.
#
# Le utenze delle dashboard non sono generate qui: le credenziali vanno scelte
# e distribuite a persone. Lo script dedicato segnalato in fondo crea o verifica
# insieme gli htpasswd e la fonte root-only necessaria a Terraform.
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
# Token dell'intake APM. Lo stesso valore serve a due lati che devono
# combaciare: la policy Fleet lo impone al server APM, il backend lo presenta a
# ogni invio. Generarlo qui li tiene su un'unica fonte; se divergessero, il
# backend continuerebbe a dichiarare "APM initialized" e le tracce sarebbero
# rifiutate senza che nulla lo segnali.
genera apm_secret_token 32
# Sale degli identificativi di partita, fisso per l'intero esercizio: generato
# dal backend a ogni avvio cambierebbe con ogni riavvio, e una partita a cavallo
# di un riavvio verrebbe contata due volte. Non e' una credenziale, ma chi lo
# conosce puo' ricalcolare l'identificativo di una partita dal token di
# sessione: per questo sta con i segreti.
genera gameplay_id_salt 32
# Chiave con cui il backend firma le sfide a prova di lavoro. Senza, vale il
# predefinito del codice, pubblico nel repository: chiunque potrebbe firmarsi una
# sfida a difficolta' zero e aggirare la soglia sulla creazione di sessioni.
genera pow_secret 48
# Password dell'utenza con cui Filebeat scrive, creata da Terraform al
# bootstrap: una fonte sola per i due lati, come per il token APM.
genera filebeat_writer_password 32

mancanti=""
for f in dashboard_users dashboard_users_esercizio dashboard_users_evento \
         dashboard_users.tfvars.json; do
  [ -s "$DEST/$f" ] || mancanti="$mancanti $f"
done

if [ -n "$mancanti" ]; then
  cat >&2 <<MSG

Credenziali delle dashboard da configurare:$mancanti

Le credenziali che contengono valgono anche come utenze Kibana: il proxy non
rimuove l'intestazione di autorizzazione, quindi la stessa credenziale
autentica a valle e riceve il ruolo del proprio Space.

Usare il comando dedicato: non mostra le password, crea gli htpasswd mancanti
e scrive la copia root-only usata da Terraform per creare gli stessi utenti
in Elasticsearch.

  sudo $(dirname "$0")/configure-dashboard-users.py $DEST
MSG
  exit 1
fi

echo "Tutti i secret sono presenti."
