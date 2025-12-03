#!/usr/bin/env bash
set -euo pipefail

###############################################################################
# scripts/cleanup.sh
# 
# Script centralizzato di pulizia intelligente con modalità multiple:
#   --dev        : Pulizia completa per sviluppo (equivale al vecchio clean_build.sh)
#   --production : Pulizia selettiva per deployment produzione  
#   --full       : Pulizia totale (attenzione: cancella TUTTO)
#   --soft       : Pulizia leggera (solo cache e build artifacts)
#
# Preserva sempre:
#   - Configurazioni NGINX Proxy Manager
#   - Certificati SSL Let's Encrypt  
#   - Configurazioni Kibana
#   - File environment (.env)
#   - Dashboard Kibana (se protette)
###############################################################################

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

# Backup automatico configurazioni critiche
backup_critical_configs() {
    print_header "Backup Configurazioni Critiche"
    
    local backup_dir="backups/config-$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$backup_dir"
    
    # Backup Kibana
    if [ -d "docker/volumes/kibana/config" ]; then
        cp -r docker/volumes/kibana/config "$backup_dir/kibana-config"
        print_success "Backup configurazione Kibana"
    fi
    
    # Backup dashboard se esistono
    if [ -d "docker/volumes/kibana/data" ] && [ "$(find docker/volumes/kibana/data -name "*.ndjson" 2>/dev/null | wc -l)" -gt 0 ]; then
        mkdir -p "$backup_dir/kibana-dashboards"
        find docker/volumes/kibana/data -name "*.ndjson" -exec cp {} "$backup_dir/kibana-dashboards/" \; 2>/dev/null || true
        print_success "Backup dashboard Kibana"
    fi
    
    # Backup NGINX Proxy Manager configs essenziali
    if [ -d "docker/volumes/npm_data" ]; then
        tar -czf "$backup_dir/npm-configs.tar.gz" docker/volumes/npm_data/database.sqlite docker/volumes/npm_data/keys.json 2>/dev/null || true
        print_success "Backup configurazioni NGINX Proxy Manager"
    fi
    
    # Backup environment files
    cp .env "$backup_dir/" 2>/dev/null || true
    cp docker/env/.env "$backup_dir/docker-env" 2>/dev/null || true
    print_success "Backup file environment"
    
    print_info "Backup salvato in: $backup_dir"
}

# Pulizia artifacts di build
clean_build_artifacts() {
    print_header "Pulizia Build Artifacts"
    
    # JavaScript/Node.js artifacts
    for dir in frontend server sandbox; do
        if [ -d "$dir" ]; then
            rm -rf "$dir/dist" "$dir/node_modules" "$dir/package-lock.json" 2>/dev/null || true
            print_success "Rimossi artifacts $dir"
        fi
    done
    
    # Go build cache (se presente)
    rm -rf server/tmp/main 2>/dev/null || true
    print_success "Rimossi artifacts Go"
}

# Pulizia Docker completa
clean_docker_full() {
    print_header "Pulizia Docker Completa"
    
    # Stop e rimozione container
    docker compose down --volumes --remove-orphans 2>/dev/null || true
    print_success "Container fermati e rimossi"
    
    # Pulizia sistema Docker
    docker system prune -af --volumes 2>/dev/null || true
    print_success "Risorse Docker inutilizzate rimosse"
    
    # Pulizia cache builder
    docker builder prune --all --force 2>/dev/null || true
    print_success "Cache Docker builder rimossa"
}

