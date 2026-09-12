#!/usr/bin/env sh
set -eu

# Questi frammenti vengono inseriti nella SPA e i loro script vengono ricreati
# dal loader. In produzione la CSP ammette soltanto script same-origin: un
# blocco inline qui renderebbe la pagina visibile ma non interattiva.
pages='homePage consent privacy accessibility desktopOnly'

for page in $pages; do
  html="frontend/public/static/pages/$page.html"
  script="frontend/public/static/pages/$page.js"

  if grep -nE '<script([[:space:]>])' "$html" | grep -vF 'src="/static/pages/' >/dev/null; then
    echo "script inline non compatibile con la CSP: $html" >&2
    exit 1
  fi

  expected="<script src=\"/static/pages/$page.js\"></script>"
  if ! grep -Fxq "$expected" "$html"; then
    echo "riferimento allo script esterno mancante o inatteso: $html" >&2
    exit 1
  fi

  if [ ! -s "$script" ]; then
    echo "script esterno mancante o vuoto: $script" >&2
    exit 1
  fi
done

echo "pagine statiche compatibili con script-src 'self': OK"
