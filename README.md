# Progetti Innovativi, piattaforma gioco HTML5

Gioco HTML5 singleplayer (Phaser 3 + TypeScript/Vite) con backend Go, persistenza
MongoDB/Redis e osservabilità Elastic (Elasticsearch, Kibana, APM, Fleet, Filebeat).
In sviluppo gira su Docker Compose con Traefik come reverse proxy; in produzione gira
su Docker Swarm a partire da `deploy/stack.yml`.

Tutti i comandi del progetto passano dal Makefile. `make help` ne stampa l'elenco,
generato dai target stessi, quindi non può divergere da ciò che esiste davvero.

## Architettura

| Componente | Tecnologia | Ruolo |
|---|---|---|
| Frontend | Phaser 3, TypeScript, Vite | Gioco singleplayer, build statica servita da NGINX |
| Landing | NGINX | Pagina di ingresso, indipendente dal gioco (solo produzione) |
| Sandbox | Vite dev server | Ambiente di prototipazione meccaniche (solo sviluppo) |
| Backend | Go (Gorilla Mux) | API sessioni, stato di gioco, ingest log; validazione via JSON Schema |
| Database | MongoDB | Sessioni e stato di gioco |
| Cache | Redis (con ACL) | Sessioni e stato temporaneo |
| Proxy | Traefik v3 | Routing dichiarativo via file provider, TLS in produzione |
| Sicurezza | CrowdSec | Rilevamento sugli access log di Traefik e rimediazione graduata |
| Osservabilità | Elasticsearch, Kibana, APM, Fleet, Filebeat | Log, metriche, tracing |

Lo stack è descritto da file diversi a seconda dell'ambiente:

| File | Ambiente | Comando |
|---|---|---|
| `docker-compose.dev.yml` | Sviluppo, applicazione | `make dev-up` |
| `docker-compose.monitoring.yml` | Sviluppo, Elastic | `make monitoring-up` |
| `docker-compose.security.yml` | Sviluppo, overlay CrowdSec | `make security-up` |
| `deploy/stack.yml` | Produzione, Docker Swarm | `make stack-deploy` |

> `docker-compose.prod.yml` è un residuo dell'era Node e non è allineato allo stack
> attuale. La produzione è `deploy/stack.yml`.

## Requisiti

- Docker 20.10+ con Compose v2. In produzione lo swarm serve, ma non va
  inizializzato a mano: lo fa lo script di deploy se sul nodo non esiste.
- Almeno 4 GB di RAM liberi se si avvia anche Elastic.
- Go 1.26+ e Node 24+ servono solo per compilare fuori dai container. I target di
  verifica girano in immagini ancorate per digest e non richiedono toolchain sull'host.

## Avvio in sviluppo

```bash
# 1. File di ambiente locale, a partire dal template versionato.
#    `.env` non è versionato: contiene le credenziali di sviluppo.
cp .env.example .env

# 2. Applicazione. Alla prima esecuzione costruisce le immagini e crea le reti
#    condivise internal_net, proxy_net e frontend_net.
make dev-up

# 3. Osservabilità Elastic. Opzionale: serve solo per Kibana, APM e Fleet.
make monitoring-up
```

I valori di sviluppo da mettere in `.env` sono in [SETUP.md](SETUP.md), il dettaglio
di ogni variabile in [ENV_GUIDE.md](ENV_GUIDE.md).

Durante il lavoro:

```bash
make dev-ps                     # servizi e stato
make dev-logs SERVICE=server    # log di un servizio, in coda
make dev-shell SERVICE=server   # shell dentro un servizio
make dev-rebuild                # ricostruisce le immagini senza toccare le dipendenze
```

Per fermare tutto, nell'ordine inverso rispetto all'avvio:

```bash
make monitoring-down   # solo se avviato
make dev-down          # i volumi restano intatti
```

### URL di sviluppo

