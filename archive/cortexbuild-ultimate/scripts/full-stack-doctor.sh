#!/usr/bin/env bash
# End-to-end sanity: API port, health, optional agent-debug sink, Docker, Vite.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== CortexBuild full-stack doctor ==="
echo "Repo: $ROOT"
echo

echo "--- TCP 3001 (API) ---"
if command -v lsof >/dev/null 2>&1; then
  if lsof -nP -iTCP:3001 -sTCP:LISTEN 2>/dev/null | grep -q .; then
    echo "[OK] Listener on 3001"
    lsof -nP -iTCP:3001 -sTCP:LISTEN
  else
    echo "[WARN] Nothing on 3001 — start: npm run local:api  OR  cd server && npm run dev"
  fi
else
  echo "[SKIP] lsof not installed"
fi
echo

echo "--- GET /api/health ---"
if curl -sS -m 8 -f "http://127.0.0.1:3001/api/health" 2>/dev/null | head -c 400; then
  echo
  echo "[OK] Health responded"
else
  echo "[FAIL] http://127.0.0.1:3001/api/health (start API or check firewall)"
fi
echo

echo "--- GET /api/agent-debug (NDJSON sink; 404 if disabled in production) ---"
code="$(curl -sS -m 8 -o /tmp/cb_agent_debug.json -w '%{http_code}' "http://127.0.0.1:3001/api/agent-debug" || echo "000")"
if [[ "$code" == "200" ]]; then
  echo "[OK] Agent debug API enabled (http $code)"
  head -c 200 /tmp/cb_agent_debug.json; echo
elif [[ "$code" == "404" ]] || [[ "$code" == "000" ]]; then
  echo "[INFO] Agent debug not available (http $code) — expected if API down or NODE_ENV=production without ENABLE_AGENT_DEBUG_API=1"
else
  echo "[INFO] http $code"
  head -c 200 /tmp/cb_agent_debug.json 2>/dev/null || true; echo
fi
rm -f /tmp/cb_agent_debug.json
echo

echo "--- Vite dev (5173) ---"
if curl -sS -m 2 -o /dev/null -w "%{http_code}" "http://127.0.0.1:5173/" 2>/dev/null | grep -qE '^(200|304)$'; then
  echo "[OK] Vite responding on 5173"
else
  echo "[WARN] No dev server on 5173 — start: npm run dev  (or npm run dev:local)"
fi
echo

if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  echo "--- Docker (cortexbuild / 3001) ---"
  docker ps -a --format '{{.Names}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null | grep -iE 'cortexbuild|3001' || echo "(no matching containers)"
else
  echo "--- Docker ---"
  echo "[SKIP] Docker not available"
fi
echo

echo "=== Done ==="
echo "Frontend debug logs: POST /api/agent-debug (browser) → .cursor/debug-82d802.log"
echo "Nginx 504: raise proxy_read_timeout; verify upstream curl 127.0.0.1:3001/api/health"
