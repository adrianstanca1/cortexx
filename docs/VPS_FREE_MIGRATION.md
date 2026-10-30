# Cortexx VPS-free migration

## Current state (audited 30 October 2026)

Repository: `adrianstanca1/cortexx`, default branch `main`.

Cortexx is a monorepo containing:
- Offline-first PWA and static assets.
- Next.js / React admin and app routes using Prisma migrations.
- Express API using a separate raw SQL schema at `server/db/schema.sql`.
- Native/mobile app and shared packages.
- Docker Compose dependencies including PostgreSQL, Redis, Caddy and Ollama.

The former VPS at `85.190.100.68` and its SSH access are unavailable. The old deployment, DB rescue and arbitrary remote-execution workflows are being retired in this PR. They must remain inert; do not dispatch them or reintroduce VPS secrets.

## Hosting inventory and decisions

### Neon

A new isolated Neon Free project was provisioned for Cortexx:
- Project: `cortexx-vps-free` (`flat-breeze-66564481`)
- Region: `aws-eu-west-2`
- PostgreSQL 17
- Database: `cortexx`
- Branch: `production` (`br-gentle-math-zajczdl4`)
- Compute: 0.25 CU min/max.

The destination was verified empty (zero user tables) and its compute was suspended; latest inspection reported it idle. No connection string was fetched or exposed. No schema, seed data, customer records or production export has been imported.

The separate populated Neon project named `cortex` is unrelated existing data. It was inspected read-only and remains untouched. Never use it as a migration destination without an explicit data ownership decision.

### Render

Workspace `My Workspace` (`tea-d1bg1k8dl3ps73elu94g`) has several active free services for Jarvis Mobile, Jarvis Gateway and FacelessVideoGen. Legacy CortexBuild services are suspended and point to an older repository. Workspace free instance-hour headroom could not be verified from metrics. Do not add a Cortexx service until the dashboard confirms capacity. Render free services sleep when idle and have ephemeral filesystems; they are not a verified always-on production solution here.

### Google Cloud Run

Cloud Run remains disabled. It requires an active billing account and can incur charges; this is incompatible with the strict zero-spend requirement unless the user explicitly approves billing.

### Storage and DNS

No verified Cloudflare account/DNS authority or R2 bucket access was available during this audit. Do not claim DNS or object-storage readiness.

## Recommended architecture

1. Static PWA assets on a free static host, with private API responses excluded from CDN caching.
2. Next.js and Express as separately tested Node runtimes unless a deliberate, tested consolidation is implemented.
3. Dedicated Neon PostgreSQL project with pooled connections, quota monitoring and least-privilege runtime credentials.
4. S3-compatible object storage for private uploads, using signed URLs; never rely on ephemeral app filesystems.
5. Local/browser inference as the default AI path; optional providers only when explicitly configured and quota-limited. Do not deploy Ollama on a constrained free host.

## Mandatory migration gates

- Identify and obtain a verified backup/export of the authoritative production database and uploaded files from the former host or another trusted backup source.
- Reconcile the Express raw SQL schema with Prisma migrations. Establish one canonical migration authority or a proven coordinated migration process.
- Inventory runtime environment-variable names without exposing secret values; rotate any credentials previously exposed.
- Confirm hosting capacity and free-tier quotas before creating services.
- Restore the source backup into an isolated staging database and compare table counts, constraints, indexes and tenant-scoped samples.
- Verify registration/login, tenant isolation, projects, tasks, timesheets, documents/uploads, portal, webhooks, SSE/realtime, cron, offline sync, PWA install and mobile API compatibility.
- Verify backups, restore and rollback before any DNS change.
- Confirm DNS and TLS control for `cortexbuildpro.tech`.
- Keep production DNS, production databases and existing storage untouched until staging is signed off and cutover is separately approved.

## Cost safety

- No paid plans, billing accounts, card-backed upgrades, persistent disks, paid databases or paid object storage without explicit approval.
- Do not treat free quotas as unlimited or provider alerts as hard spend caps.
- Prefer scale-to-zero, pooled DB connections, maximum instance limits and request limits.
- If zero-cost operation cannot be confirmed, stop before provisioning.

## Current blockers

- The source database and uploads from the former VPS have not been exported or independently verified. No production data migration can be completed safely without this.
- Raw SQL and Prisma data models are separate and require reconciliation.
- Render free-hour headroom is unknown.
- DNS authority and Cloudflare/R2 access are unverified.
- No Cortexx staging service has been deployed or end-to-end tested.
- The new Neon destination is empty and suspended; it is not yet an application-ready database.

This PR is preparation only. It does not claim that Cortexx has been migrated, deployed or cut over.
