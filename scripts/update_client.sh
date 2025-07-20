# !V1
# !/usr/bin/env bash
set -euo pipefail

# echo "📦 Reinstalling client dependencies…"
# (cd client && npm install)

echo "⚙️ Building client (Vite)…"
(cd client && npm run build)

echo "✅ Client build complete. The proxy will now serve the updated files from ./client/dist."