# Pulizia dati sviluppo (preserva configurazioni)
clean_development_data() {
    print_header "Pulizia Dati Sviluppo"
    
    # MongoDB dati sviluppo
    if [ -d "docker/volumes/mongodb" ]; then
        rm -rf docker/volumes/mongodb/*
        print_success "Database MongoDB sviluppo rimosso"
    fi
    
    # Elasticsearch dati
    if [ -d "docker/volumes/logs/esdata" ]; then
        rm -rf docker/volumes/logs/esdata/*
        print_success "Dati Elasticsearch sviluppo rimossi"
    fi
    
    # Log MongoDB
    if [ -d "docker/volumes/logs/mongodb" ]; then
        rm -rf docker/volumes/logs/mongodb/*
        print_success "Log MongoDB sviluppo rimossi"
    fi
    
    # Fluent Bit cache
    if [ -d "docker/volumes/fluent-bit-db" ]; then
        rm -rf docker/volumes/fluent-bit-db/*.db*
        print_success "Cache Fluent Bit rimossa"
    fi
    
    # Kibana: PRESERVATO COMPLETAMENTE per evitare perdita configurazioni
    # La directory docker/volumes/kibana/ non viene mai toccata durante la pulizia
    # per mantenere intatte tutte le configurazioni, dashboard e impostazioni Fleet
    print_success "Directory Kibana preservata completamente (configurazioni, dashboard, Fleet)"
}

# Pulizia produzione (solo dati sviluppo)
clean_production_data() {
    print_header "Pulizia Selettiva per Produzione"
    
    # Stop servizi
    docker compose down 2>/dev/null || true
    
    # Backup automatico prima della pulizia
    backup_critical_configs
    
    # Pulizia solo dati sviluppo
    clean_development_data
    
    print_header "Verifica Configurazioni Preservate"
    
    configs_ok=true
    
    # Verifica configurazioni critiche
    if [ -f "docker/volumes/kibana/config/kibana.yml" ]; then
        print_success "Configurazione Kibana preservata"
    else
        print_error "Configurazione Kibana mancante!"
        configs_ok=false
    fi
    
    if [ -d "docker/volumes/npm_data" ]; then
        print_success "Configurazioni NGINX Proxy Manager preservate"
    else
        print_warning "Directory NGINX Proxy Manager non trovata"
    fi
    
    if [ -d "docker/volumes/npm_letsencrypt" ]; then
        print_success "Certificati SSL preservati"
    else
        print_warning "Directory certificati SSL non trovata"
    fi
    
    if [ -f "docker/volumes/fluent-bit/fluent-bit.conf" ]; then
        print_success "Configurazione Fluent Bit preservata"
    else
        print_warning "Configurazione Fluent Bit non trovata"
    fi
    
    if [ "$configs_ok" = true ]; then
        print_header "✅ Sistema Pronto per Deployment Produzione"
        print_info "Esegui: docker compose -f docker-compose.dev.yml up -d"
    else
        print_header "⚠️ Attenzione: Alcune Configurazioni Mancanti"
        print_info "Verifica le configurazioni prima del deployment"
    fi
}

# Pulizia completa (ATTENZIONE!)
clean_full() {
    print_header "⚠️ PULIZIA COMPLETA - CANCELLA TUTTO"
    
    echo -e "${RED}ATTENZIONE: Questa operazione cancellerà:"
    echo "• Tutti i container e volumi Docker"
    echo "• Tutte le configurazioni (NGINX, Kibana, SSL)"
    echo "• Tutti i dati (database, log, cache)"
    echo "• Tutti gli artifacts di build"
    echo -e "${NC}"
    
    read -p "Sei ASSOLUTAMENTE sicuro? Digita 'DELETE_ALL' per confermare: " confirm
    if [ "$confirm" != "DELETE_ALL" ]; then
        print_info "Operazione annullata"
        exit 0
    fi
    
    # Backup prima della distruzione
    backup_critical_configs
    
    # Rimuovi tutto
    clean_docker_full
    clean_build_artifacts
    
    # Rimuovi anche tutte le configurazioni ECCETTO Kibana (per sicurezza)
    find docker/volumes -mindepth 1 -maxdepth 1 ! -name 'kibana' -exec rm -rf {} + 2>/dev/null || true
    
    print_header "💥 Pulizia Completa Terminata"
    print_warning "Tutte le configurazioni sono state cancellate!"
    print_info "Directory Kibana preservata per sicurezza - cancella manualmente se necessario"
    print_info "Dovrai riconfigurare tutto da zero"
}

# Pulizia leggera (solo cache e build)
clean_soft() {
    print_header "Pulizia Leggera"
    
    clean_build_artifacts
    
    # Solo cache Docker, non volumi
    docker system prune -f 2>/dev/null || true
    docker builder prune --force 2>/dev/null || true
    
    print_success "Cache e artifacts rimossi"
    print_info "Configurazioni e dati preservati"
}

# Help
show_help() {
    echo "Script di pulizia centralizzato per progetti innovativi"
    echo ""
    echo "Uso: $0 [MODALITÀ]"
    echo ""
    echo "MODALITÀ:"
    echo "  --dev         Pulizia completa per sviluppo (default)"
    echo "                • Rimuove tutti i container e volumi"
    echo "                • Pulisce artifacts di build"
    echo "                • Mantiene solo configurazioni essenziali"
    echo ""
    echo "  --production  Pulizia selettiva per deployment produzione"
    echo "                • Rimuove solo dati di sviluppo"  
    echo "                • Preserva tutte le configurazioni"
    echo "                • Backup automatico prima della pulizia"
    echo ""
    echo "  --soft        Pulizia leggera"
    echo "                • Solo cache e artifacts di build"
    echo "                • Preserva tutto il resto"
    echo ""
    echo "  --full        Pulizia completa (ATTENZIONE!)"
    echo "                • Cancella TUTTO comprese configurazioni"
    echo "                • Richiede conferma esplicita"
    echo ""
    echo "  --help        Mostra questo help"
    echo ""
    echo "Esempi:"
    echo "  $0 --dev         # Pulizia sviluppo"
    echo "  $0 --production  # Prepara per produzione"
    echo "  $0 --soft        # Solo cache"
}

# Main
main() {
    case "${1:---dev}" in
        --dev)
            print_header "🔧 Modalità Sviluppo"
            backup_critical_configs
            clean_docker_full
            clean_build_artifacts
            print_header "✅ Pulizia Sviluppo Completata"
            print_info "Esegui: ./scripts/dev-rebuild.sh per ricostruire"
            ;;
        --production)
            print_header "🚀 Modalità Produzione"
            clean_production_data
            ;;
        --soft)
            print_header "🧹 Modalità Leggera"
            clean_soft
            ;;
        --full)
            clean_full
            ;;
        --help|-h)
            show_help
            ;;
        *)
            print_error "Modalità sconosciuta: $1"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

main "$@"
