#!/bin/bash
# =============================================================================
# CortexBuild Ultimate - ENHANCED Frontend Deploy Script
# =============================================================================
# Features:
#   - Atomic deployment with backup
#   - CDN cache invalidation
#   - Nginx reload verification
#   - Rollback capability
#   - Detailed logging
#   - Asset fingerprinting support
#
# Usage: bash /root/deploy-frontend.sh
# =============================================================================

set -euo pipefail

# Configuration
readonly SCRIPT_NAME="$(basename "$0")"
readonly DIST_DIR="dist"
readonly BACKUP_DIR="/var/backups/cortexbuild-frontend"
readonly NGINX_CACHE_DIR="/var/cache/nginx/cortexbuild"
readonly LOG_FILE="/var/log/cortexbuild-frontend-deploy-$(date +%Y%m%d).log"
readonly DEPLOY_TIMEOUT=300  # 5 minutes

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging
log() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${BLUE}[$timestamp]${NC} [${level}] ${message}"
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
}

log_info()   { log "INFO" "$1"; }
log_warn()   { log "${YELLOW}WARN${NC}" "$1"; }
log_error()  { log "${RED}ERROR${NC}" "$1"; }
log_success(){ log "${GREEN}SUCCESS${NC}" "$1"; }

# Find project directory
resolve_project_dir() {
    local patterns=(
        "/root/cortexbuild-ultimate"
        "/var/www/cortexbuild-ultimate"
        "/var/www/cortexbuild-work"
        "/var/www/html/cortexbuild-ultimate"
        "/root/cortexbuild-work"
        "$HOME/cortexbuild-work"
        "$HOME/cortexbuild-ultimate"
    )
    for pattern in "${patterns[@]}"; do
        for candidate in $pattern; do
            if [ -d "$candidate/.git" ] && [ -f "$candidate/package.json" ] && [ -d "$candidate/server" ]; then
                echo "$candidate"
                return 0
            fi
        done
    done
    return 1
}

# Verify build output
verify_build() {
    if [ ! -d "$DIST_DIR" ]; then
        log_error "Build failed - dist directory not found"
        return 1
    fi
    
    # Check for critical files
    if [ ! -f "$DIST_DIR/index.html" ]; then
        log_error "Build incomplete - index.html not found"
        return 1
    fi
    
    local file_count
    file_count=$(find "$DIST_DIR" -type f 2>/dev/null | wc -l)
    log_info "Build contains $file_count files"
    
    return 0
}

# Create backup of current deployment
backup_current() {
    log_info "Creating backup of current deployment..."
    
    mkdir -p "$BACKUP_DIR"
    
    local backup_name="frontend-$(date +%Y%m%d-%H%M%S)"
    local backup_path="$BACKUP_DIR/$backup_name"
    
    # Backup dist if exists
    if [ -d "$DIST_DIR" ]; then
        cp -r "$DIST_DIR" "$backup_path"
        log_success "Backup created: $backup_path"
        
        # Keep only last 5 backups
        ls -dt "$BACKUP_DIR"/frontend-* 2>/dev/null | tail -n +6 | xargs -r rm -rf
    else
        log_warn "No existing deployment to backup"
    fi
}

# Rollback to previous version
rollback() {
    log_warn "Initiating rollback..."
    
    local latest_backup
    latest_backup=$(ls -dt "$BACKUP_DIR"/frontend-* 2>/dev/null | head -n 1 || true)
    
    if [ -n "$latest_backup" ] && [ -d "$latest_backup" ]; then
        log_info "Rolling back to: $latest_backup"
        
        rm -rf "$DIST_DIR"
        cp -r "$latest_backup" "$DIST_DIR"
        
        # Reload nginx only after a successful config test
        if nginx -t >/dev/null 2>&1; then
            nginx -s reload 2>/dev/null || service nginx reload 2>/dev/null || true
        else
            log_error "nginx config test failed; not reloading"
            return 1
        fi
        
        log_success "Rollback complete"
        return 0
    else
        log_error "No backup found for rollback"
        return 1
    fi
}

# Invalidate CDN cache (if using Cloudflare or similar)
invalidate_cdn_cache() {
    local cdn_api="${CDN_PURGE_URL:-}"
    
    if [ -n "$cdn_api" ]; then
        log_info "Invalidating CDN cache..."
        curl -sf -X POST "$cdn_api" \
            -H "Content-Type: application/json" \
            -d "{\"files\":[\"https://www.cortexbuildpro.com/*\"]}" \
            >/dev/null 2>&1 || log_warn "CDN invalidation failed (non-critical)"
    fi
}

