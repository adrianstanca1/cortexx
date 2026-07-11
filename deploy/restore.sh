#!/bin/sh
# CortexBuild Pro — restore a database backup produced by deploy/backup.sh.
# Usage:  sh deploy/restore.sh backups/cortexx-2026-06-06-0300.sql.gz
#
# WARNING: this DROPs and recreates the public schema before restoring.
# Take a fresh backup first if the current data matters.
set -e

FILE="$1"
if [ -z "$FILE" ] || [ ! -f "$FILE" ]; then
	echo "Usage: sh deploy/restore.sh <backup.sql.gz>"
	echo "Available backups:"
	ls -1 backups/cortexx-*.sql.gz 2>/dev/null || echo "  (none found in backups/)"
	exit 1
fi

echo "[restore] This will OVERWRITE the current cortexx database with:"
echo "          $FILE"
printf "[restore] Type 'yes' to continue: "
read CONFIRM
[ "$CONFIRM" = "yes" ] || { echo "[restore] aborted."; exit 1; }

echo "[restore] resetting schema…"
docker compose exec -T db psql -U postgres -d cortexx -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

echo "[restore] loading dump…"
gunzip -c "$FILE" | docker compose exec -T db psql -U postgres -d cortexx

echo "[restore] done. Restarting API…"
docker compose restart api
echo "[restore] complete."
