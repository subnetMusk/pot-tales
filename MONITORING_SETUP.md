# Monitoring Stack - Setup e Gestione

## Panoramica

Il sistema di monitoring è stato configurato per funzionare **indipendentemente** dall'applicazione principale, permettendo di:
- Avviare l'app senza monitoring (sviluppo veloce, risorse ridotte)
- Avviare il monitoring separatamente quando serve
- Fermare il monitoring mantenendo l'app attiva
- Condividere la stessa configurazione `.env`

## Architettura

### Due Docker Compose Separati

#### `docker-compose.dev.yml` - Applicazione Principale
Servizi core dell'applicazione:
- Traefik (reverse proxy)
- Server (Go backend API)
- MongoDB + Mongo Express
- Redis + Redis Commander
- Frontend (Vite production build)
- Sandbox (Vite dev server)

#### `docker-compose.monitoring.yml` - Stack Monitoring
Servizi di observability e monitoring:
- Elasticsearch (storage metrics/logs)
- Kibana (analytics dashboard)
- Fleet Server (agent management)
- APM Agent (application performance monitoring)
- Infrastructure Agent (system metrics)
- Filebeat (raccolta dei log dei container Docker -> Elasticsearch)

### Reti Condivise

Entrambi i compose condividono le reti:
- `internal_net` - Comunicazione sicura interna
- `proxy_net` - Accesso via Traefik

Il monitoring aggiunge:
- `kibana_net` - Accesso internet per Kibana (integrazioni)

## Fragilità note e debito tecnico (ELK)

Lo stack ELK funziona ma ha alcuni punti fragili da conoscere **prima** di metterci mano. Sono elencati qui per evitare di "romperlo per sbaglio".

1. **Race sui certificati all'avvio.** In `docker-compose.monitoring.yml` il servizio `es01` dipende da `setup` con `condition: service_started` (non `service_healthy`/`service_completed_successfully`). Questo perché `setup` resta in attesa che ES sia raggiungibile per impostare la password di `kibana_system`, mentre ES a sua volta dipende da `setup`: usare `service_completed_successfully` creerebbe un **deadlock**. Il prezzo è una possibile race in cui `es01` parte prima che i certificati siano scritti. Pattern corretto di riferimento: la compose ufficiale Elastic con `setup` che diventa *healthy* quando i certificati esistono (`[ -f config/certs/es01/es01.crt ]`) ed `es01` che dipende da `setup: service_healthy`. **Da rivedere con calma**, testando, prima di toccare le `depends_on`.

2. **Token di enrollment Fleet hardcoded e identici.** In `.env` `FLEET_ENROLLMENT_TOKEN`, `FLEET_ENROLLMENT_TOKEN_APM` e `FLEET_ENROLLMENT_TOKEN_INFRA` hanno lo **stesso valore placeholder**. I token reali sono per-policy: generarli con il modulo [terraform/elk](terraform/elk/README.md) (`terraform output`) o da Kibana (Fleet -> Enrollment tokens), e copiarli nel `.env`.

3. **Standalone vs Fleet (RISOLTO).** La config standalone (`elastic-agent.yml` + `ELASTIC_AGENT_STANDALONE`) è stata rimossa: gli agent sono gestiti da Fleet (`FLEET_ENROLL=1`). Resta aperto il tema dei token di enrollment (punto 2).

4. **`kibana.yml` ripulito.** Il file puntava a `http://elasticsearch:9200` (host inesistente, senza TLS) e definiva una `encryptionKey` diversa da `KIBANA_ENCRYPTION_KEY`: configurazione contraddittoria che reggeva solo perché le env del compose prevalgono. Ora `kibana.yml` contiene **solo** ciò che non è già passato via env (server, apm, fleet); connessione ES ed encryption key arrivano dal compose.

