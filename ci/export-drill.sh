#!/usr/bin/env bash
# Prova l'esportazione su MongoDB ed Elasticsearch veri, e ne verifica l'esito.
#
# L'esportazione e' l'unico meccanismo con cui i dati sopravvivono alla
# dismissione della macchina, e va provata prima di servire, non dopo. Una
# esportazione che non e' mai stata riletta e' un'ipotesi, non una copia: la
# prova qui non si ferma alla presenza dei file, ma conta i documenti e
# rileggge l'archivio di MongoDB reinserendolo in una base dati separata.
#
# I servizi vivono in contenitori effimeri su una rete dedicata, con nomi
# distinti da quelli di qualunque altro flusso di lavoro sullo stesso demone.
#
#   ./ci/export-drill.sh            prepara, esporta, verifica, smonta
#   ./ci/export-drill.sh --prepara  prepara e lascia i servizi in piedi
#   ./ci/export-drill.sh --pulisci  smonta quanto preparato
set -uo pipefail

RADICE=$(cd "$(dirname "$0")/.." && pwd)

MONGO_IMAGE=${MONGO_IMAGE:-mongo:8.2.12@sha256:e0ce8c35124d4a9f9785532d1f268f39e9728ffa1cb38f46fa482436424c4bd3}
ES_IMAGE=${ES_IMAGE:-docker.elastic.co/elasticsearch/elasticsearch:8.19.19@sha256:5dbf405a97e008f3024cf6f8f4a314d91b765d82954530893dcc13f8e87d21f4}

# Prefisso e intervallo di porte riservati a questa prova: sullo stesso demone
# possono girare altri stack, e una collisione di nomi o di porte fermerebbe
# roba che non e' nostra.
RETE=sb-net
MONGO=sb-mongo
ES=sb-es
VOLUME=sb-mongodata
PORTA_ES=${PORTA_ES:-19100}

# Fuori dall'albero di lavoro: la copia di lavoro puo' essere condivisa con
# altri flussi, e i file non tracciati non sono isolati dai rami.
LAVORO=${LAVORO:-${TMPDIR:-/tmp}/sb-drill}
DOCUMENTI_ES=${DOCUMENTI_ES:-20000}
DOCUMENTI_MONGO=${DOCUMENTI_MONGO:-5000}

export MSYS_NO_PATHCONV=1

pulisci() {
  docker rm -f "$MONGO" "$ES" >/dev/null 2>&1
  docker network rm "$RETE" >/dev/null 2>&1
  docker volume rm "$VOLUME" >/dev/null 2>&1
  rm -rf "$LAVORO"
}

fallisci() { echo "PROVA FALLITA: $*" >&2; exit 1; }

# --- Preparazione della base di prova ---------------------------------------

