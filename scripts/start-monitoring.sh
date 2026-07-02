#!/bin/bash

################################################################################
# Start Monitoring Stack Script
#
# This script starts all monitoring services (Elasticsearch, Kibana, Fleet, APM)
# independently from the main application services.
#
# Usage: ./scripts/start-monitoring.sh
################################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}  Starting Monitoring Stack${NC}"
echo -e "${BLUE}================================${NC}"
echo ""

# Change to project root
cd "$PROJECT_ROOT"

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo -e "${RED}Error: .env file not found!${NC}"
    echo -e "${YELLOW}Please create the .env file with required configuration.${NC}"
    exit 1
fi

# Check if docker-compose.monitoring.yml exists
if [ ! -f "docker-compose.monitoring.yml" ]; then
    echo -e "${RED}Error: docker-compose.monitoring.yml not found!${NC}"
    exit 1
fi

# Check if internal_net network exists
if ! docker network ls | grep -q "internal_net"; then
    echo -e "${YELLOW}Warning: internal_net network not found.${NC}"
    echo -e "${YELLOW}The network will be created when you start the main app services.${NC}"
    echo -e "${YELLOW}Please start docker-compose.dev.yml first, or the monitoring stack will fail.${NC}"
    echo ""
    read -p "Do you want to continue? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Aborted.${NC}"
        exit 1
    fi
fi

# Check if proxy_net network exists
if ! docker network ls | grep -q "proxy_net"; then
    echo -e "${YELLOW}Warning: proxy_net network not found.${NC}"
    echo -e "${YELLOW}The network will be created when you start the main app services.${NC}"
    echo ""
fi

echo -e "${YELLOW}Starting monitoring services...${NC}"
echo ""

# Start containers using docker-compose
echo -e "${BLUE}Running docker compose up for monitoring stack...${NC}"
docker compose -f docker-compose.monitoring.yml up -d

echo ""
echo -e "${YELLOW}Waiting for services to initialize...${NC}"
echo -e "${BLUE}This may take a few minutes...${NC}"

# Wait for Elasticsearch to be healthy
echo -e "${BLUE}Waiting for Elasticsearch...${NC}"
timeout=300
elapsed=0
while [ $elapsed -lt $timeout ]; do
    if docker ps --filter "name=es01" --filter "health=healthy" | grep -q "es01"; then
        echo -e "${GREEN}✓${NC} Elasticsearch is healthy"
        break
    fi
    sleep 5
    elapsed=$((elapsed + 5))
    echo -n "."
done

if [ $elapsed -ge $timeout ]; then
    echo -e "${RED}✗${NC} Elasticsearch failed to become healthy within ${timeout}s"
fi

# Wait for Kibana to be healthy
echo -e "${BLUE}Waiting for Kibana...${NC}"
elapsed=0
while [ $elapsed -lt $timeout ]; do
    if docker ps --filter "name=kibana" --filter "health=healthy" | grep -q "kibana"; then
        echo -e "${GREEN}✓${NC} Kibana is healthy"
        break
    fi
    sleep 5
    elapsed=$((elapsed + 5))
    echo -n "."
done

if [ $elapsed -ge $timeout ]; then
    echo -e "${RED}✗${NC} Kibana failed to become healthy within ${timeout}s"
fi

echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}  Monitoring stack started!${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo -e "${BLUE}Services running:${NC}"
docker compose -f docker-compose.monitoring.yml ps

echo ""
echo -e "${BLUE}Access points:${NC}"
echo -e "  Kibana: ${GREEN}http://kibana.localhost${NC} (via Traefik)"
echo -e "  Elasticsearch: ${GREEN}https://es01:9200${NC} (internal only)"
echo -e "  APM Server: ${GREEN}http://apm.localhost${NC} (via Traefik)"
echo ""
echo -e "${YELLOW}Note:${NC} Make sure Traefik is running on proxy_net."
