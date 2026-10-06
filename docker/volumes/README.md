# Configurazioni e volumi Docker

Configurazioni dei servizi e mount dei dati di sviluppo in `docker/`.
I dati runtime sono esclusi da Git tramite `.gitignore`.

## Config versionate

| Percorso | Servizio | Contenuto |
|---|---|---|
| `traefik/traefik.yml` | Traefik | Config statica del reverse proxy (entrypoint, provider file). Il routing sta in `traefik/dynamic/`. |
| `redis/redis.conf`, `redis/users.acl` | Redis | Config server e ACL (utenti `app` RW, `frontend` RO). |
| `volumes/kibana/config/kibana.yml` | Kibana | Solo impostazioni non passate via env (server, apm, fleet). Connessione ES ed encryption key arrivano dal compose. |
| `volumes/filebeat/filebeat.yml` | Filebeat | Raccolta log dei container Docker -> Elasticsearch. |

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
