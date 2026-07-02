#!/bin/bash
################################################################################
# Configuration Persistence Check Script
################################################################################
# This script verifies that all persistent data and configurations remain intact
# after running dev-reinstall.sh. It checks all mounted volumes and critical
# configuration files for each service in the Docker Compose stack.
################################################################################

set -uo pipefail

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m' # No Color

# Script directory and project root
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Counters for reporting
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0

################################################################################
# UTILITY FUNCTIONS
################################################################################

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((PASSED_CHECKS++))
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((FAILED_CHECKS++))
}

check_file() {
    local file_path="$1"
    local description="$2"
    ((TOTAL_CHECKS++))
    
    if [[ -f "$file_path" ]]; then
        log_success "$description: $file_path"
        return 0
    else
        log_error "$description: $file_path (NOT FOUND)"
        return 1
    fi
}

check_directory() {
    local dir_path="$1"
    local description="$2"
    ((TOTAL_CHECKS++))
    
    if [[ -d "$dir_path" ]]; then
        log_success "$description: $dir_path"
        return 0
    else
        log_error "$description: $dir_path (NOT FOUND)"
        return 1
    fi
}

check_file_content() {
    local file_path="$1"
    local expected_content="$2"
    local description="$3"
    ((TOTAL_CHECKS++))
    
    if [[ -f "$file_path" ]]; then
        if grep -q "$expected_content" "$file_path" 2>/dev/null; then
            log_success "$description: Content verified"
            return 0
        else
            log_warning "$description: Content pattern '$expected_content' not found"
            return 1
        fi
    else
        log_error "$description: File not found ($file_path)"
        return 1
    fi
}

check_docker_volume() {
    local volume_name="$1"
    local description="$2"
    ((TOTAL_CHECKS++))
    
    if docker volume inspect "$volume_name" >/dev/null 2>&1; then
        log_success "$description: Docker volume exists"
        return 0
    else
        log_error "$description: Docker volume missing"
        return 1
    fi
}

print_separator() {
    echo -e "\n${BLUE}=================================================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}=================================================================================${NC}\n"
}

################################################################################
# CONFIGURATION CHECKS
################################################################################

check_environment_files() {
    print_separator "ENVIRONMENT CONFIGURATION"
    
    # Environment file unico (in root, usato sia da Compose per la sostituzione
    # ${...} sia come env_file dei container)
    check_file "$PROJECT_ROOT/.env" "Environment file (root)"

    # Verify key configurations exist
    if [[ -f "$PROJECT_ROOT/.env" ]]; then
        check_file_content "$PROJECT_ROOT/.env" "ELASTICSEARCH_PASSWORD=" "Elasticsearch password"
        check_file_content "$PROJECT_ROOT/.env" "APM_SECRET_TOKEN=" "APM secret token"
        check_file_content "$PROJECT_ROOT/.env" "ELASTIC_APM_RUM_SECRET_TOKEN=" "RUM secret token"
        check_file_content "$PROJECT_ROOT/.env" "KIBANA_SYSTEM_PASSWORD=" "Kibana system password"
    fi
}

check_traefik() {
    print_separator "TRAEFIK (REVERSE PROXY) CONFIG"

    # La config Traefik e' versionata nel repo (routing via label sui container),
    # quindi non c'e' stato runtime da persistere come con NPM.
    check_file "$PROJECT_ROOT/docker/traefik/traefik.yml" "Traefik static config"
}

check_elasticsearch() {
    print_separator "ELASTICSEARCH PERSISTENCE"
    
    # Check Elasticsearch data directory
    check_directory "$PROJECT_ROOT/docker/volumes/logs/esdata" "Elasticsearch data directory"
    
    # Check Docker volume (may not exist if services haven't been started)
    ((TOTAL_CHECKS++))
    if docker volume inspect "progetti_innovativi_esdata" >/dev/null 2>&1; then
        log_success "Elasticsearch data volume: Docker volume exists"
        ((PASSED_CHECKS++))
    else
        log_warning "Elasticsearch data volume: Not created yet (normal if services not started)"
        ((PASSED_CHECKS++))
    fi
    
    # Check for Elasticsearch data files
    if [[ -d "$PROJECT_ROOT/docker/volumes/logs/esdata" ]]; then
        if find "$PROJECT_ROOT/docker/volumes/logs/esdata" -type f -name "*.dat" -o -name "*.tim" -o -name "*.tip" | head -1 | grep -q .; then
            log_success "Elasticsearch index files found"
            ((PASSED_CHECKS++))
        else
            log_warning "No Elasticsearch index files found (may be normal for fresh install)"
        fi
        ((TOTAL_CHECKS++))
    fi
}

check_kibana() {
    print_separator "KIBANA PERSISTENCE"
    
    # Check Kibana configuration
    check_file "$PROJECT_ROOT/docker/volumes/kibana/config/kibana.yml" "Kibana configuration file"
    
    # Check Kibana data directory
    check_directory "$PROJECT_ROOT/docker/volumes/kibana/data" "Kibana data directory"
    
    # Verify Kibana config content
    if [[ -f "$PROJECT_ROOT/docker/volumes/kibana/config/kibana.yml" ]]; then
        check_file_content "$PROJECT_ROOT/docker/volumes/kibana/config/kibana.yml" "elasticsearch.hosts:" "Kibana Elasticsearch connection"
        check_file_content "$PROJECT_ROOT/docker/volumes/kibana/config/kibana.yml" "server.host:" "Kibana server configuration"
    fi
}

