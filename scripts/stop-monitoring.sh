#!/bin/bash

################################################################################
# Stop Monitoring Stack Script
#
# This script stops all monitoring services (Elasticsearch, Kibana, Fleet, APM)
# while keeping the main application services running.
#
# Usage: ./scripts/stop-monitoring.sh
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
echo -e "${BLUE}  Stopping Monitoring Stack${NC}"
echo -e "${BLUE}================================${NC}"
echo ""

# Change to project root
cd "$PROJECT_ROOT"

# Check if docker-compose.monitoring.yml exists
if [ ! -f "docker-compose.monitoring.yml" ]; then
    echo -e "${RED}Error: docker-compose.monitoring.yml not found!${NC}"
    exit 1
fi

# List of monitoring containers to stop
MONITORING_CONTAINERS=(
    "fluent-bit"
    "infra-agent"
    "apm-agent"
    "fleet-server"
    "kibana"
    "es01"
    "setup-certs"
)

echo -e "${YELLOW}Stopping monitoring containers...${NC}"
echo ""

# Stop containers using docker-compose
echo -e "${BLUE}Running docker compose down for monitoring stack...${NC}"
docker compose -f docker-compose.monitoring.yml down

echo ""
echo -e "${YELLOW}Verifying containers are stopped...${NC}"

# Check if any monitoring containers are still running
RUNNING_CONTAINERS=0
for container in "${MONITORING_CONTAINERS[@]}"; do
    if docker ps --format '{{.Names}}' | grep -q "^${container}$"; then
        echo -e "${RED}✗${NC} $container is still running"
        RUNNING_CONTAINERS=$((RUNNING_CONTAINERS + 1))
    else
        echo -e "${GREEN}✓${NC} $container stopped"
    fi
done

echo ""

if [ $RUNNING_CONTAINERS -eq 0 ]; then
    echo -e "${GREEN}================================${NC}"
    echo -e "${GREEN}  All monitoring services stopped successfully!${NC}"
    echo -e "${GREEN}================================${NC}"
    echo ""
    echo -e "${BLUE}Note:${NC} Application services (server, db, redis, frontend, sandbox) are still running."
    echo -e "${BLUE}To stop them, use:${NC} docker compose -f docker-compose.dev.yml down"
    exit 0
else
    echo -e "${YELLOW}================================${NC}"
    echo -e "${YELLOW}  Warning: Some containers are still running${NC}"
    echo -e "${YELLOW}================================${NC}"
    echo ""
    echo -e "${YELLOW}Try stopping them manually with:${NC}"
    echo "  docker stop <container_name>"
    exit 1
fi
