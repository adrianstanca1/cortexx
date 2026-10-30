# Cortexx VPS-free migration

## Current state (audited 2026-10-30)

The repository is `adrianstanca1/cortexx`, default branch `main`. It is a monorepo, not a static-only app:

- Offline-first PWA: `Cortexx.html`, `lib/`, `dist/`, service worker and local IndexedDB/localStorage.
- Next.js 16 / React 19 admin and app-router server: `app/`, `components/`, Prisma schema and API/cron routes.
- Express API: `server/index.js`, raw SQL schema in `server/db/schema.sql`, JWT/magic-link auth, multi-tenant collections, SSE and integration routes.
- Current Docker Compose also includes PostgreSQL, Ollama, Caddy, Next admin and Next app. The local Ollama dependency is not suitable for a small free cloud instance; retain local/browser inference and configurable external providers as optional paths.

The previous workflow `.github/workflows/deploy-vps.yml` targeted `85.190.100.68` and SSH credentials. That target is no longer available. Its trigger has been disabled in this branch; no VPS SSH attempt should run.

## Hosting resources inspected

### Render

Workspace: `My Workspace` (`tea-d1bg1k8dl3ps73elu94g`).

Existing active free web services include Jarvis Mobile API, Jarvis Gateway, and three FacelessVideoGen services. The workspace also has two active static sites. The legacy CortexBuild Render services are suspended and point to the older `cortexbuild-ultimate` repository, not this Cortexx monorepo. They must not be treated as a current deployment.

Render metrics were queried for the five active free web services. Metrics were sparse and did not expose a reliable workspace-wide free-instance-hour balance. Do not create another always-on free service until the workspace's remaining allowance is visible in the dashboard. Render free web services sleep when idle, use ephemeral filesystems, and do not provide SSH or persistent disks. Free service hours are shared at workspace level. Therefore Render is a possible low-cost staging/limited-availability host, not a verified always-on production solution for this workspace.

### Neon

The connected Neon organization is on the Free plan. It contains a project named `cortex` in `aws-eu-west-2`. Its only branch, `production`, is archived; the branch contains a Cortex-shaped Prisma schema, but its compute is inactive. This branch must be treated as historical data, not as the active production database. Do not restore, overwrite, or migrate it as part of this change.

A separate older Neon project is also present. Before using either existing project, confirm its ownership and data purpose. A fresh, dedicated Cortexx database should be created only after the schema choice is settled and the user approves the database provisioning/migration step. The Express API uses `server/db/schema.sql`; the Next.js app uses Prisma migrations. The repository explicitly documents drift between these two models. A database cutover cannot safely run both migration systems without reconciliation.

### Google Cloud Run

Cloud Run supports Docker containers and scales to zero, but Google requires an active Cloud Billing account even when using only Free Tier resources. Google also explicitly states that alerts-only budgets do not cap spend. Cloud Run is therefore **not approved for this strict-zero-cost migration**. Re-evaluate only if the user explicitly approves linking a billing account and a real spend-cap configuration. No Google Cloud project, billing account, service, registry, or deployment was created or changed.

## Recommended target architecture

The target should be staged and verified, not deployed as a blind one-click migration:

1. **PWA/static assets:** Cloudflare Pages (or a free static-site host) for `Cortexx.html`, `dist/`, public assets, manifest and service worker. Keep private data and API responses out of CDN caches.
2. **Next.js admin/app:** a Node-compatible host is required for Next.js server routes, Auth.js, Prisma and cron endpoints. A free Render web service can be tested as staging, subject to the shared workspace allowance and sleep limitations.
3. **Express API:** a separate Node service is needed unless the Express routes are deliberately ported into the Next.js server. It must preserve auth, tenant scoping, rate limits, webhooks, SSE and CORS.
4. **PostgreSQL:** a dedicated Neon Free project in a supported EU region, using pooled application connections and explicit usage monitoring. Do not use the archived `cortex` branch as a live target without a data review and restore plan.
5. **Uploads:** use an S3-compatible free-tier object store (Cloudflare R2 is a candidate) with private-by-default objects and short-lived signed upload/download URLs. Do not store uploads on Render's ephemeral filesystem.
6. **AI:** no Ollama container in the free cloud deployment. Preserve browser WebGPU/local inference where supported; use an optional, explicitly configured compatible model provider with request limits and graceful deterministic fallback.

## Mandatory pre-cutover gates

- Reconcile raw SQL schema and Prisma migrations; document the canonical source of truth and create migration tests.
- Inventory every required production environment variable without printing secret values. Rotate any secrets previously exposed in logs or committed files.
- Decide how the Next.js server and Express API will be hosted and routed on the custom domain.
- Confirm DNS control and TLS/domain verification for `cortexbuildpro.tech`.
- Provision isolated staging resources on confirmed free plans only; record quotas and hard limits.
- Export/backup any existing production data before migration; restore into a disposable staging database and compare table counts and tenant-scoped samples.
- Test registration/login, tenant isolation, projects, tasks, timesheets, documents/uploads, portal, webhooks, SSE, cron, offline sync, PWA install and mobile API compatibility.
- Verify health checks and public routes end-to-end before changing DNS.
- Keep the existing production DNS and all historical databases untouched until the user approves cutover.

## Cost safety policy

- No paid plan, billing account, card-backed upgrade, minimum instance, persistent disk, paid database, or paid object storage without explicit approval.
- Cloud Run stays off while the requirement is strict zero spend; free-tier estimates and budget alerts are not a hard guarantee.
- Set provider-side usage limits/alerts where available, but do not describe alerts as hard caps.
- Prefer scale-to-zero and pooled DB connections; set maximum instances and request limits.
- Never assume a free quota is unlimited or shared across separate accounts/projects.
- If a provider cannot guarantee a zero-cost operating mode, stop before provisioning it.

## Current blockers

- No verified Cloudflare account connection or DNS authority was available during this audit.
- Render's remaining workspace free hours could not be confirmed from the available metrics.
- Neon project `cortex` has an archived branch; no live Cortexx Neon database has been provisioned.
- The Express API and Next.js app are distinct runtimes; no combined production image or end-to-end test has been built for a free host.
- The raw SQL and Prisma data models need reconciliation before database cutover.

This branch intentionally records the safe migration plan and disables the retired VPS deploy trigger. It does not claim that Cortexx has been migrated or deployed.
