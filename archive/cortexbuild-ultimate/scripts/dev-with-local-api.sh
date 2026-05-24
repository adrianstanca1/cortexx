#!/usr/bin/env bash
# Ensure Docker local API (:3001) is up, then start Vite (:5173). Same-origin /api via Vite proxy.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export PATH="/opt/homebrew/bin:/usr/local/bin:/Applications/Docker.app/Contents/Resources/bin:$PATH"
export CORTEXBUILD_LOCAL_API_SKIP_BUILD="${CORTEXBUILD_LOCAL_API_SKIP_BUILD:-1}"
bash "$ROOT/scripts/start-local-api.sh"
exec npm run dev
