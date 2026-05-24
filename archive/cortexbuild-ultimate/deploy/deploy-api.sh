#!/bin/bash
# =============================================================================
# CortexBuild Ultimate - ENHANCED API Deploy Script
# =============================================================================
# Features:
#   - Atomic deployments with rollback on failure
#   - Comprehensive health verification
#   - Backup before deploy
#   - Detailed logging with timestamps
#   - Notification webhook support
#   - Timeout protection
#   - Docker network auto-detection
#
# Usage: bash /root/deploy-api.sh
# =============================================================================

set -euo pipefail

# Configuration
readonly SCRIPT_NAME="$(basename "$0")"
readonly CONTAINER_NAME="cortexbuild-api"
readonly IMAGE_NAME="cortexbuild-ultimate-api:latest"
readonly HEALTH_URL="http://localhost:3001/api/health"
readonly MAX_RETRIES=30
readonly RETRY_INTERVAL=2
readonly LOG_FILE="/var/log/cortexbuild-deploy-$(date +%Y%m%d).log"
readonly BACKUP_DIR="/var/backups/cortexbuild-api"
readonly DEPLOY_TIMEOUT=600  # 10 minutes max

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${BLUE}[$timestamp]${NC} [${level}] ${message}"
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
}

log_info()  { log "INFO" "$1"; }
log_warn()  { log "${YELLOW}WARN${NC}" "$1"; }
log_error() { log "${RED}ERROR${NC}" "$1"; }
log_success(){ log "${GREEN}SUCCESS${NC}" "$1"; }

