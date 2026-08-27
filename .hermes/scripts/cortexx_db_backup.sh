#!/usr/bin/env bash
# Nightly backup of the Cortexx CUSTOMER data store (host Postgres) — the real
# database the web app uses (NOT the docker 'db' container). Plain-text secrets are
# avoided: we connect via the postgres OS user (peer auth), so no password is needed
# in this file or in the crontab.
#
# Output: timestamped .dump (pg_dump custom format) + .sql in /var/backups/cortexx,
# kept for KEEP_DAYS then rotated. Writes a .lastok marker on success so the watchdog
# can later alert if backups stop happening.
#
# Install via /etc/cron.d/cortexx-backup (see that file). Run manually:
#   bash /root/.hermes/scripts/cortexx_db_backup.sh

set -u
# Cron runs with a minimal PATH — pin the tools we need.
export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
PG_DB="cortexx"
BACKUP_DIR="/var/backups/cortexx"
KEEP_DAYS=7
TS="$(date -u +%Y%m%dT%H%M%SZ)"
LASTOK="$BACKUP_DIR/.lastok"

mkdir -p "$BACKUP_DIR"

dump_one() {  # $1 = role
  local role="$1"
  local dump="$BACKUP_DIR/${PG_DB}-${TS}.dump"
  # PATCHED 2026-07-27: was `sudo -u postgres pg_dump` against the HOST
  # Postgres — an orphaned DB with 83 tables and 0 rows. The live database
  # is inside the `db` container (both cortexx-api-1 and cortexx-admin-1
  # use db:5432/cortexx). Custom format is preserved so the existing
  # replica + Telegram/S3 replication steps keep working unchanged.
  if ( cd /opt/cortexx && docker compose exec -T db pg_dump -U postgres --format=custom -d "$PG_DB" ) > "$dump" 2>/dev/null && [ -s "$dump" ]; then
    # Only the compressed custom-format dump is kept (it is the restore artifact).
    # A human-readable .sql copy is intentionally NOT written: it would be a
    # plaintext copy of customer data on disk and the dump is sufficient.
    date -u +%FT%TZ > "$LASTOK"
    echo "[cortexx-db-backup $TS] OK -> $dump ($(du -h "$dump" | cut -f1))"
    return 0
  fi
  echo "[cortexx-db-backup $TS] FAILED via role $role" >&2
  return 1
}

if dump_one postgres; then
  # Rotate: delete dumps older than KEEP_DAYS
  find "$BACKUP_DIR" -name "${PG_DB}-*.dump" -mtime +"$KEEP_DAYS" -delete 2>/dev/null
  echo "[cortexx-db-backup $TS] rotation: kept last $KEEP_DAYS days"
  exit 0
else
  echo "[cortexx-db-backup $TS] BACKUP FAILED" >&2
  exit 1
fi
