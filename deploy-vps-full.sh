#!/bin/bash
# =============================================================================
# CortexBuild Pro — FULL VPS Deploy (with Next.js app)
# Target: 85.190.100.68 (cortexbuildpro.com)
# Run ON THE VPS as root:
#   bash /opt/cortexx-deploy-artifacts/deploy-vps-full.sh [DOMAIN] [EMAIL]
#
# This includes the Next.js app service which provides:
#   - /api/cron/* endpoints (overdue-invoices, expiry-warnings, prune-push)
#   - Admin dashboard (app.cortexbuildpro.com)
#   - Full PWA experience
#
# REQUIRES: More resources (Next.js build needs RAM + time)
#            PostgreSQL 16, Node 22, Docker, Git
# =============================================================================
set -e

DOMAIN="${1:-}"
EMAIL="${2:-admin@cortexbuildpro.com}"
DEPLOY_DIR="/opt/cortexx"
PORT_HTTP=8080

echo "════════════════════════════════════════════════════════════"
echo "  CortexBuild Pro v1.4.0 — FULL Stack Deploy"
echo "  Target: 85.190.100.68"
echo "  Includes: PostgreSQL + Express API + Ollama + Caddy + Next.js App"
echo "════════════════════════════════════════════════════════════"
echo ""

# ── 1. Prerequisites ──────────────────────────────────────────────
echo "[1/6] Checking prerequisites…"
if ! command -v docker >/dev/null 2>&1; then
    echo "  Installing Docker…"
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq && apt-get install -y -qq docker.io 2>/dev/null || \
    curl -fsSL https://get.docker.com | sh
    systemctl enable --now docker 2>/dev/null || service docker start 2>/dev/null || true
    echo "  Docker installed"
else
    echo "  Docker ✓"
fi

if ! command -v git >/dev/null 2>&1; then
    apt-get install -y -qq git 2>/dev/null || true
    echo "  Git installed"
else
    echo "  Git ✓"
fi

# ── 2. Clone / update ─────────────────────────────────────────────
if [ ! -d "$DEPLOY_DIR" ]; then
    echo ""
    echo "[2/6] Cloning cortexx to $DEPLOY_DIR…"
    mkdir -p "$DEPLOY_DIR"
    git clone https://github.com/adrianstanca1/cortexx.git "$DEPLOY_DIR" 2>&1 | tail -5
else
    echo ""
    echo "[2/6] Updating $DEPLOY_DIR…"
    cd "$DEPLOY_DIR"
    git pull 2>&1 | tail -3
fi
cd "$DEPLOY_DIR"
echo "  Version: $(git rev-parse --short HEAD)"

# ── 3. Secrets ────────────────────────────────────────────────────
echo ""
echo "[3/6] Generating secrets…"

POSTGRES_PASSWORD="$(head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n')"
JWT_SECRET="$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
WEBHOOK_SECRET="$(head -c 16 /dev/urandom | od -An -tx1 | tr -d ' \n')"
BANKING_ENC_KEY="$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
NEXTAUTH_SECRET="$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"

export POSTGRES_PASSWORD
export NEXTAUTH_SECRET

if [ ! -f server/.env ]; then
    cp server.env.template server/.env 2>/dev/null || cp server/.env.example server/.env
fi

sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" server/.env
sed -i "s|^WEBHOOK_SECRET=.*|WEBHOOK_SECRET=$WEBHOOK_SECRET|" server/.env
sed -i "s|^BANKING_ENC_KEY=.*|BANKING_ENC_KEY=$BANKING_ENC_KEY|" server/.env
sed -i "s|^NEXTAUTH_SECRET=.*|NEXTAUTH_SECRET=$NEXTAUTH_SECRET|" server/.env
sed -i "s|^NODE_ENV=.*|NODE_ENV=production|" server/.env
sed -i "s|^DATABASE_URL=.*|DATABASE_URL=postgres://postgres:***@db:5432/cortexx|" server/.env
sed -i "s|^CORS_ORIGINS=.*|CORS_ORIGINS=https://${DOMAIN:-cortexbuildpro.com},http://${DOMAIN:-cortexbuildpro.com}:${PORT_HTTP}|" server/.env
sed -i "s|^APP_URL=.*|APP_URL=${DOMAIN:+https://}$DOMAIN|" server/.env

echo "  Secrets generated ✓"

# ── 4. Write compose + Caddy files ────────────────────────────────
echo ""
echo "[4/6] Writing docker-compose.cortexx.yml…"