check_apm_server() {
    print_separator "APM SERVER PERSISTENCE"
    
    # Note: APM Server typically doesn't need persistent storage as it forwards data
    # But we check if there are any custom configurations
    
    log_info "APM Server uses stateless configuration (no persistent storage required)"
    
    # Verify APM configuration in environment
    if [[ -f "$PROJECT_ROOT/.env" ]]; then
        check_file_content "$PROJECT_ROOT/.env" "APM_SECRET_TOKEN=" "APM secret token configuration"
        check_file_content "$PROJECT_ROOT/.env" "APM_SERVER_URL=" "APM server URL configuration"
        check_file_content "$PROJECT_ROOT/.env" "ELASTIC_APM_RUM_SECRET_TOKEN=" "RUM token configuration"
    fi
}

check_elastic_agent() {
    print_separator "ELASTIC AGENT (FLEET-MANAGED)"

    # Gli agent sono gestiti da Fleet: la configurazione vive nelle policy su
    # Kibana/Elasticsearch, non in un file locale. Nessun file da verificare qui.
    echo "  Agent gestiti da Fleet: nessun file di config locale."
}

check_filebeat() {
    print_separator "FILEBEAT PERSISTENCE"

    # Filebeat raccoglie i log dei container e li invia a Elasticsearch.
    check_file "$PROJECT_ROOT/docker/volumes/filebeat/filebeat.yml" "Filebeat configuration"
}

check_mongodb() {
    print_separator "MONGODB PERSISTENCE"
    
    # Check MongoDB data directory
    check_directory "$PROJECT_ROOT/docker/volumes/mongodb" "MongoDB data directory"
    
    # Check MongoDB logs directory
    check_directory "$PROJECT_ROOT/docker/volumes/logs/mongodb" "MongoDB logs directory"
    
    # Check MongoDB init scripts
    check_directory "$PROJECT_ROOT/docker/init-db" "MongoDB init scripts directory"
    
    # Check for MongoDB data files
    if [[ -d "$PROJECT_ROOT/docker/volumes/mongodb" ]]; then
        find "$PROJECT_ROOT/docker/volumes/mongodb" -name "*.wt" -o -name "*.bson" | head -5 | while read -r db_file; do
            check_file "$db_file" "MongoDB data file"
        done
    fi
}

check_redis() {
    print_separator "REDIS PERSISTENCE"
    
    # Check Redis configuration files
    check_file "$PROJECT_ROOT/docker/redis/redis.conf" "Redis configuration file"
    check_file "$PROJECT_ROOT/docker/redis/users.acl" "Redis ACL configuration"
    
    # Verify Redis config content
    if [[ -f "$PROJECT_ROOT/docker/redis/redis.conf" ]]; then
        check_file_content "$PROJECT_ROOT/docker/redis/redis.conf" "aclfile" "Redis ACL file reference"
    fi
    
    if [[ -f "$PROJECT_ROOT/docker/redis/users.acl" ]]; then
        check_file_content "$PROJECT_ROOT/docker/redis/users.acl" "user" "Redis user definitions"
    fi
}

check_redis_commander() {
    print_separator "REDIS COMMANDER PERSISTENCE"
    
    # Redis Commander is stateless, but check environment configuration
    if [[ -f "$PROJECT_ROOT/.env" ]]; then
        check_file_content "$PROJECT_ROOT/.env" "REDIS_UI_HOSTS=" "Redis Commander hosts configuration"
        check_file_content "$PROJECT_ROOT/.env" "REDIS_UI_PORT=" "Redis Commander port configuration"
    fi
    
    log_info "Redis Commander uses stateless configuration (no persistent storage required)"
}

check_frontend_rum() {
    print_separator "FRONTEND RUM CONFIGURATION"
    
    # Check RUM configuration files
    check_file "$PROJECT_ROOT/frontend/src/apm-rum-config.js" "RUM configuration file"
    
    # Check if APM is properly integrated in main.ts
    check_file "$PROJECT_ROOT/frontend/src/main.ts" "Frontend main entry point"
    
    if [[ -f "$PROJECT_ROOT/frontend/src/main.ts" ]]; then
        check_file_content "$PROJECT_ROOT/frontend/src/main.ts" "apm-rum-config" "RUM import in main.ts"
        check_file_content "$PROJECT_ROOT/frontend/src/main.ts" "window.apm" "RUM global exposure"
    fi
    
    # Check RUM environment variables
    local env_files=("$PROJECT_ROOT/.env")
    local rum_vars_found=false
    
    for env_file in "${env_files[@]}"; do
        if [[ -f "$env_file" ]]; then
            if grep -q "VITE_ELASTIC_APM_RUM_SERVER_URL=" "$env_file" 2>/dev/null ||
               grep -q "ELASTIC_APM_RUM_SERVER_URL=" "$env_file" 2>/dev/null; then
                check_file_content "$env_file" "ELASTIC_APM_RUM_SERVER_URL=" "RUM server URL"
                rum_vars_found=true
                break
            fi
        fi
    done
    
    if [[ "$rum_vars_found" == false ]]; then
        ((TOTAL_CHECKS++))
        log_warning "RUM server URL: Not found in either .env file"
    fi
}

