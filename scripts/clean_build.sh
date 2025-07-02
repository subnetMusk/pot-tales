#!/usr/bin/env bash
set -euo pipefail

echo "🗑️ Rimuovo node_modules e dist in tutte le cartelle del progetto…"
rm -rf server/dist
rm -rf client/dist
rm -rf sandbox/dist

rm -rf server/node_modules
rm -rf client/node_modules
rm -rf sandbox/node_modules


echo "🛑 Arresto e rimozione di container, network e volumi anonimi…"
docker compose down --volumes --remove-orphans

echo "🗑️  Pulizia delle risorse inutilizzate (immagini, volumi, reti)…"
docker system prune -af --volumes

echo "🧹 Pulizia cache builder Docker…"
docker builder prune --all --force