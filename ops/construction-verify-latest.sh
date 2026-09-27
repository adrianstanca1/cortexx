#!/usr/bin/env bash
# Fail on missing/stale backups before attempting an isolated restore.
set -euo pipefail
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups/construction}"
MAX_AGE_HOURS="${MAX_AGE_HOURS:-36}"
[[ "$MAX_AGE_HOURS" =~ ^[1-9][0-9]*$ ]] || { echo 'Invalid MAX_AGE_HOURS' >&2; exit 1; }
marker="$BACKUP_DIR/.last-local-success"
[[ -s "$marker" ]] || { echo 'No successful construction backup recorded' >&2; exit 1; }
backup=$(cat "$marker")
[[ -d "$backup" && -f "$backup/database.dump" ]] || { echo 'Recorded backup is missing' >&2; exit 1; }
root=$(realpath "$BACKUP_DIR")
backup=$(realpath "$backup")
[[ "$(dirname "$backup")" == "$root" && "$(basename "$backup")" == construction-* ]] || { echo 'Backup is outside the managed directory' >&2; exit 1; }
age=$(( $(date +%s) - $(stat -c %Y "$backup/database.dump") ))
(( age >= 0 && age <= MAX_AGE_HOURS * 3600 )) || { echo "Backup is stale or has an invalid timestamp: ${age}s" >&2; exit 1; }
printf 'Latest construction backup is %s seconds old.\n' "$age"
bash "$(dirname "$0")/construction-restore-drill.sh" "$backup"
