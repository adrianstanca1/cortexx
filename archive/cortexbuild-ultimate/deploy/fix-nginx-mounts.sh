#!/bin/bash
set -euo pipefail

# CortexBuild Ultimate - Fix Nginx Container Mount Paths
# Corrects the nginx volume bindings to use /var/www/cortexbuild-ultimate

readonly VPS_HOST="root@72.62.132.43"
readonly VPS_PATH="/var/www/cortexbuild-ultimate"
readonly SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_ed25519_vps}"
readonly SSH_OPTS="-o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new -o IdentitiesOnly=yes -i $SSH_KEY"

echo "🔧 CortexBuild Ultimate - Fix Nginx Mount Paths"
echo "==============================================="
echo "Target VPS: $VPS_HOST"
echo "Correct Path: $VPS_PATH"
echo

# Check SSH connection
if ! ssh $SSH_OPTS "$VPS_HOST" "echo 'SSH OK'" >/dev/null 2>&1; then
    echo "❌ Cannot connect to VPS via SSH"
    echo "   Run: ssh-add $SSH_KEY"
    exit 1
fi

echo "✅ SSH connection verified"
echo

# Check current mounts
echo "📊 Current nginx volume bindings:"
ssh $SSH_OPTS "$VPS_HOST" "docker inspect cortexbuild-nginx --format '{{json .HostConfig.Binds}}'" 2>&1 | python3 -m json.tool 2>/dev/null || \
  ssh $SSH_OPTS "$VPS_HOST" "docker inspect cortexbuild-nginx --format '{{json .HostConfig.Binds}}'" 2>&1

echo ""
read -p "🔧 Fix nginx container mounts? [y/N] " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Cancelled"
    exit 0
fi

# Fix the mounts
echo "🔧 Fixing nginx container..."
ssh $SSH_OPTS "$VPS_HOST" "
    cd $VPS_PATH
    
    echo 'Stopping nginx container...'
    docker-compose stop nginx
    
    echo 'Updating volume bindings in docker-compose.yml...'
    # The docker-compose.yml already has correct paths (./dist:/var/www/cortexbuild-ultimate/dist)
    # The issue was the container was started from a different directory
    
    echo 'Restarting nginx with correct mounts...'
    docker stop cortexbuild-nginx 2>/dev/null || true
    docker rm -f cortexbuild-nginx 2>/dev/null || true
    docker run -d \
      --name cortexbuild-nginx \
      --restart always \
      -p 80:80 -p 443:443 \
      -v "$VPS_PATH/dist:/var/www/cortexbuild-ultimate/dist:ro" \
      -v "$VPS_PATH/nginx/nginx.conf:/etc/nginx/conf.d/default.conf:ro" \
      -v /etc/letsencrypt:/etc/letsencrypt:ro \
      nginx:alpine
    
    echo 'Verifying mounts...'
    docker inspect cortexbuild-nginx --format '{{json .HostConfig.Binds}}'
    
    echo ''
    echo 'Testing nginx access to dist files...'
    docker exec cortexbuild-nginx ls -la /var/www/cortexbuild-ultimate/dist/ | head -10
"

echo ""
echo "🏥 Running health checks..."
ssh $SSH_OPTS "$VPS_HOST" "
    curl -sf -o /dev/null -w 'Site HTTP: %{http_code}\n' https://www.cortexbuildpro.com/ || echo 'Site check failed'
    curl -sf http://localhost:3001/api/health || echo 'API check failed'
"

echo ""
echo "✅ Nginx mount paths fixed!"
echo "   Container now uses: $VPS_PATH/dist"