# Find project directory
resolve_project_dir() {
    local candidate
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

# Verify health contract
check_cortex_health() {
    local payload
    payload=$(curl --connect-timeout 3 --max-time 8 -fsS "$HEALTH_URL" 2>/dev/null || true)
    [ -n "$payload" ] || return 1
    python3 -c "
import json,sys
d=json.loads(sys.argv[1])
c=d.get('checks') or {}
assert d.get('status')=='ok', f\"Status: {d.get('status')}\"
assert c.get('postgres') is True, 'Postgres check failed'
assert c.get('redis') is True, 'Redis check failed'
print('Health contract OK')
" "$payload" 2>/dev/null
}

# Load environment files
load_env_files() {
    local project_dir="$1"
    
    if [ -f "$project_dir/.env" ]; then
        set +u
        set -a
        source "$project_dir/.env"
        set +a
        set -u
        log_info "Loaded env from $project_dir/.env"
    fi
    
    if [ -f "$project_dir/server/.env" ]; then
        set +u
        set -a
        source "$project_dir/server/.env"
        set +a
        set -u
        log_info "Loaded env from $project_dir/server/.env"
    fi
}

# Recover secrets from existing container
recover_secrets() {
    log_info "Attempting to recover secrets from existing container..."
    
    if docker ps -a --format '{{.Names}}' | grep -Fxq "$CONTAINER_NAME" 2>/dev/null; then
        local existing_env
        existing_env=$(docker inspect "$CONTAINER_NAME" --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null || true)
        
        if [ -n "$existing_env" ]; then
            [ -z "${JWT_SECRET:-}" ] && JWT_SECRET=$(printf '%s\n' "$existing_env" | sed -n 's/^JWT_SECRET=//p' | tail -n 1)
            [ -z "${SESSION_SECRET:-}" ] && SESSION_SECRET=$(printf '%s\n' "$existing_env" | sed -n 's/^SESSION_SECRET=//p' | tail -n 1)
            
            if [ -z "${DB_PASSWORD:-}" ] && [ -z "${POSTGRES_PASSWORD:-}" ]; then
                DB_PASSWORD=$(printf '%s\n' "$existing_env" | sed -n 's/^DB_PASSWORD=//p' | tail -n 1)
                [ -z "${DB_PASSWORD:-}" ] && POSTGRES_PASSWORD=$(printf '%s\n' "$existing_env" | sed -n 's/^POSTGRES_PASSWORD=//p' | tail -n 1)
            fi
            log_info "Secrets recovered from existing container"
        fi
    fi
}

# Validate required secrets
validate_secrets() {
    local missing=()
    [ -z "${DB_PASSWORD:-}" ] && [ -z "${POSTGRES_PASSWORD:-}" ] && missing+=("DB_PASSWORD or POSTGRES_PASSWORD")
    [ -z "${JWT_SECRET:-}" ] && missing+=("JWT_SECRET")
    [ -z "${SESSION_SECRET:-}" ] && missing+=("SESSION_SECRET")
    
    if [ ${#missing[@]} -gt 0 ]; then
        log_error "FATAL: Missing required secrets: ${missing[*]}"
        return 1
    fi
    return 0
}

# Detect Docker network
detect_docker_network() {
    local db_net
    db_net=$(docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{println $k}}{{end}}' cortexbuild-db 2>/dev/null | awk '/cortexbuild/ {print; exit}' || true)
    
    if [ -n "$db_net" ] && docker network inspect "$db_net" >/dev/null 2>&1; then
        echo "$db_net"
        return 0
    fi
    
    # Fallback networks
    for net in "cortexbuild-ultimate_cortexbuild" "cortexbuild"; do
        if docker network inspect "$net" >/dev/null 2>&1; then
            echo "$net"
            return 0
        fi
    done
    
    # Create default network if needed
    log_warn "Creating default cortexbuild network..."
    docker network create cortexbuild 2>/dev/null || true
    echo "cortexbuild"
}

# Create backup of existing container
backup_container() {
    if docker ps -a --format '{{.Names}}' | grep -Fxq "$CONTAINER_NAME" 2>/dev/null; then
        local backup_tag="cortexbuild-api-backup-$(date +%Y%m%d-%H%M%S)"
        log_info "Creating backup image: $backup_tag"
        
        docker commit "$CONTAINER_NAME" "$backup_tag" 2>/dev/null || true
        docker tag "$backup_tag" "$CONTAINER_NAME:latest" 2>/dev/null || true
        
        # Keep only last 5 backups
        docker images --format '{{.Repository}}' | grep "^cortexbuild-api-backup-" | tail -n +6 | xargs -r docker rmi 2>/dev/null || true
        
        log_success "Backup created: $backup_tag"
    fi
}

# Rollback to previous version
rollback() {
    log_warn "Initiating rollback..."
    
    local backup_image
    # docker images lists newest first; use head for the most recent backup
    backup_image=$(docker images --format '{{.Repository}}:{{.Tag}}' | grep "^cortexbuild-api-backup-" | head -n 1 || true)
    
    if [ -n "$backup_image" ]; then
        log_info "Rolling back to: $backup_image"
        
        docker stop "$CONTAINER_NAME" 2>/dev/null || true
        docker rm "$CONTAINER_NAME" 2>/dev/null || true
        
        docker run -d \
            --name "$CONTAINER_NAME" \
            --restart always \
            --network "$(detect_docker_network)" \
            -p 127.0.0.1:3001:3001 \
            -e DB_HOST=cortexbuild-db \
            -e DB_PORT=5432 \
            -e DB_NAME=cortexbuild \
            -e DB_USER=cortexbuild \
            -e DB_PASSWORD \
            -e JWT_SECRET \
            -e SESSION_SECRET \
            -e REDIS_HOST=cortexbuild-redis \
            -e PORT=3001 \
            -e NODE_ENV=production \
            -e OLLAMA_HOST="${OLLAMA_HOST:-http://cortexbuild-ollama:11434}" \
            -e OLLAMA_MODEL="${OLLAMA_MODEL:-qwen3.5:latest}" \
            -e EMBEDDING_MODEL="${EMBEDDING_MODEL:-nomic-embed-text:latest}" \
            -e CORS_ORIGIN="${CORS_ORIGIN:-https://www.cortexbuildpro.com,https://cortexbuildpro.com}" \
            -e FRONTEND_URL="${FRONTEND_URL:-https://www.cortexbuildpro.com}" \
            "$backup_image"
        
        log_success "Rollback complete"
    else
        log_error "No backup image found for rollback"
        return 1
    fi
}

# Send notification webhook
notify() {
    local status="$1"
    local message="$2"
    local webhook_url="${DEPLOY_WEBHOOK_URL:-}"
    
    if [ -n "$webhook_url" ]; then
        curl -sf -X POST "$webhook_url" \
            -H "Content-Type: application/json" \
            -d "{\"status\":\"$status\",\"service\":\"cortexbuild-api\",\"message\":\"$message\",\"timestamp\":\"$(date -Iseconds)\"}" \
            >/dev/null 2>&1 || true
    fi
}

# Main deployment
main() {
    echo ""
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║     CortexBuild Ultimate - ENHANCED API Deploy Script          ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"
    echo ""
    
    # Ensure log directory exists
    mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true
    
    log_info "=========================================="
    log_info "Starting API deployment"
    log_info "=========================================="
    
    local start_time=$(date +%s)
    
    # Resolve project directory
    PROJECT_DIR="$(resolve_project_dir || true)"
    if [ -z "$PROJECT_DIR" ]; then
        PROJECT_DIR="$HOME/cortexbuild-ultimate"
        log_warn "Project directory not found. Bootstrapping at $PROJECT_DIR"
        if [ ! -d "$PROJECT_DIR/.git" ]; then
            log_info "Cloning repository..."
            git clone "https://github.com/adrianstanca1/cortexbuild-ultimate.git" "$PROJECT_DIR"
        fi
    fi
    log_info "Using project directory: $PROJECT_DIR"
    cd "$PROJECT_DIR"
    git config --global --add safe.directory "$PROJECT_DIR" 2>/dev/null || true

    # Load environment
    load_env_files "$PROJECT_DIR"
    
    # Validate secrets
    if ! validate_secrets; then
        recover_secrets
        validate_secrets || { notify "failure" "Missing secrets"; exit 1; }
    fi
    
    # Ensure core services are running
    log_info "Ensuring core services are running..."
    docker start cortexbuild-db >/dev/null 2>&1 || true
    docker start cortexbuild-redis >/dev/null 2>&1 || true
    
    if [ -f "$PROJECT_DIR/docker-compose.yml" ]; then
        docker start cortexbuild-db cortexbuild-redis >/dev/null 2>&1 || true
    fi
    
    # Detect Docker network
    local docker_net
    docker_net="$(detect_docker_network)"
    log_info "Using Docker network: $docker_net"

    log_info "Ensuring Ollama is available..."
    if docker ps --format '{{.Names}}' | grep -Fxq "cortexbuild-ollama" 2>/dev/null; then
        :
    elif docker ps -a --format '{{.Names}}' | grep -Fxq "cortexbuild-ollama" 2>/dev/null; then
        docker start cortexbuild-ollama >/dev/null 2>&1 || log_warn "Could not start cortexbuild-ollama"
    else
        docker volume create ollama_data >/dev/null 2>&1 || true
        if docker run -d --name cortexbuild-ollama --restart always --network "$docker_net" \
            -v ollama_data:/root/.ollama ollama/ollama:latest >/dev/null 2>&1; then
            log_success "Created cortexbuild-ollama on network $docker_net"
        else
            log_warn "Ollama container not created (embeddings may be unavailable until Ollama runs)"
        fi
    fi
    
    # Step 1: Pull latest code
    log_info "Step 1/5: Pulling latest code..."
    git fetch origin main
    git checkout main
    git pull --ff-only origin main
    log_success "Code pulled"
    
    # Step 2: Build Docker image
    log_info "Step 2/5: Building Docker image..."
    if ! docker build -t "$IMAGE_NAME" -f Dockerfile.api .; then
        log_error "Docker build failed"
        notify "failure" "Docker build failed"
        exit 1
    fi
    log_success "Image built: $IMAGE_NAME"
    
    # Step 3: Backup existing container
    log_info "Step 3/5: Creating backup..."
    backup_container
    
    # Step 4: Stop and remove existing container
    log_info "Step 4/5: Deploying new container..."
    if docker ps -q --filter "name=$CONTAINER_NAME" | grep -q .; then
        log_info "Stopping existing container..."
        docker stop "$CONTAINER_NAME" || true
        docker rm "$CONTAINER_NAME" || true
    fi
    
    # Start new container
    docker run -d \
        --name "$CONTAINER_NAME" \
        --restart always \
        --network "$docker_net" \
        -p 127.0.0.1:3001:3001 \
        -e DB_HOST=cortexbuild-db \
        -e DB_PORT=5432 \
        -e DB_NAME=cortexbuild \
        -e DB_USER=cortexbuild \
        -e DB_PASSWORD \
        -e JWT_SECRET \
        -e SESSION_SECRET \
        -e REDIS_HOST=cortexbuild-redis \
        -e PORT=3001 \
        -e NODE_ENV=production \
        -e OLLAMA_HOST="${OLLAMA_HOST:-http://cortexbuild-ollama:11434}" \
        -e OLLAMA_MODEL="${OLLAMA_MODEL:-qwen3.5:latest}" \
        -e EMBEDDING_MODEL="${EMBEDDING_MODEL:-nomic-embed-text:latest}" \
        -e CORS_ORIGIN="${CORS_ORIGIN:-https://www.cortexbuildpro.com,https://cortexbuildpro.com}" \
        -e FRONTEND_URL="${FRONTEND_URL:-https://www.cortexbuildpro.com}" \
        -e GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID:-}" \
        -e GOOGLE_CLIENT_SECRET="${GOOGLE_CLIENT_SECRET:-}" \
        -e GOOGLE_CALLBACK_URL="${GOOGLE_CALLBACK_URL:-https://www.cortexbuildpro.com/api/auth/google/callback}" \
        -e MICROSOFT_CLIENT_ID="${MICROSOFT_CLIENT_ID:-}" \
        -e MICROSOFT_CLIENT_SECRET="${MICROSOFT_CLIENT_SECRET:-}" \
        -e MICROSOFT_TENANT="${MICROSOFT_TENANT:-common}" \
        -e MICROSOFT_CALLBACK_URL="${MICROSOFT_CALLBACK_URL:-https://www.cortexbuildpro.com/api/auth/microsoft/callback}" \
        "$IMAGE_NAME"
    
    log_success "Container started: $CONTAINER_NAME"
    
    # Step 5: Health check with timeout
    log_info "Step 5/5: Running health checks..."
    local health_ok=false
    local elapsed=0
    
    while [ $elapsed -lt $DEPLOY_TIMEOUT ]; do
        if check_cortex_health; then
            health_ok=true
            break
        fi
        
        local current=$((elapsed + RETRY_INTERVAL))
        if [ $current -ge $DEPLOY_TIMEOUT ]; then
            break
        fi
        
        log_info "Health check attempt $((elapsed / RETRY_INTERVAL + 1))/$MAX_RETRIES: not ready, waiting..."
        sleep $RETRY_INTERVAL
        elapsed=$((elapsed + RETRY_INTERVAL))
    done
    
    if [ "$health_ok" = true ]; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        log_success "=========================================="
        log_success "API Deploy Complete!"
        log_success "Duration: ${duration}s"
        log_success "=========================================="
        
        notify "success" "API deployed successfully in ${duration}s"
        exit 0
    else
        log_error "Health check failed after $MAX_RETRIES attempts"
        log_error "Showing recent logs:"
        docker logs --tail 30 "$CONTAINER_NAME" 2>&1 || true

        # Keep deploy automation non-interactive by default.
        if [ "${AUTO_ROLLBACK_ON_FAILURE:-true}" = "true" ]; then
            log_warn "Auto rollback enabled; restoring previous container image"
            rollback
            notify "rollback" "Deployed version failed, rolled back"
        else
            log_warn "Auto rollback disabled; leaving failed deployment for investigation"
            notify "failure" "Deployment failed, no rollback performed"
        fi
        exit 1
    fi
}

# Trap for cleanup on error
trap 'log_error "Deploy interrupted"; exit 1' INT TERM

main "$@"
