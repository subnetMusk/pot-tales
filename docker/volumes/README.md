# Configurazioni e volumi Docker

Questa cartella (`docker/`) raccoglie le configurazioni versionate dei servizi e
i punti di mount dei dati persistenti. I dati runtime NON sono versionati (vedi
`.gitignore`); qui sta solo la configurazione.

## Config versionate

| Percorso | Servizio | Contenuto |
|---|---|---|
| `traefik/traefik.yml` | Traefik | Config statica del reverse proxy (entrypoint, provider docker). Il routing e' via label nei compose. |
| `redis/redis.conf`, `redis/users.acl` | Redis | Config server e ACL (utenti `app` RW, `frontend` RO). |
| `volumes/kibana/config/kibana.yml` | Kibana | Solo impostazioni non passate via env (server, apm, fleet). Connessione ES ed encryption key arrivano dal compose. |
| `volumes/filebeat/filebeat.yml` | Filebeat | Raccolta log dei container Docker -> Elasticsearch. |
| `env/` | — | Vuota. Le variabili sono centralizzate nell'unico `.env` in root. |

## Dati runtime (non versionati)

Bind mount (dev, `docker-compose.dev.yml`):

| Percorso | Servizio |
|---|---|
| `volumes/mongodb/` | Dati MongoDB |
| `volumes/logs/mongodb/` | Log MongoDB |

Named volume Docker (monitoring, `docker-compose.monitoring.yml`):

| Volume | Servizio |
|---|---|
| `certs` | Certificati TLS generati dal servizio `setup` |
| `esdata01` | Indici e dati Elasticsearch |
| `kibanadata` | Saved object / stato Kibana |
| `fleetserverdata` | Stato enrollment Fleet Server |

Cartelle runtime residue come `volumes/logs/esdata/` e `volumes/kibana/data/`
sono ignorate da git e possono essere svuotate; lo stato reale dell'ELK vive nei
named volume qui sopra.

## Rimosso

- `volumes/npm_data/`, `volumes/npm_letsencrypt/` — NGINX Proxy Manager sostituito da Traefik.
- `volumes/fluent-bit/`, `volumes/fluent-bit-db/` — log shipping ora via Filebeat.
- `volumes/elastic-agent/elastic-agent.yml` — modalita' standalone; gli agent sono gestiti da Fleet.
