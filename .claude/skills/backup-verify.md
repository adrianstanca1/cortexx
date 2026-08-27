# backup-verify

Verify the Cortexx database backup pipeline is healthy and producing real,
restorable dumps.

## When to use

- Watchdog reports backup stale.
- Backup marker timestamp does not match the latest dump.
- You need to confirm off-box replication is working.

## Steps

1. List local dumps:
   ```bash
   ls -lt /var/backups/cortexx
   ls -lt /opt/cortexx-backups
   ```

2. Check marker files:
   ```bash
   cat /var/backups/cortexx/.lastok
   cat /opt/cortexx-backups/.lastok-docker
   ```

3. Validate the latest dump is not empty/partial:
   ```bash
   # custom-format dump
   pg_restore -l /var/backups/cortexx/cortexx-LATEST.dump | wc -l

   # gzipped SQL dump
   gunzip -c /opt/cortexx-backups/cortexx-LATEST.sql.gz | grep -c "^CREATE TABLE"
   ```

4. If the marker is stale or missing, rerun the canonical scripts:
   ```bash
   bash /etc/cron.daily/cortexx-backup          # Docker DB → /opt/cortexx-backups + S3
   bash /root/.hermes/scripts/cortexx_db_backup.sh  # Docker DB → /var/backups/cortexx
   ```

5. Check off-box replication:
   ```bash
   bash /root/.hermes/scripts/cortexx_db_replicate.sh
   ```

## Safety

- Never delete the most recent dump until a newer successful dump exists.
- Keep at least one local copy before deleting old dumps.
- The Hermes script at `/var/backups/cortexx` and the canonical script at
  `/opt/cortexx-backups` both dump the live Docker `db` container.

## Notes

- The `.lastok` marker should be within 26 hours of the latest dump timestamp.
- A small (< 50 KB) dump usually means the wrong database was dumped — check
  that the script uses `docker compose exec -T db pg_dump`.
- S3 replication requires `/root/.config/rclone/aws.env` and a configured
  rclone remote named `awss3`.
