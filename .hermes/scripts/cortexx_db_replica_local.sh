#!/usr/bin/env bash
# CortexBuild Pro — on-prem / local replica of the nightly DB dump.
#
# Invoked by /etc/cron.d/cortexx-replica at 03:22 UTC. Hardlinks the newest
# .sql.gz from /opt/cortexx-backups into /var/backups/cortexx-replica
# (30-day retention) so a single disk failure does not wipe the only copy.
# If a NAS / USB is mounted at /mnt/cortexx-backup it writes the hardlink
# there instead — that gives true off-disk redundancy without paying S3
# egress on every nightly cycle.
#
# Companion to cortexx_db_replicate.sh, which handles off-box (S3 / Telegram)
# replication. The two are intentionally split: local replica at 03:22 is
# cheap and runs first; off-box replication at 03:27 can take its time.

set -euo pipefail
export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

SOURCE_DIR=/opt/cortexx-backups
LOCAL_REPL=/var/backups/cortexx-replica
NAS_MOUNT=/mnt/cortexx-backup
KEEP_DAYS=30

mkdir -p "$LOCAL_REPL"

# Pick the newest .sql.gz that succeeded (skip any from this script itself).
LATEST="$(find "$SOURCE_DIR" -maxdepth 1 -name 'cortexx-*.sql.gz' -printf '%T@ %p\n' 2>/dev/null | sort -nr | head -1 | awk '{print $2}')"
if [ -z "$LATEST" ] || [ ! -f "$LATEST" ]; then
  echo "[cortexx_db_replica_local] FAILED: no dump found in $SOURCE_DIR" >&2
  exit 1
fi

# Sanity-check the source still looks valid before we replicate garbage.
SIZE=$(stat -c %s "$LATEST")
if [ "$SIZE" -lt 2048 ]; then
  echo "[cortexx_db_replica_local] FAILED: source dump suspiciously small (${SIZE} bytes), refusing to replicate" >&2
  exit 1
fi

# ── 1. Hardlink into the local replica dir ──────────────────────────────────
NAME="$(basename "$LATEST")"
if ! ln -f "$LATEST" "$LOCAL_REPL/$NAME" 2>/dev/null && ! cp -f "$LATEST" "$LOCAL_REPL/$NAME"; then
  # ln can fail across filesystems; fall back to a real copy.
  cp -f "$LATEST" "$LOCAL_REPL/$NAME"
fi
echo "[cortexx_db_replica_local] OK local -> $LOCAL_REPL/$NAME ($(du -h "$LOCAL_REPL/$NAME" | cut -f1))"

# ── 2. Also hardlink onto a NAS / USB if one is mounted ─────────────────────
if mountpoint -q "$NAS_MOUNT" 2>/dev/null; then
  if ! ln -f "$LATEST" "$NAS_MOUNT/$NAME" 2>/dev/null && ! cp -f "$LATEST" "$NAS_MOUNT/$NAME"; then
    cp -f "$LATEST" "$NAS_MOUNT/$NAME"
  fi
  echo "[cortexx_db_replica_local] OK nas   -> $NAS_MOUNT/$NAME"
else
  echo "[cortexx_db_replica_local] NOTE: $NAS_MOUNT not mounted — local replica only"
fi

# ── 3. Rotate local copies (30 days) ────────────────────────────────────────
find "$LOCAL_REPL" -name 'cortexx-*.sql.gz' -mtime +"$KEEP_DAYS" -delete 2>/dev/null
if mountpoint -q "$NAS_MOUNT" 2>/dev/null; then
  find "$NAS_MOUNT" -maxdepth 1 -name 'cortexx-*.sql.gz' -mtime +"$KEEP_DAYS" -delete 2>/dev/null
fi

exit 0
