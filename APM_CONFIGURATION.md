# APM Configuration Guide

This document explains how to configure Elastic APM monitoring for both backend and frontend applications using environment variables.

## Environment Variables Overview

### Core APM Configuration
```bash
# Main APM Server configuration
APM_SECRET_TOKEN=apm-secret-token-123
APM_SERVER_URL=http://apm.localhost
APM_SERVER_INTERNAL_URL=http://apm-server:8200

# Elasticsearch connection
ELASTICSEARCH_HOSTS=http://elasticsearch:9200
ELASTICSEARCH_USERNAME=elastic
ELASTICSEARCH_PASSWORD=m6OHmMuiqNrV1i25Jz3Z
```

### Backend APM (Go Server)
```bash
# APM agent configuration for Go backend
ELASTIC_APM_SERVER_URL=http://apm.localhost
ELASTIC_APM_SERVICE_NAME=go-backend
ELASTIC_APM_ENVIRONMENT=development
ELASTIC_APM_SECRET_TOKEN=${APM_SECRET_TOKEN}  # References main token
```

### Frontend RUM (JavaScript)
```bash
# Real User Monitoring for frontend
ELASTIC_APM_RUM_SERVER_URL=http://apm.localhost
ELASTIC_APM_RUM_SERVICE_NAME=frontend-app
ELASTIC_APM_RUM_SECRET_TOKEN=rum-secret-token-456  # Different token for RUM
```

## Secret Token Strategy

### Why Different Tokens?

1. **Security Separation**: Backend and frontend have different security contexts
2. **Permission Granularity**: Different agents may need different permissions
3. **Token Rotation**: Can rotate tokens independently for each service type
4. **Monitoring**: Easier to track which agent type is sending data

### Token Configuration

#### Backend Token (Server-side)
- **Token**: `apm-secret-token-123` 
- **Used by**: Go backend service
- **Monitors**: Database queries, HTTP requests, external API calls
- **Environment Variable**: `ELASTIC_APM_SECRET_TOKEN`

#### RUM Token (Client-side)
- **Token**: `rum-secret-token-456`
- **Used by**: Frontend JavaScript application
- **Monitors**: Page loads, user interactions, browser performance
- **Environment Variable**: `ELASTIC_APM_RUM_SECRET_TOKEN`

## Docker Compose Integration

### Elastic Agent Configuration
```yaml
elastic-agent:
  environment:
    - ELASTICSEARCH_HOSTS=${ELASTICSEARCH_HOSTS}
    - ELASTICSEARCH_USERNAME=${ELASTICSEARCH_USERNAME}
    - ELASTICSEARCH_PASSWORD=${ELASTICSEARCH_PASSWORD}
```

### Backend Server Configuration
```yaml
server:
  environment:
    - ELASTIC_APM_SERVER_URL=${ELASTIC_APM_SERVER_URL}
    - ELASTIC_APM_SERVICE_NAME=${ELASTIC_APM_SERVICE_NAME}
    - ELASTIC_APM_ENVIRONMENT=${ELASTIC_APM_ENVIRONMENT}
    - ELASTIC_APM_SECRET_TOKEN=${ELASTIC_APM_SECRET_TOKEN}
```

### Frontend Configuration
```yaml
frontend:
  environment:
    - VITE_ELASTIC_APM_RUM_SERVER_URL=${ELASTIC_APM_RUM_SERVER_URL}
    - VITE_ELASTIC_APM_RUM_SERVICE_NAME=${ELASTIC_APM_RUM_SERVICE_NAME}
    - VITE_ELASTIC_APM_RUM_SECRET_TOKEN=${ELASTIC_APM_RUM_SECRET_TOKEN}
    - VITE_ELASTIC_APM_ENVIRONMENT=${ELASTIC_APM_ENVIRONMENT}
```

## Configuration Files Updated

### 1. Elastic Agent (elastic-agent.yml)
**Before:**
```yaml
hosts:
  - 'http://elasticsearch:9200'
username: 'elastic'
password: 'm6OHmMuiqNrV1i25Jz3Z'
```

**After:**
```yaml
hosts:
  - '${ELASTICSEARCH_HOSTS}'
username: '${ELASTICSEARCH_USERNAME}'
password: '${ELASTICSEARCH_PASSWORD}'
```

### 2. Environment Variables (.env)
All APM and Elasticsearch configurations are centralized in `.env` file with proper variable references.

### 3. Frontend RUM Configuration
Created `frontend/src/apm-rum-config.js` with proper environment variable usage for RUM agent initialization.

## Adding Additional Agents

### For New Services

1. **Create new secret token:**
```bash
# In .env file
ELASTIC_APM_NEWSERVICE_SECRET_TOKEN=newservice-token-789
```

2. **Add service configuration:**
```bash
ELASTIC_APM_NEWSERVICE_SERVICE_NAME=my-new-service
```

3. **Update docker-compose.yml:**
```yaml
newservice:
  environment:
    - ELASTIC_APM_SECRET_TOKEN=${ELASTIC_APM_NEWSERVICE_SECRET_TOKEN}
    - ELASTIC_APM_SERVICE_NAME=${ELASTIC_APM_NEWSERVICE_SERVICE_NAME}
```

### For Different Agent Types

1. **Mobile Apps**: Use separate token like `mobile-app-token-abc`
2. **Microservices**: Use service-specific tokens like `auth-service-token-def`
3. **Third-party Integrations**: Use integration-specific tokens

## Verification Commands

### Check Environment Variables
```bash
# Check Elastic Agent variables
docker exec elastic-agent env | grep -E "(ELASTICSEARCH|ELASTIC_APM)"

# Check Go server APM variables
docker exec server env | grep -E "ELASTIC_APM"

# Check frontend variables (during build)
docker exec frontend env | grep -E "VITE_ELASTIC_APM"
```

### Test APM Connectivity
```bash
# Generate test traffic
docker exec elasticsearch bash -c 'for i in {1..10}; do curl -s http://server:3000/health; done'

# Check APM traces
docker exec elasticsearch curl -s -u "elastic:password" "http://localhost:9200/traces-apm*/_count"
```

## Best Practices

1. **Use descriptive token names** that indicate their purpose
2. **Rotate tokens regularly** for security
3. **Use different tokens per environment** (dev/staging/prod)
4. **Monitor token usage** in APM Server logs
5. **Document token permissions** and usage scope

## Troubleshooting

### Common Issues

1. **403 Forbidden**: Check if secret token matches APM Server configuration
2. **Connection Refused**: Verify APM Server URL is correct for container networking
3. **No Data in Kibana**: Check agent configuration and token permissions
4. **Token Mismatch**: Ensure frontend uses RUM token, backend uses server token

### Debug Commands

```bash
# Check APM Server logs
docker logs apm-server --tail 20

# Check agent logs
docker logs server --tail 20

# Verify APM indices
docker exec elasticsearch curl -s -u "elastic:password" "http://localhost:9200/_cat/indices/apm-*"
```
