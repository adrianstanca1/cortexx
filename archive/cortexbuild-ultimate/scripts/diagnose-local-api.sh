#!/usr/bin/env bash
# Why is http://127.0.0.1:3001/api/health failing? (ERR_CONNECTION_REFUSED / -102)
set -euo pipefail
echo "=== CortexBuild local API (port 3001) ==="
echo

if lsof -nP -iTCP:3001 -sTCP:LISTEN 2>/dev/null | grep -q .; then
  echo "[OK] Something is listening on TCP 3001:"
  lsof -nP -iTCP:3001 -sTCP:LISTEN
else
  echo "[FAIL] Nothing is listening on 127.0.0.1:3001 → browser shows ERR_CONNECTION_REFUSED (-102)"
fi
echo

if command -v docker >/dev/null 2>&1; then
  if docker info >/dev/null 2>&1; then
    echo "[OK] Docker daemon is running."
    echo "--- containers mentioning 3001 or local-api ---"
    docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null | head -1
    docker ps -a --format '{{.Names}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null | grep -E '3001|local-api|cortexbuild' || echo "(none)"
  else
    echo "[FAIL] Docker CLI exists but daemon is not running (Docker Desktop stopped?)."
    echo "       Fix: open Docker Desktop, wait until it says “Running”, then:"
    echo "         cd $(cd "$(dirname "$0")/.." && pwd) && npm run local:api"
  fi
else
  echo "[FAIL] docker command not found. Install Docker Desktop or add docker to PATH."
fi
echo
echo "=== Quick fix (recommended) ==="
echo "  1) Start Docker Desktop"
echo "  2)  cd $(cd "$(dirname "$0")/.." && pwd)"
echo "  3)  npm run local:api"
echo "  Or API + Vite together: npm run dev:local"
echo
echo "=== Use production API instead (no local port 3001) ==="
echo "  https://cortexbuildpro.com/api/health"
echo
echo "=== Optional: tunnel VPS to localhost:3001 ==="
echo "  ssh -N -L 3001:127.0.0.1:3001 YOUR_SSH_HOST"
