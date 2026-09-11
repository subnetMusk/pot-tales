# Dashboard versionate

Export dei saved object di Kibana, uno per Space. Terraform li reimporta:
`dashboards.tf` costruisce una risorsa per ogni file `.ndjson` trovato qui
sotto, quindi aggiungere una dashboard e' aggiungere un file, non modificare il
codice.

```
esercizio/<nome>.ndjson           export dello Space di esercizio
esercizio/<nome>.ndjson.versione  versione di Kibana che l'ha prodotto
evento/<nome>.ndjson              export dello Space divulgativo
evento/<nome>.ndjson.versione
```

## I due Space

**`esercizio/`** — vista tecnica: salute del servizio, risorse della macchina,
contenimento. Non destinata alla distribuzione. Contiene `salute-risorse`, che copre
host e container; mancano i pannelli applicativi e l'imbuto di partita.

**`evento/`** — vista divulgativa, destinata alla condivisione. Ancora priva di export.

Cio' che finisce in `evento/` viene condiviso: prima di esportare va verificato che i
pannelli non mostrino indirizzi, identificativi di sessione o nomi di host. Il ruolo
`osservabilita_evento` limita gli indici leggibili, ma non puo' impedire a un pannello
di riportare un valore gia' aggregato.

## Perche' non sono generate da Terraform

Una dashboard si disegna sui dati: quali campi esistono davvero, come si
distribuiscono, quali soglie separano il normale dall'anomalo. Dichiararla in
codice prima di aver visto i dati significa scriverne una che interroga campi
ipotetici. Il codice qui governa il ciclo di vita dell'export, non il suo
contenuto.

## Ciclo

```bash
# 1. Comporre la dashboard su Kibana, nello Space di destinazione.

# 2. Esportarla. La versione di Kibana e' letta dall'istanza, non passata a mano.
KIBANA_PASSWORD=... make dashboards-export SPAZIO=esercizio NOME=salute-servizio

# 3. Versionare i due file prodotti.
git add terraform/elk/dashboards/esercizio/salute-servizio.ndjson \
        terraform/elk/dashboards/esercizio/salute-servizio.ndjson.versione

# 4. Reimportare, qui o su un'istanza ricostruita.
make dashboards-import
```

## Vincolo di versione

Elastic dichiara compatibile un export solo verso:

- la stessa versione di Kibana;
- una minor successiva della stessa major;
- la major successiva.

Il file `.versione` accanto a ogni export registra la versione di provenienza, e
`dashboards.tf` la confronta con la variabile `kibana_version` prima di
importare. Un export fuori intervallo, o privo del file di versione, ferma il
`plan` con il nome del file: fuori intervallo l'importazione puo' riuscire e
lasciare oggetti che poi non si aprono, il che e' peggio di un errore.

Dopo un aggiornamento dello stack che superi l'intervallo, gli export vanno
rifatti dall'istanza aggiornata.

## Cosa non va toccato nei file

`coreMigrationVersion` e `typeMigrationVersion`, presenti su ogni oggetto:
Kibana li legge in importazione per decidere quali migrazioni applicare. Un file
riscritto da uno strumento che li perde viene importato come se fosse gia'
aggiornato.

Per lo stesso motivo l'export non e' riformattato ne' riordinato: `export.sh`
scrive il corpo della risposta dell'API cosi' com'e' e verifica che entrambi i
campi siano presenti su ogni riga prima di salvarlo. Ne segue che l'ordine delle
righe puo' variare fra due export della stessa dashboard, e la differenza
apparire piu' ampia di quanto sia: e' il prezzo di non riscrivere il file.

## Data view

Le data view sono dichiarate in `spaces.tf` e non arrivano dagli export. Se un
export ne contiene una con lo stesso identificativo, l'importazione la
sovrascrive e la differenza compare al `plan` successivo: in quel caso va tolta
dall'export, non dal codice.