prepara() {
  pulisci
  mkdir -p "$LAVORO/export"

  # Credenziali generate a ogni esecuzione: nessun valore fisso entra nel
  # repository, e la prova esercita comunque il percorso autenticato, che e'
  # quello di produzione.
  PASSWORD=$(head -c 18 /dev/urandom | od -An -tx1 | tr -d ' \n')
  [ ${#PASSWORD} -ge 24 ] || fallisci "generazione della credenziale di prova fallita"
  printf '%s' "$PASSWORD" > "$LAVORO/es_password"
  printf '%s' "$PASSWORD" > "$LAVORO/mongo_password"

  docker network create "$RETE" >/dev/null || fallisci "rete $RETE non creata"
  docker volume create "$VOLUME" >/dev/null || fallisci "volume $VOLUME non creato"

  docker run -d --name "$MONGO" --network "$RETE" \
    -v "$VOLUME:/data/db" \
    -e MONGO_INITDB_ROOT_USERNAME=root \
    -e MONGO_INITDB_ROOT_PASSWORD="$PASSWORD" \
    "$MONGO_IMAGE" >/dev/null || fallisci "MongoDB non avviato"

  # Sicurezza attiva senza TLS: l'autenticazione e' lo stesso percorso della
  # produzione, mentre il certificato dell'autorita' privata non e'
  # riproducibile qui e resta l'unica parte non coperta da questa prova.
  docker run -d --name "$ES" --network "$RETE" \
    -p "$PORTA_ES:9200" \
    -e discovery.type=single-node \
    -e xpack.security.enabled=true \
    -e xpack.security.http.ssl.enabled=false \
    -e xpack.security.enrollment.enabled=false \
    -e ELASTIC_PASSWORD="$PASSWORD" \
    -e ES_JAVA_OPTS="-Xms512m -Xmx512m" \
    "$ES_IMAGE" >/dev/null || fallisci "Elasticsearch non avviato"

  # Il secret nella posizione in cui lo stack di produzione lo monta: lo script
  # legge la password da li' dentro il contenitore, e la prova deve esercitare
  # quel percorso e non una scorciatoia.
  attendi_mongo
  docker exec "$MONGO" sh -c \
    "mkdir -p /run/secrets && printf '%s' '$PASSWORD' > /run/secrets/mongo_root_password" \
    || fallisci "secret non depositato nel contenitore di MongoDB"

  attendi_es
  semina_mongo
  semina_es
}

attendi_mongo() {
  for _ in $(seq 1 60); do
    if docker exec "$MONGO" mongosh --quiet --eval 'db.adminCommand({ping:1}).ok' >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  fallisci "MongoDB non pronto"
}

attendi_es() {
  for _ in $(seq 1 90); do
    stato=$(docker exec "$ES" curl -fsS -u "elastic:$PASSWORD" \
      "http://localhost:9200/_cluster/health" 2>/dev/null)
    esito=$?
    if [ "$esito" -eq 0 ] && [ -n "$stato" ]; then
      case "$stato" in *'"status":"green"'*|*'"status":"yellow"'*) return 0 ;; esac
    fi
    sleep 2
  done
  fallisci "Elasticsearch non pronto"
}

# Documenti nella forma che il backend scrive davvero: identificatore uguale al
# token di sessione, campi annidati sotto data e meta. Una prova su documenti
# piatti non direbbe nulla sulla conservazione della struttura.
semina_mongo() {
  cat > "$LAVORO/semina.js" <<EOF
const N = $DOCUMENTI_MONGO;
const sessioni = [], partite = [];
for (let i = 0; i < N; i++) {
  const token = 'tok-' + i.toString(16).padStart(10, '0');
  sessioni.push({
    _id: token,
    created_at: new Date(Date.now() - i * 1000),
    expires_at: new Date(Date.now() + 900000),
    active: i % 7 !== 0,
    device_info: 'Mozilla/5.0 (X11; Linux x86_64) prova',
    client_ip: '10.0.' + (i % 255) + '.' + (i % 254 + 1),
    consent_given: true
  });
  partite.push({
    _id: token,
    created_at: new Date(Date.now() - i * 1000),
    data: { scene_id: 'scena-' + (i % 5 + 1), x: i % 1920, y: i % 1080, total_time_ms: i * 137 },
    meta: { last_ping: new Date(), warnings: i % 3 }
  });
}
// Gli esiti vanno assegnati: mongosh stampa il valore di ogni espressione di
// primo livello, e l'elenco degli identificatori inseriti sommergerebbe
// l'uscita della prova.
const esitoSessioni = db.sessions.insertMany(sessioni, { ordered: false });
const esitoPartite = db.game_states.insertMany(partite, { ordered: false });

// Indice di ritenzione, nella stessa forma che il backend crea all'avvio.
// Serve a verificare che sopravviva al giro di andata e ritorno: un archivio
// che riporta i documenti ma non gli indici lascerebbe i dati senza scadenza,
// e nulla lo segnalerebbe.
const esitoIndiceSessioni = db.sessions.createIndex(
  { created_at: 1 }, { expireAfterSeconds: 1209600 });
const esitoIndicePartite = db.game_states.createIndex(
  { created_at: 1 }, { expireAfterSeconds: 1209600 });
print('seminati ' + Object.keys(esitoSessioni.insertedIds).length +
      ' ' + Object.keys(esitoPartite.insertedIds).length);
EOF
  docker exec -i "$MONGO" mongosh --quiet \
    -u root -p "$PASSWORD" --authenticationDatabase admin game_db \
    < "$LAVORO/semina.js" || fallisci "semina di MongoDB fallita"
}

semina_es() {
  # Due forme diverse, perche' in produzione convivono entrambe e si risolvono
  # in modo diverso.
  #
  #   logs-gioco-prova   ricade sotto il template predefinito `logs-*-*` di
  #                      Elastic e diventa un **flusso di dati**: gli indici
  #                      che lo compongono si chiamano .ds-... e sono
  #                      nascosti, quindi una risoluzione che non li cerchi
  #                      esporterebbe zero documenti senza segnalare nulla.
  #                      Un flusso di dati accetta solo operazioni `create`.
  #
  #   alerts-infra       indice ordinario, la forma con cui il connettore di
  #                      Kibana deposita gli allarmi.
  #
  # I campi annidati servono a dimostrare che l'NDJSON li conserva: e' la
  # ragione per cui il formato e' stato scelto.
  for indice in logs-gioco-prova alerts-infra; do
    operazione=index
    [ "$indice" = "logs-gioco-prova" ] && operazione=create
    awk -v n="$DOCUMENTI_ES" -v idx="$indice" -v op="$operazione" 'BEGIN {
      for (i = 0; i < n; i++) {
        printf "{\"%s\":{}}\n", op;
        printf "{\"@timestamp\":\"2026-08-07T%02d:%02d:%02dZ\",\"service\":{\"name\":\"server\"},\"origine\":\"%s\",\"livello\":\"info\",\"evento\":{\"scena\":\"scena-%d\",\"durata_ms\":%d,\"punteggio\":%.2f},\"client\":{\"sessione\":\"tok-%010x\"},\"messaggio\":\"transizione di scena numero %d\"}\n", \
          (i/3600)%24, (i/60)%60, i%60, idx, i%5+1, i*7%9000, (i%1000)/10, i, i;
      }
    }' > "$LAVORO/bulk-$indice.ndjson"

    # Il carico entra dallo stdin del processo remoto invece che con docker cp:
    # la redirezione la esegue la shell, quindi nessun percorso dell'host viene
    # passato al client di Docker e la prova resta eseguibile ovunque.
    docker exec -i "$ES" sh -c 'cat > /tmp/bulk.ndjson' < "$LAVORO/bulk-$indice.ndjson" \
      || fallisci "copia del carico di semina fallita"
    docker exec "$ES" curl -fsS -u "elastic:$PASSWORD" \
      -H 'Content-Type: application/x-ndjson' \
      --data-binary @/tmp/bulk.ndjson \
      "http://localhost:9200/$indice/_bulk" > "$LAVORO/bulk-$indice.out" \
      || fallisci "indicizzazione di $indice fallita"
    grep -q '"errors":false' "$LAVORO/bulk-$indice.out" \
      || fallisci "indicizzazione di $indice conclusa con errori"
  done

  docker exec "$ES" curl -fsS -u "elastic:$PASSWORD" \
    -X POST "http://localhost:9200/_refresh" >/dev/null \
    || fallisci "refresh degli indici fallito"
}

