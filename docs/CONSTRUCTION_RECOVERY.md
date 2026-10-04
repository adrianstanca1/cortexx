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
that the canonical User/Organization/Project/Task/Document and migration tables are readable, extract uploads and remove the disposable container and its
volume. No production database is dropped or replaced. Review the weekly log;
the daily GitHub Backup Verify workflow checks the current VPS, exports the
latest successful backup as encrypted ciphertext, validates that archive with a
second disposable PostgreSQL restore, and opens or updates a recovery issue on
failure. A successful archive is retained as a private GitHub Actions artifact
for 30 days. It uses AES-256-CBC with PBKDF2 (200,000 iterations); the key stays
in the `CORTEXX_BACKUP_ENCRYPTION_KEY` GitHub secret and is not included in the
artifact.

For disaster recovery, restore into an isolated replacement stack first, verify
organisation/project/evidence access and migrations, then switch traffic during
a controlled maintenance window. Retain the existing stack for rollback. The
drill script intentionally cannot overwrite production.

## Verified 26 September 2026 UTC

- Production checkout: `e384e49`; public API reports healthy database/app/disk/memory.
- Live database and uploads backup successfully created.
- Isolated restore: **109 tables**, uploads extracted, **5 seconds** (small current
  dataset). This is not an end-to-end production recovery-time guarantee.
- Hosted Backup Verify has completed the encrypted off-site export and restore
  path. Each successful daily workflow retains one ciphertext-only artifact for
  30 days. Verify the latest workflow run before relying on that evidence.

The scheduled local verifier rejects missing backups, backups older than 36 hours,
future timestamps and paths outside the managed directory. The restore was repeated
with table smoke queries: 2 users, 2 organisations, 1 project, 2 tasks, 1 document
and 57 completed migrations; 109 tables restored in 6 seconds. These are aggregate
counts only. Five local regression tests cover the freshness guard.

## Remaining limits

Daily scheduling has an up-to-24-hour data-loss window, not the desired five-minute
RPO. Achieving that requires PostgreSQL WAL archiving/PITR; a daily encrypted
artifact is off-site backup, not continuous recovery.
Uploads are captured while the app is running, so database and file snapshots
are not transactionally coordinated. Use a maintenance window for a consistent
cutover snapshot. Host loss still loses local backups, although a recent
successfully retained GitHub artifact can provide an off-site recovery point.
Artifact retention is only 30 days and recovery also depends on preserving the
encryption key. Store environment/secrets securely off-box separately; these
scripts intentionally do not archive them.
