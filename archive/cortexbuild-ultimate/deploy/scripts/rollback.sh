#!/bin/bash
# =============================================================================
# CortexBuild Ultimate - Rollback Script
# =============================================================================
# Rollback API or Frontend to previous version
#
# Usage: bash rollback.sh [--api | --frontend] [--list]
# =============================================================================

set -euo pipefail

readonly VPS_HOST="${VPS_HOST:-root@72.62.132.43}"
readonly VPS_PATH="${VPS_PATH:-/root/cortexbuild-ultimate}"
if [[ -z "${SSH_KEY:-}" ]]; then
    if [[ -f "$HOME/.ssh/gh_actions_ed25519" ]]; then
        SSH_KEY="$HOME/.ssh/gh_actions_ed25519"
    else
        SSH_KEY="$HOME/.ssh/id_ed25519_vps"
    fi
fi
readonly SSH_KEY
readonly SSH_OPTS="-o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new -o IdentitiesOnly=yes -i $SSH_KEY"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} [$1] $2"; }
log_info()   { log "${BLUE}INFO${NC}" "$1"; }
log_success(){ log "${GREEN}SUCCESS${NC}" "$1"; }
log_warn()   { log "${YELLOW}WARN${NC}" "$1"; }
log_error()  { log "${RED}ERROR${NC}" "$1"; }

# List available backups
list_backups() {
    echo ""
    log_info "Available backups on VPS:"
    echo ""
    
    ssh $SSH_OPTS "$VPS_HOST" "
        echo '=== API Backups ==='
        ls -la /var/backups/cortexbuild-api/ 2>/dev/null | grep -v '^total' || echo '  No API backups'
        echo ''
        echo '=== Frontend Backups ==='
        ls -la /var/backups/cortexbuild-frontend/ 2>/dev/null | grep -v '^total' || echo '  No frontend backups'
        echo ''
        echo '=== Code Backups ==='
        ls -la /var/backups/cortexbuild-code/ 2>/dev/null | grep -v '^total' || echo '  No code backups'
    "
}

# Rollback API
rollback_api() {
    log_info "Rolling back API..."
    
    # Find latest backup
    local backup_image
    backup_image=$(ssh $SSH_OPTS "$VPS_HOST" "
        docker images --format '{{.Repository}}:{{.Tag}}' | grep '^cortexbuild-api-backup-' | head -1
    ")
    
    if [ -z "$backup_image" ]; then
        log_error "No API backup found"
        return 1
    fi
    
    log_info "Using backup: $backup_image"
    
    if ! ssh $SSH_OPTS "$VPS_HOST" "
        set -e
        echo 'Stopping current API...'
        docker stop cortexbuild-api 2>/dev/null || true
        docker rm cortexbuild-api 2>/dev/null || true
        
        NET=\$(docker inspect -f '{{range \$k,\$v := .NetworkSettings.Networks}}{{println \$k}}{{end}}' cortexbuild-db 2>/dev/null | awk '/cortexbuild/ {print; exit}')
        NET=\${NET:-cortexbuild}
        echo \"Starting rolled back version on network \$NET...\"
        docker run -d \
            --name cortexbuild-api \
            --restart always \
            --network \"\$NET\" \
            -p 127.0.0.1:3001:3001 \
            --env-file $VPS_PATH/.env \
            $backup_image
        
        echo 'Waiting for health...'
        sleep 5
        
        if curl -sf http://localhost:3001/api/health >/dev/null 2>&1; then
            echo 'API healthy'
        else
            echo 'API health check failed after rollback'
            exit 1
        fi
    "; then
        log_error "API rollback failed on VPS"
        return 1
    fi
    
    log_success "API rollback complete"
}

# Rollback frontend
rollback_frontend() {
    log_info "Rolling back frontend..."
    
    local backup_path
    backup_path=$(ssh $SSH_OPTS "$VPS_HOST" "
        ls -dt /var/backups/cortexbuild-frontend/frontend-* 2>/dev/null | head -1
    ")
    
    if [ -z "$backup_path" ]; then
        log_error "No frontend backup found"
        return 1
    fi
    
    log_info "Using backup: $backup_path"
    
    ssh $SSH_OPTS "$VPS_HOST" "
        echo 'Restoring frontend...'
        rm -rf $VPS_PATH/dist
        cp -r '$backup_path' $VPS_PATH/dist
        
        echo 'Reloading nginx...'
        if nginx -t >/dev/null 2>&1; then
            nginx -s reload || service nginx reload
        else
            echo 'nginx config test failed; not reloading'
            exit 1
        fi
    "
    
    log_success "Frontend rollback complete"
}

# Rollback code (git)
rollback_code() {
    local commit="${1:-HEAD~1}"
    
    log_info "Rolling back code to: $commit"
    
    ssh $SSH_OPTS "$VPS_HOST" "
        cd $VPS_PATH
        echo 'Checking out previous commit...'
        git reset --hard $commit
        git clean -fd
        
        echo 'Restarting services...'
        docker restart cortexbuild-api 2>/dev/null || true
        if nginx -t >/dev/null 2>&1; then
            nginx -s reload || service nginx reload
        else
            echo 'nginx config test failed; not reloading'
            exit 1
        fi
    "
    
    log_success "Code rollback complete"
}

# Main
main() {
    local target="${1:-}"
    
    case "$target" in
        --api|-a)
            rollback_api
            ;;
        --frontend|-f)
            rollback_frontend
            ;;
        --code|-c)
            rollback_code "${2:-HEAD~1}"
            ;;
        --list|-l)
            list_backups
            ;;
        *)
            echo ""
            echo "Usage: $0 [--api|--frontend|--code] [commit]"
            echo ""
            echo "Options:"
            echo "  --api, -a       Rollback API container"
            echo "  --frontend, -f  Rollback frontend files"
            echo "  --code, -c      Rollback code to previous git commit"
            echo "  --list, -l      List available backups"
            echo ""
            echo "Examples:"
            echo "  $0 --list              # See available backups"
            echo "  $0 --api               # Rollback API"
            echo "  $0 --frontend          # Rollback frontend"
            echo "  $0 --code HEAD~1       # Rollback to previous commit"
            exit 1
            ;;
    esac
}

main "$@"
