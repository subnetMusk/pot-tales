#!/bin/bash

# This script sets up the Fleet Server in standalone mode without using the Fleet management system
# It's a temporary solution to get the APM and system monitoring working without Fleet

# Step 1: Stop and remove agents
echo "Stopping and removing agents..."
docker stop fleet-server apm-agent infra-agent
docker rm fleet-server apm-agent infra-agent

# Step 2: Create a standalone APM server
echo "Creating standalone APM server..."
docker run -d \
  --name standalone-apm \
  --network internal_net \
  -p 8200:8200 \
  -v certs:/usr/share/elastic/certs:ro \
  -e ELASTICSEARCH_HOSTS="https://es01:9200" \
  -e ELASTICSEARCH_USERNAME="elastic" \
  -e ELASTICSEARCH_PASSWORD="m6OHmMuiqNrV1i25Jz3Z" \
  -e ELASTICSEARCH_SSL_CERTIFICATEAUTHORITIES="/usr/share/elastic/certs/ca/ca.crt" \
  docker.elastic.co/apm/apm-server:8.13.4

# Step 3: Create a standalone Metricbeat for system monitoring
echo "Creating standalone Metricbeat for system monitoring..."
docker run -d \
  --name standalone-metricbeat \
  --user=root \
  --network internal_net \
  --volume="$(pwd)/docker/volumes/metricbeat/metricbeat.yml:/usr/share/metricbeat/metricbeat.yml:ro" \
  --volume="/var/run/docker.sock:/var/run/docker.sock:ro" \
  --volume="/sys/fs/cgroup:/hostfs/sys/fs/cgroup:ro" \
  --volume="/proc:/hostfs/proc:ro" \
  --volume="/:/hostfs:ro" \
  --volume="certs:/usr/share/metricbeat/certs:ro" \
  docker.elastic.co/beats/metricbeat:8.13.4

# Step 4: Create a standalone Filebeat for log collection
echo "Creating standalone Filebeat for log collection..."
docker run -d \
  --name standalone-filebeat \
  --user=root \
  --network internal_net \
  --volume="$(pwd)/docker/volumes/filebeat/filebeat.yml:/usr/share/filebeat/filebeat.yml:ro" \
  --volume="/var/lib/docker/containers:/var/lib/docker/containers:ro" \
  --volume="/var/run/docker.sock:/var/run/docker.sock:ro" \
  --volume="certs:/usr/share/filebeat/certs:ro" \
  docker.elastic.co/beats/filebeat:8.13.4

# Step 5: Create configuration directories if they don't exist
mkdir -p docker/volumes/metricbeat
mkdir -p docker/volumes/filebeat

# Step 6: Create basic configuration files
cat > docker/volumes/metricbeat/metricbeat.yml <<EOL
metricbeat.modules:
- module: system
  metricsets:
    - cpu
    - load
    - memory
    - network
    - process
  enabled: true
  period: 10s
  processes: ['.*']

- module: docker
  metricsets:
    - container
    - cpu
    - memory
    - network
  enabled: true
  period: 10s
  hosts: ["unix:///var/run/docker.sock"]

output.elasticsearch:
  hosts: ["https://es01:9200"]
  username: "elastic"
  password: "m6OHmMuiqNrV1i25Jz3Z"
  ssl.certificate_authorities: ["/usr/share/metricbeat/certs/ca/ca.crt"]

setup.kibana:
  host: "http://kibana:5601"
  username: "elastic"
  password: "m6OHmMuiqNrV1i25Jz3Z"
EOL

cat > docker/volumes/filebeat/filebeat.yml <<EOL
filebeat.inputs:
- type: container
  paths:
    - /var/lib/docker/containers/*/*.log
  json.keys_under_root: true
  json.message_key: log
  json.add_error_key: true

processors:
  - add_docker_metadata: ~

output.elasticsearch:
  hosts: ["https://es01:9200"]
  username: "elastic"
  password: "m6OHmMuiqNrV1i25Jz3Z"
  ssl.certificate_authorities: ["/usr/share/filebeat/certs/ca/ca.crt"]

setup.kibana:
  host: "http://kibana:5601"
  username: "elastic"
  password: "m6OHmMuiqNrV1i25Jz3Z"
EOL

echo "Done! Standalone monitoring components have been set up."
echo "You can now access Kibana at http://kibana.localhost and check for incoming data."