# Construction production recovery

The active stack is `docker-compose.construction.yml`, database container
`cortexbuild-construction-db-1`, and evidence at `/app/uploads` in the app
container. The historical `ops/cortexx-backup-cron.sh` and `deploy/backup.sh`
target a different stack/database. Do not use them for this deployment.

Run `bash ops/install-construction-backups.sh` as the VPS operator from a
reviewed checkout. This preserves existing cron jobs, saves their previous
configuration, and installs a daily 02:15 backup plus Sunday 02:45 isolated
restore check in the server timezone (currently UTC).

Manual operations:

```bash
bash "$HOME/bin/construction-backup.sh"
bash "$HOME/bin/construction-restore-drill.sh" "$(cat "$HOME/backups/construction/.last-local-success")"
```

Backups are private, atomically published directories in
`$HOME/backups/construction`, retained for 14 days. Each contains a PostgreSQL
custom-format dump, uploads archive, checksums, image reference and manifest.
Failed dumps or archives are never published as completed backups. A lock
prevents concurrent runs. `.last-local-success` and `.last-offsite-success`
are deliberately separate indicators. Logs are under `$HOME/logs`.

Restore drills use a disposable PostgreSQL container without external networking
or published ports. They verify checksums, restore with exit-on-error, check
that tables exist, extract uploads and remove the disposable container and its
volume. No production database is dropped or replaced. Review the weekly log;
this setup does not yet provide external failure notifications.

For disaster recovery, restore into an isolated replacement stack first, verify
organisation/project/evidence access and migrations, then switch traffic during
a controlled maintenance window. Retain the existing stack for rollback. The
drill script intentionally cannot overwrite production.

## Verified 26 September 2026 UTC

- Production checkout: `e384e49`; public API reports healthy database/app/disk/memory.
- Live database and uploads backup successfully created.
- Isolated restore: **109 tables**, uploads extracted, **5 seconds** (small current
  dataset). This is not an end-to-end production recovery-time guarantee.
- No off-site remote is configured. Set `BACKUP_REMOTE` to an existing rclone
  destination in the scheduled environment after configuring credentials; the
  script copies and verifies objects before marking off-site success.

## Remaining limits

Daily scheduling has an up-to-24-hour data-loss window, not the desired five-minute
RPO. Achieving that requires PostgreSQL WAL archiving/PITR and off-site storage.
Uploads are captured while the app is running, so database and file snapshots
are not transactionally coordinated. Use a maintenance window for a consistent
cutover snapshot. Host loss still loses local backups. Store environment/secrets
securely off-box separately; these scripts intentionally do not archive them.
