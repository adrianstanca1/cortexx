#!/bin/bash
# CortexBuild Ultimate - Production Environment Setup Script
# Run this ONCE on the VPS to set up secure environment variables

set -euo pipefail

readonly VPS_PATH="/var/www/cortexbuild-ultimate"
readonly BACKUP_DATE=$(date +%Y%m%d_%H%M%S)

echo "🔐 CortexBuild Ultimate - Production Environment Setup"
echo "======================================================"
echo "Path: $VPS_PATH"
echo "Backup Date: $BACKUP_DATE"
echo ""

cd "$VPS_PATH"

# Backup existing .env files
echo "💾 Backing up existing configuration..."
if [[ -f .env ]]; then
    cp .env ".env.backup.$BACKUP_DATE"
    echo "   ✅ Backed up .env"
fi
if [[ -f server/.env ]]; then
    cp server/.env "server/.env.backup.$BACKUP_DATE"
    echo "   ✅ Backed up server/.env"
fi
if [[ -f .env.docker ]]; then
    cp .env.docker ".env.docker.backup.$BACKUP_DATE"
    echo "   ✅ Backed up .env.docker"
fi

# Generate secure secrets
echo ""
echo "🔑 Generating secure secrets..."
JWT_SECRET=$(openssl rand -hex 32)
SESSION_SECRET=$(openssl rand -hex 32)
DEPLOY_SECRET=$(openssl rand -hex 32)
DB_PASSWORD=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 24)

echo "   ✅ Generated JWT Secret"
echo "   ✅ Generated Session Secret"
echo "   ✅ Generated Deploy Secret"
echo "   ✅ Generated DB Password"

# Prompt for user values
echo ""
echo "📝 Configuration:"
read -p "Database name [cortexbuild]: " DB_NAME
DB_NAME="${DB_NAME:-cortexbuild}"

read -p "Database user [cortexbuild]: " DB_USER
DB_USER="${DB_USER:-cortexbuild}"

read -p "SMTP email (for notifications): " SMTP_USER
SMTP_USER="${SMTP_USER:-}"

if [[ -n "$SMTP_USER" ]]; then
    read -p "SMTP password (app password): " -s SMTP_PASS
    echo ""
else
    SMTP_PASS=""
fi

read -p "CORS origin [https://cortexbuildpro.com,https://www.cortexbuildpro.com]: " CORS_ORIGIN
CORS_ORIGIN="${CORS_ORIGIN:-https://cortexbuildpro.com,https://www.cortexbuildpro.com}"

# Create root .env
echo ""
echo "📝 Creating .env file..."
cat > .env << EOF
# ═══════════════════════════════════════════════════════════════════════════════
# CortexBuild Ultimate - Production Environment
# Generated: $(date)
# ⚠️  NEVER COMMIT THIS FILE!
# ═══════════════════════════════════════════════════════════════════════════════

# ───────────────────────────────────────────────────────────────────────────────
# DATABASE
# ───────────────────────────────────────────────────────────────────────────────
DB_HOST=postgres
DB_PORT=5432
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD

# Full connection string
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}?schema=public

# ───────────────────────────────────────────────────────────────────────────────
# AUTHENTICATION
# ───────────────────────────────────────────────────────────────────────────────
JWT_SECRET=$JWT_SECRET
SESSION_SECRET=$SESSION_SECRET

# ───────────────────────────────────────────────────────────────────────────────
# SERVER
# ───────────────────────────────────────────────────────────────────────────────
CORS_ORIGIN=$CORS_ORIGIN
PORT=3001
NODE_ENV=production

# ───────────────────────────────────────────────────────────────────────────────
# OLLAMA AI
# ───────────────────────────────────────────────────────────────────────────────
OLLAMA_HOST=http://ollama:11434
OLLAMA_MODEL=qwen3.5:latest
EMBEDDING_MODEL=nomic-embed-text:latest

# ───────────────────────────────────────────────────────────────────────────────
# REDIS
# ───────────────────────────────────────────────────────────────────────────────
REDIS_URL=redis://redis:6379

# ───────────────────────────────────────────────────────────────────────────────
# EMAIL
# ───────────────────────────────────────────────────────────────────────────────
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=$SMTP_USER
SMTP_PASS=$SMTP_PASS
EMAIL_FROM=noreply@cortexbuildpro.com

# ───────────────────────────────────────────────────────────────────────────────
# DEPLOYMENT
# ───────────────────────────────────────────────────────────────────────────────
DEPLOY_SECRET=$DEPLOY_SECRET

# ───────────────────────────────────────────────────────────────────────────────
# FEATURE FLAGS
# ───────────────────────────────────────────────────────────────────────────────
FEATURE_AI_AGENTS=true
FEATURE_RAG_SEARCH=true
FEATURE_WEBSOCKET=true
FEATURE_FILE_UPLOAD=true
FEATURE_EMAIL=true

# ───────────────────────────────────────────────────────────────────────────────
# PRODUCTION
# ───────────────────────────────────────────────────────────────────────────────
TRUST_PROXY=true
COOKIE_SECURE=true
LOG_LEVEL=info
EOF

