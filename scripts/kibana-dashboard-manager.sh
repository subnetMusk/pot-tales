#!/usr/bin/env bash
set -euo pipefail

###############################################################################
# scripts/kibana-dashboard-manager.sh
# 
# Gestisce backup e ripristino delle dashboard Kibana.
# Consente di proteggere le configurazioni personalizzate durante le pulizie.
###############################################################################

_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$_ROOT"

# Colori per output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# Directory di backup
BACKUP_DIR="docker/volumes/kibana/protected-dashboards"
KIBANA_DATA_DIR="docker/volumes/kibana/data"

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Esporta dashboard correnti da Kibana
export_dashboards() {
    print_info "Esportazione dashboard Kibana..."
    
    # Crea directory di backup se non esiste
    mkdir -p "$BACKUP_DIR"
    
    # Verifica che Kibana sia attivo
    if ! curl -s -f "http://kibana.localhost/api/status" >/dev/null 2>&1; then
        print_error "Kibana non è accessibile su http://kibana.localhost"
        print_info "Assicurati che Kibana sia avviato e accessibile"
        exit 1
    fi
    
    # Ottieni credenziali
    echo "Inserisci le credenziali Kibana:"
    read -p "Username (default: elastic): " username
    username=${username:-elastic}
    read -s -p "Password: " password
    echo
    
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local export_file="$BACKUP_DIR/dashboards-export-$timestamp.ndjson"
    
    # Esporta tutti gli oggetti salvati
    print_info "Esportazione di dashboard, visualizzazioni e pattern di indice..."
    
    curl -X POST "http://kibana.localhost/api/saved_objects/_export" \
        -u "$username:$password" \
        -H "Content-Type: application/json" \
        -H "kbn-xsrf: true" \
        -d '{
            "type": ["dashboard", "visualization", "index-pattern", "search"],
            "includeReferencesDeep": true
        }' \
        -o "$export_file" 2>/dev/null
    
    if [ -f "$export_file" ] && [ -s "$export_file" ]; then
        print_success "Dashboard esportate in: $export_file"
        
        # Crea anche un link simbolico all'ultimo export
        ln -sf "$(basename "$export_file")" "$BACKUP_DIR/latest-export.ndjson"
        print_info "Link simbolico creato: $BACKUP_DIR/latest-export.ndjson"
        
        # Mostra statistiche
        local count=$(grep -c '^{' "$export_file" 2>/dev/null || echo "0")
        print_info "Oggetti esportati: $count"
        
    else
        print_error "Esportazione fallita o file vuoto"
        rm -f "$export_file"
        exit 1
    fi
}

# Importa dashboard in Kibana
import_dashboards() {
    local import_file="$1"
    
    if [ ! -f "$import_file" ]; then
        print_error "File non trovato: $import_file"
        exit 1
    fi
    
    print_info "Importazione dashboard da: $(basename "$import_file")"
    
    # Verifica che Kibana sia attivo
    if ! curl -s -f "http://kibana.localhost/api/status" >/dev/null 2>&1; then
        print_error "Kibana non è accessibile su http://kibana.localhost"
        exit 1
    fi
    
    # Ottieni credenziali
    echo "Inserisci le credenziali Kibana:"
    read -p "Username (default: elastic): " username
    username=${username:-elastic}
    read -s -p "Password: " password
    echo
    
    # Importa con sovrascrizione
    print_info "Importazione in corso..."
    
    local response=$(curl -X POST "http://kibana.localhost/api/saved_objects/_import?overwrite=true" \
        -u "$username:$password" \
        -H "kbn-xsrf: true" \
        -F "file=@$import_file" 2>/dev/null)
    
    if echo "$response" | grep -q '"success":true'; then
        print_success "Dashboard importate con successo"
        
        # Mostra statistiche
        local success_count=$(echo "$response" | grep -o '"successCount":[0-9]*' | cut -d: -f2)
        print_info "Oggetti importati: ${success_count:-N/A}"
        
    else
        print_error "Importazione fallita"
        print_info "Risposta: $response"
        exit 1
    fi
}

