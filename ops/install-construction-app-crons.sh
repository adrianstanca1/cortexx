#!/usr/bin/env bash
set -euo pipefail
umask 077
source_dir=$(cd "$(dirname "$0")" && pwd)
mkdir -p "$HOME/bin" "$HOME/logs" "$HOME/backups/construction"
install -m 700 "$source_dir/construction-app-cron.sh" "$HOME/bin/construction-app-cron.sh"

previous=$(mktemp)
trap 'rm -f "$previous"' EXIT
crontab -l > "$previous" 2>/dev/null || true
cp "$previous" "$HOME/backups/construction/crontab-before-app-crons-$(date -u +%Y%m%dT%H%M%SZ)"
{
  sed '/# cortexx-app-overdue-invoices$/d; /# cortexx-app-expiry-warnings$/d; /# cortexx-app-prune-push$/d' "$previous"
  printf '0 6 * * * "%s/bin/construction-app-cron.sh" overdue-invoices >> "%s/logs/construction-app-cron.log" 2>&1 # cortexx-app-overdue-invoices\n' "$HOME" "$HOME"
  printf '30 6 * * * "%s/bin/construction-app-cron.sh" expiry-warnings >> "%s/logs/construction-app-cron.log" 2>&1 # cortexx-app-expiry-warnings\n' "$HOME" "$HOME"
  printf '0 3 * * 0 "%s/bin/construction-app-cron.sh" prune-push >> "%s/logs/construction-app-cron.log" 2>&1 # cortexx-app-prune-push\n' "$HOME" "$HOME"
} | crontab -

echo 'Installed CortexBuild app cron jobs (server timezone): overdue 06:00 daily, expiry 06:30 daily, push prune 03:00 Sunday.'
