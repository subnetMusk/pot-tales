#!/usr/bin/env bash
set -euo pipefail

echo "🗑️ Rimuovo node_modules e lockfile in tutte le cartelle del progetto…"
rm -rf server/dist
rm -rf server/node_modules server/package-lock.json
rm -rf client/node_modules client/package-lock.json
rm -rf sandbox/node_modules sandbox/package-lock.json

echo "📦 Reinstallo le dipendenze in locale…"
(cd server && npm install)
(cd client && npm install)
(cd sandbox && npm install)

echo "🛑 Arresto e rimozione di container, network e volumi anonimi…"
docker compose -f docker-compose.dev.yml down --volumes --remove-orphans

echo "🗑️  Pulizia delle risorse inutilizzate (immagini, volumi, reti)…"
docker system prune -af --volumes

echo "🧹 Pulizia cache builder Docker…"
docker builder prune --all --force

echo "🔨 Ricostruzione delle immagini senza cache (DEV)…"
docker compose -f docker-compose.dev.yml build --no-cache

echo "🚀 Avvio dei servizi in background (DEV)…"
docker compose -f docker-compose.dev.yml up
