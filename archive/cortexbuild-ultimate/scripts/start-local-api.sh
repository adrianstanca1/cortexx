#!/usr/bin/env bash
# Start minimal Postgres + Redis + API so http://127.0.0.1:3001/api/health works locally.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

wait_for_docker() {
  local _i
  for _i in $(seq 1 90); do
    if docker info >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

if ! docker info >/dev/null 2>&1; then
  if [[ "$(uname -s)" == "Darwin" ]]; then
    echo "Docker daemon not reachable; launching Docker Desktop…"
    open -a Docker 2>/dev/null || true
  fi
  echo "Waiting for Docker (up to 90s)…"
  if ! wait_for_docker; then
    echo "Docker still not available. Start Docker Desktop manually, then re-run:"
    echo "  bash scripts/start-local-api.sh"
    exit 1
  fi
fi

SECRETS_FILE="$ROOT/deploy/.local-api-secrets.env"
if [[ -z "${JWT_SECRET:-}" || -z "${SESSION_SECRET:-}" ]]; then
  if [[ ! -f "$SECRETS_FILE" ]]; then
    mkdir -p "$(dirname "$SECRETS_FILE")"
    umask 077
    printf 'JWT_SECRET=%s\nSESSION_SECRET=%s\n' "$(openssl rand -hex 32)" "$(openssl rand -hex 32)" >"$SECRETS_FILE"
  fi
  set -a
  # shellcheck disable=SC1090
  source "$SECRETS_FILE"
  set +a
fi
# POSTGRES_PASSWORD: omit to use compose default (stable across restarts). Set only if you rotate secrets.
export CORS_ORIGIN="${CORS_ORIGIN:-http://localhost:5173,http://127.0.0.1:5173,http://127.0.0.1:3001}"
export FRONTEND_URL="${FRONTEND_URL:-http://localhost:5173}"
export NODE_ENV="${NODE_ENV:-development}"

# Root `.env` often sets production GOOGLE_CALLBACK_URL; shell wins over compose `.env` interpolation.
# Use **localhost** (not 127.0.0.1): Google Cloud "Authorized redirect URIs" usually lists localhost;
# redirect_uri_mismatch happens if the host does not match character-for-character.
export GOOGLE_CALLBACK_URL="http://localhost:3001/api/auth/google/callback"
export MICROSOFT_CALLBACK_URL="http://localhost:3001/api/auth/microsoft/callback"

export PATH="/opt/homebrew/bin:/usr/local/bin:/Applications/Docker.app/Contents/Resources/bin:$PATH"

COMPOSE=(docker compose -f docker-compose.local.yml)
if ! docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker-compose -f docker-compose.local.yml)
fi

echo "Starting local stack (postgres :15432, redis :16379, api :3001)…"
echo "Tip: run API on the host with  cp server/env.local.template server/.env  (same DB/Redis ports)."
if [[ "${CORTEXBUILD_LOCAL_API_SKIP_BUILD:-}" == "1" ]]; then
  "${COMPOSE[@]}" up -d postgres redis api
else
  "${COMPOSE[@]}" up -d --build postgres redis api
fi

echo "Waiting for http://127.0.0.1:3001/api/health …"
for _i in $(seq 1 60); do
  if curl -sf --max-time 2 "http://127.0.0.1:3001/api/health" >/dev/null 2>&1; then
    echo "OK: http://127.0.0.1:3001/api/health"
    curl -sS "http://127.0.0.1:3001/api/health" | head -c 220
    echo
    exit 0
  fi
  sleep 2
done

echo "Health check did not pass in time. Recent api logs:"
"${COMPOSE[@]}" logs --tail 80 api || true
exit 1
