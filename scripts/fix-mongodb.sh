#!/bin/bash

# Script per riparare MongoDB corrotto automaticamente
# Autore: GitHub Copilot
# Data: $(date +%Y-%m-%d)

set -e  # Exit on any error

# Colori per output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Directory del progetto (assumendo che lo script sia in scripts/)
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOCKER_COMPOSE_FILE="$PROJECT_DIR/docker-compose.dev.yml"
MONGODB_VOLUME_DIR="$PROJECT_DIR/docker/volumes/mongodb"

echo -e "${BLUE} MongoDB Repair Script${NC}"
echo -e "${BLUE}========================${NC}"

# Funzione per stampare messaggi colorati
print_status() {
    echo -e "${GREEN}$1${NC}"
}

print_warning() {
    echo -e "${YELLOW}$1${NC}"
}

print_error() {
    echo -e "${RED}$1${NC}"
}

print_info() {
    echo -e "${BLUE}$1${NC}"
}

# Controlla se siamo nella directory corretta
if [[ ! -f "$DOCKER_COMPOSE_FILE" ]]; then
    print_error "File docker-compose.dev.yml non trovato in $PROJECT_DIR"
    exit 1
fi

print_info "Directory progetto: $PROJECT_DIR"
print_info "File Docker Compose: $DOCKER_COMPOSE_FILE"

# Step 1: Controlla lo stato attuale di MongoDB
print_info "Controllo stato MongoDB..."
DB_STATUS=$(docker-compose -f "$DOCKER_COMPOSE_FILE" ps db 2>/dev/null | tail -n +2 || echo "")

if [[ -n "$DB_STATUS" ]]; then
    if echo "$DB_STATUS" | grep -q "Up"; then
        print_status "MongoDB è attualmente in esecuzione"
        
        # Controlla i log per errori WiredTiger
        print_info "Controllo log per errori WiredTiger..."
        if docker-compose -f "$DOCKER_COMPOSE_FILE" logs db --tail=50 2>/dev/null | grep -q "WiredTiger error"; then
            print_warning "Errori WiredTiger rilevati nei log!"
            NEED_REPAIR=true
        else
            print_status "Nessun errore WiredTiger rilevato"
            echo -e "${GREEN}MongoDB sembra funzionare correttamente. Vuoi comunque procedere con la riparazione? (y/N)${NC}"
            read -r CONFIRM
            if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
                print_info "Operazione annullata dall'utente"
                exit 0
            fi
            NEED_REPAIR=true
        fi
    else
        print_warning "MongoDB non è in esecuzione o ha problemi"
        NEED_REPAIR=true
    fi
else
    print_warning "Container MongoDB non trovato"
    NEED_REPAIR=true
fi

if [[ "$NEED_REPAIR" != "true" ]]; then
    print_status "MongoDB funziona correttamente, nessuna riparazione necessaria"
    exit 0
fi

# Conferma dall'utente
echo
print_warning "ATTENZIONE: Questa operazione cancellerà tutti i dati nel database MongoDB!"
print_warning "Assicurati di avere un backup se necessario."
echo
echo -e "${YELLOW}Vuoi procedere con la riparazione? (y/N)${NC}"
read -r CONFIRM

if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    print_info "Operazione annullata dall'utente"
    exit 0
fi

echo
print_info "Inizio riparazione MongoDB..."

# Step 2: Ferma tutti i servizi
print_info "Fermando tutti i servizi Docker..."
if docker-compose -f "$DOCKER_COMPOSE_FILE" down; then
    print_status "Servizi fermati con successo"
else
    print_error "Errore nel fermare i servizi"
    exit 1
fi

# Step 3: Backup della directory corrotta (opzionale)
if [[ -d "$MONGODB_VOLUME_DIR" ]] && [[ -n "$(ls -A "$MONGODB_VOLUME_DIR" 2>/dev/null)" ]]; then
    BACKUP_DIR="$PROJECT_DIR/backups/mongodb-corrupted-$(date +%Y%m%d_%H%M%S)"
    print_info "Creando backup della directory corrotta in $BACKUP_DIR..."
    
    mkdir -p "$(dirname "$BACKUP_DIR")"
    if cp -r "$MONGODB_VOLUME_DIR" "$BACKUP_DIR"; then
        print_status "Backup creato in $BACKUP_DIR"
    else
        print_warning "Impossibile creare backup, continuando senza..."
    fi
fi

