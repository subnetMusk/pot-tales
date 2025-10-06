#!/usr/bin/env bash
# Full "clean-slate" rebuild for development.
# Uses the new centralized cleanup script and rebuilds everything from scratch.env bash
###############################################################################
# scripts/dev-reinstall.sh
# Full "clean-slate" rebuild for development.
# Every run simulates the very first execution on a brand-new machine:
#   1. Wipe JS artefacts (dist, node_modules, lockfiles)
#   2. Re-install JS dependencies
#   3. Fetch / update Go modules inside a disposable container (respecting private repo)
#   4. Build static bundles
#   5. Purge all Docker data (containers, images, cache)
#   6. Rebuild every image from scratch and start the stack
#
# NOTA IMPORTANTE: La cartella docker/ viene preservata per sicurezza.
# Prima di eseguire questo script, è consigliato effettuare un backup completo della cartella.
###############################################################################
set -euo pipefailbash
# Full "clean-slate" rebuild for development.
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

# Verifica se è stato effettuato un backup della cartella docker/
echo -e "\033[1;33m⚠️  ATTENZIONE: Protezione Cartella docker/\033[0m"
echo -e "La cartella \033[1mdocker/\033[0m contiene dati importanti che non verranno eliminati."
echo -e "Prima di procedere, è \033[1;31mFORTEMENTE RACCOMANDATO\033[0m effettuare un backup completo."
echo ""
echo -e "Comando consigliato per il backup:"
echo -e "\033[1;32mcp -a docker/ /percorso/backup/docker_backup_$(date +%Y%m%d)/\033[0m"
echo ""

read -p "Hai effettuato un backup della cartella docker/? (s/n): " backup_confirm
if [[ "$backup_confirm" != "s" && "$backup_confirm" != "S" ]]; then
    echo -e "\033[1;31m❌ Operazione annullata. Effettua prima un backup.\033[0m"
    exit 1
fi

echo ""
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
