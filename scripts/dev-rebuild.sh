#!/usr/bin/env bash
###############################################################################
# scripts/dev-rebuild.sh
# Lightweight rebuild for development.
#
# Differenze rispetto alla full clean-slate:
#   • NON rimuove dist/, node_modules/, lockfile ecc.
#   • NON riscarica le dipendenze JS o Go.
#   • NON esegue prune aggressivi di Docker.
#   • Si limita a:
#       1. fermare (in modo pulito) lo stack dev,
#       2. ricostruire tutte le immagini a partire dai Dockerfile,
#       3. ripartire in background.
###############################################################################
set -euo pipefail

_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# (facoltativo) assicura che i moduli privati non passino dai proxy pubblici
export GOPRIVATE=github.com/subnetMusk/progetti_innovativi/server

# 1 ────────────────────────────────────────────────────────────────────────────
echo "🛑  Stopping dev stack…"
docker compose -f "$_ROOT/docker-compose.dev.yml" down --remove-orphans

# 2 ────────────────────────────────────────────────────────────────────────────
echo "🔨  Rebuilding images (no-cache)…"
docker compose -f "$_ROOT/docker-compose.dev.yml" build --no-cache

# 3 ────────────────────────────────────────────────────────────────────────────
echo "🚀  Starting services (DEV)…"
docker compose -f "$_ROOT/docker-compose.dev.yml" up -d --force-recreate

echo "✅  Rebuild complete."
