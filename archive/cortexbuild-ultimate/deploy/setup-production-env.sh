#!/bin/bash
set -euo pipefail

# CortexBuild Ultimate - Production Environment Setup
# Generates secure .env files for VPS deployment

readonly VPS_HOST="root@72.62.132.43"
readonly VPS_PATH="/var/www/cortexbuild-ultimate"
readonly SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_ed25519_vps}"
readonly SSH_OPTS="-o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new -o IdentitiesOnly=yes -i $SSH_KEY"

echo "🔐 CortexBuild Ultimate - Production Environment Setup"
echo "======================================================"
echo "Target VPS: $VPS_HOST"
echo ""

# Check SSH connection
if ! ssh $SSH_OPTS "$VPS_HOST" "echo 'SSH OK'" >/dev/null 2>&1; then
    echo "❌ Cannot connect to VPS via SSH"
    echo "   Run: ssh-add $SSH_KEY"
    exit 1
fi

echo "✅ SSH connection verified"
echo ""

# Generate secrets
echo "🔑 Generating secure secrets..."
JWT_SECRET=$(openssl rand -hex 32)
SESSION_SECRET=$(openssl rand -hex 32)
DEPLOY_SECRET=$(openssl rand -hex 32)
DB_PASSWORD=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 24)

echo "   JWT Secret: ${JWT_SECRET:0:16}..."
echo "   Session Secret: ${SESSION_SECRET:0:16}..."
echo "   Deploy Secret: ${DEPLOY_SECRET:0:16}..."
echo "   DB Password: $DB_PASSWORD"
echo ""

read -p "⚠️  Save these secrets securely. Continue with setup? [y/N] " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Cancelled"
    exit 0
fi

# Prompt for user-specific values
echo ""
echo "📝 Enter your configuration values:"
read -p "Database name [cortexbuild]: " DB_NAME
DB_NAME="${DB_NAME:-cortexbuild}"

read -p "Database user [cortexbuild]: " DB_USER
DB_USER="${DB_USER:-cortexbuild}"

read -p "SMTP email (for notifications): " SMTP_USER

read -p "SMTP password (app password): " -s SMTP_PASS
echo ""

read -p "CORS origin [https://cortexbuildpro.com]: " CORS_ORIGIN
CORS_ORIGIN="${CORS_ORIGIN:-https://cortexbuildpro.com}"

# Create root .env
echo ""
echo "📝 Creating root .env file..."
ssh $SSH_OPTS "$VPS_HOST" "cat > $VPS_PATH/.env << EOF
# Database
DB_HOST=postgres
DB_PORT=5432
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD

# Full connection string
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}?schema=public

# Auth
JWT_SECRET=$JWT_SECRET
SESSION_SECRET=$SESSION_SECRET

# CORS
CORS_ORIGIN=$CORS_ORIGIN

# Server
PORT=3001
NODE_ENV=production

# Ollama
OLLAMA_HOST=http://ollama:11434
OLLAMA_MODEL=qwen3.5:latest
EMBEDDING_MODEL=nomic-embed-text:latest

# Redis
REDIS_URL=redis://redis:6379

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=$SMTP_USER
SMTP_PASS=$SMTP_PASS
EMAIL_FROM=noreply@cortexbuildpro.com

# Upload
UPLOAD_DIR=/app/uploads
MAX_UPLOAD_SIZE=104857600

# Deploy webhook
DEPLOY_SECRET=$DEPLOY_SECRET

# Feature flags
FEATURE_AI_AGENTS=true
FEATURE_RAG_SEARCH=true
FEATURE_WEBSOCKET=true
FEATURE_FILE_UPLOAD=true
FEATURE_EMAIL=true

# Production
TRUST_PROXY=true
COOKIE_SECURE=true
LOG_LEVEL=info
EOF

echo '✅ Root .env created'
chmod 600 $VPS_PATH/.env
echo '✅ Permissions set (600)'
"

# Create server/.env
echo ""
echo "📝 Creating server/.env file..."
ssh $SSH_OPTS "$VPS_HOST" "cat > $VPS_PATH/server/.env << EOF
# Database
DB_HOST=postgres
DB_PORT=5432
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD

# Auth
JWT_SECRET=$JWT_SECRET

# Server
PORT=3001
CORS_ORIGIN=$CORS_ORIGIN

# Ollama
OLLAMA_HOST=http://ollama:11434
OLLAMA_MODEL=qwen3.5:latest
EMBEDDING_MODEL=nomic-embed-text:latest

# Deploy webhook
DEPLOY_SECRET=$DEPLOY_SECRET
EOF

echo '✅ server/.env created'
chmod 600 $VPS_PATH/server/.env
echo '✅ Permissions set (600)'
"

# Update docker-compose.yml environment
echo ""
echo "📝 Updating docker-compose.yml..."
ssh $SSH_OPTS "$VPS_HOST" "
cd $VPS_PATH

# Create .env.docker for docker-compose
cat > .env.docker << EOF
# Database
POSTGRES_USER=$DB_USER
POSTGRES_PASSWORD=$DB_PASSWORD
POSTGRES_DB=$DB_NAME

# Auth
JWT_SECRET=$JWT_SECRET

# Grafana
GF_SECURITY_ADMIN_PASSWORD=${JWT_SECRET:0:16}

# Redis
REDIS_PASSWORD=

# Ollama
OLLAMA_HOST=http://ollama:11434

# CORS
CORS_ORIGIN=$CORS_ORIGIN

# Full database URL
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}?schema=public
EOF

echo '✅ .env.docker created'
chmod 600 .env.docker
"

# Restart services to pick up new env
echo ""
echo "🔄 Restarting services with new environment..."
ssh $SSH_OPTS "$VPS_HOST" "
cd $VPS_PATH
docker stop cortexbuild-api 2>/dev/null || true
docker start cortexbuild-api 2>/dev/null || true
docker start cortexbuild-db 2>/dev/null || true
docker start cortexbuild-redis 2>/dev/null || true
docker start cortexbuild-nginx 2>/dev/null || true

echo 'Waiting for services to start...'
sleep 10

# Health check
if curl -sf http://localhost:3001/api/health >/dev/null 2>&1; then
    echo '✅ API healthy'
else
    echo '⚠️  API health check failed'
fi
"

# Final status
echo ""
echo "✅ Production environment setup complete!"
echo ""
echo "🔐 IMPORTANT - Save these credentials securely:"
echo "   Database Password: $DB_PASSWORD"
echo "   JWT Secret: $JWT_SECRET"
echo "   Deploy Secret: $DEPLOY_SECRET"
echo ""
echo "📁 Files created on VPS:"
echo "   - $VPS_PATH/.env"
echo "   - $VPS_PATH/server/.env"
echo "   - $VPS_PATH/.env.docker"
echo ""
echo "🔗 Production URLs:"
echo "   - Main site: https://www.cortexbuildpro.com"
echo "   - API: https://www.cortexbuildpro.com/api/health"
