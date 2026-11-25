# Cortexx — operations and production replacement runbook

## Production target

The user has designated the new one.com Cloud Server as the production replacement for CortexBuild Pro.

- Repository: https://github.com/adrianstanca1/cortexx
- Production domain: https://cortexbuildpro.tech
- New host: `cloud-server-10717540`
- New host IPv4: `85.190.122.27`
- OS: Ubuntu 26.04
- Plan: Cloud Server XXL — 16 vCPU, 32 GB RAM, 800 GB local storage
- Login account shown by provider: `administrator`
- Intended checkout: `/home/administrator/production/cortexx`
- Intended production stack: `docker-compose.construction.yml`
- Intended protected environment file: `.env.construction` (mode 0600)
- Intended app loopback endpoint: `http://127.0.0.1:3020`
- Public health endpoint: `https://cortexbuildpro.tech/api/health`

The host has since been provisioned and the intended stack started on it. PR #476 fixed the browser-gateway container-start failure that stack exposed and records the gateway, database, cache and application healthy with Prisma migrations applied and `/api/health` OK. That is **staging evidence only**: DNS for `cortexbuildpro.tech` still resolves to the retired former host, and no source database or uploads have been restored here. The owner reports that a verified backup is ready; it still needs secure transfer and isolated restore validation. The acceptance gates below remain unpassed.

## Current operating state and migration boundary

Replacement notes: [One.com VPS replacement migration](VPS_REPLACEMENT_MIGRATION.md).

The previous host at `85.190.100.68` is retired. The only rebuild target is the One.com host `85.190.122.27`; use the manual, fail-closed app rebuild in `.github/workflows/deploy-vps.yml`. Do not run legacy SSH workflows or point backup automation at the former host.

The existing production domain, authoritative database, uploads and customer records must remain unchanged until a verified source backup has been restored and validated on the replacement. A new empty database is not production data.

**Do not change production DNS** or alter the existing database, uploads or customer records during preparation. Cutover is a separate operation after the backup, restore, staging, acceptance and rollback gates pass.

## Release architecture

The intended application release uses:

- Repository `main` at an exact commit that passed the complete CI matrix.
- `Dockerfile.construction` and `docker-compose.construction.yml`.
- PostgreSQL, Redis, Ollama and the isolated browser gateway.
- Next.js construction application on loopback port 3020.
- Persistent Docker volumes for database, uploads and service data.
- Existing reviewed health contract `scripts/check-construction-health.cjs`.
- Manual, app-only rebuild workflow `.github/workflows/deploy-vps.yml`, gated by `VPS_REBUILD_ENABLED=true` and the protected GitHub environment `replacement-vps`. Require trusted reviewers, restrict environment deployments to `main`, and keep the rebuild SSH key and verified known-hosts entry in environment secrets only. The workflow rejects schema/migration changes, restores the prior Compose configuration and images on a failed health check, verifies both the browser gateway and app readiness, and does not restore data, run migrations, or change DNS.

Do not use historical `docker-compose.yml`, `docker-compose.prod.yml`, `deploy.sh`, static HTML/Express, PM2 or host-Postgres procedures as the production path.

## Required migration gates

1. Rotate the password shared in chat and any other exposed/reused credentials. Create a fresh Ed25519 SSH key; keep the private key out of Git, logs and chat. Verify the server host key through the one.com console.
2. Establish a key-authenticated SSH session to the new host and run a read-only inventory first. Confirm OS, disk, memory, firewall, listening ports, existing Docker resources and mounts.
3. Confirm DNS authority for `cortexbuildpro.tech`, TLS strategy and provider firewall rules. Keep current production DNS unchanged during preparation.
4. Identify the authoritative source database and uploads. Obtain a verified backup/export from the former host or a trusted off-site backup. Do not assume the new host contains source data.
5. Reconcile the Express raw-SQL schema and Prisma migration model; use the tested migration authority and isolated destination.
6. Restore the source backup into an isolated destination and compare checksums, table counts, constraints, indexes, tenant-scoped records and uploaded files.
7. Provision the replacement stack with generated secrets stored only in `.env.construction` (0600) or an approved secret manager. Do not commit or print secret values.
8. Run migrations and construction bootstrap against the isolated restored database, then verify health, authentication, tenant isolation, projects, tasks, timesheets, documents/uploads, portal, webhooks, SSE/realtime, cron, offline sync, PWA install and mobile API compatibility.
9. Verify a fresh database + uploads backup and complete an isolated restore drill on the new host. Confirm off-site backup and recovery-key retention.
10. Preserve the prior production environment and its last known-good backup/image for rollback. Schedule a separate maintenance-window cutover only after all gates pass.
11. At the maintenance-window cutover, quiesce the replacement stack (app, cron/schedulers, offline-sync writers) before restoring anything, freeze writes on the source host, take a final coordinated database and uploads sync/delta backup, restore it on the replacement, run the tested migrations against that final restore, and verify reconciliation and readiness before restarting writers and changing DNS. Verify TLS, domain routing, public health and user workflows. Keep rollback routing ready.

## Backup and rollback rules

- Never overwrite or drop the source production database as an initial migration step.
- Restore into an isolated destination first. Do not use an empty destination as evidence of data migration.
- Database and uploads snapshots must be coordinated for a consistent cutover.
- Retain the old environment and a verified backup until the replacement has completed the agreed observation period.
- For an app-only regression, restore the previously healthy app image without changing database volumes.
- For a data-affecting incident, restore into an isolated replacement stack and validate before switching traffic.

## Cost and security

- The one.com server is already user-provisioned. Do not purchase additional servers, paid hosting, managed databases or storage without separate approval.
- Do not expose PostgreSQL, Redis, Ollama, browser gateway, Docker API or application-admin ports to the public internet.
- Keep SSH restricted to key-based access after a second session has been tested.
- Never store passwords, private keys, API keys, connection strings or session tokens in this public repository.

## Verification boundary

GitHub commits, CI runs and deployment workflow completion do not alone prove production is live. Production acceptance requires verified SSH access, container health, database connectivity, restored data integrity, persistent uploads, TLS/domain routing, application workflows, backups and a tested rollback path.