check_docker_compose() {
    print_separator "DOCKER COMPOSE CONFIGURATION"
    
    # Check main docker-compose file
    check_file "$PROJECT_ROOT/docker-compose.dev.yml" "Docker Compose development file"
    
    # Verify key service configurations
    if [[ -f "$PROJECT_ROOT/docker-compose.dev.yml" ]]; then
        check_file_content "$PROJECT_ROOT/docker-compose.dev.yml" "elasticsearch:" "Elasticsearch service"
        check_file_content "$PROJECT_ROOT/docker-compose.dev.yml" "kibana:" "Kibana service"
        check_file_content "$PROJECT_ROOT/docker-compose.monitoring.yml" "apm-agent:" "APM Agent service"
        check_file_content "$PROJECT_ROOT/docker-compose.monitoring.yml" "infra-agent:" "Fleet-managed infra agent service"
        check_file_content "$PROJECT_ROOT/docker-compose.monitoring.yml" "filebeat:" "Filebeat service"
        check_file_content "$PROJECT_ROOT/docker-compose.dev.yml" "volumes:" "Volume definitions"
    fi
}

check_apm_configuration_docs() {
    print_separator "APM CONFIGURATION DOCUMENTATION"
    
    # Check if APM configuration documentation exists
    check_file "$PROJECT_ROOT/APM_CONFIGURATION.md" "APM configuration documentation"
    
    if [[ -f "$PROJECT_ROOT/APM_CONFIGURATION.md" ]]; then
        check_file_content "$PROJECT_ROOT/APM_CONFIGURATION.md" "Secret Token Strategy" "APM token strategy documentation"
        check_file_content "$PROJECT_ROOT/APM_CONFIGURATION.md" "RUM Token" "RUM token documentation"
        check_file_content "$PROJECT_ROOT/APM_CONFIGURATION.md" "Environment Variables" "Environment variables documentation"
    fi
}

################################################################################
# MAIN EXECUTION
################################################################################

main() {
    log_info "Starting persistent configuration check..."
    log_info "Project root: $PROJECT_ROOT"
    echo ""
    
    # Run all checks
    check_environment_files
    check_traefik
    check_elasticsearch
    check_kibana
    check_apm_server
    check_elastic_agent
    check_filebeat
    check_mongodb
    check_redis
    check_redis_commander
    check_frontend_rum
    check_docker_compose
    check_apm_configuration_docs
    
    # Print summary
    print_separator "CONFIGURATION PERSISTENCE SUMMARY"
    
    echo -e "📊 ${BLUE}Check Results:${NC}"
    echo -e "   Total Checks: ${TOTAL_CHECKS}"
    echo -e "   ${GREEN}Passed: ${PASSED_CHECKS}${NC}"
    echo -e "   ${RED}Failed: ${FAILED_CHECKS}${NC}"
    
    if [[ $FAILED_CHECKS -eq 0 ]]; then
        echo -e "\n🎉 ${GREEN}All persistent configurations are intact!${NC}"
        echo -e "   Your dev-reinstall process preserves all critical data."
        exit 0
    else
        echo -e "\n⚠️  ${YELLOW}Some configurations may need attention.${NC}"
        echo -e "   Review the failed checks above."
        
        if [[ $FAILED_CHECKS -gt 5 ]]; then
            echo -e "\n❌ ${RED}Critical configuration loss detected!${NC}"
            echo -e "   Consider running setup scripts to restore configurations."
            exit 1
        else
            echo -e "\n💡 ${BLUE}Minor issues detected, but core functionality should work.${NC}"
            exit 0
        fi
    fi
}

# Show help if requested
if [[ "${1:-}" == "--help" ]] || [[ "${1:-}" == "-h" ]]; then
    echo "Configuration Persistence Check Script"
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "This script verifies that all persistent data and configurations"
    echo "remain intact after running dev-reinstall.sh"
    echo ""
    echo "Checks include:"
    echo "  - Environment variables (.env)"
    echo "  - Traefik routing configuration"
    echo "  - Elasticsearch data and indices"
    echo "  - Kibana configuration and data"
    echo "  - APM Server and RUM configurations"
    echo "  - Fleet-managed Elastic Agent configuration"
    echo "  - Filebeat log collection"
    echo "  - MongoDB data and init scripts"
    echo "  - Redis configuration and ACL"
    echo "  - Docker Compose service definitions"
    echo "  - Frontend RUM integration"
    echo ""
    echo "Options:"
    echo "  -h, --help    Show this help message"
    echo ""
    exit 0
fi

# Run the main function
main "$@"
