#!/usr/bin/env bash
# Cronometra le tre strade per tornare in servizio dopo un guasto ai dati.
#
# Sotto pressione la domanda non e' quale strada sia la piu' corretta, ma quale
# rientri nel tempo disponibile. I tre tempi vanno quindi misurati prima, su
# dati veri, perche' durante un'apertura al pubblico non c'e' modo di
# scoprirli.
#
#   1. messa in sicurezza   copia dello stato corrente da parte
#   2. ripristino da copia  reinserimento da un archivio di mongodump
#   3. ricreazione a vuoto  svuotamento della base dati
#
# L'ordine della prova segue l'ordine in cui le strade vanno percorse davvero:
# prima si mette al sicuro, poi si tenta il recupero, e solo per ultimo si
# ricrea. Una ricreazione affrettata distrugge l'unica copia rimasta.
#
# La base di prova e' la stessa dell'esportazione, preparata da
# ci/export-drill.sh: una seconda copia della semina divergerebbe dalla prima
# al primo campo aggiunto.
set -uo pipefail

RADICE=$(cd "$(dirname "$0")/.." && pwd)
LAVORO=${LAVORO:-${TMPDIR:-/tmp}/sb-drill}

MONGO=sb-mongo
MONGO_DB=game_db
DOCUMENTI_MONGO=${DOCUMENTI_MONGO:-5000}

export MSYS_NO_PATHCONV=1

fallisci() { echo "PROVA FALLITA: $*" >&2; exit 1; }

conta() {
  docker exec "$MONGO" mongosh --quiet \
    -u root -p "$PASSWORD" --authenticationDatabase admin "$MONGO_DB" \
    --eval 'print(db.sessions.countDocuments({}) + db.game_states.countDocuments({}))' \
    2>/dev/null | tr -d '\r\n '
}

# Indici di ritenzione presenti su entrambe le collezioni. La loro esistenza va
# verificata prima: dopo uno svuotamento getIndexes() solleva un errore invece
# di restituire un elenco vuoto, e l'errore sarebbe indistinguibile da zero.
indici_ttl() {
  docker exec "$MONGO" mongosh --quiet \
    -u root -p "$PASSWORD" --authenticationDatabase admin "$MONGO_DB" \
    --eval 'print(["sessions", "game_states"].map(c =>
              db.getCollectionNames().includes(c)
                ? db[c].getIndexes().filter(i => i.expireAfterSeconds !== undefined).length
                : 0).reduce((a, b) => a + b, 0))' \
    2>/dev/null | tr -d '\r\n '
}

trap '"$RADICE/ci/export-drill.sh" --pulisci >/dev/null 2>&1' EXIT
"$RADICE/ci/export-drill.sh" --prepara || fallisci "preparazione della base di prova fallita"

PASSWORD=$(cat "$LAVORO/mongo_password") || fallisci "credenziale di prova non leggibile"

comune=(
  CONF=/dev/null
  MONGO_CONTAINER="$MONGO"
  MONGO_VOLUME=sb-mongodata
  MONGO_DB="$MONGO_DB"
  MONGO_USER=root
  MONGO_PASSWORD_FILE=/run/secrets/mongo_root_password
  SAFEGUARD_DEST="$LAVORO/sicurezza"
  FORCE=1
)

iniziali=$(conta)
atteso=$(( DOCUMENTI_MONGO * 2 ))
[ "$iniziali" = "$atteso" ] || fallisci "base di prova: $iniziali documenti, $atteso attesi"
echo
echo "base di prova: $iniziali documenti in $MONGO_DB"

# --- Archivio di partenza ---------------------------------------------------
#
# Il ripristino ha bisogno di una copia. Viene prodotta dallo stesso percorso
# della copia notturna: provare il ripristino su un archivio confezionato a
# mano non direbbe nulla su quello che si trovera' davvero.

echo
echo "== produzione dell'archivio di partenza =="
env "${comune[@]}" \
  EXPORT_DEST="$LAVORO/backup" EXPORT_KEEP=2 LOCK_DIR="$LAVORO/lock-backup" \
  "$RADICE/provisioning/bin/data-export.sh" --solo-mongo >/dev/null \
  || fallisci "archivio di partenza non prodotto"

ARCHIVIO=$(find "$LAVORO/backup" -name "$MONGO_DB.archive.gz" | sort -r | head -1)
[ -s "$ARCHIVIO" ] || fallisci "archivio di partenza assente"
echo "archivio: $(wc -c < "$ARCHIVIO" | tr -d ' ') byte"

# --- 1. Messa in sicurezza --------------------------------------------------
#
# Opera sul volume e non sul processo: e' la strada che regge anche quando
# mongod non parte piu', che e' proprio la condizione in cui serve.

echo
echo "== 1. messa in sicurezza dello stato corrente =="
inizio=$(date +%s%3N)
env "${comune[@]}" "$RADICE/provisioning/bin/data-restore.sh" --metti-in-sicurezza \
  || fallisci "messa in sicurezza fallita"
