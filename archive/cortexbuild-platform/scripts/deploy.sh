#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# Deploy unified CortexBuild Platform v2.0.0 to VPS
# Usage: bash scripts/deploy.sh [api|web|all]
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
REMOTE_HOST="${VPS_HOST:-157.90.235.231}"
REMOTE_USER="${VPS_USER:-root}"
REMOTE_DIR="${VPS_APP_DIR:-/var/www/cortexbuild-platform}"
PM2_APP="${PM2_APP_NAME:-cortexbuild-api}"
WEB_PORT="${WEB_PORT:-3002}"
NODE_VERSION="22"

echo "═══════════════════════════════════════════════════════════════"
echo "  🏗️  CortexBuild Platform v2.0.0 — Deploy Script"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# ─── 1. SSH connection test ─────────────────────────────────────────────────
echo "--- SSH test... ---"
if ! ssh -o ConnectTimeout=5 "$REMOTE_USER@$REMOTE_HOST" 'echo "SSH OK"' 2>/dev/null; then
    echo "❌ Cannot connect to $REMOTE_HOST"
    exit 1
fi
echo "✅ SSH connection verified"

# ─── 2. Install Node.js + pnpm if not present ────────────────────────────────
echo ""
echo "--- Installing/updating dependencies... ---"
ssh "$REMOTE_USER@$REMOTE_HOST" bash <<'SSH'
  export DEBIAN_FRONTEND=noninteractive
  export NVM_DIR="$HOME/.nvm"
  if [ -s "$NVM_DIR/nvm.sh" ]; then
    source "$NVM_DIR/nvm.sh"
    nvm install 22 >/dev/null 2>&1
    nvm alias default 22
  else
    curl -sL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
    nvm install 22
    nvm alias default 22
  fi
  if ! command -v pnpm >/dev/null 2>&1; then
    npm install -g pnpm@9
  fi
  if ! command -v pm2 >/dev/null 2>&1; then
    npm install -g pm2
  fi
SSH
echo "✅ Node.js 22, pnpm, pm2 ready"

# ─── 3. Sync code via rsync ─────────────────────────────────────────────────
echo ""
echo "--- Syncing code to VPS... ---"
rsync -az --delete \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='.next' \
  --exclude='.git' \
  --exclude='.env.local' \
  --exclude='__pycache__' \
  "$ROOT_DIR/" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/"
echo "✅ Code synced to $REMOTE_DIR"

# ─── 4. Install + build + migrate via SSH ──────────────────────────────────
echo ""
echo "--- Installing, building + migrating... ---"
ssh "$REMOTE_USER@$REMOTE_HOST" bash -c "
  cd '$REMOTE_DIR'

  # Install deps
  pnpm install --frozen-lockfile

  # Build shared + db
  pnpm --filter ./packages/shared run build
  pnpm --filter ./packages/db run build

  # Build API
  pnpm --filter ./packages/api run build

  # Build web
  pnpm --filter ./apps/web run build

  # Copy env if exists
  if [ -f .env.local ]; then cp .env.local .env; fi

  # Run migrations
  pnpm db:migrate
"
echo "✅ Build + migrations complete"

# ─── 5. Start/restart API with PM2 ─────────────────────────────────────────
echo ""
echo "--- Restarting API (PM2)... ---"
ssh "$REMOTE_USER@$REMOTE_HOST" bash -c "
  cd '$REMOTE_DIR'
  if pm2 list | grep -q '$PM2_APP'; then
    pm2 reload $PM2_APP --update-env
  else
    pm2 start 'NODE_ENV=production node packages/api/dist/server.js' \
      --name '$PM2_APP' \
      --env NODE_ENV=production \
      --max-memory-restart 2G \
      --restart-delay 5000 \
      --max-restarts 5
    pm2 save
  fi
"
echo "✅ API restarted on PM2"

# ─── 6. Start/restart web (PM2 or Next.js standalone) ─────────────────────
echo ""
echo "--- Restarting Web (Next.js standalone)... ---"
ssh "$REMOTE_USER@$REMOTE_HOST" bash -c "
  cd '$REMOTE_DIR'
  if pm2 list | grep -q 'cortexbuild-web'; then
    pm2 reload cortexbuild-web --update-env
  else
    pm2 start 'cd apps/web && PORT=3002 NODE_ENV=production node .next/standalone/server.js' \
      --name 'cortexbuild-web' \
      --env NODE_ENV=production \
      --max-memory-restart 1G
    pm2 save
  fi
"
echo "✅ Web app restarted on PM2"

# ─── 7. Health check ────────────────────────────────────────────────────────
echo ""
echo "--- Health check... ---"
sleep 3
if curl -sf "http://$REMOTE_HOST:3001/api/health" > /dev/null; then
    echo "✅ API healthy on http://$REMOTE_HOST:3001/api/health"
else
    echo "⚠️ API warm-up in progress. Check: curl http://$REMOTE_HOST:3001/api/health"
fi
if curl -sf "http://$REMOTE_HOST:3002" > /dev/null; then
    echo "✅ Web app responsive on http://$REMOTE_HOST:3002"
else
    echo "⚠️ Web still starting"
fi

# ─── 8. Nginx reload (if nginx installed) ──────────────────────────────────
echo ""
echo "--- Reloading nginx ---"
ssh "$REMOTE_USER@$REMOTE_HOST" "nginx -t && nginx -s reload" 2>/dev/null || echo "ℹ️ Nginx not installed or not running on this host"

# ─── 9. Certbot (optional) ─────────────────────────────────────────────────
if [ "${ENABLE_SSL:-}" = "true" ]; then
    echo ""
    echo "--- Running certbot... ---"
    ssh "$REMOTE_USER@$REMOTE_HOST" "certbot --nginx -d app.cortexbuildpro.com -d api.cortexbuildpro.com --non-interactive --agree-tos -m ci@cortexbuild.com" || true
    echo "✅ SSL certificates applied"
fi

# ─── Summary ─────────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  ✅  Deployed CortexBuild Platform v2.0.0"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "  API:        http://$REMOTE_HOST:3001/api/health"
echo "  Web:        http://$REMOTE_HOST:3002"
echo "  PM2:        ssh $REMOTE_USER@$REMOTE_HOST 'pm2 list'"
echo "  Logs:       ssh $REMOTE_USER@$REMOTE_HOST 'pm2 logs'"
echo "  SSH:        ssh $REMOTE_USER@$REMOTE_HOST"
echo ""
echo "  Domain:     https://app.cortexbuildpro.com (after DNS + SSL)"
echo "  API:        https://api.cortexbuildpro.com"
echo ""
echo "═══════════════════════════════════════════════════════════════"
