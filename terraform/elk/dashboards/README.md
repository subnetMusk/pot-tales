# Dashboard versionate

Export dei saved object di Kibana, uno per Space. Terraform li reimporta:
`dashboards.tf` costruisce una risorsa per ogni file `.ndjson` trovato qui
sotto.

```
esercizio/<nome>.ndjson           export dello Space di esercizio
esercizio/<nome>.ndjson.versione  versione di Kibana che l'ha prodotto
evento/<nome>.ndjson              export dello Space divulgativo
evento/<nome>.ndjson.versione
```

## I due Space

**`esercizio/`**: vista tecnica: salute del servizio, risorse della macchina,
contenimento e imbuto di partita. Non destinata alla distribuzione.

**`evento/`**: vista divulgativa, destinata alla condivisione. Le dashboard
mostrano gli aggregati dei fatti di partita; Discover consente di consultare i
singoli documenti pseudonimizzati dello stesso indice e nessun dato tecnico.

Ciò che finisce in `evento/` viene condiviso: prima di esportare va verificato che i
pannelli non mostrino indirizzi, identificativi di sessione o nomi di host. Il ruolo
`osservabilita_evento` limita gli indici leggibili, ma non può impedire a un pannello
di riportare un valore già aggregato.

## Ciclo

Eseguire i comandi dalla radice del repository. La password va fornita tramite
ambiente, senza scriverla nella riga di comando. In una shell Bash:

```bash
# 1. Comporre la dashboard in Kibana nello Space di destinazione.

# 2. Impostare l’endpoint e leggere la password senza eco.
export KIBANA_URL=http://kibana.localhost    # sviluppo, senza base path
export KIBANA_USERNAME=elastic
read -r -s -p 'Password Kibana: ' KIBANA_PASSWORD
printf '\n'
export KIBANA_PASSWORD
make dashboards-export SPAZIO=esercizio \
  NOME=servizio-funnel ID=esercizio-servizio-funnel
unset KIBANA_PASSWORD

# 3. Esaminare il diff; includere entrambi i file quando si prepara il commit.
git diff -- terraform/elk/dashboards/esercizio/servizio-funnel.ndjson \
  terraform/elk/dashboards/esercizio/servizio-funnel.ndjson.versione
```

In produzione l’export va eseguito da un contesto che raggiunge l’API Kibana;
`KIBANA_URL` include il base path `/osservabilita`. Non usare `localhost:5601`
sull’host Swarm, dove la porta non è pubblicata.

Per reimportare, rieseguire il bootstrap di produzione con
`sudo systemctl restart fleet-bootstrap.service`, oppure l’apply della
[procedura locale](../../../docs/MONITORING_LOCALE.md). Il target
`make dashboards-import` è un’alternativa per chi ha già predisposto rete,
endpoint, credenziali e `TF_STATE_DIR` dello stesso ambiente; i suoi default
(`host` e stato nel checkout) non sono quelli del bootstrap di produzione.

## Vincolo di versione

Elastic dichiara compatibile un export solo verso:

- la stessa versione di Kibana;
- una minor successiva della stessa major;
- la major successiva.

Il file `.versione` accanto a ogni export registra la versione di provenienza, e
`dashboards.tf` la confronta con la variabile `kibana_version` prima di
importare. Un export fuori intervallo, o privo del file di versione, ferma il
`plan` con il nome del file: fuori intervallo l'importazione può riuscire e
lasciare oggetti che poi non si aprono.

Dopo un aggiornamento dello stack che superi l'intervallo, gli export vanno
rifatti dall'istanza aggiornata.

## Cosa non va toccato nei file

`coreMigrationVersion` e `typeMigrationVersion`, presenti su ogni oggetto:
Kibana li legge in importazione per decidere quali migrazioni applicare. Un file
riscritto da uno strumento che li perde viene importato come se fosse già
aggiornato.

Per lo stesso motivo l'export non è riformattato né riordinato: `export.sh`
scrive il corpo della risposta dell'API così com'è e verifica che entrambi i
campi siano presenti su ogni riga prima di salvarlo. L'ordine delle righe può variare fra due export della stessa dashboard e
produrre un diff più ampio delle modifiche ai pannelli.

## Esportazione mirata e data view

L'ID obbligatorio seleziona una sola dashboard e le sue dipendenze: due export
non si sovrascrivono a vicenda e non contengono copie degli oggetti di altre
dashboard nello stesso Space.

Le data view sono dichiarate in `spaces.tf` e non arrivano dagli export. Se un
export profondo le include fra le dipendenze, `export.sh` ne elimina le sole
righe conservando byte per byte gli altri oggetti e i campi di migrazione.
