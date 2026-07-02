# Progetti Innovativi — Piattaforma Gioco HTML5

Gioco HTML5 singleplayer (Phaser 3 + TypeScript/Vite) con backend Go, persistenza
MongoDB/Redis e stack di osservabilità Elastic (Elasticsearch, Kibana, APM, Filebeat),
il tutto orchestrato con Docker Compose e Traefik come reverse proxy.

## Architettura

| Componente | Tecnologia | Ruolo |
|---|---|---|
| Frontend | Phaser 3, TypeScript, Vite | Gioco singleplayer, build statica servita da NGINX |
| Sandbox | Vite dev server | Ambiente di prototipazione meccaniche (solo dev) |
| Backend | Go (Gorilla Mux) | API sessioni, stato di gioco, ingest log; validazione via JSON Schema |
| Database | MongoDB | Profili, sessioni, stato di gioco |
| Cache | Redis (con ACL) | Sessioni e stato temporaneo |
| Proxy | Traefik v3 | Routing dichiarativo via file provider |
| Monitoring | Elasticsearch, Kibana, APM, Filebeat, Fleet | Log, metriche, tracing |

Lo stack è diviso in due Compose: `docker-compose.dev.yml` (applicazione) e
`docker-compose.monitoring.yml` (Elastic). Vedi [MONITORING_SETUP.md](MONITORING_SETUP.md).

> Nota: `docker-compose.prod.yml` è attualmente obsoleto (risale all'era Node).
> Va riallineato prima di un deploy reale — vedi l'avviso in testa al file.

## Requisiti

- Docker 20.10+ e Docker Compose 2.0+
- Node.js 18+ (per build/locali; il toolchain Vite 5 non gira su Node < 18)
- Almeno 4 GB di RAM per Elasticsearch

## Avvio sviluppo

```bash
# 1. Applicazione (crea anche le reti condivise)
docker compose -f docker-compose.dev.yml up -d

# 2. (opzionale) Monitoring Elastic
./scripts/start-monitoring.sh
```

Reinstallazione completa delle dipendenze e rebuild: `./scripts/dev-reinstall.sh`.

## Accesso ai servizi

| Servizio | URL |
|---|---|
| Frontend gioco | http://localhost |
| Dashboard Traefik (dev) | http://localhost:8080 |
| Kibana | http://kibana.localhost |
| APM | http://apm.localhost |
| Mongo Express | http://mongo-ui.localhost |
| Redis Commander | http://redis-ui.localhost |
| Sandbox (dev) | http://localhost/sandbox/ |

Setup completo e valori di sviluppo in [SETUP.md](SETUP.md); dettaglio variabili
in [ENV_GUIDE.md](ENV_GUIDE.md).

## Produzione

`docker-compose.prod.yml` e `./scripts/prod-rebuild.sh` esistono ma vanno
riallineati allo stack attuale (backend Go + Traefik) prima dell'uso.
Per la pulizia pre-deploy dei dati di sviluppo: `./scripts/cleanup.sh --production`
(con backup automatico). Dettagli in [scripts/README.md](scripts/README.md).

## Backend: API

Le rotte sono dichiarate in una whitelist con validazione JSON Schema
(`server/middleware/validator.go`, schemi in `comms/server/public/`):

| Metodo | Rotta | Auth | Descrizione |
|---|---|---|---|
| POST | `/auth/session` | no | Crea sessione (cookie `session_token`) |
| GET | `/auth/validate` | sì | Verifica sessione |
| GET | `/game/position` | sì | Stato posizione/scena |
| GET | `/game/timer` | sì | Tempo di gioco |
| GET | `/health` | no | Stato server/Mongo/Redis |
| POST | `/log` | no | Ingest eventi dal frontend -> Elastic |

L'autenticazione usa session token (cookie + cache Redis/Mongo), non JWT
(`JWT_SECRET` in `.env` è un residuo non usato).

## Logging e analytics

- Backend: log strutturati JSON (ECS-like) su stdout, vedi `server/helpers/logger.go`.
- Frontend: eventi inviati a `POST /log` e ristampati dal backend come dataset
  `frontend.app`.
- Filebeat raccoglie i log dei container e li invia a Elasticsearch (indici `filebeat-*`);
  Kibana e APM per dashboard e tracing.

## Documentazione

- [GAME_ARCHITECTURE.md](GAME_ARCHITECTURE.md) — architettura e pattern del gioco
- [MONITORING_SETUP.md](MONITORING_SETUP.md) — stack Elastic, gestione e fragilità note
- [ENV_GUIDE.md](ENV_GUIDE.md) — variabili d'ambiente
- [scripts/README.md](scripts/README.md) — script di automazione

> I PDF in `docs/` sono export datati delle versioni precedenti di questi documenti
> e possono risultare disallineati.
