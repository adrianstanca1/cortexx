#!/bin/bash
# =============================================================================
# CortexBuild Pro — VPS Deploy Script
# Target: 85.190.100.68 (cortexbuildpro.com)
# Run ON THE VPS as root:
#   bash /opt/cortexx-deploy-artifacts/deploy-vps.sh [DOMAIN] [EMAIL]
# =============================================================================
set -e

DOMAIN="${1:-}"
EMAIL="${2:-admin@cortexbuildpro.com}"
DEPLOY_DIR="/opt/cortexx"
PORT_HTTP=8080
PORT_HTTPS=8443

echo "════════════════════════════════════════════════════════════"
echo "  CortexBuild Pro v1.4.0 — VPS Deploy"
echo "  Target: 85.190.100.68"
echo "  Deploy dir: $DEPLOY_DIR"
echo "════════════════════════════════════════════════════════════"
echo ""

# ── 1. Prerequisites ──────────────────────────────────────────────
echo "[1/5] Checking prerequisites…"
if ! command -v docker >/dev/null 2>&1; then
    echo "  Installing Docker…"
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq && apt-get install -y -qq docker.io docker-compose 2>/dev/null || \
    curl -fsSL https://get.docker.com | sh
    systemctl enable --now docker 2>/dev/null || service docker start 2>/dev/null || true
    echo "  Docker installed"
else
    echo "  Docker $(docker --version 2>/dev/null | head -1) ✓"
fi

if ! command -v git >/dev/null 2>&1; then
    echo "  Installing Git…"
    apt-get install -y -qq git 2>/dev/null || true
else
    echo "  Git ✓"
fi

# ── 2. Clone / update repo ────────────────────────────────────────
if [ ! -d "$DEPLOY_DIR" ]; then
    echo ""
    echo "[2/5] Cloning cortexx to $DEPLOY_DIR…"
    mkdir -p "$DEPLOY_DIR"
    git clone https://github.com/adrianstanca1/cortexx.git "$DEPLOY_DIR" 2>&1 | tail -5
    echo "  Cloned ($(cd "$DEPLOY_DIR" && git rev-parse --short HEAD))"
else
    echo ""
    echo "[2/5] Updating $DEPLOY_DIR…"
    cd "$DEPLOY_DIR"
    git pull 2>&1 | tail -3
    echo "  Updated ($(git rev-parse --short HEAD))"
fi
cd "$DEPLOY_DIR"

# ── 3. Secrets ────────────────────────────────────────────────────
echo ""
echo "[3/5] Generating secrets…"

POSTGRES_PASSWORD="$(head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n')"
JWT_SECRET="$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
WEBHOOK_SECRET="$(head -c 16 /dev/urandom | od -An -tx1 | tr -d ' \n')"
BANKING_ENC_KEY="$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"

export POSTGRES_PASSWORD

if [ ! -f server/.env ]; then
    echo "  Creating server/.env from template…"
    cp server.env.template server/.env 2>/dev/null || \
    cp server/.env.example server/.env 2>/dev/null || true
fi

# Update secrets in .env
sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" server/.env 2>/dev/null || true
sed -i "s|^WEBHOOK_SECRET=.*|WEBHOOK_SECRET=$WEBHOOK_SECRET|" server/.env 2>/dev/null || true
sed -i "s|^BANKING_ENC_KEY=.*|BANKING_ENC_KEY=$BANKING_ENC_KEY|" server/.env 2>/dev/null || true
sed -i "s|^NODE_ENV=.*|NODE_ENV=production|" server/.env 2>/dev/null || true
sed -i "s|^DATABASE_URL=.*|DATABASE_URL=postgres://postgres:***@db:5432/cortexx|" server/.env 2>/dev/null || true
sed -i "s|^CORS_ORIGINS=.*|CORS_ORIGINS=https://${DOMAIN:-cortexbuildpro.com},http://${DOMAIN:-cortexbuildpro.com}:${PORT_HTTP}|" server/.env 2>/dev/null || true
sed -i "s|^APP_URL=.*|APP_URL=${DOMAIN:+https://}$DOMAIN|" server/.env 2>/dev/null || true

echo "  JWT_SECRET:     ${JWT_SECRET:0:8}…"
echo "  WEBHOOK_SECRET: ${WEBHOOK_SECRET:0:8}…"
echo "  POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:0:8}…"
echo "  server/.env written"

# ── 4. Write compose + Caddy files ────────────────────────────────
echo ""
echo "[4/5] Writing docker-compose.cortexx.yml and Caddyfile…"

cp /root/cortexx-deploy-artifacts/docker-compose.cortexx.yml .
cp /root/cortexx-deploy-artifacts/Caddyfile .

echo "  Files copied ✓"

# ── 5. Launch ─────────────────────────────────────────────────────
echo ""
echo "[5/5] Building and launching stack…"
echo "  Services: db → api → ollama → web (Caddy on :${PORT_HTTP})"
echo ""

docker compose -f docker-compose.cortexx.yml up -d --build 2>&1 | tail -20

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  ✓ Deployment initiated"
echo "════════════════════════════════════════════════════════════"
echo ""

# ── Verification ──────────────────────────────────────────────────
echo "--- Waiting for containers (15s) ---"
sleep 15

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
    echo "⚠ pulling model (check logs)"
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
echo "  Restart: cd $DEPLOY_DIR && docker compose -f docker-compose.cortexx.yml restart"
echo "  Stop:   cd $DEPLOY_DIR && docker compose -f docker-compose.cortexx.yml down"
echo ""
echo "--- First Boot ---"
echo "  1. Ollama pulls llama3.2:3b (~2GB) — watch: docker compose -f docker-compose.cortexx.yml logs -f ollama"
echo "  2. PostgreSQL initializes with schema + seed from server/db/"
echo "  3. Caddy serves on port ${PORT_HTTP} (HTTP) — add TLS via reverse proxy or change ports"
echo ""
echo "════════════════════════════════════════════════════════════"
echo "  Done"
echo "════════════════════════════════════════════════════════════"
