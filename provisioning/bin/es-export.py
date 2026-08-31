#!/usr/bin/env python3
"""Esporta indici Elasticsearch in NDJSON compresso.

Lo scorrimento usa point-in-time e ``search_after``. Il point-in-time congela
l'insieme dei segmenti al momento dell'apertura: il risultato resta coerente
anche mentre l'indice continua a ricevere documenti, che e' la condizione
normale quando l'esportazione parte durante un'apertura al pubblico. Rispetto a
``scroll``, ``search_after`` non mantiene sul server un contesto per ogni
richiesta, e l'unico stato e' il point-in-time stesso.

Ogni riga del file contiene indice, identificatore e sorgente del documento:
e' la forma che si rilegge sia da uno strumento di analisi sia reindicizzando
altrove, senza perdere i campi annidati. Le mappature vengono salvate a fianco,
perche' senza di esse un indice ricreato altrove interpreterebbe i tipi in modo
diverso da quello di origine.

Il freno e' la cadenza delle richieste, non la quota di CPU del processo: il
lavoro pesante lo fa Elasticsearch, che legge i segmenti. Lotti piccoli con una
pausa fra l'uno e l'altro lasciano spazio all'ingestione in corso.

Solo libreria standard: lo script gira in un contenitore ancorato per digest e
non deve installare nulla.

Configurazione via ambiente:

  ES_URL             endpoint del cluster
  ES_USER            utenza (vuota per cluster senza autenticazione)
  ES_PASSWORD_FILE   file da cui leggere la password, preferito a ES_PASSWORD
  ES_PASSWORD        password in chiaro, per gli ambienti che non hanno un file
  ES_CA              certificato dell'autorita' che ha emesso quello del cluster
  ES_INDICI     modelli di indice separati da virgola
  DEST          directory di destinazione
  LOTTO         documenti per richiesta
  PAUSA         secondi di attesa fra un lotto e il successivo
  KEEP_ALIVE    durata del point-in-time, rinnovata a ogni richiesta
  TIMEOUT       secondi concessi alla singola richiesta
"""

import base64
import gzip
import json
import os
import ssl
import sys
import time
import urllib.error
import urllib.request

ES_URL = os.environ.get("ES_URL", "http://localhost:9200").rstrip("/")
ES_USER = os.environ.get("ES_USER", "")
ES_PASSWORD = os.environ.get("ES_PASSWORD", "")
ES_CA = os.environ.get("ES_CA", "")

# La password letta da file non compare fra le variabili d'ambiente del
# contenitore, che `docker inspect` mostra a chiunque possa interrogare il
# demone.
_password_file = os.environ.get("ES_PASSWORD_FILE", "")
if _password_file:
    with open(_password_file, encoding="utf-8") as _f:
        ES_PASSWORD = _f.read().strip()
ES_INDICI = os.environ.get("ES_INDICI", "*")
DEST = os.environ.get("DEST", ".")
LOTTO = int(os.environ.get("LOTTO", "1000"))
PAUSA = float(os.environ.get("PAUSA", "0.2"))
KEEP_ALIVE = os.environ.get("KEEP_ALIVE", "5m")
TIMEOUT = float(os.environ.get("TIMEOUT", "60"))

if ES_CA:
    contesto = ssl.create_default_context(cafile=ES_CA)
else:
    contesto = ssl.create_default_context()

intestazioni = {"Content-Type": "application/json"}
if ES_USER:
    credenziali = f"{ES_USER}:{ES_PASSWORD}".encode()
    intestazioni["Authorization"] = "Basic " + base64.b64encode(credenziali).decode()


def richiesta(metodo, percorso, corpo=None):
    """Esegue una richiesta e restituisce la risposta decodificata."""
    dati = json.dumps(corpo).encode() if corpo is not None else None
    req = urllib.request.Request(
        ES_URL + percorso, data=dati, headers=intestazioni, method=metodo
    )
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT, context=contesto) as risposta:
            return json.loads(risposta.read().decode())
    except urllib.error.HTTPError as errore:
        dettaglio = errore.read().decode(errors="replace")[:500]
        raise SystemExit(f"{metodo} {percorso}: HTTP {errore.code} {dettaglio}")
    except urllib.error.URLError as errore:
        raise SystemExit(f"{metodo} {percorso}: {errore.reason}")


def indici_concreti():
    """Risolve i modelli negli indici effettivamente presenti.

    ``_cat/indices`` risolve anche i flussi di dati, restituendo gli indici
    ``.ds-...`` che li compongono benche' siano nascosti. E' la ragione per cui
    viene usato al posto di ``_resolve/index``, che gli indici di un flusso li
    riporta in un elenco separato: un'esportazione costruita su quello
    scriverebbe zero documenti proprio per i dati raccolti da Elastic Agent,
    senza che nulla lo segnali.
    """
    trovati = []
    for modello in (m.strip() for m in ES_INDICI.split(",") if m.strip()):
        try:
            elenco = richiesta("GET", f"/_cat/indices/{modello}?h=index&format=json")
        except SystemExit:
            # Un modello che non corrisponde a nulla non e' un errore: gli
            # indici giornalieri esistono solo dopo il primo documento.
            continue
        trovati.extend(voce["index"] for voce in elenco)
    return sorted(set(trovati))


