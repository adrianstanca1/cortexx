#!/usr/bin/env bash
# Install from a reviewed checkout on the construction VPS as its operator.
set -euo pipefail
umask 077
source_dir=$(cd "$(dirname "$0")" && pwd)
mkdir -p "$HOME/bin" "$HOME/logs" "$HOME/backups/construction"
for script in construction-backup.sh construction-restore-drill.sh; do
  install -m 700 "$source_dir/$script" "$HOME/bin/$script"
done
# Preserve all unrelated jobs and keep a private copy of the previous crontab.
previous=$(mktemp)
trap 'rm -f "$previous"' EXIT
crontab -l > "$previous" 2>/dev/null || true
cp "$previous" "$HOME/backups/construction/crontab-before-$(date -u +%Y%m%dT%H%M%SZ)"
{
  sed '/# cortexx-construction-backup$/d; /# cortexx-construction-restore-drill$/d' "$previous"
  printf '15 2 * * * "%s/bin/construction-backup.sh" >> "%s/logs/construction-backup.log" 2>&1 # cortexx-construction-backup\n' "$HOME" "$HOME"
  printf '45 2 * * 0 "%s/bin/construction-restore-drill.sh" "$(cat "%s/backups/construction/.last-local-success")" >> "%s/logs/construction-restore-drill.log" 2>&1 # cortexx-construction-restore-drill\n' "$HOME" "$HOME" "$HOME"
} | crontab -
echo 'Installed daily backups and weekly isolated restore checks (server timezone).'
