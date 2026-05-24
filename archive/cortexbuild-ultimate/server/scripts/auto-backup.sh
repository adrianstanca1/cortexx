#!/bin/bash
# Automated backup script for CortexBuild

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/www/cortexbuild-ultimate/backups"
mkdir -p $BACKUP_DIR

# PostgreSQL backup
docker exec cortexbuild-db pg_dump -U cortexbuild cortexbuild > "$BACKUP_DIR/db_backup_$DATE.sql"

# Keep only last 7 backups
cd $BACKUP_DIR
ls -t db_backup_*.sql | tail -n +8 | xargs -r rm

echo "[$(date)] Backup completed: db_backup_$DATE.sql"