# --- Esportazione e verifica ------------------------------------------------

esporta_e_verifica() {
  echo
  echo "== esportazione =="
  inizio=$(date +%s%3N)
  CONF=/dev/null \
  EXPORT_DEST="$LAVORO/export" \
  EXPORT_KEEP=3 \
  LOCK_DIR="$LAVORO/lock" \
  ES_NET="$RETE" \
  ES_URL="http://$ES:9200" \
  ES_USER=elastic \
  ES_PASSWORD_FILE="$LAVORO/es_password" \
  ES_CA="" \
  ES_INDICI="logs-*,alerts-*" \
  MONGO_CONTAINER="$MONGO" \
  MONGO_DB=game_db \
  MONGO_USER=root \
  MONGO_PASSWORD_FILE=/run/secrets/mongo_root_password \
    "$RADICE/provisioning/bin/data-export.sh"
  uscita=$?
  durata=$(( $(date +%s%3N) - inizio ))
  [ "$uscita" -eq 0 ] || fallisci "data-export.sh uscito con $uscita"

  DEST=$(find "$LAVORO/export" -mindepth 1 -maxdepth 1 -type d | sort -r | head -1)
  [ -n "$DEST" ] || fallisci "nessuna directory di esportazione prodotta"

  echo
  echo "== verifica =="

  # 1. Conteggio dei documenti per indice: il file deve contenere esattamente
  #    quanto e' stato indicizzato. Un'esportazione troncata e' indistinguibile
  #    da una completa finche' non la si conta.
  #
  #    Gli archivi si scoprono invece di darli per noti: l'indice di un flusso
  #    di dati porta nel nome la data di creazione, e attenderne uno preciso
  #    renderebbe la prova valida un giorno solo.
  mapfile -t archivi < <(find "$DEST/elastic" -name '*.ndjson.gz' | sort)
  [ "${#archivi[@]}" -eq 2 ] \
    || fallisci "${#archivi[@]} archivi prodotti, 2 attesi (flusso di dati e indice ordinario)"

  visto_flusso=0
  for archivio in "${archivi[@]}"; do
    indice=$(basename "$archivio" .ndjson.gz)
    case "$indice" in ds-logs-gioco-prova-*) visto_flusso=1 ;; esac
    [ -s "$archivio" ] || fallisci "$indice: archivio assente o vuoto"
    gzip -dc "$archivio" > "$LAVORO/verifica.ndjson" \
      || fallisci "$indice: archivio non decomprimibile"
    righe=$(wc -l < "$LAVORO/verifica.ndjson" | tr -d ' ')
    [ "$righe" = "$DOCUMENTI_ES" ] \
      || fallisci "$indice: $righe documenti esportati, $DOCUMENTI_ES attesi"

    # 2. Struttura annidata conservata: e' la proprieta' per cui l'NDJSON e'
    #    stato scelto al posto di un formato tabellare. Il valore si cerca
    #    senza presumere l'ordine delle chiavi, che Elasticsearch non
    #    garantisce.
    grep -q '"evento":{' "$LAVORO/verifica.ndjson" \
      || fallisci "$indice: struttura annidata non conservata"
    grep -q '"scena":"scena-' "$LAVORO/verifica.ndjson" \
      || fallisci "$indice: campi annidati non conservati"
    grep -q '"_source"' "$LAVORO/verifica.ndjson" \
      || fallisci "$indice: documenti privi della sorgente"

    # 3. Identificatori distinti: un errore su search_after produrrebbe
    #    ripetizioni o buchi, e il solo conteggio non li distinguerebbe.
    distinti=$(grep -o '"_id":"[^"]*"' "$LAVORO/verifica.ndjson" | sort -u | wc -l | tr -d ' ')
    [ "$distinti" = "$DOCUMENTI_ES" ] \
      || fallisci "$indice: $distinti identificatori distinti su $DOCUMENTI_ES documenti"

    [ -s "$DEST/elastic/$indice.mapping.json" ] \
      || fallisci "$indice: mappature non salvate"
    echo "  $indice: $righe documenti, identificatori distinti, mappature presenti"
  done

  # 4. Il flusso di dati e' stato esportato davvero. In produzione i dati
  #    raccolti da Elastic Agent vivono tutti in flussi, e una risoluzione che
  #    non li raggiunge produrrebbe un'esportazione vuota senza errori.
  [ "$visto_flusso" = "1" ] \
    || fallisci "nessun archivio corrisponde all'indice di un flusso di dati"

  # 5. Nessun archivio nascosto: un nome che inizia con il punto verrebbe
  #    saltato in silenzio da un `scp dir/*` al momento del prelievo.
  nascosti=$(find "$DEST/elastic" -name '.*' -type f | wc -l | tr -d ' ')
  [ "$nascosti" = "0" ] || fallisci "$nascosti archivi con nome nascosto"

  # 6. L'archivio di MongoDB si rilegge davvero. Viene reinserito in una base
  #    dati separata, cosi' la verifica non tocca i dati di partenza.
  archivio="$DEST/mongo/game_db.archive.gz"
  [ -s "$archivio" ] || fallisci "archivio di MongoDB assente o vuoto"

  docker exec -i "$MONGO" mongorestore --quiet --archive --gzip \
    -u root -p "$PASSWORD" --authenticationDatabase admin \
    --nsFrom 'game_db.*' --nsTo 'verifica_db.*' < "$archivio" \
    || fallisci "archivio di MongoDB non rileggibile"

  conteggio=$(docker exec "$MONGO" mongosh --quiet \
    -u root -p "$PASSWORD" --authenticationDatabase admin verifica_db \
    --eval 'print(db.sessions.countDocuments({}) + " " + db.game_states.countDocuments({}))')
  atteso="$DOCUMENTI_MONGO $DOCUMENTI_MONGO"
  [ "$(echo "$conteggio" | tr -d '\r')" = "$atteso" ] \
    || fallisci "archivio riletto: [$conteggio] documenti, [$atteso] attesi"

  # 7. Struttura annidata anche sul lato MongoDB.
  campo=$(docker exec "$MONGO" mongosh --quiet \
    -u root -p "$PASSWORD" --authenticationDatabase admin verifica_db \
    --eval 'print(db.game_states.findOne({}, {"data.scene_id": 1}).data.scene_id)')
  case "$(echo "$campo" | tr -d '\r')" in
    scena-*) ;;
    *) fallisci "archivio riletto: campo annidato assente [$campo]" ;;
  esac
  echo "  game_db: archivio riletto in verifica_db, $conteggio documenti, campi annidati presenti"

  [ -s "$DEST/SHA256SUMS" ] || fallisci "somme di controllo non prodotte"
  echo "  somme di controllo: $(wc -l < "$DEST/SHA256SUMS" | tr -d ' ') file"

  echo
  echo "== tempi =="
  printf 'esportazione completa: %d ms\n' "$durata"
  du -sh "$DEST" 2>/dev/null | awk '{print "dimensione archivi:   " $1}'
  grep -E '^(logs|metrics)-' "$DEST/MANIFEST.txt" 2>/dev/null
  grep -E '^archivio' "$DEST/MANIFEST.txt" 2>/dev/null
}

# --- Ingresso ---------------------------------------------------------------

case "${1:-}" in
  --pulisci)
    pulisci
    echo "smontato"
    ;;
  --prepara)
    prepara
    echo "pronto: rete $RETE, $MONGO, $ES (porta $PORTA_ES), lavoro in $LAVORO"
    ;;
  "")
    trap pulisci EXIT
    prepara
    esporta_e_verifica
    echo
    echo "PROVA SUPERATA"
    ;;
  *)
    echo "uso: $0 [--prepara | --pulisci]" >&2
    exit 2
    ;;
esac