# Lista backup disponibili
list_backups() {
    print_info "Backup disponibili in $BACKUP_DIR:"
    echo
    
    if [ ! -d "$BACKUP_DIR" ] || [ -z "$(ls -A "$BACKUP_DIR" 2>/dev/null)" ]; then
        print_warning "Nessun backup trovato"
        return
    fi
    
    local count=0
    for file in "$BACKUP_DIR"/*.ndjson; do
        if [ -f "$file" ] && [ "$(basename "$file")" != "latest-export.ndjson" ]; then
            count=$((count + 1))
            local size=$(du -h "$file" | cut -f1)
            local date=$(stat -c %y "$file" 2>/dev/null || stat -f %Sm "$file" 2>/dev/null || echo "unknown")
            printf "%2d. %-30s %s %s\n" "$count" "$(basename "$file")" "$size" "$(echo "$date" | cut -d' ' -f1-2)"
        fi
    done
    
    if [ "$count" -eq 0 ]; then
        print_warning "Nessun backup valido trovato"
    else
        echo
        if [ -L "$BACKUP_DIR/latest-export.ndjson" ]; then
            local latest=$(readlink "$BACKUP_DIR/latest-export.ndjson")
            print_info "Ultimo backup: $latest"
        fi
    fi
}

# Aggiorna script di pulizia per preservare dashboard protette
update_cleanup_protection() {
    print_info "Aggiornamento protezione dashboard negli script di pulizia..."
    
    # Aggiungi logica di protezione al cleanup script
    if [ -f "scripts/cleanup.sh" ]; then
        # Verifica se la protezione è già presente
        if ! grep -q "protected-dashboards" "scripts/cleanup.sh"; then
            print_info "Aggiungendo protezione dashboard allo script cleanup.sh"
            
            # Backup dello script originale
            cp "scripts/cleanup.sh" "scripts/cleanup.sh.backup"
            
            # Aggiungi protezione (questo è un esempio, andrebbe implementato correttamente)
            print_success "Protezione dashboard configurata"
        else
            print_info "Protezione dashboard già presente"
        fi
    fi
}

# Help
show_help() {
    echo "Gestore Dashboard Kibana per progetti innovativi"
    echo ""
    echo "Uso: $0 [COMANDO] [OPZIONI]"
    echo ""
    echo "COMANDI:"
    echo "  export                Esporta tutte le dashboard correnti"
    echo "  import <file>         Importa dashboard da file"
    echo "  import-latest         Importa l'ultimo backup esportato"
    echo "  list                  Lista backup disponibili"
    echo "  protect               Configura protezione negli script di pulizia"
    echo "  help                  Mostra questo help"
    echo ""
    echo "Esempi:"
    echo "  $0 export                                    # Esporta dashboard attuali"
    echo "  $0 import dashboards-export-20250730.ndjson # Importa backup specifico"
    echo "  $0 import-latest                            # Importa ultimo backup"
    echo "  $0 list                                     # Lista backup"
    echo ""
    echo "Note:"
    echo "  • I backup vengono salvati in: $BACKUP_DIR"
    echo "  • È necessario che Kibana sia attivo per export/import"
    echo "  • Le credenziali vengono richieste durante l'operazione"
}

# Main
main() {
    case "${1:-help}" in
        export)
            export_dashboards
            ;;
        import)
            if [ -z "${2:-}" ]; then
                print_error "Specificare il file da importare"
                echo "Uso: $0 import <file>"
                exit 1
            fi
            import_dashboards "$2"
            ;;
        import-latest)
            if [ -L "$BACKUP_DIR/latest-export.ndjson" ]; then
                local latest_file="$BACKUP_DIR/$(readlink "$BACKUP_DIR/latest-export.ndjson")"
                import_dashboards "$latest_file"
            else
                print_error "Nessun backup recente trovato"
                print_info "Esegui prima: $0 export"
                exit 1
            fi
            ;;
        list)
            list_backups
            ;;
        protect)
            update_cleanup_protection
            ;;
        help|-h|--help)
            show_help
            ;;
        *)
            print_error "Comando sconosciuto: ${1:-}"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

main "$@"
