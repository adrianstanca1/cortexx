#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/www/cortexbuild-ultimate/backups"
KEEP_DAYS=7
LOG_FILE="/var/www/cortexbuild-ultimate/logs/backup.log"
mkdir -p $BACKUP_DIR
mkdir -p /var/www/cortexbuild-ultimate/logs
echo "[$(date)] Starting backup..." >> $LOG_FILE

# PostgreSQL backup
docker exec cortexbuild-db pg_dump -U cortexbuild cortexbuild > "$BACKUP_DIR/db_backup_$DATE.sql"
if [ $? -eq 0 ]; then
    echo "[$(date)] Database backup created: db_backup_$DATE.sql" >> $LOG_FILE
    gzip "$BACKUP_DIR/db_backup_$DATE.sql"
else
    echo "[$(date)] ERROR: Database backup failed!" >> $LOG_FILE
    exit 1
fi

# Upload files backup
tar -czf "$BACKUP_DIR/uploads_backup_$DATE.tar.gz" -C /var/www/cortexbuild-ultimate server/uploads 2>/dev/null || true

# Clean old backups
find $BACKUP_DIR -name "db_backup_*.sql.gz" -mtime +$KEEP_DAYS -delete
find $BACKUP_DIR -name "uploads_backup_*.tar.gz" -mtime +$KEEP_DAYS -delete

BACKUP_COUNT=$(ls -1 $BACKUP_DIR/db_backup_*.sql.gz 2>/dev/null | wc -l)
echo "[$(date)] Backup complete. Total backups: $BACKUP_COUNT" >> $LOG_FILE
echo "[$(date)] Disk usage: $(du -sh $BACKUP_DIR | cut -f1)" >> $LOG_FILE
