#!/bin/bash
set -euo pipefail

# CortexBuild Ultimate - Recreate Nginx Container with Correct Mounts
# Fixes the nginx volume bindings to use /var/www/cortexbuild-ultimate

readonly VPS_HOST="root@72.62.132.43"
readonly VPS_PATH="/var/www/cortexbuild-ultimate"
readonly SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_ed25519_vps}"
readonly SSH_OPTS="-o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new -o IdentitiesOnly=yes -i $SSH_KEY"

echo "🔧 CortexBuild Ultimate - Recreate Nginx Container"
echo "=================================================="
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

# Show current situation
echo "📊 Current nginx mounts:"
ssh $SSH_OPTS "$VPS_HOST" "docker inspect cortexbuild-nginx --format '{{range .Mounts}}{{.Source}} -> {{.Destination}}{{\"\n\"}}{{end}}'" 2>&1

echo ""
echo "⚠️  Issue: nginx is mounting from /root/cortexbuild-work/ instead of $VPS_PATH"
echo ""
read -p "🔧 Recreate nginx container with correct mounts? [y/N] " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Cancelled"
    exit 0
fi

# Recreate the container
echo "🔧 Recreating nginx container..."
ssh $SSH_OPTS "$VPS_HOST" "
    cd $VPS_PATH
    
    echo 'Stopping nginx...'
    docker stop cortexbuild-nginx || true
    docker rm cortexbuild-nginx || true
    
    echo 'Starting nginx with correct mounts...'
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
    
    echo ''
    echo 'Verifying new mounts:'
    sleep 2
    docker inspect cortexbuild-nginx --format '{{range .Mounts}}{{.Source}} -> {{.Destination}}{{\"\n\"}}{{end}}'
    
    echo ''
    echo 'Testing file access:'
    docker exec cortexbuild-nginx ls -la /var/www/cortexbuild-ultimate/dist/ 2>&1 | head -5 || echo 'Warning: Cannot list dist files'
"

echo ""
echo "🏥 Running health checks..."
sleep 5
ssh $SSH_OPTS "$VPS_HOST" "
    echo 'Site check:'
    curl -sf -o /dev/null -w '  HTTPS: %{http_code}\n' https://www.cortexbuildpro.com/ || echo '  HTTPS: FAILED'
    
    echo 'API check:'
    curl -sf http://localhost:3001/api/health && echo '' || echo '  API: FAILED'
    
    echo 'Nginx logs (last 5):'
    docker logs cortexbuild-nginx --tail 5 2>&1 | head -5
"

echo ""
echo "✅ Nginx container recreated!"
