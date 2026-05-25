#!/bin/bash
# Session-start hook for Claude Code on the web.
#
# Restores the dependency state the rest of the session expects:
#   • npm dependencies (node_modules/)
#   • Prisma client generated (node_modules/@prisma/client)
#
# So tests, lint, build, and prisma commands all work the moment a
# session opens, without the agent having to remember to install.
#
# Synchronous (returns no `async: true` JSON) — guarantees deps are
# ready before the agent starts working, preventing flaky first-turn
# tool calls that hit a missing module / stale Prisma client.
#
# Idempotent: re-running on a warm container with the lockfile already
# installed is a fast no-op; Prisma regenerate is cheap (~1 s).

set -euo pipefail

# Only run in remote (Claude Code on the web) environments. Local
# dev machines manage their own deps.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

echo "[session-start] npm install (using lockfile)…"
# `npm install` over `npm ci` so we benefit from the container-state
# cache layer when nothing has changed. Falls back to a full install
# on a cold container.
npm install --no-audit --no-fund

echo "[session-start] prisma generate…"
# Required because the Prisma client is generated into node_modules/
# and tsc / test / build all import it. DATABASE_URL is a dummy here —
# generate does not connect to the DB.
DATABASE_URL="postgresql://noop:noop@localhost:5432/noop" \
  npx prisma generate

echo "[session-start] ready · $(node -v) · prisma $(npx prisma -v | head -1 | awk '{print $3}')"
