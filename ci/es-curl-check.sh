#!/usr/bin/env bash
# Instradamento, quoting e guasto del task senza toccare servizi reali.
set -euo pipefail
RADICE=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
# shellcheck source=provisioning/bin/es-curl.sh
. "$RADICE/provisioning/bin/es-curl.sh"
ES_NETWORK=pi_elastic
ES_CA='/host/certs/ca.crt'
STACK_NAME=prova
ES_CURL_SERVICE=prova_surveillance-client
calls=0
docker() {
  case "$1" in
    ps)
      [ "$3" = 'label=com.docker.swarm.service.name=prova_surveillance-client' ]
      [ "${MISSING:-0}" = 1 ] || printf '%s\n' container-di-prova
      ;;
    exec)
      calls=$((calls + 1))
      [ "$2" = container-di-prova ]
      [ "$3" = curl ]
      [ "$4" = --cacert ]
      [ "$5" = /certs/ca/ca.crt ]
      [ "$6" = -u ]
      [ "$7" = 'utente:password con spazi $ e ;' ]
      ;;
    *) echo 'Creazione di container non ammessa dal test' >&2; return 1 ;;
  esac
}
es_curl --cacert "$ES_CA" -u 'utente:password con spazi $ e ;'
es_curl --cacert "$ES_CA" -u 'utente:password con spazi $ e ;'
[ "$calls" = 2 ]
MISSING=1
if es_curl --cacert "$ES_CA" -u 'utente:password con spazi $ e ;' 2>/dev/null; then
  echo 'Task assente accettato' >&2
  exit 1
fi
ES_NETWORK=''
curl() { [ "$1" = --version ]; }
es_curl --version
echo 'client ES persistente: instradamento e guasto verificati'
