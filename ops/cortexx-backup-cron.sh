#!/usr/bin/env bash
# CortexBuild Pro — nightly database backup (host cron, Dockerized Postgres)
#
# FIXED 2026-07-26: this used to run `sudo -u postgres pg_dump cortexx`,
# which dumps the HOST's local PostgreSQL 16 install — an empty, orphaned
# database left over from before the app moved to Docker Compose. The
# real, live database is inside the `db` container (postgres:16-alpine,
# see /opt/cortexx/docker-compose.yml). Every nightly backup for at least
# 8 weeks (since 2026-06-07, per the weekly Backup-Verify job's failure
# history) backed up the wrong database. This now matches the repo's
# canonical deploy/backup.sh, which already did this correctly.
set -e
cd /opt/cortexx

mkdir -p /opt/cortexx-backups
OUT="/opt/cortexx-backups/cortexx-$(date -u +%Y%m%d-%H%M%S).sql.gz"

docker compose exec -T db pg_dump -U postgres -d cortexx | gzip > "$OUT" || rm -f "$OUT"

find /opt/cortexx-backups -name '*.sql.gz' -mtime +30 -delete
