#!/usr/bin/env bash
# Manual integration check: synthetic data only; no production containers/volumes.
set -euo pipefail
umask 077
root=$(mktemp -d /tmp/cortexx-pitr-fixture-XXXXXXXX)
name=${root##*/}
source_dir=$(cd "$(dirname "$0")/.." && pwd)
cleanup() {
  local status=$?
  if [[ "$(docker inspect "$name" --format '{{index .Config.Labels "cortexx.pitr.fixture"}}' 2>/dev/null || true)" == "$name" ]]; then
    if ((status != 0)); then docker logs "$name" >&2 || true; fi
    docker rm -fv "$name" >/dev/null 2>&1 || true
  fi
  rm -rf -- "$root"
}
trap cleanup EXIT
# Keep the validation build context limited to the image's two inputs, including
# when a legacy Docker builder does not honor Dockerfile-specific ignore files.
mkdir -p "$root/build/ops"
cp "$source_dir/Dockerfile.postgres-pitr" "$root/build/Dockerfile.postgres-pitr"
cp "$source_dir/ops/construction-wal-archive.sh" "$root/build/ops/construction-wal-archive.sh"
docker build --network none --pull=false -f "$source_dir/Dockerfile.postgres-pitr" \
  -t cortexx-postgres-pitr:validation-20261005 "$root/build"
docker run -d --pull=never --name "$name" --network none \
  --label "cortexx.pitr.fixture=$name" \
  -e POSTGRES_USER=construction -e POSTGRES_DB=construction -e POSTGRES_HOST_AUTH_METHOD=trust \
  --tmpfs /var/lib/postgresql/data:rw,noexec,nosuid,size=256m \
  --mount type=volume,target=/var/lib/postgresql/wal_archive \
  cortexx-postgres-pitr:validation-20261005 postgres -c archive_mode=on -c wal_level=replica \
  -c 'archive_command=/usr/local/bin/construction-wal-archive "%p" "%f"' \
  -c checkpoint_timeout=30s -c checkpoint_completion_target=0.1 >/dev/null
ready=false
for ((attempt=0; attempt<60; attempt++)); do
  # The entrypoint also starts a temporary server during initdb. Only the final
  # postmaster is PID 1; that server will stay running for the rest of the drill.
  if [[ "$(docker exec "$name" cat /proc/1/comm 2>/dev/null || true)" == postgres ]] &&
    docker exec "$name" pg_isready -U construction -d construction >/dev/null 2>&1; then ready=true; break; fi
  sleep 1
done
[[ "$ready" == true ]] || { docker logs "$name" >&2; exit 1; }
docker exec "$name" psql -U construction -d construction -v ON_ERROR_STOP=1 -c \
  "CREATE TABLE pitr_probe (marker text PRIMARY KEY); INSERT INTO pitr_probe VALUES ('before');"
PITR_BACKUP_DIR="$root/backups" DB_CONTAINER="$name" bash "$source_dir/ops/construction-pitr-basebackup.sh"
docker exec "$name" psql -U construction -d construction -v ON_ERROR_STOP=1 -c \
  "INSERT INTO pitr_probe VALUES ('kept');"
docker exec "$name" psql -U construction -d construction -v ON_ERROR_STOP=1 -c \
  "SELECT pg_create_restore_point('cortexx_fixture_target');"
docker exec "$name" psql -U construction -d construction -v ON_ERROR_STOP=1 -c \
  "INSERT INTO pitr_probe VALUES ('excluded');"
segment=$(docker exec "$name" psql -U construction -d construction -Atc 'SELECT pg_walfile_name(pg_current_wal_insert_lsn());')
docker exec "$name" psql -U construction -d construction -v ON_ERROR_STOP=1 -c 'SELECT pg_switch_wal();'
archived=false
for ((attempt=0; attempt<60; attempt++)); do
  if docker exec "$name" test -f "/var/lib/postgresql/wal_archive/$segment"; then archived=true; break; fi
  sleep 1
done
[[ "$archived" == true ]] || { docker logs "$name" >&2; exit 1; }
mkdir "$root/wal"
# docker cp does not reliably read tmpfs mounts. Stream the immutable published
# WAL through exec, excluding the archiver's hidden staging files.
docker exec "$name" sh -ec 'cd /var/lib/postgresql/wal_archive; exec tar -cf - [0-9A-F]*' |
  tar --no-same-owner -xf - -C "$root/wal"
backup=$(cat "$root/backups/.last-physical-success")
PITR_DRILL_CHECK_TABLE=pitr_probe PITR_DRILL_EXPECT_ROWS=2 \
  bash "$source_dir/ops/construction-pitr-restore-drill.sh" "$backup" "$root/wal" cortexx_fixture_target
# Withhold the segment containing the target. An incomplete WAL chain must never
# be reported as a successful recovery, even when the base backup is consistent.
mv "$root/wal/$segment" "$root/withheld-wal"
if PITR_DRILL_TIMEOUT_SECONDS=30 bash "$source_dir/ops/construction-pitr-restore-drill.sh" \
  "$backup" "$root/wal" cortexx_fixture_target > "$root/missing-wal.log" 2>&1; then
  echo 'Drill incorrectly accepted an incomplete WAL chain' >&2; exit 1
fi
grep -q 'Recovery did not reach and pause at the named target' "$root/missing-wal.log"
mv "$root/withheld-wal" "$root/wal/$segment"
printf 'Synthetic PITR passed: base backup restored, later row replayed, row after the named target excluded.\n'
printf 'Incomplete WAL chain was correctly rejected; all fixture containers and files removed on exit.\n'
