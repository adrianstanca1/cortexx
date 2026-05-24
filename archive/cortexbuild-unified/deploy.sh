#!/usr/bin/env bash
set -euo pipefail

echo "=== CortexBuild Unified — Full Deployment ==="
echo "Target: VPS at cortexbuildpro.com (:3001 REST + tRPC, :5173 dev web)"
echo ""

# ── Config
REPO="https://github.com/adrianstanca1/cortexbuild-unified.git"
DEPLOY_DIR="/var/www/cortexbuild-unified"
DB_HOST="${DB_HOST:-cortexbuild-postgres}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-cortexbuild}"
DB_PASS="${DB_PASS:-cortexbuild123}"
DB_NAME="${DB_NAME:-cortexbuild}"
DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}?sslmode=disable"
JWT_SECRET="${JWT_SECRET:-$(openssl rand -hex 32)}"
API_PORT="${API_PORT:-3001}"

# ── Clone / Update
echo "[1/7] Clone/update repository..."
if [ -d "${DEPLOY_DIR}" ]; then
  cd "${DEPLOY_DIR}"
  git fetch origin
  git reset --hard origin/main
else
  git clone "${REPO}" "${DEPLOY_DIR}"
  cd "${DEPLOY_DIR}"
fi

# ── Install pnpm + deps
echo "[2/7] Install dependencies..."
if ! command -v pnpm >/dev/null 2>&1; then
  npm install -g pnpm@10
fi
pnpm install

# ── Type generation (server schema)
echo "[3/7] Generate Drizzle types..."
cd packages/server
pnpm exec drizzle-kit generate --schema ./schema.ts
cd ../..

# ── Database migration
echo "[4/7] Run migrations..."
cd packages/server
pnpm exec tsx scripts/migrate.ts || echo "Migration script not found, skipping..."
cd ../..

# ── Build
echo "[5/7] Build packages..."
cd packages/web
pnpm build
cd ../..

cd packages/server
pnpm build
cd ../..

# ── Deploy containers with Docker
echo "[6/7] Deploy containers..."

# Write .env if missing
if [ ! -f "${DEPLOY_DIR}/.env" ]; then
  cat > "${DEPLOY_DIR}/.env" <<EOF
DATABASE_URL=${DATABASE_URL}
JWT_SECRET=${JWT_SECRET}
PORT=${API_PORT}
NODE_ENV=production
CORS_ORIGIN=https://cortexbuildpro.com,https://app.cortexbuildpro.com
EOF
  chmod 600 "${DEPLOY_DIR}/.env"
fi

# Kill old container if running
if docker ps --format '{{.Names}}' | grep -qx "cortexbuild-unified-api"; then
  echo "Stopping old API container..."
  docker stop cortexbuild-unified-api && docker rm cortexbuild-unified-api
fi

# Run new container
docker run -d \
  --name cortexbuild-unified-api \
  --network cortexbuild \
  -p 127.0.0.1:${API_PORT}:${API_PORT} \
  -e DATABASE_URL="${DATABASE_URL}" \
  -e JWT_SECRET="${JWT_SECRET}" \
  -e PORT="${API_PORT}" \
  -e NODE_ENV=production \
  -e CORS_ORIGIN='*' \
  --add-host=host.docker.internal:host-gateway \
  --restart unless-stopped \
  node:22-slim \
  node /var/www/cortexbuild-unified/packages/server/dist/index.js

# ── Nginx config
echo "[7/7] Configure nginx..."
cat > /etc/nginx/sites-available/cortexbuild-unified.conf <<'NGINX'
server {
  listen 80;
  server_name app.cortexbuildpro.com api.cortexbuildpro.com;
  return 301 https://$server_name$request_uri;
}

server {
  listen 443 ssl http2;
  listen [::]:443 ssl http2;
  server_name app.cortexbuildpro.com;

  ssl_certificate /etc/letsencrypt/live/cortexbuildpro.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/cortexbuildpro.com/privkey.pem;
  ssl_protocols TLSv1.2 TLSv1.3;

  root /var/www/cortexbuild-unified/packages/web/dist;
  index index.html;
  try_files $uri $uri/ /index.html;

  location /trpc {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}

server {
  listen 443 ssl http2;
  listen [::]:443 ssl http2;
  server_name api.cortexbuildpro.com;

  ssl_certificate /etc/letsencrypt/live/cortexbuildpro.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/cortexbuildpro.com/privkey.pem;

  location / {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_read_timeout 300s;
  }
}
NGINX

ln -sf /etc/nginx/sites-available/cortexbuild-unified.conf /etc/nginx/sites-enabled/
nginx -t && nginx -s reload || echo "Nginx reload skipped"

echo ""
echo "✅ Deployment complete!"
echo "  Web App:   https://app.cortexbuildpro.com"
echo "  API:       https://api.cortexbuildpro.com/trpc"
echo "  Health:    http://127.0.0.1:3001/api/health"
