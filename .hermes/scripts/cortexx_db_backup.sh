#!/usr/bin/env bash
# CortexBuild Pro — nightly database backup (Hermes pipeline variant).
#
# Installed at /root/.hermes/scripts/cortexx_db_backup.sh — invoked by
# /etc/cron.d/cortexx-backup at 03:17 UTC. This is the LEGACY pipeline that
# predates /etc/cron.daily/cortexx-backup. We keep both running so a failure
# of one does not silently leave the system without off-box coverage.
#
# The 2026-07 incident (see /etc/cron.daily/cortexx-backup history block)
# was caused by this script dumping the EMPTY host Postgres while the real
# data lived in the `db` container. The host DB has since been dropped, so
# this script now dumps the live Docker DB too — same target, same guard
# rails as the daily script. Two pipelines writing the same dump is fine:
# different filenames (this one: -host suffix on the .lastok marker), and
# different S3 prefixes if/when replication is re-enabled.
#
# Writes .lastok-host on success so the watchdog can alert on staleness.

set -euo pipefail
export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

APP_DIR=/opt/cortexx
BACKUP_DIR=/opt/cortexx-backups
KEEP_DAYS=30
LASTOK="$BACKUP_DIR/.lastok-host"

TS="$(date -u +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/cortexx-${TS}-host.sql.gz"

mkdir -p "$BACKUP_DIR"
cd "$APP_DIR" || { echo "[cortexx_db_backup $TS] FATAL: $APP_DIR missing" >&2; exit 1; }

# ── 1. Dump the live database (inside the db container) ─────────────────────
if ! docker compose exec -T db pg_dump -U postgres -d cortexx 2>/tmp/cortexx-backup-host.err | gzip > "$OUT"; then
  echo "[cortexx_db_backup $TS] FAILED: pg_dump error:" >&2
  tail -5 /tmp/cortexx-backup-host.err >&2
  rm -f "$OUT"
  exit 1
fi

# Guard against a silent partial/empty dump — a valid schema dump of this
# database is comfortably over 2 KB gzipped.
SIZE=$(stat -c %s "$OUT")
if [ "$SIZE" -lt 2048 ]; then
  echo "[cortexx_db_backup $TS] FAILED: dump suspiciously small (${SIZE} bytes) — not trusting it" >&2
  rm -f "$OUT"
  exit 1
fi

# Verify the gzip is intact and contains real schema before we call it a win.
TABLES=$(gunzip -c "$OUT" 2>/dev/null | grep -c "^CREATE TABLE" || echo 0)
if [ "$TABLES" -lt 30 ]; then
  echo "[cortexx_db_backup $TS] FAILED: only ${TABLES} CREATE TABLE statements (expected 30+)" >&2
  rm -f "$OUT"
  exit 1
fi

echo "[cortexx_db_backup $TS] OK -> $OUT ($(du -h "$OUT" | cut -f1), ${TABLES} tables)"

# ── 2. Rotate local copies ──────────────────────────────────────────────────
find "$BACKUP_DIR" -name 'cortexx-*.sql.gz' -mtime +"$KEEP_DAYS" -delete 2>/dev/null

date -u +%FT%TZ > "$LASTOK"
exit 0
