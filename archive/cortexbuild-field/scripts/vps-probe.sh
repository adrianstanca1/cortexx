#!/usr/bin/env bash
# Print a snapshot of OS, tooling, disk, listeners, PM2, and local API health.
# Run on the VPS from the app directory (or anywhere): bash scripts/vps-probe.sh
set -euo pipefail

echo "=== CortexBuild Field — VPS probe ==="
echo "Time (UTC): $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo

echo "--- OS ---"
if [ -f /etc/os-release ]; then
  # shellcheck source=/dev/null
  . /etc/os-release
  echo "${PRETTY_NAME:-$NAME}"
fi
uname -a
echo

echo "--- Resources ---"
if command -v free >/dev/null 2>&1; then free -h; else echo "(free not available)"; fi
df -h / 2>/dev/null || true
if [ -d /var ]; then df -h /var 2>/dev/null || true; fi
echo

echo "--- Node / tooling ---"
command -v node >/dev/null 2>&1 && node --version || echo "node: not found"
command -v npm >/dev/null 2>&1 && npm --version || echo "npm: not found"
command -v pnpm >/dev/null 2>&1 && pnpm --version || echo "pnpm: not found"
command -v pm2 >/dev/null 2>&1 && pm2 --version || echo "pm2: not found"
command -v nginx >/dev/null 2>&1 && nginx -v 2>&1 || echo "nginx: not found"
command -v docker >/dev/null 2>&1 && docker --version || echo "docker: not found"
command -v psql >/dev/null 2>&1 && psql --version || echo "psql: not found"
echo

echo "--- Listening TCP (first 50 lines) ---"
if command -v ss >/dev/null 2>&1; then
  ss -ltnp 2>/dev/null | head -50 || true
elif command -v netstat >/dev/null 2>&1; then
  netstat -ltn 2>/dev/null | head -50 || true
else
  echo "Neither ss nor netstat available."
fi
echo

echo "--- PM2 ---"
if command -v pm2 >/dev/null 2>&1; then
  pm2 status 2>/dev/null || true
else
  echo "pm2 not installed"
fi
echo

echo "--- Local API health (http://127.0.0.1:3005/api/health) ---"
if command -v curl >/dev/null 2>&1; then
  code=$(curl -s -o /tmp/cbf-vps-probe-health.json -w "%{http_code}" --connect-timeout 3 http://127.0.0.1:3005/api/health || echo "000")
  echo "HTTP ${code}"
  if [ -f /tmp/cbf-vps-probe-health.json ]; then head -c 800 /tmp/cbf-vps-probe-health.json; echo; fi
else
  echo "curl not found"
fi
echo

echo "--- Docker (cortexbuild*) ---"
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  docker ps -a --filter name=cortexbuild --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null || true
else
  echo "(docker not running or not installed)"
fi

echo "=== End probe ==="
