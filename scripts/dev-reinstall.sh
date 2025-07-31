#!/# Full "clean-slate" rebuild for development.
# Uses the new centralized cleanup script and rebuilds everything from scratch.env bash
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
cd "$_ROOT"

# Configura GOPRIVATE per moduli privati
export GOPRIVATE=github.com/subnetMusk/progetti_innovativi/server

echo "� === DEV REINSTALL - Ricostruzione Completa Sviluppo ==="
echo ""

# 1. Pulizia completa usando il nuovo script centralizzato
echo "🧹 Esecuzione pulizia completa..."
./scripts/cleanup.sh --dev

# 2. Reinstallazione dipendenze JavaScript
echo ""
echo "📦 Reinstallazione dipendenze JavaScript..."

# Frontend
if [ -d "frontend" ]; then
    echo "   🔧 Frontend..."
    cd "$_ROOT/frontend"
    npm install
    npm run build
    cd "$_ROOT"
    echo "   ✅ Frontend build completato"
fi

# Sandbox  
if [ -d "sandbox" ]; then
    echo "   🔧 Sandbox..."
    cd "$_ROOT/sandbox"
    npm install
    npm run build
    cd "$_ROOT"
    echo "   ✅ Sandbox build completato"
fi

# 3. Aggiornamento moduli Go nel container
echo ""
echo "🐹 Aggiornamento moduli Go..."
if [ -d "server" ] && [ -f "server/go.mod" ]; then
    # Uso un container temporaneo per go mod tidy rispettando GOPRIVATE
    MSYS_NO_PATHCONV=1 docker run --rm \
        -e GOPRIVATE="$GOPRIVATE" \
        -v "$_ROOT/server":/go/src/app \
        -w /go/src/app \
        golang:1.22 sh -c '
            set -e
            echo "🔄 go get latest stable deps..."
            go get -u github.com/redis/go-redis/v9@latest \
                     github.com/santhosh-tekuri/jsonschema/v5@latest
            echo "🧹 go mod tidy..."
            go mod tidy
            echo "⬇️ go mod download (cache)..."
            go mod download
        '
    echo "   ✅ Moduli Go aggiornati"
else
    echo "   ⚠️  Directory server/go.mod non trovata"
fi

# 4. Ricostruzione stack Docker
echo ""
echo "🐳 Ricostruzione stack Docker..."

# Build da zero senza cache
echo "   🔨 Build immagini da zero..."
docker compose -f docker-compose.dev.yml build --no-cache --parallel

# 5. Avvio stack
echo ""
echo "🚀 Avvio stack di sviluppo..."
docker compose -f docker-compose.dev.yml up -d

echo "✅ Dev reinstall terminato."
