#!/bin/bash

# Script di diagnostica per il monitoraggio dei servizi Elastic Stack
# Verifica le connessioni tra i vari servizi della stack Elastic

echo "=== SCRIPT DI DIAGNOSTICA PER ELASTIC STACK ==="
echo

# Controlla se Elasticsearch risponde correttamente
echo "Controllo Elasticsearch..."
echo "---------------------------------"
docker exec es01 curl -s -k -u elastic:m6OHmMuiqNrV1i25Jz3Z https://localhost:9200/_cat/health
docker exec es01 curl -s -k -u elastic:m6OHmMuiqNrV1i25Jz3Z https://localhost:9200/_cat/indices
echo

# Controlla se Kibana è raggiungibile
echo "Controllo Kibana..."
echo "---------------------------------"
docker exec kibana curl -s -I http://localhost:5601 | head -1
echo

# Controlla connessione da Fleet Server a Elasticsearch
echo "Controllo Fleet Server -> Elasticsearch..."
echo "---------------------------------"
docker exec fleet-server curl -s -k -u elastic:m6OHmMuiqNrV1i25Jz3Z https://es01:9200/_cat/health
echo

# Controlla connessione da Fleet Server a Kibana
echo "Controllo Fleet Server -> Kibana..."
echo "---------------------------------"
docker exec fleet-server curl -s -I http://kibana:5601 | head -1
echo

# Controlla stato di Fleet Server
echo "Controllo stato Fleet Server..."
echo "---------------------------------"
docker exec fleet-server curl -k -s --cacert /usr/share/elastic-agent/certs/ca/ca.crt https://localhost:8220/api/status || echo "Fleet Server non risponde sull'API di stato"
echo

# Verifica se APM è raggiungibile
echo "Controllo APM Server..."
echo "---------------------------------"
docker exec -it apm-agent curl -s -I http://localhost:8200 || echo "APM Server non risponde"
echo

# Controlla le variabili d'ambiente impostate
echo "Variabili d'ambiente impostate..."
echo "---------------------------------"
echo "ELASTICSEARCH_HOSTS: $(docker exec kibana env | grep ELASTICSEARCH_HOSTS)"
echo "KIBANA_HOST (fleet-server): $(docker exec fleet-server env | grep KIBANA_HOST)"
echo "FLEET_URL (fleet-server): $(docker exec fleet-server env | grep FLEET_URL)"
echo

# Controlla i proxy host configurati
echo "Proxy Host configurati in NPM..."
echo "---------------------------------"
for file in /Users/leonardo/Desktop/git_projects/progetti_innovativi/docker/volumes/npm_data/nginx/proxy_host/*.conf; do
  HOST=$(grep "server_name" $file | awk '{print $2}' | sed 's/;//')
  FORWARD=$(grep "\$server" $file | awk '{print $3}' | sed 's/"//g;s/;//')
  PORT=$(grep "\$port" $file | awk '{print $3}' | sed 's/;//')
  echo "$HOST -> $FORWARD:$PORT"
done
echo

# Verifica reti dei container
echo "Reti dei container..."
echo "---------------------------------"
docker inspect -f '{{.Name}} -> {{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' $(docker ps -q)
echo

echo "=== DIAGNOSTICA COMPLETATA ==="