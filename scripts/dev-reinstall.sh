#!/usr/bin/env bash
###############################################################################
# scripts/dev-reinstall.sh
# Full “clean-slate” rebuild for development.
# Every run simulates the very first execution on a brand-new machine:
#   1. Wipe JS artefacts (dist, node_modules, lockfiles)
#   2. Re-install JS dependencies
#   3. Fetch / update Go modules inside a disposable container (respecting private repo)
#   4. Build static bundles
#   5. Purge all Docker data (containers, images, volumes, cache)
#   6. Rebuild every image from scratch and start the stack
###############################################################################
set -euo pipefail

_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# 0 ────────────────────────────────────────────────────────────────────────────
# Configura GOPRIVATE per assicurare che i moduli del progetto privato
# non passino attraverso proxy.golang.org né sum.golang.org
export GOPRIVATE=github.com/subnetMusk/progetti_innovativi/server

# 1 ────────────────────────────────────────────────────────────────────────────
echo "🗑️  Removing JS artefacts…"
rm -rf "$_ROOT/frontend/dist"  "$_ROOT/sandbox/dist"
rm -rf "$_ROOT/frontend/node_modules"  "$_ROOT/frontend/package-lock.json"
rm -rf "$_ROOT/sandbox/node_modules"   "$_ROOT/sandbox/package-lock.json"
# Il progetto Go non produce una cartella dist in locale, quindi la rimozione è opzionale:
rm -rf "$_ROOT/server/dist" || true

# 2 ────────────────────────────────────────────────────────────────────────────
echo "📦 Installing JS dependencies…"
( cd "$_ROOT/frontend" && npm install )
( cd "$_ROOT/sandbox"  && npm install )

# 3 ────────────────────────────────────────────────────────────────────────────
# Dentro un container Golang usa GOPRIVATE per rispettare il modulo privato
echo "⬇️  Downloading / updating Go modules (Docker)…"
MSYS_NO_PATHCONV=1 docker run --rm \
  -e GOPRIVATE=$GOPRIVATE \
  -v "$_ROOT/server":/go/src/app \
  -w /go/src/app \
  golang:1.22 sh -c '
    set -e
    echo "🔄  go get latest stable deps…"
    go get -u github.com/redis/go-redis/v9@latest \
             github.com/santhosh-tekuri/jsonschema/v5@latest
    echo "🧹  go mod tidy…"
    go mod tidy
    echo "⬇️  go mod download (cache)…"
    go mod download
  '

# 4 ────────────────────────────────────────────────────────────────────────────
echo "⚙️  Building front-end bundles…"
( cd "$_ROOT/frontend" && npm run build )
( cd "$_ROOT/sandbox"  && npm run build )

# 5 ────────────────────────────────────────────────────────────────────────────
echo "🛑  Halting and PURGING Docker resources…"
docker compose -f "$_ROOT/docker-compose.dev.yml" down --rmi all --volumes --remove-orphans
docker system prune -af --volumes
docker builder prune --all --force

# 6 ────────────────────────────────────────────────────────────────────────────
echo "🔨  Rebuilding images from scratch…"
docker compose -f "$_ROOT/docker-compose.dev.yml" build --no-cache

echo "🚀  Starting services (DEV)…"
docker compose -f "$_ROOT/docker-compose.dev.yml" up -d
