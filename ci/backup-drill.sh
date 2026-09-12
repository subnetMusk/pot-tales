#!/usr/bin/env bash
# Prova la copia di sicurezza: archivio portabile e recapito al servizio di
# sorveglianza.
#
# Le due meta' si provano in modo diverso, e vale la pena essere espliciti su
# quale sia coperta da cosa.
#
#   archivio portabile   provato per intero su MongoDB vero, con rilettura
#                        dell'archivio prodotto.
#
#   recapito             provato contro un ricevitore locale, che registra
#                        percorso e corpo di ogni richiesta. Verifica la forma
#                        degli endpoint, i suffissi di inizio ed esito e il
#                        fatto che un guasto produca davvero il segnale di
#                        guasto. Non tocca il servizio esterno: l'URL di ping
#                        e' una credenziale, e un battito falso terrebbe spenta
#                        la sorveglianza.
#
#   snapshot LVM         **non provato qui**. Richiede un volume group con
#                        spazio non allocato, che esiste sulla macchina di
#                        destinazione e non su una postazione di sviluppo. La
#                        prova copre il comportamento dello script in sua
#                        assenza, che deve essere un guasto dichiarato e non
#                        un successo silenzioso.
set -uo pipefail

RADICE=$(cd "$(dirname "$0")/.." && pwd)
LAVORO=${LAVORO:-${TMPDIR:-/tmp}/sb-drill}

MONGO=sb-mongo
RETE=sb-net
RICEVITORE=sb-ping
PORTA_PING=${PORTA_PING:-19101}
PYTHON_IMAGE=${PYTHON_IMAGE:-python:3.13-alpine@sha256:399babc8b49529dabfd9c922f2b5eea81d611e4512e3ed250d75bd2e7683f4b0}

export MSYS_NO_PATHCONV=1

fallisci() { echo "PROVA FALLITA: $*" >&2; exit 1; }

pulisci_tutto() {
  docker rm -f "$RICEVITORE" >/dev/null 2>&1
  "$RADICE/ci/export-drill.sh" --pulisci >/dev/null 2>&1
}
trap pulisci_tutto EXIT

# --- Ricevitore dei battiti -------------------------------------------------
#
# Risponde 200 a qualunque percorso e lo registra. E' il minimo che consenta di
# osservare cio' che lo script manda davvero, invece di dedurlo dal codice.

avvia_ricevitore() {
  docker rm -f "$RICEVITORE" >/dev/null 2>&1
  docker run -d --name "$RICEVITORE" --network "$RETE" -p "$PORTA_PING:8000" \
    "$PYTHON_IMAGE" python3 -c '
import http.server

class Ricevitore(http.server.BaseHTTPRequestHandler):
    def _registra(self):
        lunghezza = int(self.headers.get("Content-Length") or 0)
        corpo = self.rfile.read(lunghezza).decode(errors="replace") if lunghezza else ""
        print(f"{self.path}\t{corpo}", flush=True)
        self.send_response(200)
        self.send_header("Content-Length", "2")
        self.end_headers()
        self.wfile.write(b"ok")

    do_GET = do_POST = _registra

    def log_message(self, *_):
        pass

http.server.HTTPServer(("", 8000), Ricevitore).serve_forever()
' >/dev/null || fallisci "ricevitore non avviato"

  for _ in $(seq 1 30); do
    if curl -fsS --max-time 2 "http://localhost:$PORTA_PING/pronto" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  fallisci "ricevitore non raggiungibile su $PORTA_PING"
}

battiti() {
  docker logs "$RICEVITORE" 2>/dev/null | grep -v '^/pronto'
}

# --- Preparazione -----------------------------------------------------------

"$RADICE/ci/export-drill.sh" --prepara || fallisci "preparazione della base di prova fallita"
avvia_ricevitore

CHIAVE=$(head -c 16 /dev/urandom | od -An -tx1 | tr -d ' \n')
comune=(
  CONF="$LAVORO/stack-data.env"
  CONF_SORVEGLIANZA=/dev/null
  BIN_DIR="$RADICE/provisioning/bin"
  MONGO_CONTAINER="$MONGO"
  MONGO_DB=game_db
  MONGO_USER=root
  MONGO_PASSWORD_FILE=/run/secrets/mongo_root_password
  BACKUP_DEST="$LAVORO/backup-notturno"
  DUMP_KEEP=3
  LOCK_DIR="$LAVORO/lock-backup"
  HC_BASE="http://localhost:$PORTA_PING"
  HC_PING_KEY="$CHIAVE"
)

