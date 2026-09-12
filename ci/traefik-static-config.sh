#!/usr/bin/env bash
# Impedisce di mescolare i metodi di configurazione statica di Traefik.
#
# Traefik sceglie un solo metodo fra file, argomenti ed environment. Se nello
# stack ricompare `--configfile`, gli argomenti successivi possono essere
# ignorati silenziosamente: e' gia' successo alla directory ACME di prova e al
# middleware CrowdSec. La verifica lavora sulla forma interpolata dello stack,
# cioe' sullo stesso contenuto che Docker applica.
set -euo pipefail

repo_dir=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
stack_file="$repo_dir/deploy/stack.yml"
rendered=$(mktemp "${TMPDIR:-/tmp}/traefik-static.XXXXXX")
cleanup() { rm -f -- "$rendered"; }
trap cleanup EXIT

fake_digest=sha256:0000000000000000000000000000000000000000000000000000000000000000
export STACK_NAME=ci
export APP_HOST=example.invalid
export ACME_EMAIL=acme@example.invalid
export ACME_CA_SERVER=https://acme-staging-v02.api.letsencrypt.org/directory
export SERVER_IMAGE="example.invalid/server@$fake_digest"
export FRONTEND_IMAGE="example.invalid/frontend@$fake_digest"
export LANDING_IMAGE="example.invalid/landing@$fake_digest"

while IFS= read -r variable; do
  [ -n "$variable" ] || continue
  export "$variable=ci"
done < <(
  grep -oE '\$\{(CFG_REV|SEC_REV)_[A-Z0-9_]+' "$stack_file" |
    sed 's/^${//' |
    awk '!seen[$0]++'
)

(
  cd "$repo_dir/deploy"
  docker stack config -c stack.yml
) > "$rendered"

require() {
  grep -Fq -- "$1" "$rendered" || {
    printf 'configurazione Traefik mancante nello stack renderizzato: %s\n' "$1" >&2
    exit 1
  }
}

reject() {
  if grep -Fq -- "$1" "$rendered"; then
    printf 'configurazione Traefik vietata nello stack renderizzato: %s\n' "$1" >&2
    exit 1
  fi
}

reject --configfile=
reject https://acme-v02.api.letsencrypt.org/directory

require --entrypoints.web.address=:80
require --entrypoints.websecure.address=:443
require --entrypoints.websecure.http.middlewares=crowdsec@file
require --certificatesresolvers.principale.acme.caserver=https://acme-staging-v02.api.letsencrypt.org/directory
require --certificatesresolvers.principale.acme.httpchallenge.entrypoint=web
require --experimental.plugins.crowdsec.modulename=github.com/maxlerebourg/crowdsec-bouncer-traefik-plugin
require --providers.file.directory=/etc/traefik/dynamic
require --accesslog.filepath=/var/log/traefik/access.log
require --ping.entrypoint=ping

printf 'configurazione statica Traefik via soli argomenti: OK\n'
