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

The host is a replacement target, **not yet verified as provisioned or deployed**. The provider screenshot confirms the server identity and plan only. No SSH session, package inventory, firewall state, DNS change, data restore or application deployment has yet been verified on this host.

## Current operating state and migration boundary

The previous host documented in older workflows/runbooks was `85.190.100.68`. It is not the new host. Do not run legacy SSH workflows or backup automation against either host until its target and credentials have been explicitly reconciled.

The existing production domain, authoritative database, uploads and customer records must remain unchanged until a verified source backup has been restored and validated on the replacement. A new empty database is not production data.

## Release architecture

The intended application release uses:

- Repository `main` at an exact commit that passed the complete CI matrix.
- `Dockerfile.construction` and `docker-compose.construction.yml`.
- PostgreSQL, Redis, Ollama and the isolated browser gateway.
- Next.js construction application on loopback port 3020.
- Persistent Docker volumes for database, uploads and service data.
- Existing reviewed health contract `scripts/check-construction-health.cjs`.

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
11. Change DNS only after the replacement is healthy and validated. Verify TLS, domain routing, public health and user workflows. Keep rollback routing ready.

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
