#!/usr/bin/env bash
# Stop the docker-compose.local.yml stack (API + Postgres + Redis on dev ports).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export PATH="/opt/homebrew/bin:/usr/local/bin:/Applications/Docker.app/Contents/Resources/bin:$PATH"
COMPOSE=(docker compose -f docker-compose.local.yml)
if ! docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker-compose -f docker-compose.local.yml)
fi
"${COMPOSE[@]}" down
echo "Local API stack stopped."
echo "To wipe Postgres/Redis data: docker compose -f docker-compose.local.yml down -v"
