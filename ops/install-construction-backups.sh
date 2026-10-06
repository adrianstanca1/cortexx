#!/usr/bin/env bash
# Install from a reviewed checkout on the construction VPS as its operator.
set -euo pipefail
umask 077
source_dir=$(cd "$(dirname "$0")" && pwd)
install_pitr=${INSTALL_CONSTRUCTION_PITR_TOOLS:-0}
[[ "$install_pitr" == 0 || "$install_pitr" == 1 ]] || { echo 'INSTALL_CONSTRUCTION_PITR_TOOLS must be 0 or 1' >&2; exit 1; }
mkdir -p "$HOME/bin" "$HOME/logs" "$HOME/backups/construction"
scripts=(construction-backup.sh construction-restore-drill.sh construction-verify-latest.sh)
if [[ "$install_pitr" == 1 ]]; then
  scripts+=(construction-pitr-basebackup.sh construction-pitr-restore-drill.sh construction-pitr-validate.py)
fi
for script in "${scripts[@]}"; do
  if [[ "$source_dir/$script" != "$HOME/bin/$script" ]]; then
    install -m 700 "$source_dir/$script" "$HOME/bin/$script"
  fi
done
# Preserve all unrelated jobs and keep a private copy of the previous crontab.
previous=$(mktemp)
trap 'rm -f "$previous"' EXIT
crontab -l > "$previous" 2>/dev/null || true
cp "$previous" "$HOME/backups/construction/crontab-before-$(date -u +%Y%m%dT%H%M%SZ)"
{
  sed '/# cortexx-construction-backup$/d; /# cortexx-construction-restore-drill$/d' "$previous"
  printf '15 2 * * * "%s/bin/construction-backup.sh" >> "%s/logs/construction-backup.log" 2>&1 # cortexx-construction-backup\n' "$HOME" "$HOME"
  printf '45 2 * * 0 "%s/bin/construction-verify-latest.sh" >> "%s/logs/construction-restore-drill.log" 2>&1 # cortexx-construction-restore-drill\n' "$HOME" "$HOME"
} | crontab -
echo 'Installed daily backups and weekly isolated restore checks (server timezone).'
if [[ "$install_pitr" == 1 ]]; then
  echo 'Installed optional PITR tools only. WAL archiving, physical-backup scheduling and off-site WAL copy still require operator setup.'
fi
