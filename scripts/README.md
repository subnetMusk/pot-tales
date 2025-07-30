# Scripts Directory

This directory contains utility scripts for managing the Docker Compose development environment.

## Available Scripts

### `dev-reinstall.sh`
**Full development environment reinstall from scratch**
- Cleans JavaScript artifacts (dist, node_modules, lockfiles)
- Reinstalls all JS dependencies
- Updates Go modules in isolated container
- Builds frontend bundles
- Removes Docker containers and images
- **Preserves all persistent configurations and data**
- Rebuilds and starts the entire stack

**Usage:** `./scripts/dev-reinstall.sh`

**What's Preserved:**
- Kibana dashboards and Fleet configurations
- Elasticsearch indices and APM data  
- MongoDB application data
- NGINX Proxy Manager settings and SSL certificates
- Redis ACL configurations

### `check-persistent-config.sh`
**Verifies persistent data integrity**
- Checks all critical configuration files exist
- Reports on persistent data directory contents
- Validates environment variable synchronization
- Verifies Docker Compose configuration validity

**Usage:** `./scripts/check-persistent-config.sh`

### `dev-rebuild.sh`
**Quick rebuild without cleaning dependencies**
- Rebuilds Docker images only
- Faster than full reinstall
- Use when only Docker configuration changes

### `clean_build.sh`
**Build cleanup utility**
- Removes build artifacts
- Cleans temporary files

### `update_frontend.sh` / `update_sandbox.sh`
**Individual service updates**
- Updates specific frontend services
- Rebuilds only affected containers

## Important Notes

⚠️ **Data Persistence**: The `dev-reinstall.sh` script is designed to preserve all manual configurations made through Kibana, Fleet, NGINX Proxy Manager, and other UIs. These configurations are automatically saved to local directories in `docker/volumes/`.

🔧 **Configuration Sync**: Always ensure both `.env` files (root and `docker/env/.env`) remain synchronized.

🚀 **Quick Start**: For new developers, run `./scripts/check-persistent-config.sh` first to verify the environment, then `./scripts/dev-reinstall.sh` for a complete setup.