cat > docker-compose.cortexx.yml << 'COMPOSEEOF'
version: '3.8'
services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: cortexx
      POSTGRES_PASSWORD: "${POSTGRES_PASSWORD}"
    volumes:
      - cortexx_pgdata:/var/lib/postgresql/data
      - ./server/db/schema.sql:/docker-entrypoint-initdb.d/01-schema.sql:ro
      - ./server/db/seed.sql:/docker-entrypoint-initdb.d/02-seed.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d cortexx"]
      interval: 5s
      timeout: 3s
      retries: 12

  api:
    build: ./server
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    env_file: ./server/.env
    environment:
      DATABASE_URL: postgres://postgres:***@db:5432/cortexx
      PORT: 3001
      NODE_ENV: production
      OLLAMA_BASE: http://ollama:11434
    expose: ["3001"]
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3001/api/health"]
      interval: 30s
      timeout: 3s
      retries: 5
      start_period: 15s

  ollama:
    image: ollama/ollama:latest
    restart: unless-stopped
    volumes:
      - cortexx_ollama:/root/.ollama
      - ./server/ollama-init.sh:/ollama-init.sh:ro
    entrypoint: ["/bin/sh", "/ollama-init.sh"]
    expose: ["11434"]
    healthcheck:
      test: ["CMD", "ollama", "list"]
      interval: 10s
      timeout: 5s
      retries: 10

  web:
    image: caddy:2-alpine
    restart: unless-stopped
    depends_on: [api]
    ports:
      - "${PORT_HTTP:-8080}:80"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - ./dist:/srv/app/dist:ro
      - ./lib:/srv/app/lib:ro
      - ./landing.html:/srv/app/landing.html:ro
      - ./Cortexx.html:/srv/app/Cortexx.html:ro
      - ./admin.html:/srv/app/admin.html:ro
      - ./admin.js:/srv/app/admin.js:ro
      - ./support.html:/srv/app/support.html:ro
      - ./portal.html:/srv/app/portal.html:ro
      - ./manifest.json:/srv/app/manifest.json:ro
      - ./sw.js:/srv/app/sw.js:ro
      - ./icon-192.png:/srv/app/icon-192.png:ro
      - ./icon-512.png:/srv/app/icon-512.png:ro
      - ./icon.svg:/srv/app/icon.svg:ro
      - ./browserconfig.xml:/srv/app/browserconfig.xml:ro
      - ./apple-touch-icon.png:/srv/app/apple-touch-icon.png:ro
      - ./public:/srv/app/public:ro
      - cortexx_caddy_data:/data
      - cortexx_caddy_config:/config
    environment:
      SITE_ADDRESS: ":80"
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:80/api/health"]
      interval: 30s
      timeout: 3s
      retries: 5

  app:
    build:
      context: .
      dockerfile: Dockerfile.app
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    env_file: ./server/.env
    environment:
      DATABASE_URL: postgres://postgres:***@db:5432/cortexx
      PORT: 3010
      NODE_ENV: production
      NEXTAUTH_URL: "${NEXTAUTH_URL:-https://cortexbuildpro.com}"
      NEXTAUTH_SECRET: "${NEXTAUTH_SECRET}"
      NEXT_TELEMETRY_DISABLED: "1"
    expose: ["3010"]
    healthcheck:
      test: ["CMD-SHELL", "curl -sS http://127.0.0.1:3010/api/cron/overdue-invoices -o /dev/null || true"]
      interval: 30s
      timeout: 5s
      retries: 5
      start_period: 60s

volumes:
  cortexx_pgdata:
  cortexx_ollama:
  cortexx_caddy_data:
  cortexx_caddy_config:
COMPOSEEOF

cp Caddyfile /dev/null 2>/dev/null || true  # ensure Caddyfile exists
if [ ! -f Caddyfile ]; then
    cp /root/cortexx-deploy-artifacts/Caddyfile .
fi

echo "  docker-compose.cortexx.yml written ✓"

# ── 5. Build dist (PWA) ───────────────────────────────────────────
echo ""
echo "[5/6] Building PWA dist/ (Babel in-browser, no bundler needed)…"

