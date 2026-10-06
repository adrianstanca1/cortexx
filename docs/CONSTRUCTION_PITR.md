# Optional PostgreSQL point-in-time recovery

This opt-in extension supports the construction stack's PostgreSQL 16 cluster
with its default data directory and no external tablespaces. The normal daily
logical backups, uploads backups and hosted Backup Verify continue independently.
The PITR overlay is not enabled by the regular Compose file or backup installer.

## Install and validate without restarting the database

Host requirements: Bash, Docker/Compose access, Python 3 (standard library only),
GNU coreutils/tar/gzip and `flock` from util-linux. The restore image
`postgres:16-alpine` must already be cached; drills use `--pull=never`.

```bash
INSTALL_CONSTRUCTION_PITR_TOOLS=1 bash ops/install-construction-backups.sh
npm run test:pitr
npm run test:pitr:drill
```

The installer copies physical-backup and restore tools alongside the existing
tools. It does not enable WAL archiving or schedule physical backups. The manual
fixture drill builds a separate validation image using the cached PostgreSQL
base image, creates synthetic data without networking or production volumes,
verifies recovery at a named target, rejects a withheld WAL segment, and removes
its disposable containers and files. It requires a local Docker daemon and
enough memory for the tmpfs databases.

## Operator activation during a maintenance window

Verify a recent logical backup first. Applying this overlay recreates/restarts
the database service; schedule that outage and review the resolved Compose
configuration before activation. Use the same project/environment files as the
existing deployment so its database volume is retained.

```bash
docker compose --env-file .env.construction \
  -f docker-compose.construction.yml -f docker-compose.construction-pitr.yml config --quiet
docker compose --env-file .env.construction \
  -f docker-compose.construction.yml -f docker-compose.construction-pitr.yml build db
docker compose --env-file .env.construction \
  -f docker-compose.construction.yml -f docker-compose.construction-pitr.yml up -d --no-deps db
docker exec cortexbuild-construction-db-1 psql -U construction -d construction -c \
  'SHOW archive_mode; SHOW archive_command; SELECT * FROM pg_stat_archiver;'
```

The overlay enables WAL archiving to the separate `construction_wal_archive`
volume and requests a segment switch after 60 seconds of activity. The archiver
publishes each segment atomically, with private permissions, compares existing
bytes before accepting a retry, and reports synchronization failures. Archive
failures retain WAL in `pg_wal`; monitor both `pg_stat_archiver.failed_count`,
archive freshness and disk capacity. Keep the overlay in subsequent deployment
commands so recreating the database does not silently disable archiving.

## Create a base backup and rehearse a named target

```bash
bash "$HOME/bin/construction-pitr-basebackup.sh"
docker exec cortexbuild-construction-db-1 psql -U construction -d construction -c \
  "SELECT pg_create_restore_point('construction_verified_target'); SELECT pg_switch_wal();"
```

Base backups are private, immutable directories under
`$HOME/backups/construction-pitr`, published after the stream completes and its
archive layout is validated. `.last-physical-success` records the last completed
physical backup separately from logical and off-site markers. Taking a backup
requires an archiving PostgreSQL 16 primary, an active archive command and local
socket replication authentication for its configured `POSTGRES_USER`. Custom
tablespaces, other major versions and archives containing links are rejected.
`--wal-method=fetch` includes the WAL needed to make the base consistent; the
server must retain that WAL until the backup completes. A busy cluster may need
more `wal_keep_size`; a failed fetch never publishes success. The initial spread
checkpoint can take several minutes.

After the segment containing the named target has been successfully archived,
take an immutable snapshot of the published WAL. The following copies local
WAL only; it is not an encrypted off-site export:

```bash
mkdir -m 700 "$HOME/backups/construction-pitr/wal-snapshot"
docker exec cortexbuild-construction-db-1 sh -ec \
  'cd /var/lib/postgresql/wal_archive; exec tar -cf - [0-9A-F]*' |
  tar --no-same-owner -xf - -C "$HOME/backups/construction-pitr/wal-snapshot"
bash "$HOME/bin/construction-pitr-restore-drill.sh" \
  "$(cat "$HOME/backups/construction-pitr/.last-physical-success")" \
  "$HOME/backups/construction-pitr/wal-snapshot" construction_verified_target
```

Run the snapshot pipeline with `set -o pipefail` and check the exit status.
Restore inputs must be canonical absolute paths and remain unchanged during the
drill. The verifier checks checksums, rejects unsafe tar paths/links and invalid
WAL, runs `pg_verifybackup`, then requires recovery to pause at the named target
on the base backup's timeline and reads public tables. It fails when the target
is missing or the WAL chain is incomplete. It mounts source files read-only,
uses a fixed PostgreSQL 16 image without networking/published ports, restores
only into tmpfs, and removes the labelled container on exit. Socket trust is
configured only inside that disposable container.

Set `PITR_DB_USER`/`PITR_DB_NAME` for different role/database names.
`PITR_DRILL_TMPFS_SIZE` defaults to `1g` for **each** data/WAL tmpfs;
`PITR_DRILL_TIMEOUT_SECONDS` defaults to 120 (maximum 3600).
`PITR_DRILL_CHECK_TABLE` plus `PITR_DRILL_EXPECT_ROWS` adds a row-count assertion.

## Recovery limits and evidence

On 5 October 2026, an isolated PostgreSQL 16.15 fixture passed: the physical base
restored, a later row was replayed, a row after the named target was excluded,
and withholding the target segment caused failure. This is synthetic tooling
evidence; production archiving/off-site coverage has not been activated or
verified by this change.

WAL and base backups contain sensitive database contents. Configure encrypted
off-site copying with continuous monitoring and verify restoration from that
destination before claiming a five-minute recovery point. Local WAL alone does
not protect against host/volume loss. The existing daily encrypted artifact does
not export these physical backups or their WAL. Retain a verified base and its
complete WAL chain through every required target; these tools deliberately do
not delete physical backups/WAL or set an automatic retention policy. Archive
checksums detect corruption; they do not authenticate an attacker-modified
archive and checksum file.

Uploads are separate from PostgreSQL WAL and are not transactionally coordinated.
Use the logical-backup uploads procedure and a consistent maintenance snapshot
for cutover. The drill discards its recovered database; a real incident still
requires an isolated replacement stack, application verification and a planned
traffic cutover as described in [CONSTRUCTION_RECOVERY.md](CONSTRUCTION_RECOVERY.md).
PostgreSQL documents the required [continuous WAL chain](https://www.postgresql.org/docs/16/continuous-archiving.html),
the [fetch-mode retention constraint](https://www.postgresql.org/docs/16/app-pgbasebackup.html)
and the limits of [backup verification](https://www.postgresql.org/docs/16/app-pgverifybackup.html).