# Step 4: Rimuovi dati corrotti
print_info "Rimozione dati MongoDB corrotti..."

if [[ -d "$MONGODB_VOLUME_DIR" ]]; then
    # Prova prima senza sudo
    if rm -rf "$MONGODB_VOLUME_DIR" 2>/dev/null; then
        print_status "Directory MongoDB rimossa"
    else
        print_info "Richiesti permessi amministratore per rimuovere la directory..."
        if sudo rm -rf "$MONGODB_VOLUME_DIR"; then
            print_status "Directory MongoDB rimossa (con sudo)"
        else
            print_error "Impossibile rimuovere la directory MongoDB"
            exit 1
        fi
    fi
else
    print_warning "Directory MongoDB non esistente, creazione nuova..."
fi

# Step 5: Ricrea directory con permessi corretti
print_info "Ricreazione directory MongoDB..."
if mkdir -p "$MONGODB_VOLUME_DIR" && chmod 755 "$MONGODB_VOLUME_DIR"; then
    print_status "Directory MongoDB ricreata"
else
    print_error "Errore nella creazione della directory MongoDB"
    exit 1
fi

# Step 6: Pulizia volumi Docker orfani
print_info "Pulizia volumi Docker orfani..."
if docker volume prune -f > /dev/null 2>&1; then
    print_status "Volumi Docker orfani rimossi"
else
    print_warning "Impossibile rimuovere volumi orfani (potrebbe essere normale)"
fi

# Step 7: Riavvia tutti i servizi
print_info "Riavvio servizi Docker..."
if docker-compose -f "$DOCKER_COMPOSE_FILE" up -d; then
    print_status "Servizi riavviati"
else
    print_error "Errore nel riavviare i servizi"
    exit 1
fi

# Step 8: Verifica che MongoDB sia funzionante
print_info "Verifica funzionamento MongoDB..."
sleep 5  # Attendi che i servizi si avviino

# Attendi fino a 60 secondi che MongoDB si avvii
TIMEOUT=60
COUNTER=0

while [[ $COUNTER -lt $TIMEOUT ]]; do
    if docker-compose -f "$DOCKER_COMPOSE_FILE" ps db | grep -q "Up"; then
        print_status "MongoDB è in esecuzione"
        break
    fi
    
    if [[ $((COUNTER % 10)) -eq 0 ]]; then
        print_info "Attendo avvio MongoDB... ($COUNTER/$TIMEOUT secondi)"
    fi
    
    sleep 1
    ((COUNTER++))
done

if [[ $COUNTER -eq $TIMEOUT ]]; then
    print_error "Timeout: MongoDB non si è avviato entro $TIMEOUT secondi"
    print_info "Controlla i log con: docker-compose -f $DOCKER_COMPOSE_FILE logs db"
    exit 1
fi

# Controlla i log per errori
print_info "Controllo log MongoDB per errori..."
sleep 2

if docker-compose -f "$DOCKER_COMPOSE_FILE" logs db --tail=20 | grep -q -E "(ERROR|FATAL|WiredTiger error)"; then
    print_warning "Rilevati possibili errori nei log MongoDB"
    print_info "Controlla i log completi con: docker-compose -f $DOCKER_COMPOSE_FILE logs db"
else
    print_status "Nessun errore rilevato nei log MongoDB"
fi

# Step 9: Test connessione
print_info "Test connessione MongoDB..."
sleep 3

if docker-compose -f "$DOCKER_COMPOSE_FILE" logs db --tail=10 | grep -q "Connection accepted"; then
    print_status "MongoDB sta accettando connessioni"
else
    print_warning "Non sono state rilevate connessioni attive (potrebbe essere normale)"
fi

echo
print_status "🎉 Riparazione MongoDB completata con successo!"
echo
print_info "Riepilogo operazioni eseguite:"
echo -e "  ${GREEN}${NC} Servizi fermati"
echo -e "  ${GREEN}${NC} Dati corrotti rimossi"
echo -e "  ${GREEN}${NC} Directory MongoDB ricreata"
echo -e "  ${GREEN}${NC} Volumi Docker puliti"
echo -e "  ${GREEN}${NC} Servizi riavviati"
echo -e "  ${GREEN}${NC} MongoDB funzionante"
echo
print_info "Per monitorare MongoDB: docker-compose -f $DOCKER_COMPOSE_FILE logs db -f"
print_info "Per vedere lo stato: docker-compose -f $DOCKER_COMPOSE_FILE ps"

exit 0