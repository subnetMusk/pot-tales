# Elastic Stack Management Guide

This guide explains how to manage the Elastic Stack components in your environment.

## Architecture Overview

Your Elastic Stack setup consists of:

1. **Elasticsearch** (`es01`) - The core search and analytics engine
2. **Kibana** (`kibana`) - The visualization platform for Elasticsearch data
3. **Fleet Server** (`fleet-server`) - Manages and updates Elastic Agents
4. **APM Server** (`apm-agent`) - Collects and processes application performance metrics
5. **Infrastructure Agent** (`infra-agent`) - Collects system metrics
6. **Fluent Bit** (`fluent-bit`) - Forwards logs to Elasticsearch

## Common Issues and Solutions

### Issue: Fleet Server Authentication Failures

**Symptoms**:
- Fleet Server shows `"unauthorized: apikey auth response [API Key ID]: [401 Unauthorized]"` errors
- APM agent cannot enroll with Fleet Server
- Infrastructure agent cannot enroll with Fleet Server

**Solution**:
Run the `reset_fleet.sh` script to reset and reconfigure Fleet:

```bash
cd scripts
./reset_fleet.sh
```

This script:
1. Stops and removes all agent containers
2. Removes the Fleet Server data volume
3. Generates new API keys for enrollment
4. Updates your .env file with the new tokens
5. Creates a Fleet Server policy in Kibana
6. Restarts all agents with the new configuration

### Issue: Need Monitoring Without Fleet

If you need to quickly set up monitoring without the complexity of Fleet, use:

```bash
cd scripts
./setup_standalone_monitoring.sh
```

This creates standalone APM Server, Metricbeat, and Filebeat containers that report directly to Elasticsearch.

## Access and Management

### Elasticsearch

- **URL**: https://es01:9200 (internal)
- **Credentials**: elastic:m6OHmMuiqNrV1i25Jz3Z

### Kibana

- **URL**: http://kibana.localhost
- **Credentials**: elastic:m6OHmMuiqNrV1i25Jz3Z

### Fleet Server

- Fleet Server runs on port 8220 and manages Elastic Agents
- Configuration is set in Kibana under Management → Fleet

### APM

- **Internal URL**: http://apm-agent:8200
- **External URL**: http://apm.localhost
- Configure applications to use this endpoint for performance monitoring

## Troubleshooting

### Check Container Status

```bash
docker ps --format "table {{.Names}}\t{{.Status}}"
```

### View Container Logs

```bash
docker logs [container_name]
```

### Check Elasticsearch Health

```bash
docker exec es01 curl -k -u elastic:m6OHmMuiqNrV1i25Jz3Z https://localhost:9200/_cat/health
```

### Test APM Server Connection

```bash
curl -I http://apm.localhost
```

### Reset Elasticsearch Passwords

If you need to reset the Elasticsearch passwords:

```bash
docker exec -it es01 /bin/bash
bin/elasticsearch-reset-password -u elastic
```

## Maintenance Tasks

### Updating Elasticsearch Configuration

1. Edit `docker/volumes/elasticsearch/config/elasticsearch.yml`
2. Restart Elasticsearch: `docker restart es01`

### Updating Kibana Configuration

1. Edit `docker/volumes/kibana/config/kibana.yml`
2. Restart Kibana: `docker restart kibana`

### Backing Up Elasticsearch Data

Use the Elasticsearch Snapshot API or the following command:

```bash
cd scripts
./backup-docker.sh
```

## Monitoring Your Stack

1. Login to Kibana at http://kibana.localhost
2. Go to Observability → Overview to see APM metrics
3. Go to Analytics → Dashboard to see system metrics
4. Go to Management → Stack Monitoring for Elastic Stack health

## Additional Resources

- [Elasticsearch Documentation](https://www.elastic.co/guide/en/elasticsearch/reference/current/index.html)
- [Kibana Documentation](https://www.elastic.co/guide/en/kibana/current/index.html)
- [Fleet Documentation](https://www.elastic.co/guide/en/fleet/current/index.html)
- [APM Documentation](https://www.elastic.co/guide/en/apm/guide/current/index.html)