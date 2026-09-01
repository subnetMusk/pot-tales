# Setup ambiente di sviluppo

Guida per avviare il progetto dopo la migrazione a Traefik e la pulizia dei
volumi runtime. Il file `.env` NON e' piu' versionato: si parte dal template
`.env.example` (vedi sotto i valori dev di riferimento). La produzione non usa
questo file: legge secret separati, vedi in fondo.

## Prerequisiti

- Docker 20.10+ e Docker Compose v2
- Node 24+ e Go 1.26+ solo se si builda fuori dai container
- Almeno 4 GB di RAM liberi se si avvia anche lo stack ELK

Tutti i comandi hanno un equivalente nel Makefile, che e' il punto di ingresso
del progetto: `make help` stampa l'elenco completo dei target.

## Avvio rapido

```bash
# 1. Crea il file di ambiente locale dal template
cp .env.example .env
# compila i valori (per lo sviluppo vedi la tabella sotto)

# 2. Applicazione (crea le reti condivise internal_net / proxy_net / frontend_net)
make dev-up

# (opzionale) Monitoring Elastic
make monitoring-up
```

I due target invocano `docker compose -f docker-compose.dev.yml up -d` e
`./scripts/start-monitoring.sh`. Per ricostruire le immagini dopo una modifica:
`make dev-rebuild`.

Per fermare tutto:

```bash
make monitoring-down   # se avviato
make dev-down          # i volumi restano intatti
```

## Routing e URL (Traefik)

Il reverse proxy e Traefik: config statica in `docker/traefik/traefik.yml`,
routing dichiarato nel file dinamico `docker/traefik/dynamic/routes.yml`.
I sottodomini `*.localhost` risolvono a 127.0.0.1
nella maggior parte dei browser; se il tuo sistema non lo fa, aggiungili a
`/etc/hosts` (o `C:\Windows\System32\drivers\etc\hosts`):

```
127.0.0.1  localhost sandbox.localhost kibana.localhost mongo-ui.localhost redis-ui.localhost apm.localhost
```

| URL | Servizio |
|---|---|
| http://localhost | Frontend (gioco) |
| http://localhost/auth, /game, /health, /log | API backend Go |
| http://localhost/sandbox/ | Sandbox Vite (dev; base path `/sandbox/`) |
| http://kibana.localhost | Kibana (richiede monitoring attivo) |
| http://apm.localhost | APM server (monitoring) |
| http://mongo-ui.localhost | Mongo Express |
| http://redis-ui.localhost | Redis Commander |
| http://localhost:8080 | Dashboard Traefik (solo dev) |

## Valori di sviluppo

Da inserire nel tuo `.env` locale (copiato da `.env.example`). Questi valori
girano in dev da inizio progetto e verranno ruotati per la produzione; devono
restare coerenti con `docker/redis/users.acl` (password Redis hardcoded li'):

| Variabile | Valore dev | Uso |
|---|---|---|
| `MONGO_URI` | `mongodb://db:27017/database` | Connessione MongoDB |
| `REDIS_APP_PASS` | `app-password` | Utente Redis backend (RW) |
| `REDIS_FE_PASS` | `fe-password` | Utente Redis frontend (RO) |
| `SESSION_TTL_MIN` | `30` | Durata sessione (minuti) |
| `STACK_VERSION` | `8.19.19` | Versione Elastic Stack (restare sulla linea 8.x) |
| `ELASTIC_PASSWORD` | `m6OHmMuiqNrV1i25Jz3Z` | Utente `elastic` (superuser) |
| `KIBANA_SYSTEM_PASSWORD` | `eJL-r*4rNjRioOwWPEMT` | Utente `kibana_system` |
| `KIBANA_UI_USERNAME` / `KIBANA_UI_PASSWORD` | `kibana_admin` / `changeme123` | Login UI Kibana |
| `APM_SECRET_TOKEN` | `apm-secret-token-123` | Token agent APM |
| `TRAEFIK_DASHBOARD_PORT` | `8080` | Porta dashboard Traefik |

Nota: `JWT_SECRET` e' un residuo non usato dal backend Go (auth via session
token). Il RUM browser e' opt-in: `ELASTIC_APM_RUM_ACTIVE=true` solo se il
monitoring e' attivo.

## Build locale (senza Docker)

```bash
cd frontend && npm ci && npm run build     # richiede Node 24+
cd ../server && go build ./...             # richiede Go 1.26+
```

## Produzione

La produzione non usa questo `.env`. Lo stack Swarm (`deploy/stack.yml`) legge
file di secret separati, uno per credenziale, generati sulla macchina con
`make secrets` e mai versionati: il flusso completo e' in
[secrets/README.md](secrets/README.md), e i passi di deploy nell'ordine giusto
sono nel [README](README.md#avvio-in-produzione-docker-swarm).

Le credenziali di sviluppo qui sopra non vanno portate in produzione: girano da
inizio progetto e sono note. La rotazione avviene di fatto alla generazione dei
secret, che sono valori nuovi e distinti da questi.

Vedi anche [MONITORING_SETUP.md](MONITORING_SETUP.md) per le fragilita note
dello stack ELK, [terraform/README.md](terraform/README.md) per la collocazione
dello stato Terraform e [provisioning/README.md](provisioning/README.md) per
l'installazione sull'host, che non e' provisionato da Terraform.
