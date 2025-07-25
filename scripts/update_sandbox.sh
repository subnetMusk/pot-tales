#!/usr/bin/env bash
# update_sandbox_assets.sh
# Syncs Vite-built asset links from frontend/dist/index.html to sandbox/index.html

set -euo pipefail

echo "⚙️ Building frontend (Vite)…"
(cd frontend && npm run build)

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