5. **Filebeat usa il superuser `elastic`.** `filebeat.yml` si autentica con `ELASTICSEARCH_USERNAME/PASSWORD` (l'utente `elastic`). Il modulo [terraform/elk](terraform/elk/README.md) crea l'utente dedicato `filebeat_writer` con soli privilegi di scrittura sugli indici dei log: usarlo in produzione.

6. **Segreti in chiaro.** L'unico `.env` in root contiene password e token in chiaro (ELASTIC/KIBANA/APM). I vecchi backup che li duplicavano sono stati rimossi dal versionamento; resta consigliata la **rotazione** delle credenziali e, a regime, l'uso di un secret manager.

## Utilizzo

### Avvio Servizi

#### Scenario 1: Solo Applicazione (Sviluppo Veloce)
```bash
# Avvia solo i servizi applicativi
docker compose -f docker-compose.dev.yml up -d

# Vantaggi:
# - Startup veloce (~30-60 secondi)
# - Basso consumo risorse
# - APM disabilitato ma app funziona normalmente
```

#### Scenario 2: Applicazione + Monitoring (Sviluppo Completo)
```bash
# 1. Avvia prima l'applicazione (crea le reti)
docker compose -f docker-compose.dev.yml up -d

# 2. Avvia il monitoring
./scripts/start-monitoring.sh

# Vantaggi:
# - Telemetria completa dell'applicazione
# - Dashboard Kibana per analytics
# - APM tracking delle performance
# - Log aggregation in tempo reale
```

### Stop Servizi

#### Stop Solo Monitoring (Mantieni App Attiva)
```bash
./scripts/stop-monitoring.sh

# Risultato:
# Monitoring stack fermato
# App continua a funzionare
# Dati Elasticsearch preservati (volumi Docker)
```

#### Stop Solo Applicazione (Mantieni Monitoring)
```bash
docker compose -f docker-compose.dev.yml down

# Nota: Raramente usato, normalmente si ferma monitoring prima
```

#### Stop Completo
```bash
# Ferma monitoring
./scripts/stop-monitoring.sh

# Ferma applicazione
docker compose -f docker-compose.dev.yml down
```

## Configurazione

### File .env Condiviso

Entrambi i compose leggono dall'unico file `.env` in root.

#### Variabili Aggiunte per Monitoring

Le seguenti variabili sono state aggiunte al file `.env`:

```bash
################################################################################
# ELASTICSEARCH CLUSTER
################################################################################
STACK_VERSION=8.19.19                          # Versione Elastic Stack (linea 8.x)
ES_IMAGE_DIGEST=sha256:...                     # digest delle 4 immagini Elastic,
KIBANA_IMAGE_DIGEST=sha256:...                 # da riallineare a ogni cambio di
ELASTIC_AGENT_IMAGE_DIGEST=sha256:...          # STACK_VERSION (valori in .env.example)
FILEBEAT_IMAGE_DIGEST=sha256:...
CLUSTER_NAME=docker-cluster                    # Nome cluster ES
ES_MEM_LIMIT=1073741824                        # Limite memoria ES (1GB)

################################################################################
# SECURITY
################################################################################
ELASTIC_PASSWORD=<generato da provisioning/bin/generate-secrets.sh>         # Password elastic user
KIBANA_PASSWORD=<generato da provisioning/bin/generate-secrets.sh>          # Password kibana_system user
KIBANA_ENCRYPTION_KEY=<generato da provisioning/bin/generate-secrets.sh>     # Chiave encryption Kibana

################################################################################
# KIBANA
################################################################################
KIBANA_MEM_LIMIT=1073741824                    # Limite memoria Kibana (1GB)

################################################################################
# FLEET & AGENTS
################################################################################
FLEET_ENROLLMENT_TOKEN_APM=456ed72a-c343...   # Token enrollment APM Agent
FLEET_ENROLLMENT_TOKEN_INFRA=456ed72a-c343... # Token enrollment Infra Agent
```

### Volumi Persistenti

Il monitoring mantiene dati persistenti in:
- `certs` - Certificati TLS Elasticsearch
- `esdata01` - Indici e dati Elasticsearch
- `kibanadata` - Dashboard e configurazioni Kibana
- `fleetserverdata` - Configurazioni Fleet Server

**Nota**: Questi volumi NON vengono cancellati con `docker compose down`

## Accesso ai Servizi

### Dopo Avvio Completo

#### Via Traefik (sottodomini *.localhost)
- **Kibana Dashboard**: `http://kibana.localhost`
- **APM Server**: `http://apm.localhost`
- **Mongo Express**: `http://mongo-ui.localhost`
- **Redis Commander**: `http://redis-ui.localhost`

#### Porte Dirette (Localhost)
- **Dashboard Traefik**: `http://localhost:8080` (solo dev)
- **App Frontend**: `http://localhost` (via proxy)
- **Sandbox Dev Server**: `http://sandbox.localhost`

#### Servizi Interni (Solo Container Network)
- **Elasticsearch**: `https://es01:9200`
- **MongoDB**: `mongodb://db:27017`
- **Redis**: `redis://redis:6379`
- **Backend API**: `http://server:3000`

## Monitoring e Debug

### Verificare Stato Servizi

#### Applicazione
```bash
docker compose -f docker-compose.dev.yml ps
```

#### Monitoring
```bash
docker compose -f docker-compose.monitoring.yml ps
```

#### Tutti i Container
```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

### Log dei Servizi

#### Applicazione
```bash
# Backend API
docker logs server -f --tail 50

# Frontend build
docker logs frontend -f --tail 50

# MongoDB
docker logs db -f --tail 50
```

#### Monitoring
```bash
# Elasticsearch
docker logs es01 -f --tail 50

# Kibana
docker logs kibana -f --tail 50

# APM Agent
docker logs apm-agent -f --tail 50

# Filebeat (raccolta log container)
docker logs filebeat -f --tail 50
```

### Health Check

#### Elasticsearch
```bash
curl -u "elastic:$ELASTIC_PASSWORD" \
  --cacert docker/volumes/certs/ca/ca.crt \
  https://localhost:9200/_cluster/health
```

#### Kibana
```bash
curl -I http://localhost:5601/api/status
```

## Performance e Risorse

### Consumo Risorse Stimato

#### Solo Applicazione
- **CPU**: ~15-20% (MacBook Air M1)
- **RAM**: ~1.5-2GB
- **Startup**: ~30-60 secondi

#### Applicazione + Monitoring
- **CPU**: ~35-45% (MacBook Air M1)
- **RAM**: ~4-5GB
- **Startup**: ~3-5 minuti (primo avvio con setup certificati)

### Ottimizzazione Risorse

Per ridurre consumo risorse in sviluppo:

```bash
# Usa solo app senza monitoring
docker compose -f docker-compose.dev.yml up -d

# Quando serve analytics, avvia monitoring
./scripts/start-monitoring.sh

# Finito debugging, ferma monitoring
./scripts/stop-monitoring.sh
```

## Troubleshooting

### Problema: Monitoring non parte

**Errore**: `external network internal_net not found`

**Soluzione**:
```bash
# Devi avviare prima l'applicazione che crea le reti
docker compose -f docker-compose.dev.yml up -d

# Poi avvia monitoring
./scripts/start-monitoring.sh
```

---

### Problema: Elasticsearch non diventa healthy

**Sintomi**: Timeout dopo 5 minuti, container in stato `starting`

**Debug**:
```bash
# Controlla log Elasticsearch
docker logs es01 --tail 100

# Verifica memoria disponibile
docker stats es01
```

**Soluzioni**:
- Aumenta `ES_MEM_LIMIT` in `.env` se hai più RAM
- Riduci `ELASTICSEARCH_JAVA_OPTS` a `-Xms256m -Xmx256m` per macchine con poca RAM
- Assicurati che Docker abbia almeno 4GB RAM allocati

---

### Problema: Kibana non si connette a Elasticsearch

**Errore**: `Unable to retrieve version information from Elasticsearch`

**Debug**:
```bash
# Verifica che ES sia healthy
docker ps | grep es01

# Testa connessione
docker exec kibana curl -k https://es01:9200
```

**Soluzioni**:
- Verifica che `ELASTIC_PASSWORD` e `KIBANA_PASSWORD` siano corretti in `.env`
- Riavvia Kibana: `docker restart kibana`

---

### Problema: Volumi persistenti pieni

**Sintomi**: Elasticsearch si blocca, errori di disco

**Debug**:
```bash
# Controlla dimensione volumi
docker system df -v
```

**Soluzione**:
```bash
# Pulizia indici vecchi (da Kibana Dev Tools)
DELETE /logs-*-2024.01.*

# Oppure pulizia completa (ATTENZIONE: cancella tutti i dati)
./scripts/stop-monitoring.sh
docker volume rm progetti_innovativi_esdata01
./scripts/start-monitoring.sh
```

## Best Practices

### Sviluppo Quotidiano

1. **Inizio giornata**:
   ```bash
   docker compose -f docker-compose.dev.yml up -d
   ```

2. **Quando serve debugging/analytics**:
   ```bash
   ./scripts/start-monitoring.sh
   ```

3. **Fine giornata**:
   ```bash
   ./scripts/stop-monitoring.sh
   docker compose -f docker-compose.dev.yml down
   ```

### Testing Performance

1. **Avvia tutto**:
   ```bash
   docker compose -f docker-compose.dev.yml up -d
   ./scripts/start-monitoring.sh
   ```

2. **Esegui test con carico**
3. **Analizza in Kibana**: `http://kibana.localhost`
4. **Stop monitoring** quando finito

### Prima di Commit

```bash
# Verifica che tutto funzioni
docker compose -f docker-compose.dev.yml up -d
./scripts/start-monitoring.sh

# Testa app
curl http://localhost/health

# Verifica monitoring
curl http://localhost:5601/api/status

# Cleanup
./scripts/stop-monitoring.sh
docker compose -f docker-compose.dev.yml down
```

## Link Utili

- [ENV_GUIDE.md](ENV_GUIDE.md) - Guida variabili environment
- [scripts/README.md](scripts/README.md) - Documentazione script
- [GAME_ARCHITECTURE.md](GAME_ARCHITECTURE.md) - Architettura completa
- [Elastic Stack Docs](https://www.elastic.co/guide/index.html) - Documentazione ufficiale