| URL | Servizio |
|---|---|
| http://localhost | Frontend, il gioco |
| http://localhost/auth, /game, /health, /log | API del backend Go |
| http://localhost/sandbox/ oppure http://sandbox.localhost | Sandbox Vite |
| http://mongo-ui.localhost | Mongo Express |
| http://redis-ui.localhost | Redis Commander |
| http://kibana.localhost | Kibana, richiede il monitoring attivo |
| http://apm.localhost | APM server, richiede il monitoring attivo |
| http://localhost:8080 | Dashboard Traefik, solo sviluppo |

Il routing è dichiarato in `docker/traefik/dynamic/routes.yml`, la configurazione
statica del proxy in `docker/traefik/traefik.yml`. I sottodomini `*.localhost`
risolvono a 127.0.0.1 sulla maggior parte dei browser; se il tuo sistema non lo fa,
aggiungili a `/etc/hosts`:

```
127.0.0.1  localhost sandbox.localhost kibana.localhost mongo-ui.localhost redis-ui.localhost apm.localhost
```

## Avvio in produzione (Docker Swarm)

I passi sono in ordine di dipendenza. I primi due si eseguono una volta sola per
macchina, gli altri a ogni cambio di configurazione o di immagine. La procedura
completa di preparazione dell'host, comprese le unità systemd, è in
[provisioning/README.md](provisioning/README.md).

```bash
# 1. Host: volumi separati, journal persistente, unità systemd.
#    Senza --apply lo script mostra soltanto i comandi che eseguirebbe.
sudo ./provisioning/bin/setup-volumes.sh --apply

# 2. Secret dello stack. Idempotente: quelli già presenti non vengono toccati,
#    perché rigenerarli invaliderebbe le credenziali con cui i servizi si sono
#    già registrati.
make secrets SECRETS_DIR=/srv/progetti_innovativi/secrets

# 3. Elenchi di utenze delle dashboard. Non sono generabili: vanno scelti e
#    distribuiti a persone. Lo script del passo 2 si limita a segnalarne l'assenza.
htpasswd -cbB /srv/progetti_innovativi/secrets/dashboard_users_esercizio <utente> <password>
htpasswd -cbB /srv/progetti_innovativi/secrets/dashboard_users_evento    <utente> <password>
cat /srv/progetti_innovativi/secrets/dashboard_users_esercizio \
    /srv/progetti_innovativi/secrets/dashboard_users_evento \
    > /srv/progetti_innovativi/secrets/dashboard_users
chmod 0400 /srv/progetti_innovativi/secrets/dashboard_users*

# 4. Parametri del deploy: hostname pubblico, recapito per il certificato e le tre
#    immagini riferite per digest. Il modello commentato è in provisioning/systemd/.
sudo install -m 0600 -o root -g root \
     provisioning/systemd/stack-deploy.env.example /etc/stack-deploy.env
sudo "${EDITOR:-vi}" /etc/stack-deploy.env

# 5. Applica lo stack, inizializzando lo swarm se manca. Da qui in poi il riavvio
#    della macchina basta: l'unità riapplica `deploy/stack.yml` a ogni avvio, e il
#    comando è idempotente.
sudo systemctl start stack-deploy.service
```

Le immagini vanno riferite per digest, non per tag: lo script rifiuta di procedere
se non lo sono, e rifiuta anche se un file di secret è assente o vuoto. Entrambi i
controlli servono a far fallire il deploy prima di iniziare, invece di lasciare lo
stack applicato a metà. I digest sono scritti dalla pipeline nel riepilogo del job
che pubblica su GHCR (`ghcr.io/subnetMusk/progetti_innovativi/{server,frontend,landing}`).

Dopo il deploy:

```bash
make stack-status     # servizi, repliche e task non in esecuzione
make stack-verify     # verifica end-to-end di uno stack già applicato
```

`fleet-bootstrap.service` parte da sola dopo il deploy e registra le policy Fleet,
riprovando finché Kibana non risponde. Non serve attenderla: gli agenti vengono
rischedulati finché il token che li riguarda non compare sul volume condiviso, quindi
lo stack converge da solo con un solo deploy. L'equivalente manuale è
`make fleet-bootstrap`.

Le dashboard si compongono a mano su Kibana, perché hanno bisogno di dati veri; ciò
che si versiona è il loro export. Per reimportarle, vedi
[terraform/elk/README.md](terraform/elk/README.md) e i target `dashboards-export`,
`dashboards-import` e `dashboards-list`.

