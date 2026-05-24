#!/bin/bash
# =============================================================================
# CortexBuild VPS Deploy Script
# =============================================================================
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-/root/cortexbuild-ultimate}"
IMAGE_NAME="cortexbuild-ultimate-api:latest"
CONTAINER_NAME="cortexbuild-api"

echo "=== CortexBuild Deploy — $(date) ==="

# Pull cod
cd "$PROJECT_DIR"
git fetch origin
git reset --hard origin/main

# Build
docker build -t "$IMAGE_NAME" -f Dockerfile.api .

# Stop and recreate API container (postgres/redis kept running)
docker stop cortexbuild-api 2>/dev/null || true
docker rm cortexbuild-api 2>/dev/null || true

# Extract postgres creds from .env safely (without shell-sourcing, which is fragile
# against unquoted special chars). The .env DATABASE_URL points at 127.0.0.1:55432
# (host port) which doesn't resolve inside the container — override it below to use
# the docker-network hostname `cortexbuild-postgres:5432`.
ENV_FILE="$PROJECT_DIR/.env"
PG_USER=$(grep -E '^POSTGRES_USER=' "$ENV_FILE" | head -1 | cut -d= -f2-)
PG_PASS=$(grep -E '^POSTGRES_PASSWORD=' "$ENV_FILE" | head -1 | cut -d= -f2-)
PG_DB=$(grep -E '^POSTGRES_DB=' "$ENV_FILE" | head -1 | cut -d= -f2-)
PG_USER="${PG_USER:-cortexbuild}"
PG_DB="${PG_DB:-cortexbuild}"
if [ -z "${PG_PASS:-}" ]; then
  echo "❌ POSTGRES_PASSWORD not found in $ENV_FILE — cannot construct docker-network DATABASE_URL"
  exit 1
fi

docker run -d \
  --name cortexbuild-api \
  --restart always \
  --network cortexbuild \
  -p 127.0.0.1:3009:3001 \
  --env-file "$ENV_FILE" \
  -e "PORT=3001" \
  -e "DATABASE_URL=postgresql://${PG_USER}:${PG_PASS}@cortexbuild-postgres:5432/${PG_DB}?sslmode=disable" \
  -e "DB_HOST=cortexbuild-postgres" \
  -e "DB_PORT=5432" \
  -e "REDIS_HOST=cortexbuild-redis" \
  -e "REDIS_URL=redis://cortexbuild-redis:6379" \
  "$IMAGE_NAME"

# Așteaptă health
echo "Waiting for API health..."
for i in $(seq 1 30); do
  if curl -fsS http://localhost:3009/api/health >/dev/null 2>&1; then
    echo "✅ API healthy"
    break
  fi
  sleep 2
done

# Verificare finală
if ! curl -fsS http://localhost:3009/api/health >/dev/null 2>&1; then
  echo "❌ API health check failed"
  docker logs --tail 30 "$CONTAINER_NAME"
  exit 1
fi

# Reload nginx
systemctl reload nginx 2>/dev/null || service nginx reload 2>/dev/null || true

echo "=== Deploy Complete — $(date) ==="
