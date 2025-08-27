# !/usr/bin/env bash
set -euo pipefail

# echo "📦 Reinstalling frontend dependencies…"
# (cd frontend && npm install)

echo "⚙️ Building frontend (Vite)…"
(cd frontend && npm run build)

echo "✅ frontend build complete. The proxy will now serve the updated files from ./frontend/dist."