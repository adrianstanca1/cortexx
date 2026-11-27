#!/bin/sh
set -eu

export PORT="${PORT:-8080}"
export HOSTNAME=0.0.0.0

# Keep preview sessions functional without embedding a fixed signing secret.
# Supply NEXTAUTH_SECRET at runtime when sessions must survive restarts.
if [ -z "${NEXTAUTH_SECRET:-}" ]; then
  NEXTAUTH_SECRET="$(node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))")"
  export NEXTAUTH_SECRET
fi

exec node server.js
