#!/bin/bash
# Genera la CA e i certificati di servizio, poi imposta la password
# dell'utente kibana_system.
#
# Eseguito come `replicated-job`: completa ed esce con codice 0.
#
# Non dipende dall'avvio di Elasticsearch: crea prima i certificati, che
# sbloccano es01, e solo dopo attende che il nodo risponda.
#
# Idempotente: se i certificati esistono gia' non vengono rigenerati.
set -euo pipefail

CERTS=config/certs

# Ritardo opzionale usato dai test di avvio per invertire l'ordine di
# partenza dei servizi e verificare il comportamento di riavvio.
if [ -n "${SETUP_DELAY:-}" ]; then
  echo "[setup] ritardo di ${SETUP_DELAY}s"
  sleep "$SETUP_DELAY"
fi

ELASTIC_PASSWORD="$(cat /run/secrets/elastic_password)"
KIBANA_PASSWORD="$(cat /run/secrets/kibana_system_password)"

if [ ! -f "$CERTS/ca.zip" ]; then
  echo "[setup] creazione della CA"
  bin/elasticsearch-certutil ca --silent --pem -out "$CERTS/ca.zip"
  unzip -o "$CERTS/ca.zip" -d "$CERTS"
fi

if [ ! -f "$CERTS/certs.zip" ]; then
  echo "[setup] creazione dei certificati di servizio"
  cat > "$CERTS/instances.yml" <<'EOF'
instances:
  - name: es01
    dns: [ es01, localhost ]
    ip:  [ 127.0.0.1 ]
  - name: kibana
    dns: [ kibana, localhost ]
    ip:  [ 127.0.0.1 ]
EOF
  bin/elasticsearch-certutil cert --silent --pem \
    -out "$CERTS/certs.zip" \
    --in "$CERTS/instances.yml" \
    --ca-cert "$CERTS/ca/ca.crt" \
    --ca-key "$CERTS/ca/ca.key"
  unzip -o "$CERTS/certs.zip" -d "$CERTS"
fi

# Le immagini Elastic girano come uid 1000 con gid 0, quindi permessi
# root:root 640 restano leggibili dal gruppo.
echo "[setup] impostazione dei permessi"
chown -R root:root "$CERTS"
find "$CERTS" -type d -exec chmod 750 {} \;
find "$CERTS" -type f -exec chmod 640 {} \;

echo "[setup] attesa di es01"
until curl -s --cacert "$CERTS/ca/ca.crt" https://es01:9200 | grep -q "missing authentication credentials"; do
  sleep 5
done

echo "[setup] impostazione della password di kibana_system"
until curl -s -X POST --cacert "$CERTS/ca/ca.crt" \
  -u "elastic:${ELASTIC_PASSWORD}" \
  -H "Content-Type: application/json" \
  https://es01:9200/_security/user/kibana_system/_password \
  -d "{\"password\":\"${KIBANA_PASSWORD}\"}" | grep -q "^{}"; do
  sleep 5
done

echo "[setup] completato"