T_SICUREZZA=$(( $(date +%s%3N) - inizio ))

COPIA=$(find "$LAVORO/sicurezza" -name 'mongodata-*.tar.gz' | sort -r | head -1)
[ -s "$COPIA" ] || fallisci "copia di sicurezza non prodotta"
BYTE_COPIA=$(wc -c < "$COPIA" | tr -d ' ')

# La copia deve contenere i file di MongoDB, non una directory vuota: un
# archivio che si crea senza errori e non contiene nulla e' il modo peggiore
# di fallire, perche' si scopre solo quando serve.
docker run --rm -i "${MONGO_IMAGE:-mongo:8.2.12@sha256:e0ce8c35124d4a9f9785532d1f268f39e9728ffa1cb38f46fa482436424c4bd3}" \
  tar tzf - < "$COPIA" > "$LAVORO/contenuto-copia.txt" \
  || fallisci "copia di sicurezza non leggibile"
grep -q 'WiredTiger' "$LAVORO/contenuto-copia.txt" \
  || fallisci "copia di sicurezza priva dei file di MongoDB"
echo "copia verificata: $(wc -l < "$LAVORO/contenuto-copia.txt" | tr -d ' ') voci, $BYTE_COPIA byte"

# --- 2. Ripristino da copia -------------------------------------------------
#
# Lo stato viene prima corrotto per davvero: un ripristino provato su una base
# dati gia' corretta non dimostra che il ripristino funzioni.

echo
echo "== 2. ripristino da copia =="
docker exec "$MONGO" mongosh --quiet \
  -u root -p "$PASSWORD" --authenticationDatabase admin "$MONGO_DB" \
  --eval 'db.sessions.deleteMany({}); db.game_states.updateMany({}, {$set: {data: null}});' \
  >/dev/null || fallisci "corruzione simulata non applicata"
corrotti=$(conta)
echo "stato corrotto: $corrotti documenti"

inizio=$(date +%s%3N)
env "${comune[@]}" "$RADICE/provisioning/bin/data-restore.sh" --ripristina "$ARCHIVIO" \
  || fallisci "ripristino fallito"
T_RIPRISTINO=$(( $(date +%s%3N) - inizio ))

ripristinati=$(conta)
[ "$ripristinati" = "$atteso" ] \
  || fallisci "dopo il ripristino: $ripristinati documenti, $atteso attesi"

# Il conteggio da solo non basta: --drop rimuove le collezioni prima di
# reinserirle, e un ripristino che fondesse vecchio e nuovo darebbe lo stesso
# totale con i campi azzerati ancora al loro posto.
azzerati=$(docker exec "$MONGO" mongosh --quiet \
  -u root -p "$PASSWORD" --authenticationDatabase admin "$MONGO_DB" \
  --eval 'print(db.game_states.countDocuments({data: null}))' 2>/dev/null | tr -d '\r\n ')
[ "$azzerati" = "0" ] || fallisci "dopo il ripristino restano $azzerati documenti corrotti"

# L'indice di ritenzione deve tornare con i documenti. Un archivio che
# ripristina i dati senza gli indici lascerebbe le sessioni senza scadenza, e
# la differenza non si vede finche' il disco non si riempie.
ttl=$(indici_ttl)
[ "$ttl" = "2" ] || fallisci "dopo il ripristino mancano indici di ritenzione ($ttl su 2 trovati)"
echo "stato ripristinato: $ripristinati documenti, nessun residuo corrotto, due indici di ritenzione presenti"

# --- 3. Ricreazione a vuoto -------------------------------------------------

echo
echo "== 3. ricreazione a vuoto =="
inizio=$(date +%s%3N)
env "${comune[@]}" "$RADICE/provisioning/bin/data-restore.sh" --ricrea \
  || fallisci "ricreazione fallita"
T_RICREAZIONE=$(( $(date +%s%3N) - inizio ))

residui=$(conta)
[ "$residui" = "0" ] || fallisci "dopo la ricreazione restano $residui documenti"

# Lo svuotamento porta via anche gli indici. E' la ragione per cui la strada
# piu' rapida richiede comunque un riavvio del backend: senza, i documenti
# nuovi nascerebbero senza scadenza.
ttl=$(indici_ttl)
[ "$ttl" = "0" ] || fallisci "dopo la ricreazione l'indice di ritenzione risulta ancora presente"
echo "base dati vuota, indice di ritenzione rimosso con essa"

# --- Esito ------------------------------------------------------------------

echo
echo "== tempi misurati su $atteso documenti =="
printf '%-24s %8d ms\n' "messa in sicurezza"  "$T_SICUREZZA"
printf '%-24s %8d ms\n' "ripristino da copia" "$T_RIPRISTINO"
printf '%-24s %8d ms\n' "ricreazione a vuoto" "$T_RICREAZIONE"
echo
echo "PROVA SUPERATA"
