# Environment Configuration Guide

This project uses a single root `.env` at runtime and a committed `.env.example`
as the safe template.

## File Structure

- **`.env.example`** - Template versionato, senza segreti reali.
- **`.env`** - File locale non versionato. Docker Compose lo usa sia per la
  sostituzione delle `${VAR}` nei file compose sia come `env_file` iniettato nei
  container.
- **`secrets/*.enc.env`** - File cifrati con SOPS/age per ambienti condivisi o
  produzione.

In passato esistevano copie duplicate (`docker/env/.env`, `sandbox/.env`): sono
state consolidate nella root.

## Variable Categories

### Backend Services
- **PORT, MONGO_URI, JWT_SECRET** - Core API configuration
- **SESSION_TTL_MIN, SCHEMA_DIR_SERVER** - Session and validation settings

### Redis Configuration
- **REDIS_APP_PASS, REDIS_URL** - Backend service credentials (full access)
- **REDIS_FE_PASS, REDIS_FE_URL** - Frontend service credentials (read-only)
- **REDIS_UI_HOSTS** - Redis Commander web interface configuration

### Elasticsearch Stack
- **ELASTICSEARCH_HOST, ELASTICSEARCH_HOSTS** - Connection endpoints
- **ELASTICSEARCH_USERNAME, ELASTICSEARCH_PASSWORD** - Authentication
- **ELASTICSEARCH_JAVA_OPTS** - JVM performance settings

### Kibana Analytics
- **KIBANA_PORT, KIBANA_URL, KIBANA_HOST** - Web interface and service URLs
- **KIBANA_INDEX_PATTERN** - Default log data pattern

### APM Monitoring
- **APM_SECRET_TOKEN** - Agent authentication
- **APM_SERVER_URL, APM_SERVER_INTERNAL_URL** - Service endpoints
- **ELASTIC_APM_SERVER_URL, ELASTIC_APM_SERVICE_NAME** - Application instrumentation

### Security Accounts
- **KIBANA_SYSTEM_USERNAME/PASSWORD** - Kibana system account
- **KIBANA_UI_USERNAME/PASSWORD** - Web interface access
- **APM_USERNAME/PASSWORD** - APM data ingestion account

## Usage

Per lo sviluppo locale:

```bash
cp .env.example .env
```

Poi compila i valori mancanti. Tutti i servizi Docker Compose caricano le
variabili dall'unico `.env` in root (via sostituzione `${VAR}` e `env_file`).

Per valori condivisi o di produzione:

```bash
cp .sops.yaml.example .sops.yaml
# sostituisci il recipient age placeholder
sops --encrypt .env > secrets/prod.enc.env
sops --decrypt secrets/prod.enc.env > .env
```

## Persistent Configuration

All critical configurations and data are persisted to local directories in `docker/volumes/`:

### Configuration Files (Always Preserved)
- **Kibana**: `docker/volumes/kibana/config/kibana.yml` - Dashboard and analytics settings
- **Redis**: `docker/redis/redis.conf` and `docker/redis/users.acl` - Cache and ACL settings
- **Filebeat**: `docker/volumes/filebeat/` - Raccolta log dei container Docker

### Data Directories (Always Preserved)
- **Kibana Data**: `docker/volumes/kibana/data/` - Dashboards, visualizations, Fleet settings
- **Elasticsearch**: `docker/volumes/logs/esdata/` - Search indices, Fleet policies, APM data
- **MongoDB**: `docker/volumes/mongodb/` - Application database
- **Traefik**: `docker/traefik/traefik.yml` - Config reverse proxy (routing dichiarativo via label)

### Scripts
- **Configuration Check**: `./scripts/check-persistent-config.sh` - Verifies all persistent data integrity
- **Clean Reinstall**: `./scripts/dev-reinstall.sh` - Rebuilds containers while preserving configurations

## Security Notes

- Change all default passwords before production deployment
- Keep `.env` out of git
- Use SOPS/age for shared and production secrets
- Rotate APM tokens and authentication credentials regularly
