#!/usr/bin/env bash
set -euo pipefail

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

echo "🛑 Arresto e rimozione di container, network e volumi anonimi…"
docker compose -f docker-compose.prod.yml down --volumes --remove-orphans

echo "🗑️  Pulizia delle risorse inutilizzate (immagini, volumi, reti)…"
docker system prune -af --volumes

echo "🧹 Pulizia cache builder Docker…"
docker builder prune --all --force

echo "🔨 Ricostruzione delle immagini senza cache (PROD)…"
docker compose -f docker-compose.prod.yml build --no-cache

echo "🚀 Avvio dei servizi in background (PROD)…"
docker compose -f docker-compose.prod.yml up