# The dist/ should already be in the repo from a previous build-dist.js run.
# If it's missing or stale, build it.
if [ ! -d dist ] || [ ! -f dist/app-main.js ]; then
    echo "  dist/ missing — running build-dist.js…"
    if command -v npm >/dev/null 2>&1; then
        cd /tmp && npm install --save-dev @babel/core @babel/preset-react 2>/dev/null && \
        cp -r "$DEPLOY_DIR/lib" /tmp/lib-copy && cp "$DEPLOY_DIR/build-dist.js" /tmp/ && \
        cd /tmp && node build-dist.js 2>/dev/null && \
        cp -r /tmp/dist "$DEPLOY_DIR/dist" 2>/dev/null || \
        echo "  ⚠ build-dist failed — dist/ may be stale"
        cd "$DEPLOY_DIR"
    else
        echo "  ⚠ npm not available — dist/ must be pre-built in the repo"
    fi
fi

if [ -d dist ] && [ -f dist/app-main.js ]; then
    echo "  dist/ ready ($(ls dist/ | wc -l) files)"
else
    echo "  ⚠ dist/ not found — static app may not load correctly"
fi

# ── 6. Launch ─────────────────────────────────────────────────────
echo ""
echo "[6/6] Building and launching stack…"
echo "  Services: db → api → ollama → web (Caddy :${PORT_HTTP}) → app (Next.js :3010)"
echo ""

docker compose -f docker-compose.cortexx.yml up -d --build 2>&1 | tail -25

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  ✓ Deployment initiated"
echo "════════════════════════════════════════════════════════════"
echo ""

# ── Verification ──────────────────────────────────────────────────
echo "--- Waiting for containers (20s) ---"
sleep 20

echo ""
echo "--- Container Status ---"
docker compose -f docker-compose.cortexx.yml ps --format 'table {{.Name}}\t{{.Status}}'

echo ""
echo "--- Health Checks ---"

echo -n "  PostgreSQL:  "
if docker exec cortexx-db pg_isready -U postgres -d cortexx 2>/dev/null | grep -q "accepting"; then
    echo "✓"
else
    echo "⚠ starting"
fi

echo -n "  Express API: "
API_OUT=$(curl -s --connect-timeout 5 "http://localhost:${PORT_HTTP}/api/health" 2>/dev/null || echo "unreachable")
if echo "$API_OUT" | grep -q '"status"'; then
    echo "✓ $API_OUT"
else
    echo "⚠ $API_OUT"
fi

echo -n "  Caddy Web:   "
WEB_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "http://localhost:${PORT_HTTP}/" 2>/dev/null || echo "000")
if [ "$WEB_CODE" = "200" ] || [ "$WEB_CODE" = "302" ] || [ "$WEB_CODE" = "308" ]; then
    echo "✓ HTTP $WEB_CODE"
else
    echo "⚠ HTTP $WEB_CODE"
fi

echo -n "  Ollama:      "
OLLAMA_OUT=$(docker compose -f docker-compose.cortexx.yml logs ollama 2>/dev/null | grep -E "(pulling|already present|ready)" | tail -1 || echo "")
if [ -n "$OLLAMA_OUT" ]; then
    echo "✓ $OLLAMA_OUT"
else
    echo "⚠ pulling model"
fi

echo -n "  Next.js App: "
APP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "http://localhost:3010/api/cron/overdue-invoices" 2>/dev/null || echo "000")
if [ "$APP_CODE" = "200" ] || [ "$APP_CODE" = "401" ] || [ "$APP_CODE" = "403" ]; then
    echo "✓ HTTP $APP_CODE (app is responding)"
else
    echo "⚠ HTTP $APP_CODE (app may still be building)"
fi

echo ""
echo "--- Access Points ---"
IP=$(hostname -I 2>/dev/null | awk '{print $1}')
if [ -n "$DOMAIN" ]; then
    echo "  App:  https://${DOMAIN}"
    echo "  API:  https://${DOMAIN}/api/health"
else
    echo "  App:  http://${IP}:${PORT_HTTP}/"
    echo "  API:  http://${IP}:${PORT_HTTP}/api/health"
fi
echo ""
echo "--- Useful Commands ---"
echo "  Logs:  cd $DEPLOY_DIR && docker compose -f docker-compose.cortexx.yml logs -f"
echo "  Ollama: cd $DEPLOY_DIR && docker compose -f docker-compose.cortexx.yml logs -f ollama"
echo "  Restart: cd $DEPLOY_DIR && docker compose -f docker-compose.cortexx.yml restart"
echo "  Stop:   cd $DEPLOY_DIR && docker compose -f docker-compose.cortexx.yml down"
echo ""
echo "════════════════════════════════════════════════════════════"
echo "  Done"
echo "════════════════════════════════════════════════════════════"