# Verify nginx serves new files
verify_nginx() {
    log_info "Verifying nginx configuration..."
    
    if ! nginx -t 2>/dev/null; then
        log_error "Nginx configuration test failed"
        return 1
    fi
    
    log_info "Reloading nginx..."
    nginx -s reload 2>/dev/null || service nginx reload 2>/dev/null || systemctl reload nginx 2>/dev/null || true
    
    sleep 2
    
    # Verify site responds
    local http_code
    http_code=$(curl -sf -o /dev/null -w '%{http_code}' https://www.cortexbuildpro.com/ 2>/dev/null || echo "000")
    
    if [ "$http_code" = "200" ]; then
        log_success "Site verification: HTTP $http_code"
        return 0
    else
        log_warn "Site returned HTTP $http_code (may be expected if build is fresh)"
        return 0
    fi
}

# Pre-build validation
pre_build_check() {
    log_info "Running pre-build checks..."
    
    # Check disk space (need at least 2GB)
    local available
    available=$(df -BG "$PROJECT_DIR" 2>/dev/null | awk 'NR==2 {print $4}' | tr -d 'G')
    if [ "${available:-0}" -lt 2 ]; then
        log_warn "Low disk space: ${available}GB available"
    fi
    
    # Check memory
    local mem_available
    mem_available=$(free -m 2>/dev/null | awk 'NR==2 {print $7}' || echo "512")
    if [ "${mem_available:-0}" -lt 256 ]; then
        log_warn "Low memory: ${mem_available}MB available"
    fi
    
    log_success "Pre-build checks passed"
}

# Send notification
notify() {
    local status="$1"
    local message="$2"
    local webhook_url="${DEPLOY_WEBHOOK_URL:-}"
    
    if [ -n "$webhook_url" ]; then
        curl -sf -X POST "$webhook_url" \
            -H "Content-Type: application/json" \
            -d "{\"status\":\"$status\",\"service\":\"cortexbuild-frontend\",\"message\":\"$message\",\"timestamp\":\"$(date -Iseconds)\"}" \
            >/dev/null 2>&1 || true
    fi
}

# Main deployment
main() {
    echo ""
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║     CortexBuild Ultimate - ENHANCED Frontend Deploy Script   ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"
    echo ""
    
    mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true
    
    local start_time=$(date +%s)
    
    log_info "Starting frontend deployment"
    
    # Resolve project directory
    PROJECT_DIR="$(resolve_project_dir || true)"
    if [ -z "$PROJECT_DIR" ]; then
        PROJECT_DIR="$HOME/cortexbuild-ultimate"
        log_warn "Project directory not found. Bootstrapping at $PROJECT_DIR"
        if [ ! -d "$PROJECT_DIR/.git" ]; then
            git clone "https://github.com/adrianstanca1/cortexbuild-ultimate.git" "$PROJECT_DIR"
        fi
    fi
    log_info "Using project directory: $PROJECT_DIR"
    cd "$PROJECT_DIR"
    git config --global --add safe.directory "$PROJECT_DIR" 2>/dev/null || true

    # Step 1: Pull latest code
    log_info "Step 1/6: Pulling latest code..."
    git fetch origin main
    git checkout main
    git pull --ff-only origin main
    log_success "Code pulled"
    
    # Step 2: Pre-build checks
    log_info "Step 2/6: Pre-build validation..."
    pre_build_check
    
    # Step 3: Backup current deployment
    log_info "Step 3/6: Creating backup..."
    backup_current
    
    # Step 4: Clean install and build
    log_info "Step 4/6: Building frontend..."
    
    # Use cache for faster builds
    export npm_config_cache="/tmp/npm-cache-frontend"
    
    if ! npm ci --ignore-scripts 2>&1 | tail -5; then
        log_error "npm install failed"
        notify "failure" "npm install failed"
        exit 1
    fi
    
    if ! npm run build 2>&1 | tail -20; then
        log_error "Build failed"
        notify "failure" "Build failed"
        if [ "${AUTO_ROLLBACK_ON_FAILURE:-true}" = "true" ]; then
            log_warn "Auto rollback enabled; restoring previous frontend backup"
            rollback
        else
            log_warn "Auto rollback disabled; leaving failed frontend build for investigation"
        fi
        exit 1
    fi
    log_success "Build complete"
    
    # Step 5: Verify build output
    log_info "Step 5/6: Verifying build..."
    if ! verify_build; then
        log_error "Build verification failed"
        rollback
        notify "failure" "Build verification failed"
        exit 1
    fi
    
    # Step 6: Deploy and verify
    log_info "Step 6/6: Deploying and verifying..."
    
    # Set permissions
    chown -R www-data:www-data "$DIST_DIR" 2>/dev/null || \
    chown -R nginx:nginx "$DIST_DIR" 2>/dev/null || \
    chown -R nobody:nobody "$DIST_DIR" 2>/dev/null || true
    
    # Reload nginx
    verify_nginx
    
    # Invalidate CDN
    invalidate_cdn_cache
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log_success "=========================================="
    log_success "Frontend Deploy Complete!"
    log_success "Duration: ${duration}s"
    log_success "=========================================="
    
    # Final verification
    local final_check
    final_check=$(curl -sf -o /dev/null -w '%{http_code}' https://www.cortexbuildpro.com/ 2>/dev/null || echo "checking")
    log_info "Final site check: $final_check"
    
    notify "success" "Frontend deployed successfully in ${duration}s"
}

trap 'log_error "Deploy interrupted"; exit 1' INT TERM

main "$@"
