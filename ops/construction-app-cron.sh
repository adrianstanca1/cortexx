#!/usr/bin/env bash
set -euo pipefail
umask 077

job=${1:-}
case "$job" in
  overdue-invoices|expiry-warnings|prune-push) ;;
  *) echo "Usage: $0 {overdue-invoices|expiry-warnings|prune-push}" >&2; exit 64 ;;
esac

repo=${CORTEXX_REPO:-"$HOME/production/cortexx"}
env_file=${CORTEXX_ENV_FILE:-"$repo/.env.construction"}
[[ -r "$env_file" ]] || { echo "Production env is not readable: $env_file" >&2; exit 78; }

secret=$(sed -n 's/^CRON_SECRET=//p' "$env_file" | tail -1)
[[ -n "$secret" ]] || { echo 'CRON_SECRET is missing from production env' >&2; exit 78; }

exec curl --fail-with-body --silent --show-error --max-time 120 \
  -X POST "http://127.0.0.1:3020/api/cron/$job" \
  -H "Authorization: Bearer $secret"
