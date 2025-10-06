#!/usr/bin/env bash
###############################################################################
# scripts/backup-docker.sh
# 
# Script per effettuare il backup completo della cartella docker/
# da eseguire prima di qualsiasi reinstallazione completa.
###############################################################################
set -euo pipefail

_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$_ROOT"

# Colori per output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Funzioni utility
print_header() {
    echo -e "${BLUE}🚀 === $1 ===${NC}"
}

print_success() {
    echo -e "${GREEN}   ✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}   ⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}   ❌ $1${NC}"
}

print_info() {
    echo -e "   ℹ️  $1"
}

# Default del percorso di backup
DEFAULT_BACKUP_PATH="$HOME/docker_backups"

# Funzione di backup
perform_backup() {
    local backup_path="$1"
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_dir="${backup_path}/docker_backup_${timestamp}"
    
    print_header "Backup Cartella docker/"
    print_info "Creazione backup in: ${backup_dir}"
    
    # Verifica che la cartella docker/ esista
    if [ ! -d "docker/" ]; then
        print_error "La cartella docker/ non esiste!"
        exit 1
    fi
    
    # Crea la directory di backup
    mkdir -p "${backup_path}"
    
    # Esegui il backup usando rsync (più efficiente di cp)
    if command -v rsync &> /dev/null; then
        rsync -a --info=progress2 docker/ "${backup_dir}/"
        backup_result=$?
    else
        # Fallback a cp se rsync non è disponibile
        mkdir -p "${backup_dir}"
        cp -a docker/ "${backup_dir}/"
        backup_result=$?
    fi
    
    # Verifica risultato del backup
    if [ $backup_result -eq 0 ]; then
        print_success "Backup completato con successo!"
        print_info "Percorso del backup: ${backup_dir}"
        
        # Crea un file di info sul backup
        cat > "${backup_dir}/.backup_info" << EOL
Backup effettuato il: $(date)
Da: $(whoami)@$(hostname)
Percorso origine: $(pwd)/docker/
Versione progetto: $(git describe --always --tags 2>/dev/null || echo "unknown")
Branch: $(git branch --show-current 2>/dev/null || echo "unknown")
Commit: $(git rev-parse HEAD 2>/dev/null || echo "unknown")
EOL
        
        # Verifica dimensione
        if command -v du &> /dev/null; then
            du -sh "${backup_dir}" | awk '{print "Dimensione backup: " $1}'
        fi
        
        print_header "Backup Completato con Successo"
        echo ""
        print_info "Per ripristinare questo backup:"
        echo -e "${GREEN}cp -a \"${backup_dir}/\" \"$(pwd)/docker/\"${NC}"
        echo ""
        print_warning "Ricorda: prima di ripristinare, ferma tutti i container Docker"
    else
        print_error "Errore durante il backup!"
        print_info "Controlla i permessi e lo spazio disponibile."
        exit 1
    fi
}

# Main
main() {
    print_header "Backup Completo della Cartella docker/"
    print_warning "Questo script effettua un backup completo della cartella docker/"
    print_warning "che contiene configurazioni, dati e volumi essenziali"
    
    # Verifica se abbiamo Docker attivi
    if command -v docker &> /dev/null && docker ps -q &> /dev/null; then
        running_containers=$(docker ps -q | wc -l | tr -d ' ')
        if [ "$running_containers" -gt 0 ]; then
            print_warning "Ci sono ${running_containers} container Docker attivi"
            print_info "Per un backup più sicuro, considera di fermarli prima:"
            echo -e "${YELLOW}docker compose down${NC}"
            echo ""
            read -p "Continuare comunque con il backup? (s/n): " confirm
            if [[ "$confirm" != "s" && "$confirm" != "S" ]]; then
                print_info "Backup annullato"
                exit 0
            fi
            echo ""
        fi
    fi
    
    # Chiedi percorso di backup
    read -p "Percorso per il backup [${DEFAULT_BACKUP_PATH}]: " backup_path
    backup_path=${backup_path:-$DEFAULT_BACKUP_PATH}
    
    # Espandi percorso
    backup_path=$(eval echo "$backup_path")
    
    # Verifica spazio disponibile
    if command -v df &> /dev/null; then
        docker_size=$(du -sm docker/ 2>/dev/null | awk '{print $1}' || echo "unknown")
        if [ "$docker_size" != "unknown" ]; then
            target_free_space=$(df -m "$backup_path" 2>/dev/null | awk 'NR==2 {print $4}' || echo "unknown")
            if [ "$target_free_space" != "unknown" ]; then
                if [ "$target_free_space" -lt "$docker_size" ]; then
                    print_error "Spazio insufficiente nella destinazione!"
                    print_info "Spazio richiesto: ${docker_size}MB, Spazio disponibile: ${target_free_space}MB"
                    exit 1
                else
                    print_info "Spazio richiesto: ${docker_size}MB, Spazio disponibile: ${target_free_space}MB"
                    print_success "Spazio sufficiente per il backup"
                fi
            fi
        fi
    fi
    
    # Esegui il backup
    perform_backup "$backup_path"
}

# Esegui lo script
main "$@"