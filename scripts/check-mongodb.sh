#!/bin/bash

# Script per controllare rapidamente lo stato di MongoDB
# Uso: ./scripts/check-mongodb.sh

set -e

# Colori
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOCKER_COMPOSE_FILE="$PROJECT_DIR/docker-compose.dev.yml"

echo -e "${BLUE}MongoDB Status Check${NC}"
echo -e "${BLUE}=====================${NC}"

# Controlla se MongoDB è in esecuzione
if ! docker-compose -f "$DOCKER_COMPOSE_FILE" ps db | grep -q "Up"; then
    echo -e "${RED}MongoDB non è in esecuzione${NC}"
    echo -e "${YELLOW}Esegui: ./scripts/fix-mongodb.sh${NC}"
    exit 1
fi

echo -e "${GREEN}MongoDB è in esecuzione${NC}"

# Controlla errori nei log
if docker-compose -f "$DOCKER_COMPOSE_FILE" logs db --tail=50 | grep -q -E "(ERROR|FATAL|WiredTiger error)"; then
    echo -e "${RED}Errori rilevati nei log MongoDB${NC}"
    echo -e "${YELLOW}Esegui: ./scripts/fix-mongodb.sh${NC}"
    echo
    echo -e "${YELLOW}Ultimi errori:${NC}"
    docker-compose -f "$DOCKER_COMPOSE_FILE" logs db --tail=20 | grep -E "(ERROR|FATAL|WiredTiger error)" | tail -5
    exit 1
fi

echo -e "${GREEN}Nessun errore nei log recenti${NC}"

# Controlla connessioni
if docker-compose -f "$DOCKER_COMPOSE_FILE" logs db --tail=20 | grep -q "Connection accepted"; then
    echo -e "${GREEN}MongoDB sta accettando connessioni${NC}"
else
    echo -e "${YELLOW} Nessuna connessione rilevata nei log recenti${NC}"
fi

echo -e "${GREEN}MongoDB è sano!${NC}"