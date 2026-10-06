# Sviluppo

Avvio e configurazione locale del progetto. Per la produzione seguire
[Esercizio](ESERCIZIO.md).

## Prerequisiti

- Docker Engine con Docker Compose 2.24.0+ (il monitoring usa `env_file.required`)
- Node 24+ e Go 1.26+ solo se si compila fuori dai container
- Almeno 4 GB di RAM liberi se si avvia anche lo stack Elastic

`make help` elenca i target disponibili.

## Avvio

```bash
cp .env.example .env      # compilare i valori, vedi sotto
make dev-up               # applicazione, crea le reti condivise
make monitoring-up        # facoltativo: avvia Elastic, non completa il bootstrap Fleet
```

L'ordine conta: il monitoring si attacca alle reti create dall'applicazione. Avviarlo
per primo fallisce con `external network internal_net not found`.

```bash
make dev-rebuild          # ricostruisce le immagini dopo una modifica
make monitoring-down      # ferma il monitoring, l'applicazione resta su
make dev-down             # ferma l'applicazione, i volumi restano intatti
```

Lo stack Elastic è facoltativo; senza monitoring disattivare APM. Per registrare
gli agenti e importare le dashboard seguire il [bootstrap locale](MONITORING_LOCALE.md).
La versione minima di Compose deriva da
[`env_file.required`](https://docs.docker.com/reference/compose-file/services/#required).

## Variabili d'ambiente

Le variabili e i valori predefiniti sono in `.env.example`.

`.env` non è versionato. Docker Compose lo usa sia per sostituire le `${VAR}` nei file
compose sia come `env_file` iniettato nei container.

| Vincolo | Perché |
|---|---|
| `REDIS_APP_PASS` e `REDIS_FE_PASS` devono combaciare con `docker/redis/users.acl` | le password sono scritte nell'ACL, che è versionato: cambiarne una sola delle due rompe l'autenticazione |
| `STACK_VERSION` resta sulla linea 8.x | i digest delle quattro immagini Elastic vanno riallineati a ogni cambio |
| `ELASTIC_APM_RUM_ACTIVE=true` solo con il monitoring attivo | altrimenti il browser tenta di consegnare telemetria a un endpoint che non risponde |

Le credenziali di sviluppo sono versionate e non vanno usate in produzione.
Il provisioning genera secret separati per la produzione.

I token di enrollment Fleet sono per-policy. Compose legge i valori generati
nei file `.env.fleet.server`, `.env.fleet.apm` e `.env.fleet.infra`; i
segnaposto `FLEET_ENROLLMENT_TOKEN_*` del `.env.example` non li sostituiscono.
La [procedura locale](MONITORING_LOCALE.md) descrive creazione e rinnovo.

## Routing locale

Il reverse proxy è Traefik: configurazione statica in `docker/traefik/traefik.yml`,
routing dichiarato in `docker/traefik/dynamic/routes.yml`.

I sottodomini `*.localhost` risolvono a 127.0.0.1 nella maggior parte dei browser. Se il
sistema non lo fa, vanno aggiunti agli host:

```
127.0.0.1  localhost sandbox.localhost kibana.localhost mongo-ui.localhost redis-ui.localhost apm.localhost
```

| URL | Servizio |
|---|---|
| `http://localhost` | frontend, il gioco |
| `http://localhost/auth`, `/game`, `/health` | API del backend |
| `http://localhost/sandbox/` | sandbox Vite, base path `/sandbox/` |
| `http://kibana.localhost` | Kibana, richiede il monitoring attivo |
| `http://apm.localhost` | server APM |
| `http://mongo-ui.localhost` | Mongo Express |
| `http://redis-ui.localhost` | Redis Commander |
| `http://localhost:8080` | dashboard Traefik, **solo in sviluppo** |

In produzione la dashboard di Traefik non è abilitata e la porta 8080 non è pubblicata:
scavalca router e middleware, quindi qualunque autenticazione dichiarata sui router non
la protegge.

## Compilazione fuori dai container

```bash
(cd frontend && npm ci && npm run build)
(cd server && go build ./...)
```

## Manutenzione delle scene

Le scene Phaser sono istanze riusate: `scene.start()` e `launch()` non le ricostruiscono, e
gli inizializzatori dei campi di classe girano una volta sola per pagina. Lo stato di
partita (flag di Stage 2 e Stage 3, picchi del minigioco dei grafici) sta quindi in
`frontend/src/items/stageRunState.ts`, e le scene lo ricreano a ogni avvio: Stage 2 e
Stage 3 in `init()`, prima che `create()` lo ricostruisca dai checkpoint, GraficoGame in
`create()`. L'inventario vive nel registry del gioco, che sopravvive a tutte le scene, e lo
svuota il menu a ogni apertura. Così si giocano più partite di fila nella stessa scheda
senza ricaricare la pagina.

Per la stessa ragione gli eventi di una scena (`scene.events`) sopravvivono allo shutdown:
li svuota solo la distruzione della scena, che nel gioco non avviene. Un oggetto che vi
registra un listener lo deve togliere quando viene distrutto
(`frontend/src/items/sceneListeners.ts`, usato dal Player), e un gestore che deve
scattare una volta per partita va registrato con `once`. Altrimenti, al riavvio della
scena, il listener di un oggetto già distrutto scatta con `this.scene` non definito e
l'eccezione blocca anche i listener della partita nuova.

## Traduzioni

La [guida alle traduzioni Phaser](../frontend/public/assets/i18n/guide.md) descrive
file JSON, nomi degli oggetti testo e cambio lingua.

## Sandbox

`sandbox/` è un gemello del frontend per prototipare scene e provare comportamenti con
dati controllati. È escluso dal monitoraggio per separare la telemetria di prova
dai dati di esercizio.

## Verifica

La soglia frontend dell'85% riguarda i moduli caricati dai test, non l'intero
gioco: listener delle scene, skip dei video, stato di partita e timer dei ping.
Typecheck, build e verifica CSP coprono categorie di errori diverse.


```bash
make help                 # elenco dei target
make verify-fast          # Go (formato, vet, build, test), lint shell/Docker/compose/stack, Filebeat, export dashboard
make verify               # tutto il precedente più integrazione e analizzatori
make frontend-typecheck   # tipi del frontend, che la compilazione non controlla
make frontend-test        # test del frontend (runner di Node), con soglia di copertura
make go-test              # sola suite Go, senza servizi esterni
make go-test-integration  # richiede MongoDB e Redis, avviati dal target
```

I test che richiedono MongoDB e Redis usano il tag di compilazione `integration`.