Per applicare lo stack senza systemd, ad esempio durante una prova, il target
`make stack-deploy` invoca lo stesso script e legge la stessa configurazione.

## Verifica

```bash
make verify-fast   # formattazione, analisi statica, build, test, lint di compose e stack
make verify        # aggiunge Terraform, workflow, test di integrazione, copertura, segreti
```

I test di integrazione girano su MongoDB e Redis veri e stanno dietro il tag di
compilazione `integration`: senza, ogni esecuzione della suite dipenderebbe da due
servizi esterni e un guasto di ambiente sarebbe indistinguibile da una regressione.
`make go-test` esegue quindi i soli test unitari, `make go-test-integration` gli altri.

`make runtime-check` avvia gli artefatti costruiti e li interroga davvero, senza
richiedere uno stack Swarm.

## Backend: API

Le rotte sono dichiarate in una whitelist con validazione JSON Schema
(`server/middleware/validator.go`, schemi in `comms/server/public/`). Una rotta il
cui schema non esiste fa fallire l'avvio del server, di proposito: un contratto
mancante è un errore di build, non un degrado da scoprire in produzione.

| Metodo | Rotta | Auth | Quota | Descrizione |
|---|---|---|---|---|
| POST | `/auth/session` | no | dedicata | Crea sessione (cookie `session_token`), con prova di lavoro |
| GET | `/auth/validate` | sì | 600 | Verifica sessione |
| GET | `/game/position` | sì | 1200 | Posizione, scena corrente e checkpoint raggiunti |
| GET | `/game/timer` | sì | 1200 | Tempo di gioco accumulato |
| POST | `/game/ping` | sì | 1200 | Battito di gioco, valida spostamento e accumula tempo |
| POST | `/game/checkpoint` | sì | 1200 | Registra un traguardo raggiunto |
| POST | `/game/reset` | sì | 1200 | Azzera i progressi della sessione |
| GET | `/health` | no | 0 | Stato di server, Mongo e Redis |
| POST | `/log` | no | 0 | Ingest eventi dal frontend verso Elastic |

La quota è per sessione e non per indirizzo, sulla finestra di
`SESSION_QUOTA_WINDOW_MIN` minuti (10 per default): un indirizzo pubblico è condiviso
da tutti gli utenti dietro lo stesso NAT, quindi un limite per indirizzo
penalizzerebbe utenti estranei a chi lo supera. Superata la quota la risposta è
`429` con `Retry-After`.

L'autenticazione usa session token (cookie più cache Redis e Mongo), non JWT:
`JWT_SECRET` in `.env` è un residuo non usato.

## Logging e analytics

- Backend: log strutturati JSON secondo lo standard ECS su stdout, vedi
  `server/helpers/logger.go`.
- Frontend: eventi inviati a `POST /log` e ristampati dal backend come dataset
  `frontend.app`.
- Filebeat raccoglie i log dei container e li invia a Elasticsearch; Kibana e APM
  per dashboard e tracing.

## Documentazione

- [SETUP.md](SETUP.md), setup dell'ambiente di sviluppo e valori di riferimento
- [ENV_GUIDE.md](ENV_GUIDE.md), variabili d'ambiente
- [GAME_ARCHITECTURE.md](GAME_ARCHITECTURE.md), architettura e pattern del gioco
- [MONITORING_SETUP.md](MONITORING_SETUP.md), stack Elastic, gestione e fragilità note
- [RUNBOOK.md](RUNBOOK.md), intervento per sintomo durante l'esercizio
- [provisioning/README.md](provisioning/README.md), preparazione dell'host, sorveglianza,
  esportazione e ripristino dei dati
- [terraform/README.md](terraform/README.md), osservabilità come codice e stato Terraform
- [secrets/README.md](secrets/README.md), secret dello stack e credenziali di sviluppo
- [scripts/README.md](scripts/README.md), script di automazione preesistenti

> I PDF in `docs/` sono export datati di versioni precedenti di questi documenti e
> possono risultare disallineati.
