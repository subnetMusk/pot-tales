#!/usr/bin/env bash
# update_sandbox_assets.sh
# Syncs Vite-built asset links from frontend/dist/index.html to sandbox/index.html

set -euo pipefail

echo "⚙️ Building frontend (Vite)…"
(cd frontend && npm run build)


# Questo passaggio è necessario per correggere i path degli asset nei file JSON generati da Phaser,
# che non tengono conto del fatto che in produzione gli asset non sono serviti dalla cartella "public".
# Questo passaggio viene svolto qui per evitare di dover modificare la copia locale dei file di sviluppo, che renderebbe inutilizzabile il phaser editor.
echo "🔧 Adjusting asset paths for production…"
find frontend/dist/assets -type f -name "*.json" -exec sed -i 's|frontend/public/||g' {} +

echo "⚙️ Building sandbox (Vite)…"
(cd sandbox && npm run build)

FRONTEND_DIST="frontend/dist/index.html"
SANDBOX_HTML="sandbox/dist/index.html"

# Extract asset tags from frontend/dist/index.html
STYLE_TAG=$(grep -o '<link rel="stylesheet"[^>]*>' "$FRONTEND_DIST" | grep '/assets/' | head -n1)
SCRIPT_TAG=$(grep -o '<script type="module"[^>]*></script>' "$FRONTEND_DIST" | grep '/assets/' | head -n1)

TMP_FILE=$(mktemp)

awk -v style="$STYLE_TAG" -v script="$SCRIPT_TAG" '
  /VITE_ASSETS/ { print "\t" style "\n\t" script; next }
  { print }
' "$SANDBOX_HTML" > "$TMP_FILE"

mv "$TMP_FILE" "$SANDBOX_HTML"

echo "✅ sandbox/index.html updated with latest Vite asset links."