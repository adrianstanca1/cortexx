#!/usr/bin/env bash
# Off-box replication of the nightly Cortexx customer-DB dump.
#
# Two modes, auto-selected:
#   1. CLOUD (preferred, ACTIVE): if `rclone` has a configured remote whose name
#      matches CORTEXX_REMOTE (default: "awss3") AND an S3 bucket is set via
#      CORTEXX_S3_BUCKET, copy every local .dump into
#      <remote>:<bucket>/cortexx-db/. The credentials come from a root-only env
#      file (/root/.config/rclone/aws.env) sourced by the cron entry — never stored
#      in rclone.conf or this script. This is the durable off-box copy.
#   2. TELEGRAM (fallback): if no cloud remote/bucket is configured, the latest
#      dump is delivered to Telegram as a document. Reuses Hermes' Telegram token
#      via `hermes send` — no new credentials. Keeps only the single newest dump.
#
# Cron runs with a minimal PATH — pin the tools we need.
set -u
export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
BACKUP_DIR="/var/backups/cortexx"
PG_DB="cortexx"
REMOTE_NAME="${CORTEXX_REMOTE:-awss3}"
S3_BUCKET="${CORTEXX_S3_BUCKET:-}"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
TG_TARGET="${CORTEXX_REPLICATE_TG:-telegram}"

latest_dump() {
  ls -1t "$BACKUP_DIR/${PG_DB}-"*.dump 2>/dev/null | head -1
}

if [[ ! -d "$BACKUP_DIR" ]]; then
  echo "[cortexx-replicate $TS] ERROR: backup dir $BACKUP_DIR missing — run cortexx_db_backup.sh first"
  exit 1
fi

DUMP="$(latest_dump)"
if [[ -z "$DUMP" ]]; then
  echo "[cortexx-replicate $TS] ERROR: no .dump found in $BACKUP_DIR"
  exit 1
fi

# Mode 1: cloud remote available AND bucket configured AND credentials present?
AWS_CREDS_OK=0
AWS_ENV=/root/.config/rclone/aws.env
if [[ -f "$AWS_ENV" ]]; then
  # shellcheck disable=SC1090
  . "$AWS_ENV"
  [[ -n "${AWS_ACCESS_KEY_ID:-}" && -n "${AWS_SECRET_ACCESS_KEY:-}" ]] && AWS_CREDS_OK=1
fi

if [[ "$AWS_CREDS_OK" -eq 1 && -n "$S3_BUCKET" ]] && command -v rclone >/dev/null 2>&1 \
   && rclone listremotes 2>/dev/null | grep -qx "${REMOTE_NAME}:"; then
  rclone_rc=0
  timeout 120 rclone copy "$BACKUP_DIR" "${REMOTE_NAME}:${S3_BUCKET}/cortexx-db" \
        --include "${PG_DB}-*.dump" --s3-no-check-bucket 2>/tmp/cortexx-replicate.err || rclone_rc=$?
  if [ "$rclone_rc" -eq 0 ]; then
    echo "[cortexx-replicate $TS] OK: synced dumps to ${REMOTE_NAME}:${S3_BUCKET}/cortexx-db"
    exit 0
  elif [ "$rclone_rc" -eq 124 ]; then
    echo "[cortexx-replicate $TS] WARN: rclone timed out after 120s; falling back to Telegram for this run"
  else
    echo "[cortexx-replicate $TS] WARN: rclone copy failed; falling back to Telegram for this run"
  fi
elif [[ -f "$AWS_ENV" && "$AWS_CREDS_OK" -eq 0 ]]; then
  echo "[cortexx-replicate $TS] WARN: AWS credentials empty in $AWS_ENV; falling back to Telegram"
fi

# Mode 2: Telegram document delivery (working off-box copy)
CAP="Cortexx DB off-box copy ($(du -h "$DUMP" | cut -f1)) — $(basename "$DUMP")"
if printf '%s\nMEDIA:%s\n' "$CAP" "$DUMP" | hermes send -t "$TG_TARGET" -q 2>/dev/null; then
  echo "[cortexx-replicate $TS] OK: sent $(basename "$DUMP") to Telegram ($TG_TARGET)"
  exit 0
else
  echo "[cortexx-replicate $TS] ERROR: Telegram delivery failed"
  exit 1
fi
