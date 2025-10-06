#!/bin/bash

# Reset and reconfigure Fleet Server and agents
# This script should be run when Fleet Server or agents are having authentication issues

# Step 1: Stop all agents and fleet server
echo "Stopping Fleet Server and agents..."
docker stop fleet-server apm-agent infra-agent

# Step 2: Remove the containers to start fresh
echo "Removing containers..."
docker rm fleet-server apm-agent infra-agent

# Step 3: Delete fleet server data volume to reset enrollment
echo "Removing Fleet Server data volume..."
docker volume rm progetti_innovativi_fleetserverdata

# Step 4: Generate new Fleet enrollment tokens
echo "Generating new enrollment tokens..."

# First, let's get the API key for Fleet Server enrollment
FLEET_SERVER_TOKEN=$(docker exec -it es01 curl -s -k -u elastic:m6OHmMuiqNrV1i25Jz3Z -X POST \
  "https://localhost:9200/_security/api_key" \
  -H 'Content-Type: application/json' \
  -d'{"name": "fleet-server-token", "role_descriptors": {"fleet_server":{"cluster":["monitor", "manage_api_key"], "indices":[{"names":["logs-*", "metrics-*", "traces-*", ".fleet-*"], "privileges":["write","create_index","auto_configure"]}]}}}')

FLEET_SERVER_KEY_ID=$(echo $FLEET_SERVER_TOKEN | grep -o '"id":"[^"]*' | cut -d'"' -f4)
FLEET_SERVER_KEY_API=$(echo $FLEET_SERVER_TOKEN | grep -o '"api_key":"[^"]*' | cut -d'"' -f4)
FLEET_SERVER_KEY=$(echo -n "$FLEET_SERVER_KEY_ID:$FLEET_SERVER_KEY_API" | base64)

# Generate API key for APM Server
APM_SERVER_TOKEN=$(docker exec -it es01 curl -s -k -u elastic:m6OHmMuiqNrV1i25Jz3Z -X POST \
  "https://localhost:9200/_security/api_key" \
  -H 'Content-Type: application/json' \
  -d'{"name": "apm-server-token", "role_descriptors": {"apm_server":{"cluster":["monitor", "manage_api_key"], "indices":[{"names":["logs-*", "metrics-*", "traces-*", "apm-*"], "privileges":["write","create_index"]}]}}}')

APM_SERVER_KEY_ID=$(echo $APM_SERVER_TOKEN | grep -o '"id":"[^"]*' | cut -d'"' -f4)
APM_SERVER_KEY_API=$(echo $APM_SERVER_TOKEN | grep -o '"api_key":"[^"]*' | cut -d'"' -f4)
APM_SERVER_KEY=$(echo -n "$APM_SERVER_KEY_ID:$APM_SERVER_KEY_API" | base64)

# Generate API key for Infrastructure agent
INFRA_TOKEN=$(docker exec -it es01 curl -s -k -u elastic:m6OHmMuiqNrV1i25Jz3Z -X POST \
  "https://localhost:9200/_security/api_key" \
  -H 'Content-Type: application/json' \
  -d'{"name": "infra-agent-token", "role_descriptors": {"infra_agent":{"cluster":["monitor"], "indices":[{"names":["logs-*", "metrics-*"], "privileges":["write","create_index"]}]}}}')

INFRA_KEY_ID=$(echo $INFRA_TOKEN | grep -o '"id":"[^"]*' | cut -d'"' -f4)
INFRA_KEY_API=$(echo $INFRA_TOKEN | grep -o '"api_key":"[^"]*' | cut -d'"' -f4)
INFRA_KEY=$(echo -n "$INFRA_KEY_ID:$INFRA_KEY_API" | base64)

# Step 5: Update .env file with new tokens
echo "Updating .env file with new tokens..."
sed -i.bak "s/^FLEET_ENROLLMENT_TOKEN=.*/FLEET_ENROLLMENT_TOKEN=$FLEET_SERVER_KEY/" ../.env
sed -i.bak "s/^FLEET_ENROLLMENT_TOKEN_APM=.*/FLEET_ENROLLMENT_TOKEN_APM=$APM_SERVER_KEY/" ../.env
sed -i.bak "s/^FLEET_ENROLLMENT_TOKEN_INFRA=.*/FLEET_ENROLLMENT_TOKEN_INFRA=$INFRA_KEY/" ../.env

# Step 6: Create Fleet Server policy in Kibana if not exists
echo "Creating Fleet Server policy in Kibana..."
docker exec -it kibana curl -s -X POST "http://localhost:5601/api/fleet/fleet_server_hosts" \
  -H 'kbn-xsrf: true' \
  -H 'Content-Type: application/json' \
  -u elastic:m6OHmMuiqNrV1i25Jz3Z \
  -d '{
    "name": "Default Fleet Server",
    "host_urls": ["https://fleet-server:8220"],
    "is_default": true
  }'

# Step 7: Create Fleet Server policy if it doesn't exist
docker exec -it kibana curl -s -X POST "http://localhost:5601/api/fleet/agent_policies?sys_monitoring=true" \
  -H 'kbn-xsrf: true' \
  -H 'Content-Type: application/json' \
  -u elastic:m6OHmMuiqNrV1i25Jz3Z \
  -d '{
    "name": "Fleet Server policy",
    "description": "Policy for Fleet Server",
    "namespace": "default",
    "monitoring_enabled": ["logs", "metrics"]
  }'

# Step 8: Restart Fleet Server with the new token
echo "Restarting Fleet Server with new token..."
docker-compose -f ../docker-compose.dev.yml up -d fleet-server

# Wait for Fleet Server to be healthy
echo "Waiting for Fleet Server to be healthy..."
while ! docker exec fleet-server curl -sSf --cacert /usr/share/elastic-agent/certs/ca/ca.crt https://localhost:8220/api/status | grep -q 'HEALTHY'; do
  sleep 5
  echo "Still waiting for Fleet Server..."
done

# Step 9: Restart APM and Infra agents
echo "Restarting APM and Infrastructure agents..."
docker-compose -f ../docker-compose.dev.yml up -d apm-agent infra-agent

echo "Done! Fleet Server and agents have been reconfigured."