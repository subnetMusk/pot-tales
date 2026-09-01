#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# echo "📦 Reinstalling frontend dependencies…"
# (cd frontend && npm install)

echo "⚙️ Building frontend (Vite)…"
(cd frontend && npm run build)

# Questo passaggio è necessario per correggere i path degli asset nei file JSON generati da Phaser,
# che non tengono conto del fatto che in produzione gli asset non sono serviti dalla cartella "public".
# Questo passaggio viene svolto qui per evitare di dover modificare la copia locale dei file di sviluppo, che renderebbe inutilizzabile il phaser editor.
echo "🔧 Adjusting asset paths for production…"
find frontend/dist/assets -type f -name "*.json" -exec perl -pi -e 's|frontend/public/||g' {} +

if command -v docker >/dev/null 2>&1; then
	if docker compose -f "$ROOT/docker-compose.dev.yml" ps --status running --services | grep -qx frontend; then
		echo "🔄 Copying updated build into the running frontend container…"
		docker cp frontend/dist/. frontend:/usr/share/nginx/html/
	else
		echo "🔄 Rebuilding the frontend image because the container is not running…"
		docker compose -f "$ROOT/docker-compose.dev.yml" up -d --build --no-deps --force-recreate frontend
	fi
fi

echo "✅ frontend build complete. The running frontend now serves the updated build."