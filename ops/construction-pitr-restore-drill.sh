#!/usr/bin/env bash
# Read a physical backup and WAL into a disposable, network-isolated container.
set -euo pipefail
umask 077
backup=${1:?Usage: construction-pitr-restore-drill.sh BACKUP_DIRECTORY WAL_DIRECTORY RECOVERY_TARGET_NAME}
wal=${2:?WAL directory required}
target=${3:?Named recovery target required}
[[ "$target" =~ ^[a-zA-Z][a-zA-Z0-9_-]{0,62}$ ]] || { echo 'Invalid recovery target name' >&2; exit 1; }
for directory in "$backup" "$wal"; do
  [[ "$directory" == /* && "$directory" != / && "$directory" != *,* && "$directory" != *$'\n'* && -d "$directory" && "$(realpath "$directory")" == "$directory" ]] || {
    echo 'Restore paths must be existing absolute canonical directories without commas or symlinks' >&2; exit 1;
  }
done
for file in base.tar.gz contents.txt postgres-image.txt manifest.txt SHA256SUMS; do
  [[ -f "$backup/$file" && ! -L "$backup/$file" ]] || { echo "Missing or symlink backup file: $file" >&2; exit 1; }
done
# Check only the four known files, so a modified checksum list cannot read host paths.
[[ "$(cut -c67- "$backup/SHA256SUMS" | sort)" == $'base.tar.gz\ncontents.txt\nmanifest.txt\npostgres-image.txt' ]] || {
  echo 'Unexpected checksum file list' >&2; exit 1;
}
if grep -Ev '^[0-9a-f]{64}  (base.tar.gz|contents.txt|postgres-image.txt|manifest.txt)$' "$backup/SHA256SUMS" >/dev/null; then
  echo 'Invalid checksum record' >&2; exit 1;
fi
(cd "$backup" && sha256sum -c --strict SHA256SUMS)
grep -qx 'postgres_major=16' "$backup/manifest.txt"
python3 "$(dirname "$0")/construction-pitr-validate.py" "$backup/base.tar.gz"
# Reject an empty or unrelated WAL directory before any Docker mutation. Hidden
# archiver staging files may exist while the source archive is active.
shopt -s nullglob
segments=0
for source in "$wal"/*; do
  filename=${source##*/}
  [[ -f "$source" && ! -L "$source" && -s "$source" && "$filename" =~ ^([0-9A-F]{24}(\.[0-9A-F]{8}\.backup|\.partial)?|[0-9A-F]{8}\.history)$ ]] || {
    echo 'WAL directory contains an invalid, empty or symlink entry' >&2; exit 1;
  }
  if [[ "$filename" =~ ^[0-9A-F]{24}$ ]]; then segments=$((segments + 1)); fi
done
(( segments > 0 )) || { echo 'WAL directory contains no completed WAL segments' >&2; exit 1; }
size=${PITR_DRILL_TMPFS_SIZE:-1g}
[[ "$size" =~ ^[1-9][0-9]*[mg]$ ]] || { echo 'Invalid PITR_DRILL_TMPFS_SIZE' >&2; exit 1; }
timeout=${PITR_DRILL_TIMEOUT_SECONDS:-120}
[[ "$timeout" =~ ^[1-9][0-9]{0,3}$ && "$timeout" -le 3600 ]] || { echo 'Invalid PITR_DRILL_TIMEOUT_SECONDS (1-3600)' >&2; exit 1; }
user=${PITR_DB_USER:-construction}
database=${PITR_DB_NAME:-construction}
[[ "$user" =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ && "$database" =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]] || {
  echo 'Invalid drill database or user' >&2; exit 1;
}
check_table=${PITR_DRILL_CHECK_TABLE:-}
check_count=${PITR_DRILL_EXPECT_ROWS:-}
if [[ -n "$check_table" || -n "$check_count" ]]; then
  [[ "$check_table" =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ && "$check_count" =~ ^[0-9]+$ ]] || {
    echo 'Set both a valid PITR_DRILL_CHECK_TABLE and PITR_DRILL_EXPECT_ROWS' >&2; exit 1;
  }
fi
nonce=$(basename "$(mktemp -u /tmp/pitr-drill-XXXXXXXX)")
name="cortexx-$nonce"
cleanup() {
  if [[ "$(docker inspect "$name" --format '{{index .Config.Labels "cortexx.pitr.drill"}}' 2>/dev/null || true)" == "$nonce" ]]; then
    docker rm -fv "$name" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT
# Use a known PostgreSQL 16 image, never execute an image from backup metadata.
# Every writable location is container-local tmpfs; source mounts are read-only.
docker run -d --pull=never --name "$name" --network none --read-only \
  --security-opt no-new-privileges=true --label "cortexx.pitr.drill=$nonce" \
  --mount "type=bind,source=$backup,target=/backup,readonly" \
  --mount "type=bind,source=$wal,target=/wal,readonly" \
  --tmpfs "/var/lib/postgresql/data:rw,noexec,nosuid,size=$size" \
  --tmpfs "/restore-wal:rw,noexec,nosuid,size=$size" \
  --tmpfs /var/run/postgresql:rw,noexec,nosuid,size=16m \
  --tmpfs /tmp:rw,noexec,nosuid,size=16m \
  --entrypoint bash postgres:16-alpine -ec '
    tar -xzf /backup/base.tar.gz -C "$PGDATA"
    pg_verifybackup "$PGDATA"
    for source in /wal/*; do
      [[ -f "$source" && ! -L "$source" ]] || { echo "WAL source must be a regular file: $source" >&2; exit 1; }
      filename=${source##*/}
      [[ "$filename" =~ ^([0-9A-F]{24}(\.[0-9A-F]{8}\.backup|\.partial)?|[0-9A-F]{8}\.history)$ ]] || { echo "Invalid WAL filename" >&2; exit 1; }
      cp -- "$source" "/restore-wal/$filename"
    done
    chown -R postgres:postgres "$PGDATA" /restore-wal
    chmod 700 "$PGDATA" /restore-wal
    rm -f "$PGDATA/standby.signal"
    printf "local all all trust\n" > /tmp/drill-pg_hba.conf
    touch "$PGDATA/recovery.signal"
    exec docker-entrypoint.sh postgres -c archive_mode=off -c listen_addresses= \
      -c hba_file=/tmp/drill-pg_hba.conf \
      -c hot_standby=on -c "restore_command=cp /restore-wal/%f %p" \
      -c "recovery_target_name=$1" -c recovery_target_timeline=current \
      -c recovery_target_action=pause
  ' -- "$target" >/dev/null
ready=false
for ((attempt=0; attempt<timeout; attempt++)); do
  if [[ "$(docker exec "$name" psql -U "$user" -d "$database" -Atc 'SELECT pg_is_in_recovery() AND pg_is_wal_replay_paused()' 2>/dev/null || true)" == t ]]; then
    ready=true; break
  fi
  if [[ "$(docker inspect "$name" --format '{{.State.Running}}')" != true ]]; then break; fi
  sleep 1
done
if [[ "$ready" != true ]]; then
  docker logs "$name" >&2
  echo 'Recovery did not reach and pause at the named target' >&2; exit 1
fi
tables=$(docker exec "$name" psql -U "$user" -d "$database" -v ON_ERROR_STOP=1 -Atc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'")
[[ "$tables" =~ ^[0-9]+$ && "$tables" -gt 0 ]] || { echo 'No public tables restored' >&2; exit 1; }
if [[ -n "$check_table" ]]; then
  rows=$(docker exec "$name" psql -U "$user" -d "$database" -v ON_ERROR_STOP=1 -Atc "SELECT count(*) FROM public.\"$check_table\"")
  [[ "$rows" == "$check_count" ]] || { echo "Unexpected row count for $check_table" >&2; exit 1; }
fi
printf 'Restored %s public tables at named target %s; recovery paused and disposable container removed on exit.\n' "$tables" "$target"
