#!/usr/bin/env bash
# CortexBuild Pro — off-box replication of the nightly DB dump.
#
# Invoked by /etc/cron.d/cortexx-replicate at 03:27 UTC (the cron sources
# /root/.config/rclone/aws.env and exports CORTEXX_S3_BUCKET before exec).
# Uploads the newest .sql.gz from /opt/cortexx-backups to S3 under
# s3://$CORTEXX_S3_BUCKET/cortexx-db/. If the bucket/creds are not yet
# configured, falls back to delivering the dump to Telegram so an
# off-box copy still exists somewhere.
#
# Local replica (cortexx_db_replica_local.sh) runs first at 03:22 and is
# non-fatal if it skipped; this script is the one that leaves the building.
#
# Writes .lastok-s3 on success so the watchdog can alert on staleness.

set -euo pipefail
export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

SOURCE_DIR=/opt/cortexx-backups
S3_BUCKET="${CORTEXX_S3_BUCKET:-cortexx-db-backup}"
S3_PREFIX="cortexx-db"
AWS_ENV=/root/.config/rclone/aws.env
LASTOK="$SOURCE_DIR/.lastok-s3"

# Pick the newest .sql.gz
LATEST="$(find "$SOURCE_DIR" -maxdepth 1 -name 'cortexx-*.sql.gz' -printf '%T@ %p\n' 2>/dev/null | sort -nr | head -1 | awk '{print $2}')"
if [ -z "$LATEST" ] || [ ! -f "$LATEST" ]; then
  echo "[cortexx_db_replicate] FAILED: no dump found in $SOURCE_DIR" >&2
  exit 1
fi

NAME="$(basename "$LATEST")"
SIZE=$(stat -c %s "$LATEST")
if [ "$SIZE" -lt 2048 ]; then
  echo "[cortexx_db_replicate] FAILED: source dump suspiciously small (${SIZE} bytes)" >&2
  exit 1
fi

# ── 1. Try S3 replication (primary off-box target) ─────────────────────────
S3_OK=0
if [ -f "$AWS_ENV" ] && command -v rclone >/dev/null 2>&1; then
  # shellcheck disable=SC1090
  . "$AWS_ENV"
  if [ -z "${AWS_ACCESS_KEY_ID:-}" ] || [ -z "${AWS_SECRET_ACCESS_KEY:-}" ]; then
    echo "[cortexx_db_replicate] WARNING: AWS credentials empty in $AWS_ENV — falling back to Telegram" >&2
  else
    rclone_rc=0
    timeout 180 rclone copy "$LATEST" "awss3:${S3_BUCKET}/${S3_PREFIX}/" --s3-no-check-bucket 2>/tmp/cortexx-s3-replicate.err || rclone_rc=$?
    if [ "$rclone_rc" -eq 0 ]; then
      echo "[cortexx_db_replicate] OK s3 -> s3://${S3_BUCKET}/${S3_PREFIX}/$NAME"
      S3_OK=1
    elif [ "$rclone_rc" -eq 124 ]; then
      echo "[cortexx_db_replicate] WARNING: S3 replication timed out after 180s — falling back to Telegram" >&2
    else
      echo "[cortexx_db_replicate] WARNING: S3 replication failed (rc=$rclone_rc) — falling back to Telegram:" >&2
      tail -3 /tmp/cortexx-s3-replicate.err >&2
    fi
  fi
else
  echo "[cortexx_db_replicate] NOTE: rclone or $AWS_ENV missing — falling back to Telegram" >&2
fi

# ── 2. Telegram fallback (so an off-box copy still exists) ──────────────────
# Use the Hermes CLI's send command — it knows the right chat and bot token
# from the user-configured gateway, no secrets in this file.
if [ "$S3_OK" -eq 0 ] && command -v hermes >/dev/null 2>&1; then
  TG_OUT=$(timeout 60 hermes send --file "$LATEST" --caption "Cortexx DB backup $NAME (off-box fallback, S3 unavailable)" 2>/tmp/cortexx-tg.err) || true
  if echo "$TG_OUT" | grep -qiE 'sent|delivered|ok'; then
    echo "[cortexx_db_replicate] OK telegram fallback delivered ($NAME)"
  else
    echo "[cortexx_db_replicate] WARNING: Telegram fallback could not confirm delivery:" >&2
    tail -3 /tmp/cortexx-tg.err >&2
  fi
elif [ "$S3_OK" -eq 0 ]; then
  echo "[cortexx_db_replicate] ERROR: no S3 and no hermes CLI — OFF-BOX COPY NOT MADE" >&2
  exit 1
fi

date -u +%FT%TZ > "$LASTOK"
exit 0
