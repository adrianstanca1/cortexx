#!/usr/bin/env bash
# Nightly backup of the InvoiceSmart Postgres database.
# Dumps the live database inside the cortexbuild-postgres container,
# verifies size + gzip integrity, rotates local copies, and writes a
# .lastok marker for watchdog checks.
#
# Run manually:
#   bash /root/.hermes/scripts/invoicesmart_backup.sh

set -uo pipefail
export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

PG_DB="invoicesmart"
BACKUP_DIR="/opt/invoicesmart-backups"
KEEP_DAYS=30
TS="$(date -u +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/invoicesmart-${TS}.sql.gz"
LASTOK="$BACKUP_DIR/.lastok"

mkdir -p "$BACKUP_DIR"

# ── 1. Dump the live database (inside the postgres container) ────────────────
if ! docker exec -i cortexbuild-postgres pg_dump -U postgres -d "$PG_DB" 2>/tmp/invoicesmart-backup.err | gzip > "$OUT"; then
  echo "[invoicesmart-backup $TS] FAILED: pg_dump error:" >&2
  tail -5 /tmp/invoicesmart-backup.err >&2
  rm -f "$OUT"
  exit 1
fi

# Guard against a silent partial/empty dump.
SIZE=$(stat -c %s "$OUT")
if [ "$SIZE" -lt 1024 ]; then
  echo "[invoicesmart-backup $TS] FAILED: dump suspiciously small (${SIZE} bytes) — not trusting it" >&2
  rm -f "$OUT"
  exit 1
fi

# Verify gzip integrity and that it contains real schema.
TABLES=$(gunzip -c "$OUT" 2>/dev/null | grep -c "^CREATE TABLE" || echo 0)
if [ "$TABLES" -lt 5 ]; then
  echo "[invoicesmart-backup $TS] FAILED: only ${TABLES} CREATE TABLE statements (expected 5+)" >&2
  rm -f "$OUT"
  exit 1
fi

echo "[invoicesmart-backup $TS] OK -> $OUT ($(du -h "$OUT" | cut -f1), ${TABLES} tables)"

# ── 2. Rotate local copies ─────────────────────────────────────────────────
find "$BACKUP_DIR" -name 'invoicesmart-*.sql.gz' -mtime +"$KEEP_DAYS" -delete 2>/dev/null

date -u +%FT%TZ > "$LASTOK"
exit 0
