#!/usr/bin/env bash
# CortexBuild Pro — nightly database backup + off-box replication.
#
# Installed at /etc/cron.daily/cortexx-backup on the VPS.
#
# ── History / why this file exists ──────────────────────────────────────────
# v1 (fixed 2026-07-26, PR #125): the previous cron dumped the HOST's local
#   PostgreSQL via `sudo -u postgres pg_dump cortexx` — an empty, orphaned
#   database left over from before the app moved to Docker Compose. The live
#   database is inside the `db` container. 8 weeks of backups protected
#   nothing.
#
# v2 (this file): v1 fixed the target but wrote only to /opt/cortexx-backups
#   on the same disk — no off-box copy. Meanwhile the parallel Hermes
#   pipeline (/root/.hermes/scripts/cortexx_db_backup.sh, cron.d/cortexx-*)
#   replicates nightly to AWS S3 — but it still dumps the EMPTY host DB, so
#   the only off-site backup contained no data. This adds S3 replication of
#   the REAL dump, reusing the rclone remote + creds the Hermes pipeline
#   already established.
#
# Objects land under s3://$S3_BUCKET/cortexx-db/docker/ — a distinct prefix
# from the Hermes pipeline's cortexx-db/, so the two never collide and it's
# obvious which dumps came from the live database.
#
# Local: 30-day retention. Off-box: lifecycle-managed on the bucket.
# Writes .lastok-docker on success so a watchdog can alert on staleness.

set -uo pipefail
export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

APP_DIR=/opt/cortexx
BACKUP_DIR=/opt/cortexx-backups
KEEP_DAYS=30
S3_BUCKET="${CORTEXX_S3_BUCKET:-cortexx-db-backup}"
S3_PREFIX="cortexx-db/docker"
AWS_ENV=/root/.config/rclone/aws.env
LASTOK="$BACKUP_DIR/.lastok-docker"

TS="$(date -u +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/cortexx-${TS}.sql.gz"

mkdir -p "$BACKUP_DIR"
cd "$APP_DIR" || { echo "[cortexx-backup $TS] FATAL: $APP_DIR missing" >&2; exit 1; }

# ── 1. Dump the live database (inside the db container) ─────────────────────
if ! docker compose exec -T db pg_dump -U postgres -d cortexx 2>/tmp/cortexx-backup.err | gzip > "$OUT"; then
  echo "[cortexx-backup $TS] FAILED: pg_dump error:" >&2
  tail -5 /tmp/cortexx-backup.err >&2
  rm -f "$OUT"
  exit 1
fi

# Guard against a silent partial/empty dump: a valid schema dump of this
# database is comfortably over 2 KB gzipped. Catching this here is the
# difference between "backup failed loudly" and "backup succeeded, restored
# to nothing" — the exact failure class that went unnoticed for 8 weeks.
SIZE=$(stat -c %s "$OUT")
if [ "$SIZE" -lt 2048 ]; then
  echo "[cortexx-backup $TS] FAILED: dump suspiciously small (${SIZE} bytes) — not trusting it" >&2
  rm -f "$OUT"
  exit 1
fi

# Verify the gzip is intact and contains real schema before we call it a win.
TABLES=$(gunzip -c "$OUT" 2>/dev/null | grep -c "^CREATE TABLE" || echo 0)
if [ "$TABLES" -lt 30 ]; then
  echo "[cortexx-backup $TS] FAILED: only ${TABLES} CREATE TABLE statements (expected 30+)" >&2
  rm -f "$OUT"
  exit 1
fi

echo "[cortexx-backup $TS] OK -> $OUT ($(du -h "$OUT" | cut -f1), ${TABLES} tables)"

# ── 2. Replicate off-box to S3 ──────────────────────────────────────────────
# A local-only backup does not survive the failure mode that matters most
# (losing the box). Non-fatal: a local backup still exists if this fails, but
# it's reported loudly so the watchdog/log shows it.
if [ -f "$AWS_ENV" ] && command -v rclone >/dev/null 2>&1; then
  # shellcheck disable=SC1090
  . "$AWS_ENV"
  if rclone copy "$OUT" "awss3:${S3_BUCKET}/${S3_PREFIX}/" --s3-no-check-bucket 2>/tmp/cortexx-s3.err; then
    echo "[cortexx-backup $TS] replicated -> s3://${S3_BUCKET}/${S3_PREFIX}/$(basename "$OUT")"
  else
    echo "[cortexx-backup $TS] WARNING: S3 replication failed (local copy retained):" >&2
    tail -3 /tmp/cortexx-s3.err >&2
  fi
else
  echo "[cortexx-backup $TS] WARNING: rclone or $AWS_ENV missing — NO off-box copy made" >&2
fi

# ── 3. Rotate local copies ──────────────────────────────────────────────────
find "$BACKUP_DIR" -name 'cortexx-*.sql.gz' -mtime +"$KEEP_DAYS" -delete 2>/dev/null

date -u +%FT%TZ > "$LASTOK"
exit 0
