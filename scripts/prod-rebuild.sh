#!/usr/bin/env bash
###############################################################################
# scripts/prod-rebuild.sh
# Ricostruzione dell'ambiente di produzione
#
# NOTA IMPORTANTE: La cartella docker/ viene preservata per sicurezza.
# Prima di eseguire questo script, è NECESSARIO effettuare un backup completo della cartella.
###############################################################################
set -euo pipefail

# Colori per output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}⚠️  IMPORTANTE - PROTEZIONE DIRECTORY DOCKER/${NC}"
echo -e "${YELLOW}La directory docker/ non verrà mai modificata dagli script di pulizia${NC}"
echo -e "${YELLOW}Prima di qualsiasi reinstallazione completa, effettua un backup di docker/${NC}"
echo -e "${GREEN}Comando consigliato per il backup:${NC}"
echo -e "${GREEN}cp -a docker/ /percorso/backup/docker_backup_$(date +%Y%m%d)/${NC}\n"

read -p "Hai effettuato un backup della cartella docker/? (s/n): " backup_confirm
if [[ "$backup_confirm" != "s" && "$backup_confirm" != "S" ]]; then
    echo -e "${RED}❌ Operazione annullata. Effettua prima un backup.${NC}"
    exit 1
fi

echo "🗑️ Rimuovo node_modules e lockfile in tutte le cartelle del progetto…"
rm -rf server/dist
rm -rf server/node_modules server/package-lock.json
rm -rf frontend/dist frontend/node_modules frontend/package-lock.json
rm -rf sandbox/node_modules sandbox/package-lock.json

echo "📦 Reinstallo le dipendenze in locale…"
(cd server && npm install)
(cd frontend && npm install)
(cd sandbox && npm install)

echo "⚙️ Build del frontend per la produzione…"
(cd frontend && npm run build)

echo "🛑 Arresto e rimozione di container e network (preservando volumi)…"
docker compose -f docker-compose.prod.yml down --remove-orphans

echo "🗑️  Pulizia delle risorse inutilizzate (immagini e reti, preservando volumi)…"
docker system prune -af

echo "🧹 Pulizia cache builder Docker…"
docker builder prune --all --force

echo "🔨 Ricostruzione delle immagini senza cache (PROD)…"
docker compose -f docker-compose.prod.yml build --no-cache

echo "🚀 Avvio dei servizi in background (PROD)…"
docker compose -f docker-compose.prod.yml up