chmod 600 .env
echo "   ✅ Created .env (permissions: 600)"

# Create server/.env
echo ""
echo "📝 Creating server/.env file..."
cat > server/.env << EOF
# ═══════════════════════════════════════════════════════════════════════════════
# CortexBuild Ultimate - Backend Server Environment
# Generated: $(date)
# ⚠️  NEVER COMMIT THIS FILE!
# ═══════════════════════════════════════════════════════════════════════════════

# ───────────────────────────────────────────────────────────────────────────────
# DATABASE (Required)
# ───────────────────────────────────────────────────────────────────────────────
DB_HOST=postgres
DB_PORT=5432
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD

# ───────────────────────────────────────────────────────────────────────────────
# AUTHENTICATION
# ───────────────────────────────────────────────────────────────────────────────
JWT_SECRET=$JWT_SECRET

# ───────────────────────────────────────────────────────────────────────────────
# SERVER
# ───────────────────────────────────────────────────────────────────────────────
PORT=3001
CORS_ORIGIN=$CORS_ORIGIN

# ───────────────────────────────────────────────────────────────────────────────
# OLLAMA AI
# ───────────────────────────────────────────────────────────────────────────────
OLLAMA_HOST=http://ollama:11434
OLLAMA_MODEL=qwen3.5:latest
EMBEDDING_MODEL=nomic-embed-text:latest

# ───────────────────────────────────────────────────────────────────────────────
# DEPLOYMENT WEBHOOK
# ───────────────────────────────────────────────────────────────────────────────
DEPLOY_SECRET=$DEPLOY_SECRET
EOF

chmod 600 server/.env
echo "   ✅ Created server/.env (permissions: 600)"

# Create .env.docker for docker-compose
echo ""
echo "📝 Creating .env.docker file..."
cat > .env.docker << EOF
# ═══════════════════════════════════════════════════════════════════════════════
# CortexBuild Ultimate - Docker Compose Environment
# Generated: $(date)
# ═══════════════════════════════════════════════════════════════════════════════

# Database
POSTGRES_USER=$DB_USER
POSTGRES_PASSWORD=$DB_PASSWORD
POSTGRES_DB=$DB_NAME

# Auth
JWT_SECRET=$JWT_SECRET

# Grafana
GF_SECURITY_ADMIN_PASSWORD=${JWT_SECRET:0:16}

# Redis (no password by default)
REDIS_PASSWORD=

# Ollama
OLLAMA_HOST=http://ollama:11434

# CORS
CORS_ORIGIN=$CORS_ORIGIN

# Full database URL
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}?schema=public
EOF

chmod 600 .env.docker
echo "   ✅ Created .env.docker (permissions: 600)"

# Print secrets for user to save
echo ""
echo "╔══════════════════════════════════════════════════════════════════════════╗"
echo "║  ⚠️  CRITICAL: SAVE THESE SECRETS SECURELY!                              ║"
echo "╠══════════════════════════════════════════════════════════════════════════╣"
echo "║  Database Password: $DB_PASSWORD"
echo "║  JWT Secret:        $JWT_SECRET"
echo "║  Deploy Secret:     $DEPLOY_SECRET"
echo "║  Session Secret:    $SESSION_SECRET"
echo "╚══════════════════════════════════════════════════════════════════════════╝"
echo ""
echo "💾 Backups saved to:"
echo "   - .env.backup.$BACKUP_DATE"
echo "   - server/.env.backup.$BACKUP_DATE"
echo "   - .env.docker.backup.$BACKUP_DATE"
echo ""

# Restart services
echo "🔄 Restarting services with new configuration..."
read -p "Restart Docker services now? [y/N] " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    docker stop cortexbuild-api 2>/dev/null || true
    docker start cortexbuild-api 2>/dev/null || true
    docker start cortexbuild-db 2>/dev/null || true
    docker start cortexbuild-redis 2>/dev/null || true
    docker start cortexbuild-nginx 2>/dev/null || true
    
    echo ""
    echo "⏳ Waiting for services to start..."
    sleep 15
    
    # Health checks
    echo ""
    echo "🏥 Running health checks..."
    if curl -sf http://localhost:3001/api/health >/dev/null 2>&1; then
        echo "   ✅ API: Healthy"
    else
        echo "   ⚠️  API: Check failed (may need more time)"
    fi
    
    if curl -sf -o /dev/null -w '' https://www.cortexbuildpro.com/ 2>/dev/null; then
        echo "   ✅ Site: Accessible"
    else
        echo "   ⚠️  Site: Check failed"
    fi
    
    echo ""
    echo "📊 Service status:"
    docker ps --format "table {{.Names}}\t{{.Status}}"
fi

echo ""
echo "✅ Production environment setup complete!"
echo ""
echo "📁 Files created:"
echo "   - .env (root configuration)"
echo "   - server/.env (backend configuration)"
echo "   - .env.docker (docker-compose configuration)"
echo ""
echo "🔒 Security reminders:"
echo "   1. Save the secrets shown above to a password manager"
echo "   2. Never commit .env files to git"
echo "   3. Rotate secrets every 90 days"
echo "   4. Back up .env files regularly"
echo ""
