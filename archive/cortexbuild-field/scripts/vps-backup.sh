#!/usr/bin/env bash
# cortexbuild-field nightly backup
# Daily Postgres dump + 30-day retention.
# Configured cron: 02:00 UTC daily — see /etc/cron.d/cortexbuild-backup.
set -euo pipefail

BACKUP_DIR=/var/backups/cortexbuild
RETENTION_DAYS=30
TS=$(date -u +%Y%m%d-%H%M%S)
LOG=/var/log/cortexbuild-backup.log

mkdir -p "$BACKUP_DIR"

log() { echo "[$(date -u +%FT%TZ)] $*" | tee -a "$LOG"; }

log "── start ──"

# --- Postgres dump (pg_dump piped through the docker-exec'd container) ---
DB_FILE="$BACKUP_DIR/db-$TS.sql.gz"
if docker ps --format '{{.Names}}' | grep -q '^cortexbuild-postgres$'; then
  if docker exec cortexbuild-postgres pg_dump -U cortexbuild cortexbuild_field 2>>"$LOG" \
     | gzip -9 > "$DB_FILE"; then
    SIZE=$(stat -c%s "$DB_FILE")
    log "  pg_dump ok → $DB_FILE ($SIZE bytes)"
  else
    log "  ERROR: pg_dump failed; partial file removed"
    rm -f "$DB_FILE"
    exit 1
  fi
else
  log "  WARN: cortexbuild-postgres container not running; skipping DB dump"
fi

# --- Snapshot Apple .p8 keys + .env (small but critical) ---
CRED_FILE="$BACKUP_DIR/creds-$TS.tar.gz"
tar czf "$CRED_FILE" \
  -C / \
  --warning=no-file-changed --warning=no-file-removed \
  root/.config/apple/ \
  root/cortexbuild-field/.env \
  var/www/cortexbuild-field/.env \
  root/.ssh/cbf_github_deploy \
  root/.ssh/id_ed25519 \
  root/.ssh/authorized_keys \
  2>>"$LOG" || log "  WARN: some files missing in cred snapshot"
chmod 600 "$CRED_FILE"
log "  creds snapshot → $CRED_FILE ($(stat -c%s "$CRED_FILE") bytes)"

# --- Retention: drop anything older than RETENTION_DAYS ---
DELETED=$(find "$BACKUP_DIR" -name 'db-*.sql.gz' -o -name 'creds-*.tar.gz' \
  | xargs -I{} ls -t {} 2>/dev/null | tail -n +$((RETENTION_DAYS + 1)) | wc -l)
find "$BACKUP_DIR" \( -name 'db-*.sql.gz' -o -name 'creds-*.tar.gz' \) \
  -mtime +"$RETENTION_DAYS" -delete 2>>"$LOG"
log "  retention pruned $DELETED files older than ${RETENTION_DAYS}d"

log "  inventory: $(ls "$BACKUP_DIR" | wc -l) files, $(du -sh "$BACKUP_DIR" | cut -f1)"
log "── end ──"
