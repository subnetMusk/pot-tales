#!/usr/bin/env bash
#
# Esporta i saved object di uno Space Kibana in NDJSON, dentro la directory che
# Terraform legge per reimportarli.
#
# L'export dell'API e' scritto senza riscritture. Ogni oggetto porta
# `coreMigrationVersion` e `typeMigrationVersion`: Kibana li usa in importazione
# per decidere quali migrazioni applicare, e uno strumento che riformatta il
# JSON senza conservarli produce un file che si importa senza errori e lascia
# oggetti che non si aprono. Lo script verifica che siano presenti prima di
# accettare il risultato.
#
# Accanto a ogni export viene scritto un file `.versione` con la versione di
# Kibana che l'ha prodotto, letta dall'istanza stessa e non passata a mano.
# Terraform la confronta con `kibana_version` prima di importare.
#
# Uso:
#   KIBANA_PASSWORD=... ./export.sh esercizio servizio-funnel esercizio-servizio-funnel
#   KIBANA_PASSWORD=... ./export.sh evento andamento evento-andamento
#
# Variabili riconosciute:
#   KIBANA_URL       radice di Kibana, comprensiva del sottopercorso su cui e'
#                    esposta (default http://localhost:5601/osservabilita)
#   KIBANA_USERNAME  utente con privilegi di lettura sui saved object dello
#                    Space (default elastic)
#   KIBANA_PASSWORD  password del suddetto, obbligatoria

set -euo pipefail

CARTELLA="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

KIBANA_URL=${KIBANA_URL:-http://localhost:5601/osservabilita}
KIBANA_USERNAME=${KIBANA_USERNAME:-elastic}
KIBANA_PASSWORD=${KIBANA_PASSWORD:-}

errore() {
	echo "errore: $*" >&2
	exit 1
}

[ $# -eq 3 ] || errore "uso: $(basename "$0") <spazio> <nome-export> <dashboard-id>"

SPAZIO=$1
NOME=$2
DASHBOARD_ID=$3

case "$SPAZIO" in
esercizio | evento) ;;
*) errore "spazio sconosciuto: $SPAZIO (attesi: esercizio, evento)" ;;
esac

# Il nome finisce in un percorso e in un identificativo Terraform: limitarlo
# evita sia la risalita di directory sia un indirizzo di risorsa che cambia
# forma a seconda di come e' stato scritto.
case "$NOME" in
*[!a-zA-Z0-9_-]*) errore "il nome puo' contenere solo lettere, cifre, trattino e trattino basso" ;;
esac
case "$DASHBOARD_ID" in
*[!a-zA-Z0-9_-]*) errore "l'id dashboard puo' contenere solo lettere, cifre, trattino e trattino basso" ;;
esac

[ -n "$KIBANA_PASSWORD" ] || errore "KIBANA_PASSWORD non impostata"

DESTINAZIONE="$CARTELLA/$SPAZIO"
[ -d "$DESTINAZIONE" ] || errore "directory inesistente: $DESTINAZIONE"

FILE="$DESTINAZIONE/$NOME.ndjson"
FILE_VERSIONE="$FILE.versione"

# Le credenziali passano da file di configurazione e non dalla riga di comando:
# gli argomenti di un processo sono leggibili da chiunque sulla macchina.
CONFIG_CURL=$(mktemp)
TEMPORANEO=$(mktemp)
FILTRATO=$(mktemp)
STATO=$(mktemp)
trap 'rm -f "$CONFIG_CURL" "$TEMPORANEO" "$FILTRATO" "$STATO"' EXIT

printf 'user = "%s:%s"\n' "$KIBANA_USERNAME" "$KIBANA_PASSWORD" >"$CONFIG_CURL"

# ---------- Versione dell'istanza ----------

curl --silent --show-error --fail --config "$CONFIG_CURL" \
	"$KIBANA_URL/api/status" >"$STATO" ||
	errore "Kibana non raggiungibile, o credenziali rifiutate, su $KIBANA_URL"

