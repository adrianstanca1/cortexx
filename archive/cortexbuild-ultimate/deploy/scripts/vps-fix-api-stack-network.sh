#!/bin/bash
# Run on the VPS (not locally). Repairs cortexbuild-api when it was started on a
# compose-only network: app expects hostnames "postgres" and "redis" while DB
# containers are named cortexbuild-db / cortexbuild-redis on network "cortexbuild".
set -euo pipefail
NET="${DOCKER_STACK_NET:-cortexbuild}"
API="${API_CONTAINER:-cortexbuild-api}"
DB="${DB_CONTAINER:-cortexbuild-db}"
REDIS="${REDIS_CONTAINER:-cortexbuild-redis}"

docker network disconnect "$NET" "$API" 2>/dev/null || true
docker network disconnect cortexbuild-ultimate_cortexbuild "$API" 2>/dev/null || true

docker network disconnect "$NET" "$DB" 2>/dev/null || true
docker network connect --alias postgres "$NET" "$DB"

docker network disconnect "$NET" "$REDIS" 2>/dev/null || true
docker network connect --alias redis "$NET" "$REDIS"

docker network connect "$NET" "$API"
docker restart "$API"
sleep 12
curl -sS --max-time 15 "http://127.0.0.1:3001/api/health" || true
echo
