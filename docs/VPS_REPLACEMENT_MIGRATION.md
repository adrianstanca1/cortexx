# Cortexx replacement VPS migration

## Current state (updated 24 November 2026)

Repository: `adrianstanca1/cortexx`, production branch: `main`, canonical release: v1.7.6.

Cortexx has an offline-first PWA, a Next.js application using Prisma migrations, a legacy Express API with a separate raw-SQL schema, and native/mobile clients. The designated replacement is the One.com Cloud Server below; the legacy Hostinger/static/Express deployment is not the production target.

- Host: `cloud-server-10717540`
- IPv4: `85.190.122.27`
- OS/plan: Ubuntu 26.04, 16 vCPU, 32 GB RAM, 800 GB local storage
- Login account: `administrator`
- Checkout: `/home/administrator/production/cortexx`
- Stack: `docker-compose.construction.yml` (Next.js, PostgreSQL, Redis, Ollama, browser gateway)

PR #476 records the replacement stack healthy after fixing browser-gateway startup. This is **staging evidence only**: the source database and uploads have not been restored and the public domain still points to the retired host. Do not treat a healthy empty/staging database as migrated production data.

## Rebuild path

`.github/workflows/deploy-vps.yml` is the manual app-only rebuild path for the replacement VPS. It is restricted to `main`, requires the `VPS_REBUILD_ENABLED=true` repository variable and the protected GitHub environment `replacement-vps`. Configure that environment with required trusted reviewers, limit its deployment branches to `main`, and store `REPLACEMENT_VPS_REBUILD_SSH_PRIVATE_KEY` and `REPLACEMENT_VPS_REBUILD_KNOWN_HOSTS` as environment secrets only—not repository secrets. The workflow verifies the host key rather than scanning it at runtime. It checks out the exact current `main` SHA remotely, refuses dirty checkouts and Prisma schema/migration changes, tags the running images for rollback, builds and restarts only the app and browser gateway, then verifies both the browser-gateway container health and the app's local health contract. A failed rebuild restores the previous Compose configuration and image tags, then verifies both previous health contracts.

The workflow does **not** restore source data, run migrations/bootstrap, touch database volumes, or change public DNS. Run it only after the exact `main` commit has passed CI. For schema or migration changes, follow the restore and acceptance gates in [`RUNBOOK.md`](RUNBOOK.md) first. The workflow remains unavailable until the protected environment, its environment-scoped secrets and the operator gate are configured; never paste SSH material into chat or the repository.

## Hosting alternatives reviewed (not selected)

Neon and Render were investigated during an earlier zero-spend review, but neither is the selected production target. The separate Neon project `cortex` is unrelated existing data and must not be used as a migration destination without an explicit ownership decision. Cloud Run remains disabled unless billing is explicitly approved. These notes are historical; they do not supersede the One.com replacement decision.

## Migration and acceptance gates

- The owner reports that a verified database-and-uploads backup is ready; it has not yet been transferred or restored on the replacement. Transfer it through a secure channel and validate it in an isolated destination.
- Establish and document the Next.js/Prisma migration authority. The legacy Express/raw-SQL schema is a separate runtime and must not be assumed equivalent.
- Inventory runtime environment variable names without exposing their values; rotate any credentials previously exposed or reused.
- Confirm the One.com host key through its control panel, use a fresh Ed25519 SSH deploy key, and restrict SSH to verified key authentication.
- Restore the source backup into an isolated destination and compare checksums, table counts, constraints, indexes, tenant-scoped samples and uploaded files.
- Verify registration/login, tenant isolation, projects, tasks, timesheets, documents/uploads, portal, webhooks, SSE/realtime, cron, offline sync, PWA install and mobile API compatibility.
- Install a fresh replacement-host backup and complete a separate isolated restore drill. Preserve rollback images and the prior source environment.
- Confirm DNS/TLS authority for `cortexbuildpro.tech`. Keep production DNS and data unchanged until acceptance and a separately approved maintenance-window cutover.

## Cost and security

- The One.com replacement server is already owner-provisioned; do not purchase hosting, managed databases or object storage without separate approval.
- Do not expose PostgreSQL, Redis, Ollama, browser gateway, Docker API or the app's internal port publicly.
- Never store passwords, private keys, API keys, connection strings or session tokens in this repository, workflow logs or chat.

## Current blockers

- Secure backup transfer and isolated restore validation are outstanding.
- End-to-end acceptance, a fresh replacement backup/restore drill and a tested rollback remain outstanding.
- DNS/TLS still targets the retired host; no production cutover is approved by these staging records.
- Backup Verify stays separately disabled until the new host backup chain and credentials are validated. Before enabling it, restrict the `replacement-vps-backup-verify` GitHub environment to `main` and store its SSH key, verified known-hosts entry and encryption key as environment secrets only; remove any legacy repository-scoped backup secrets. The old GitHub SSH failure against the retired host is historical.
