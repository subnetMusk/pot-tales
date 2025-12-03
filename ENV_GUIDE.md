# Environment Configuration Guide

This project uses centralized environment variable configuration through `.env` files.

## File Structure

- **`.env`** (root directory) - Main environment file loaded by Docker Compose
- **`docker/env/.env`** - Identical copy for services that explicitly reference this path

Both files contain identical content and should be kept in sync.

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

All Docker Compose services automatically load variables from the root `.env` file.
Some services may explicitly reference `docker/env/.env` through `env_file` directives.

## Persistent Configuration

All critical configurations and data are persisted to local directories in `docker/volumes/`:

### Configuration Files (Always Preserved)
- **Kibana**: `docker/volumes/kibana/config/kibana.yml` - Dashboard and analytics settings
- **Elastic Agent**: `docker/volumes/elastic-agent/elastic-agent.yml` - Log collection configuration  
- **Redis**: `docker/redis/redis.conf` and `docker/redis/users.acl` - Cache and ACL settings
- **Fluent Bit**: `docker/volumes/fluent-bit/` - Log processing and parsing rules

### Data Directories (Always Preserved)
- **Kibana Data**: `docker/volumes/kibana/data/` - Dashboards, visualizations, Fleet settings
- **Elasticsearch**: `docker/volumes/logs/esdata/` - Search indices, Fleet policies, APM data
- **MongoDB**: `docker/volumes/mongodb/` - Application database
- **NGINX Proxy Manager**: `docker/volumes/npm_data/` - Reverse proxy configurations and SSL certificates

### Scripts
- **Configuration Check**: `./scripts/check-persistent-config.sh` - Verifies all persistent data integrity
- **Clean Reinstall**: `./scripts/dev-reinstall.sh` - Rebuilds containers while preserving configurations

## Security Notes

- Change all default passwords before production deployment
- Use Docker secrets for sensitive values in production
- Rotate APM tokens and authentication credentials regularly
