#!/bin/bash
# Carica nella keystore nativa i valori consegnati da Swarm. I secret non
# entrano nell'ambiente del processo Kibana e non sono quindi leggibili da
# /proc/<pid>/environ.
set -euo pipefail

KEYSTORE=/usr/share/kibana/config/kibana.keystore
KIBANA_KEYSTORE=/usr/share/kibana/bin/kibana-keystore

if [ ! -f "$KEYSTORE" ]; then
  "$KIBANA_KEYSTORE" create --silent
fi

add_secret() {
  local setting=$1 secret_file=$2
  "$KIBANA_KEYSTORE" add "$setting" --stdin --force --silent < "$secret_file"
}

add_secret elasticsearch.password /run/secrets/kibana_system_password
add_secret xpack.security.encryptionKey /run/secrets/kibana_encryption_key
add_secret xpack.encryptedSavedObjects.encryptionKey /run/secrets/kibana_encryption_key
add_secret xpack.reporting.encryptionKey /run/secrets/kibana_encryption_key

exec /usr/local/bin/kibana-docker
