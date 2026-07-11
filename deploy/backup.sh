#!/bin/sh
# CortexBuild Pro — nightly database backup (free, local).
# Dumps the Postgres DB from the running compose stack to ./backups,
# gzips it, and prunes anything older than RETAIN_DAYS.
#
# One-time cron install (3am daily):
#   (crontab -l 2>/dev/null; echo "0 3 * * * cd $(pwd) && sh deploy/backup.sh >> backups/backup.log 2>&1") | crontab -
#
# Restore a dump:
#   sh deploy/restore.sh backups/cortexx-2026-06-06-0300.sql.gz
set -e

RETAIN_DAYS="${RETAIN_DAYS:-14}"
DIR="backups"
STAMP=$(date +%Y-%m-%d-%H%M)
OUT="$DIR/cortexx-$STAMP.sql.gz"

mkdir -p "$DIR"

echo "[backup] $(date) — dumping database…"
# Stream pg_dump out of the db container, gzip on the host.
docker compose exec -T db pg_dump -U postgres -d cortexx | gzip > "$OUT"

SIZE=$(ls -lh "$OUT" | awk '{print $5}')
echo "[backup] wrote $OUT ($SIZE)"

# Prune old backups
DELETED=$(find "$DIR" -name 'cortexx-*.sql.gz' -mtime +"$RETAIN_DAYS" -print -delete | wc -l)
[ "$DELETED" -gt 0 ] && echo "[backup] pruned $DELETED backup(s) older than ${RETAIN_DAYS}d"

echo "[backup] done."
