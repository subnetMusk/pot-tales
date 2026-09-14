# Sviluppo

Come avviare il progetto in locale. La produzione non usa nulla di ciò che segue:
legge file di secret separati, vedi [ESERCIZIO.md](ESERCIZIO.md).

## Prerequisiti

- Docker 20.10+ e Docker Compose v2
- Node 24+ e Go 1.26+ solo se si compila fuori dai container
- Almeno 4 GB di RAM liberi se si avvia anche lo stack Elastic

Il Makefile è il punto di ingresso: `make help` stampa l'elenco dei target,
generato dai target stessi e non scritto a parte.

## Avvio

```bash
cp .env.example .env      # compilare i valori, vedi sotto
make dev-up               # applicazione, crea le reti condivise
make monitoring-up        # facoltativo: stack Elastic
```

L'ordine conta: il monitoring si attacca alle reti create dall'applicazione. Avviarlo
per primo fallisce con `external network internal_net not found`.

```bash
make dev-rebuild          # ricostruisce le immagini dopo una modifica
make monitoring-down      # ferma il monitoring, l'applicazione resta su
make dev-down             # ferma l'applicazione, i volumi restano intatti
```

Lo stack Elastic è deliberatamente separato dall'applicazione: senza, l'avvio è di
qualche decina di secondi invece di qualche minuto, e l'applicazione funziona lo stesso
con APM disattivato. Conviene tenerlo spento finché non serve.

## Variabili d'ambiente

**La fonte è `.env.example`**, che è versionato, commentato e allineato al codice. Qui
stanno solo i vincoli che il file non può esprimere da solo.

`.env` non è versionato. Docker Compose lo usa sia per sostituire le `${VAR}` nei file
compose sia come `env_file` iniettato nei container.

| Vincolo | Perché |
|---|---|
| `REDIS_APP_PASS` e `REDIS_FE_PASS` devono combaciare con `docker/redis/users.acl` | le password sono scritte nell'ACL, che è versionato: cambiarne una sola delle due rompe l'autenticazione |
| `STACK_VERSION` resta sulla linea 8.x | i digest delle quattro immagini Elastic vanno riallineati a ogni cambio |
| `ELASTIC_APM_RUM_ACTIVE=true` solo con il monitoring attivo | altrimenti il browser tenta di consegnare telemetria a un endpoint che non risponde |

Le credenziali di sviluppo non vanno portate in produzione. Non è una raccomandazione
generica: girano da inizio progetto, sono note a chiunque abbia visto il repository, e
la rotazione avviene di fatto alla generazione dei secret, che produce valori nuovi e
distinti.

I token di enrollment Fleet in `.env.example` sono segnaposto **identici fra loro**. I
token reali sono per-policy: si generano dal modulo [terraform/elk](../terraform/elk/README.md)
con `terraform output`, oppure da Kibana sotto Fleet.

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
| `http://localhost/auth`, `/game`, `/health`, `/log` | API del backend |
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
cd frontend && npm ci && npm run build
cd server && go build ./...
```

## Sandbox

`sandbox/` è un gemello del frontend per prototipare scene e provare comportamenti con
dati controllati. È **escluso dal monitoraggio** di proposito: la telemetria di prova
inquinerebbe i dati di esercizio, e distinguerli a posteriori non è sempre possibile.

## Verifica

```bash
make help                 # elenco dei target
make verify-fast          # Go (formato, vet, build, test), lint shell/Docker/compose/stack, Filebeat, export dashboard
make verify               # tutto il precedente piu' integrazione e analizzatori
make frontend-typecheck   # tipi del frontend, che la compilazione non controlla
make frontend-test        # test del frontend (runner di Node), con soglia di copertura
make go-test              # sola suite Go, senza servizi esterni
make go-test-integration  # richiede MongoDB e Redis, avviati dal target
```

I test che richiedono servizi esterni stanno dietro il tag di compilazione
`integration`. Senza quella separazione ogni esecuzione della suite dipenderebbe da due
servizi, e un guasto d'ambiente sarebbe indistinguibile da una regressione.
