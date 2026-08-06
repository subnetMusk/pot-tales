#!/bin/bash
# Kibana legge la configurazione da variabili d'ambiente ma non supporta il
# suffisso _FILE, quindi il valore del secret viene esportato qui.
# Come per Filebeat, il segreto resta leggibile nell'ambiente del processo;
# l'alternativa e' la keystore di Kibana (kibana-keystore add).
set -euo pipefail

ELASTICSEARCH_PASSWORD="$(cat /run/secrets/kibana_system_password)"
export ELASTICSEARCH_PASSWORD

KEY="$(cat /run/secrets/kibana_encryption_key)"
export XPACK_SECURITY_ENCRYPTIONKEY="$KEY"
export XPACK_ENCRYPTEDSAVEDOBJECTS_ENCRYPTIONKEY="$KEY"
export XPACK_REPORTING_ENCRYPTIONKEY="$KEY"

exec /usr/local/bin/kibana-docker