def nome_file(indice):
    """Nome di file corrispondente all'indice, senza punto iniziale.

    Gli indici che compongono un flusso di dati si chiamano ``.ds-...``: un
    file che inizia con il punto e' nascosto, e un ``scp dir/*`` lo salterebbe
    in silenzio portandosi via tutto tranne gli archivi piu' grandi. Il nome
    esatto dell'indice resta nel manifesto, nel file delle mappature e in ogni
    riga dell'NDJSON, quindi nulla va perduto.
    """
    return indice.lstrip(".")


def salva_mappatura(indice, destinazione):
    """Scrive mappature e impostazioni dell'indice a fianco dei dati."""
    schema = {
        "index": indice,
        "mappings": richiesta("GET", f"/{indice}/_mapping")[indice]["mappings"],
        "settings": richiesta("GET", f"/{indice}/_settings")[indice]["settings"],
    }
    with open(destinazione, "w", encoding="utf-8") as f:
        json.dump(schema, f, ensure_ascii=False, indent=2)


def esporta(indice, destinazione):
    """Scorre l'indice e scrive NDJSON compresso. Restituisce i documenti scritti."""
    pit = richiesta("POST", f"/{indice}/_pit?keep_alive={KEEP_ALIVE}")["id"]
    scritti = 0
    dopo = None
    try:
        with gzip.open(destinazione, "wt", encoding="utf-8") as uscita:
            while True:
                corpo = {
                    "size": LOTTO,
                    "query": {"match_all": {}},
                    "pit": {"id": pit, "keep_alive": KEEP_ALIVE},
                    # _shard_doc e' il criterio di ordinamento piu' economico
                    # disponibile, ed esiste solo dentro un point-in-time.
                    "sort": [{"_shard_doc": "asc"}],
                    "track_total_hits": False,
                }
                if dopo is not None:
                    corpo["search_after"] = dopo
                risposta = richiesta("POST", "/_search", corpo)

                # L'identificatore del point-in-time puo' cambiare a ogni
                # risposta: riusare quello iniziale farebbe scadere lo
                # scorrimento a meta' strada.
                pit = risposta.get("pit_id", pit)

                colpi = risposta["hits"]["hits"]
                if not colpi:
                    break

                for colpo in colpi:
                    uscita.write(
                        json.dumps(
                            {
                                "_index": colpo["_index"],
                                "_id": colpo["_id"],
                                "_source": colpo.get("_source", {}),
                            },
                            ensure_ascii=False,
                            # Separatori compatti: su milioni di righe gli spazi
                            # di cortesia sono l'unico contenuto che non serve a
                            # nessuno, ne' a chi rilegge ne' a chi reindicizza.
                            separators=(",", ":"),
                        )
                    )
                    uscita.write("\n")
                scritti += len(colpi)
                dopo = colpi[-1]["sort"]

                if len(colpi) < LOTTO:
                    break
                if PAUSA > 0:
                    time.sleep(PAUSA)
    finally:
        # Un point-in-time non chiuso trattiene i segmenti a cui fa
        # riferimento finche' non scade, e lo spazio che occupano non viene
        # liberato dalla fusione.
        try:
            richiesta("DELETE", "/_pit", {"id": pit})
        except SystemExit as errore:
            print(f"chiusura del point-in-time fallita: {errore}", file=sys.stderr)
    return scritti


def main():
    os.makedirs(DEST, exist_ok=True)
    indici = indici_concreti()
    if not indici:
        print(f"nessun indice corrisponde a {ES_INDICI}", file=sys.stderr)
        return 1

    esito = 0
    for indice in indici:
        base = nome_file(indice)
        dati = os.path.join(DEST, f"{base}.ndjson.gz")
        schema = os.path.join(DEST, f"{base}.mapping.json")
        inizio = time.monotonic()
        try:
            salva_mappatura(indice, schema)
            documenti = esporta(indice, dati)
        except SystemExit as errore:
            # Un indice che fallisce non ferma gli altri: un export parziale
            # vale piu' di nessun export, purche' sia dichiarato tale.
            print(f"{indice}: FALLITO {errore}", file=sys.stderr)
            esito = 1
            continue
        durata = time.monotonic() - inizio
        byte = os.path.getsize(dati)
        print(f"{indice}\t{documenti}\t{byte}\t{durata:.1f}s")
    return esito


if __name__ == "__main__":
    sys.exit(main())