# Riproduce la configurazione di produzione, dove EXPORT_DEST appartiene alle
# esportazioni manuali. data-backup deve ignorarlo quando richiama
# data-export per il dump notturno e usare BACKUP_DEST/mongodump.
printf 'EXPORT_DEST=%s\n' "$LAVORO/esportazione-generica" > "$LAVORO/stack-data.env"

# --- 1. Archivio portabile con recapito riuscito ----------------------------

echo
echo "== 1. archivio portabile =="
inizio=$(date +%s%3N)
env "${comune[@]}" "$RADICE/provisioning/bin/data-backup.sh" \
  --solo-dump --check backup-nightly \
  || fallisci "copia con solo archivio portabile fallita"
T_DUMP=$(( $(date +%s%3N) - inizio ))

ARCHIVIO=$(find "$LAVORO/backup-notturno" -name 'game_db.archive.gz' | sort -r | head -1)
[ -s "$ARCHIVIO" ] || fallisci "archivio portabile non prodotto"
[ ! -e "$LAVORO/esportazione-generica" ] \
  || fallisci "il dump notturno ha usato EXPORT_DEST invece di BACKUP_DEST"

# L'archivio si rilegge davvero: viene reinserito in una base dati separata,
# cosi' la verifica non tocca i dati di partenza.
PASSWORD=$(cat "$LAVORO/mongo_password") || fallisci "credenziale di prova non leggibile"
docker exec -i "$MONGO" mongorestore --quiet --archive --gzip \
  -u root -p "$PASSWORD" --authenticationDatabase admin \
  --nsFrom 'game_db.*' --nsTo 'verifica_backup.*' < "$ARCHIVIO" \
  || fallisci "archivio portabile non rileggibile"
conteggio=$(docker exec "$MONGO" mongosh --quiet \
  -u root -p "$PASSWORD" --authenticationDatabase admin verifica_backup \
  --eval 'print(db.sessions.countDocuments({}) + db.game_states.countDocuments({}))' \
  2>/dev/null | tr -d '\r\n ')
atteso=$(( ${DOCUMENTI_MONGO:-5000} * 2 ))
[ "$conteggio" = "$atteso" ] \
  || fallisci "archivio riletto: $conteggio documenti, $atteso attesi"
echo "archivio riletto: $conteggio documenti, $(wc -c < "$ARCHIVIO" | tr -d ' ') byte"

# --- 2. Forma degli endpoint ------------------------------------------------

echo
echo "== 2. recapito al servizio di sorveglianza =="
battiti > "$LAVORO/battiti.txt"
cat "$LAVORO/battiti.txt"

grep -q "^/$CHIAVE/backup-nightly/start" "$LAVORO/battiti.txt" \
  || fallisci "segnale di inizio non recapitato nella forma <chiave>/<slug>/start"
grep -qE "^/$CHIAVE/backup-nightly	" "$LAVORO/battiti.txt" \
  || fallisci "segnale di esito non recapitato nella forma <chiave>/<slug>"
grep -q "^/$CHIAVE/backup-nightly	backup .* dump=ok" "$LAVORO/battiti.txt" \
  || fallisci "il corpo del segnale non riporta l'esito della copia"

# --- 3. Guasto dichiarato in assenza di LVM ---------------------------------
#
# Sulla macchina di destinazione lo snapshot e' il meccanismo primario. Qui non
# e' creabile, e cio' che conta e' che l'assenza produca un guasto visibile:
# una copia che si dichiara riuscita senza aver copiato nulla e' peggio di una
# copia mancante, perche' toglie la ragione di andare a controllare.

echo
echo "== 3. assenza dello snapshot LVM =="
env "${comune[@]}" VG_NAME=vg-inesistente \
  "$RADICE/provisioning/bin/data-backup.sh" --solo-snapshot --check backup-nightly
uscita=$?
[ "$uscita" -ne 0 ] || fallisci "l'assenza di LVM non ha prodotto un guasto"

battiti > "$LAVORO/battiti-guasto.txt"
grep -q "^/$CHIAVE/backup-nightly/fail" "$LAVORO/battiti-guasto.txt" \
  || fallisci "il guasto non e' stato recapitato sul suffisso di guasto"
grep -q "^/$CHIAVE/backup-nightly/fail	backup .* fallito" "$LAVORO/battiti-guasto.txt" \
  || fallisci "il corpo del guasto non ne riporta la causa"
echo "guasto dichiarato e recapitato (uscita $uscita)"

# --- Esito ------------------------------------------------------------------

echo
echo "== tempi =="
printf '%-24s %8d ms\n' "archivio portabile" "$T_DUMP"
echo
echo "PROVA SUPERATA"
