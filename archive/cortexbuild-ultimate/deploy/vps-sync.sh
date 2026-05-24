#!/bin/bash
set -euo pipefail

# CortexBuild Ultimate - VPS Deployment Script
# Syncs local development changes to production VPS using SSH key authentication

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
readonly VPS_HOST="${VPS_HOST:-root@72.62.132.43}"
# Production stack lives under /root on current VPS (override with VPS_PATH=...)
readonly VPS_PATH="${VPS_PATH:-/root/cortexbuild-ultimate}"
readonly BACKUP_PATH="/var/backups/cortexbuild-$(date +%Y%m%d_%H%M%S)"
if [[ -z "${SSH_KEY:-}" ]]; then
    if [[ -f "$HOME/.ssh/gh_actions_ed25519" ]]; then
        SSH_KEY="$HOME/.ssh/gh_actions_ed25519"
    else
        SSH_KEY="$HOME/.ssh/id_ed25519_vps"
    fi
fi
readonly SSH_KEY
readonly SSH_OPTS="-o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new -o IdentitiesOnly=yes -i $SSH_KEY"

echo "🚀 CortexBuild Ultimate - VPS Deployment"
echo "=========================================="
echo "Project: $PROJECT_ROOT"
echo "Target VPS: $VPS_HOST"
echo "Remote Path: $VPS_PATH"
echo

# Preflight checks
echo "🔍 Preflight Checks..."

# Check SSH key exists
if [[ ! -f "$SSH_KEY" ]]; then
    echo "❌ SSH key not found: $SSH_KEY"
    echo "   Generate one: ssh-keygen -t ed25519 -f $SSH_KEY -C 'cortexbuild-deploy'"
    echo "   Then copy to VPS: ssh-copy-id -i ${SSH_KEY}.pub $VPS_HOST"
    exit 1
fi

# Check if we can connect to VPS
if ! ssh $SSH_OPTS "$VPS_HOST" "echo 'SSH connection successful'" >/dev/null 2>&1; then
    echo "❌ Cannot connect to VPS via SSH"
    echo "   1. Add key to agent: ssh-add $SSH_KEY"
    echo "   2. Copy key to VPS: ssh-copy-id -i ${SSH_KEY}.pub $VPS_HOST"
    echo "   3. Or manually: cat ${SSH_KEY}.pub | ssh $VPS_HOST 'mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys'"
    exit 1
fi

echo "✅ SSH connection verified"
echo "🏗️ Building production assets..."

cd "$PROJECT_ROOT"

# Ensure clean build
if ! npm run build --silent; then
    echo "❌ Build failed. Please fix TypeScript errors first."
    echo "   Run: npm run typecheck"
    exit 1
fi

echo "✅ Build completed successfully"

# Check Docker setup
if ! docker --version >/dev/null 2>&1; then
    echo "❌ Docker not found. Please install Docker first."
    exit 1
fi

# Create Docker image (matches deploy-api.sh / CI)
echo "🐳 Building Docker image..."
docker build -t cortexbuild-ultimate-api:latest -f Dockerfile.api .

# Create deployment archive
echo "📦 Creating deployment package..."
TAR_FILE="/tmp/cortexbuild-deploy-$(date +%Y%m%d_%H%M%S).tar.gz"

# Include the local 'dist' folder since we build locally to prevent VPS OOM
tar -czf "$TAR_FILE" \
    --exclude='.git' \
    --exclude='node_modules' \
    --exclude='*.log' \
    --exclude='.env*' \
    -C "$PROJECT_ROOT" .

echo "✅ Package created: $TAR_FILE"

# VPS Deployment
echo "🌐 Deploying to VPS..."

# Create backup of existing deployment
ssh $SSH_OPTS "$VPS_HOST" "
    if [ -d '$VPS_PATH' ]; then
        echo 'Creating backup...'
        sudo mkdir -p $(dirname '$BACKUP_PATH')
        sudo cp -r '$VPS_PATH' '$BACKUP_PATH'
        echo 'Backup created: $BACKUP_PATH'
    fi
"

# Upload and extract
echo "📤 Uploading package..."
scp $SSH_OPTS "$TAR_FILE" "$VPS_HOST:/tmp/cortexbuild-deploy.tar.gz"

ssh $SSH_OPTS "$VPS_HOST" "
    # Setup deployment directory
    sudo mkdir -p '$VPS_PATH'
    cd '$VPS_PATH'

    # Extract new code (includes local build dist/)
    sudo tar -xzf /tmp/cortexbuild-deploy.tar.gz

    # Set permissions
    sudo chown -R root:root .

    # Install backend dependencies only
    echo '📦 Installing backend dependencies...'
    cd server && npm ci && cd ..

    # Start services
    echo '🚀 Starting services...'

    # Start services
    echo '🚀 Starting services...'
    # Force stop all containers and ensure ports are released
    docker stop cortexbuild-api 2>/dev/null || true
    docker rm -f cortexbuild-api 2>/dev/null || true

    if docker ps --format '{{.Names}}' | grep -Fxq "cortexbuild-db" 2>/dev/null; then
        docker start cortexbuild-db >/dev/null 2>&1 || true
    fi
    if docker ps -a --format '{{.Names}}' | grep -Fxq "cortexbuild-redis" 2>/dev/null; then
        docker start cortexbuild-redis >/dev/null 2>&1 || true
    fi

    docker network create cortexbuild 2>/dev/null || true
    docker run -d \
      --name cortexbuild-api \
      --restart always \
      --network cortexbuild \
      -p 127.0.0.1:3001:3001 \
      --env-file "$VPS_PATH/.env" \
      cortexbuild-ultimate-api:latest

    # Health check
    echo '🏥 Waiting for services to start...'
    sleep 30

    # Verify deployment against Cortex API contract on local API port
    if curl --connect-timeout 2 --max-time 5 -fsS http://127.0.0.1:3001/api/health 2>/dev/null | python3 -c 'import json,sys; d=json.load(sys.stdin); c=d.get("checks") or {}; assert d.get("status")=="ok"; assert c.get("postgres") is True; assert c.get("redis") is True' >/dev/null 2>&1; then
        echo '✅ Deployment successful!'
        echo '🌐 Site available at: https://cortexbuildpro.com'
    else
        echo '⚠️ Service health check failed'
        echo 'Please check logs: docker logs -f cortexbuild-api'
        exit 1
    fi

    # Cleanup
    rm -f /tmp/cortexbuild-deploy.tar.gz
"

# Cleanup local files
rm -f "$TAR_FILE"

echo
echo "🎉 Deployment Complete!"
echo "======================="
echo "✅ Code synced to VPS"
echo "✅ Services restarted"
echo "✅ Health checks passed"
echo
echo "🔗 Production URLs:"
echo "   - Main site: https://cortexbuildpro.com"
echo "   - API health: https://cortexbuildpro.com/api/health"
echo "   - VPS direct: http://72.62.132.43"
echo
echo "📊 Monitoring:"
echo "   - Grafana: http://72.62.132.43:3002"
echo "   - Prometheus: http://72.62.132.43:9090"
echo
echo "🛠️ Rollback if needed:"
echo "   ssh $SSH_OPTS $VPS_HOST 'sudo rm -rf $VPS_PATH && sudo mv $BACKUP_PATH $VPS_PATH'"
