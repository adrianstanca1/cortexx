#!/usr/bin/env bash
# Back up the active construction stack. Does not stop or modify production.
set -euo pipefail
umask 077
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups/construction}"
DB_CONTAINER="${DB_CONTAINER:-cortexbuild-construction-db-1}"
APP_CONTAINER="${APP_CONTAINER:-cortexbuild-construction-app-1}"
KEEP_DAYS="${KEEP_DAYS:-14}"
[[ "$KEEP_DAYS" =~ ^[0-9]+$ ]] || { echo 'Invalid KEEP_DAYS' >&2; exit 1; }
mkdir -p "$BACKUP_DIR"
exec 9>"$BACKUP_DIR/.backup.lock"
flock -n 9 || { echo 'Backup already running' >&2; exit 1; }
stamp=$(date -u +%Y%m%dT%H%M%SZ)
staging=$(mktemp -d "$BACKUP_DIR/.pending-XXXXXXXX")
trap 'rm -rf -- "$staging"' EXIT
# Use the live container settings rather than credentials or obsolete host DBs.
docker exec "$DB_CONTAINER" sh -c 'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc --no-owner --no-acl' > "$staging/database.dump"
docker exec -i "$DB_CONTAINER" pg_restore --list < "$staging/database.dump" > "$staging/database.contents"
grep -q ' TABLE DATA ' "$staging/database.contents"
# Read-only mount access through the app; archive paths remain relative.
docker exec "$APP_CONTAINER" tar -czf - -C /app/uploads . > "$staging/uploads.tar.gz"
gzip -t "$staging/uploads.tar.gz"
tar -tzf "$staging/uploads.tar.gz" > /dev/null
docker inspect "$DB_CONTAINER" --format '{{.Config.Image}}' > "$staging/postgres-image.txt"
printf 'created_utc=%s\nupload_consistency=live-files-not-transactional\n' "$stamp" > "$staging/manifest.txt"
(cd "$staging" && sha256sum database.dump uploads.tar.gz > SHA256SUMS)
destination="$BACKUP_DIR/construction-$stamp"
mv "$staging" "$destination"
printf '%s\n' "$destination" > "$BACKUP_DIR/.last-local-success"
# Optional preconfigured off-site remote. Never label local success as off-site.
if [[ -n "${BACKUP_REMOTE:-}" ]]; then
  rclone copy "$destination" "${BACKUP_REMOTE%/}/$(basename "$destination")"
  rclone check "$destination" "${BACKUP_REMOTE%/}/$(basename "$destination")" --one-way
  printf '%s\n' "$destination" > "$BACKUP_DIR/.last-offsite-success"
else
  echo 'WARNING: local backup only; BACKUP_REMOTE is not configured.' >&2
fi
find "$BACKUP_DIR" -maxdepth 1 -type d -name 'construction-*' -mtime +"$KEEP_DAYS" -exec rm -rf -- {} +
printf 'Backup completed: %s\n' "$destination"
