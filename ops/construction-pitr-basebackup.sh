#!/usr/bin/env bash
# Read a physical base backup from the active database; publish only on success.
set -euo pipefail
umask 077
backup_dir=${PITR_BACKUP_DIR:-$HOME/backups/construction-pitr}
db_container=${DB_CONTAINER:-cortexbuild-construction-db-1}
backup_dir=${backup_dir%/}
[[ "$backup_dir" == /* && "$backup_dir" != / && "$backup_dir" != *//* && "$backup_dir" != *,* && "$backup_dir" != *$'\n'* && ! "$backup_dir" =~ (^|/)\.\.?(/|$) ]] || {
  echo 'Backup directory must be an absolute, canonical path' >&2; exit 1;
}
parent=$backup_dir
while [[ "$parent" != / ]]; do
  [[ ! -L "$parent" ]] || { echo 'Backup path cannot contain symlinks' >&2; exit 1; }
  parent=${parent%/*}; [[ -n "$parent" ]] || parent=/
done
[[ "$db_container" =~ ^[a-zA-Z0-9][a-zA-Z0-9_.-]*$ ]] || { echo 'Invalid database container name' >&2; exit 1; }
mkdir -p "$backup_dir"
mode=$(stat -c %a "$backup_dir")
if [[ "$(stat -c %u "$backup_dir")" != "$EUID" ]] || (( (8#$mode & 077) != 0 )); then
  echo 'Backup directory must be owned by this user and private' >&2; exit 1
fi
[[ ! -L "$backup_dir/.basebackup.lock" && ( ! -e "$backup_dir/.basebackup.lock" || -f "$backup_dir/.basebackup.lock" ) ]] || {
  echo 'Backup lock must be a regular file, never a symlink' >&2; exit 1;
}
exec 9>>"$backup_dir/.basebackup.lock"
flock -n 9 || { echo 'PITR base backup already running' >&2; exit 1; }
staging=$(mktemp -d "$backup_dir/.pending-base-XXXXXXXX")
trap 'rm -rf -- "$staging"' EXIT
docker exec "$db_container" sh -ec '
  test "$(psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SHOW archive_mode")" = on
  test "$(psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT pg_is_in_recovery()")" = f
  test -n "$(psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SHOW archive_command")"
  test "$(psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SHOW server_version_num")" -ge 160000
  test "$(psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SHOW server_version_num")" -lt 170000
  exec pg_basebackup -U "$POSTGRES_USER" --pgdata=- --format=tar --gzip --wal-method=fetch --checkpoint=spread --no-password
' > "$staging/base.tar.gz"
gzip -t "$staging/base.tar.gz"
python3 "$(dirname "$0")/construction-pitr-validate.py" "$staging/base.tar.gz"
tar -tzf "$staging/base.tar.gz" > "$staging/contents.txt"
for member in backup_label PG_VERSION backup_manifest; do
  grep -Eq "^(\\./)?$member$" "$staging/contents.txt"
done
docker inspect "$db_container" --format '{{.Config.Image}}' > "$staging/postgres-image.txt"
printf 'backup_type=physical-pitr\npostgres_major=16\ncreated_utc=%s\noffsite_wal=unverified\n' "$(date -u +%FT%TZ)" > "$staging/manifest.txt"
(cd "$staging" && sha256sum base.tar.gz contents.txt postgres-image.txt manifest.txt > SHA256SUMS)
destination="$backup_dir/base-$(date -u +%Y%m%dT%H%M%SZ)-$$"
sync
mv "$staging" "$destination"
marker=$(mktemp "$backup_dir/.pending-marker-XXXXXXXX")
trap 'rm -rf -- "$staging"; rm -f -- "$marker"' EXIT
printf '%s\n' "$destination" > "$marker"
mv -T -- "$marker" "$backup_dir/.last-physical-success"
sync
printf 'Physical base backup: %s; retain the complete WAL chain separately.\n' "$destination"
