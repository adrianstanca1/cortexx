#!/usr/bin/env bash
# CortexBuild Pro — VPS deploy (forwarder)
# ──────────────────────────────────────────────────────────────────
# This used to be a separate nginx + certbot installer. The project now
# ships a single Caddy + Ollama stack via docker-compose.yml, so this
# script forwards to the canonical deploy-vps.sh to avoid two web servers
# fighting over :80. One implementation, one source of truth.
#
#   bash deploy.sh                         # plain HTTP on the server IP
#   bash deploy.sh cortexbuildpro.com you@email.com   # + auto-HTTPS
# ──────────────────────────────────────────────────────────────────
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
exec sh "$DIR/deploy-vps.sh" "$@"
