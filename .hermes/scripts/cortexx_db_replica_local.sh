#!/usr/bin/env bash
# On-prem / local replica of the nightly Cortexx customer-DB dumps.
#
# Why: the primary nightly dump lives in /var/backups/cortexx (7-day rotation).
# This script copies the newest dumps to a SEPARATE path (/var/backups/cortexx-replica)
# with LONGER retention (30 days) so an accidental wipe or corruption of the primary
# dir — or a bad backup — is recoverable. It uses hardlinks when the replica is on the
# same filesystem (zero extra disk cost) and falls back to cp otherwise.
#
# Off-box ready: if an external volume (NAS/USB) is mounted at $MOUNT_POINT, the replica
# is written there instead — giving true disk-failure protection the moment you attach
# one. The fstab/cron wiring already points at it.
#
# Cron runs with a minimal PATH — pin the tools we need.
set -u
export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
SRC_DIR="/var/backups/cortexx"
REPLICA_DIR="/var/backups/cortexx-replica"
MOUNT_POINT="/mnt/cortexx-backup"   # attach a NAS/USB here to get off-disk protection
KEEP_DAYS=30
PG_DB="cortexx"
TS="$(date -u +%Y%m%dT%H%M%SZ)"

# Prefer an external mount if it's actually mounted and writable
if mountpoint -q "$MOUNT_POINT" 2>/dev/null && [[ -w "$MOUNT_POINT" ]]; then
  REPLICA_DIR="$MOUNT_POINT/cortexx-replica"
  install -d -m 700 "$REPLICA_DIR"
fi

if [[ ! -d "$SRC_DIR" ]]; then
  echo "[cortexx-replica $TS] ERROR: source $SRC_DIR missing"
  exit 1
fi
install -d -m 700 "$REPLICA_DIR"

# Copy every local .dump into the replica. Hardlink if same FS (free), else copy.
copied=0
while IFS= read -r f; do
  [[ -e "$f" ]] || continue
  dest="$REPLICA_DIR/$(basename "$f")"
  [[ -e "$dest" ]] && continue
  if ln "$f" "$dest" 2>/dev/null; then
    : # hardlink ok
  elif cp -p "$f" "$dest" 2>/dev/null; then
    : # copy ok
  else
    echo "[cortexx-replica $TS] WARN: could not copy $(basename "$f")"
    continue
  fi
  copied=$((copied+1))
done < <(ls -1t "$SRC_DIR/${PG_DB}-"*.dump 2>/dev/null)

# Rotate: delete replica copies older than KEEP_DAYS
find "$REPLICA_DIR" -name "${PG_DB}-*.dump" -mtime +"$KEEP_DAYS" -delete 2>/dev/null
count=$(ls -1 "$REPLICA_DIR/${PG_DB}-"*.dump 2>/dev/null | wc -l)

if [[ "$MOUNT_POINT" != "${REPLICA_DIR%/*}" ]]; then
  loc="local ($REPLICA_DIR)"
else
  loc="external ($REPLICA_DIR)"
fi
echo "[cortexx-replica $TS] OK: +$copied new, $count kept ($KEEP_DAYS d) [$loc]"
exit 0
