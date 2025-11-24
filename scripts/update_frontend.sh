#!/usr/bin/env bash
set -euo pipefail

# echo "📦 Reinstalling frontend dependencies…"
# (cd frontend && npm install)

echo "⚙️ Building frontend (Vite)…"
(cd frontend && npm run build)

# Questo passaggio è necessario per correggere i path degli asset nei file JSON generati da Phaser,
# che non tengono conto del fatto che in produzione gli asset non sono serviti dalla cartella "public".
# Questo passaggio viene svolto qui per evitare di dover modificare la copia locale dei file di sviluppo, che renderebbe inutilizzabile il phaser editor.
echo "🔧 Adjusting asset paths for production…"
find frontend/dist/assets -type f -name "*.json" -exec perl -pi -e 's|frontend/public/||g' {} +

echo "✅ frontend build complete. The proxy will now serve the updated files from ./frontend/dist."