VERSIONE=$(sed -n 's/.*"number"[[:space:]]*:[[:space:]]*"\([0-9][0-9.]*\)".*/\1/p' "$STATO" | head -1)
[ -n "$VERSIONE" ] || errore "versione di Kibana non ricavabile da $KIBANA_URL/api/status"

# ---------- Export ----------

echo "export dello Space '$SPAZIO' da Kibana $VERSIONE"

# `excludeExportDetails` toglie la riga di riepilogo finale, che non e' un
# saved object e cambia a ogni esecuzione: senza, ogni export risulterebbe
# diverso dal precedente anche a dashboard immutate.
CORPO=$(printf '{"objects":[{"type":"dashboard","id":"%s"}],"includeReferencesDeep":true,"excludeExportDetails":true}' \
	"$DASHBOARD_ID")

curl --silent --show-error --fail --config "$CONFIG_CURL" \
	-X POST "$KIBANA_URL/s/$SPAZIO/api/saved_objects/_export" \
	-H 'Content-Type: application/json' \
	-H 'kbn-xsrf: true' \
	-d "$CORPO" >"$TEMPORANEO" ||
	errore "esportazione fallita per lo Space '$SPAZIO'"

[ -s "$TEMPORANEO" ] || errore "esportazione vuota: nessun saved object nello Space '$SPAZIO'"

# Le dipendenze profonde includono la data view. Quella e' gia' dichiarata da
# Terraform e reimportarla dal file la renderebbe proprieta' di due risorse.
# Si eliminano soltanto le righe il cui tipo top-level e' `index-pattern`,
# copiando tutte le altre byte per byte: nessun JSON viene riformattato.
while IFS= read -r riga || [ -n "$riga" ]; do
	tipo=$(printf '%s\n' "$riga" |
		sed -n 's/.*,"type":"\([^"]*\)","typeMigrationVersion":"[^"]*".*/\1/p')
	[ -n "$tipo" ] || errore "tipo top-level non riconoscibile nell'export"
	[ "$tipo" = "index-pattern" ] || printf '%s\n' "$riga" >>"$FILTRATO"
done <"$TEMPORANEO"

[ -s "$FILTRATO" ] || errore "export privo di dashboard e dipendenze dopo la rimozione della data view"
mv "$FILTRATO" "$TEMPORANEO"

# ---------- Verifiche sul risultato ----------

OGGETTI=$(grep -c '^{' "$TEMPORANEO" || true)
[ "$OGGETTI" -gt 0 ] || errore "nessun oggetto nell'export: risposta inattesa da Kibana"
grep -q '"type":"dashboard"' "$TEMPORANEO" ||
	errore "la dashboard '$DASHBOARD_ID' non compare nell'export"
if grep -q '"type":"index-pattern","typeMigrationVersion"' "$TEMPORANEO"; then
	errore "una data view e' rimasta nell'export"
fi

# Ogni riga deve portare entrambi i campi di migrazione. Se mancano, il file non
# viene salvato: e' preferibile un export assente a un export che si importa in
# silenzio e lascia oggetti illeggibili.
MANCANTI=$(grep -c -v 'coreMigrationVersion' "$TEMPORANEO" || true)
[ "$MANCANTI" -eq 0 ] ||
	errore "$MANCANTI oggetti senza coreMigrationVersion: export non conservabile"

MANCANTI=$(grep -c -v 'typeMigrationVersion' "$TEMPORANEO" || true)
[ "$MANCANTI" -eq 0 ] ||
	errore "$MANCANTI oggetti senza typeMigrationVersion: export non conservabile"

mv "$TEMPORANEO" "$FILE"
printf '%s\n' "$VERSIONE" >"$FILE_VERSIONE"

echo "scritto  $FILE ($OGGETTI oggetti)"
echo "scritto  $FILE_VERSIONE ($VERSIONE)"
echo
echo "Versionare entrambi i file. Il successivo 'terraform apply' li reimporta."
