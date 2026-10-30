# Cortexx VPS-free migration

## Current state (audited 2026-10-30)

The repository is `adrianstanca1/cortexx`, default branch `main`. It is a monorepo, not a static-only app:

- Offline-first PWA: `Cortexx.html`, `lib/`, `dist/`, service worker and local IndexedDB/localStorage.
- Next.js 16 / React 19 admin and app-router server: `app/`, `components/`, Prisma schema and API/cron routes.
- Express API: `server/index.js`, raw SQL schema in `server/db/schema.sql`, JWT/magic-link auth, multi-tenant collections, SSE and integration routes.
- Current Docker Compose also includes PostgreSQL, Ollama, Caddy, Next admin and Next app. The local Ollama dependency is not suitable for a small free cloud instance; retain local/browser inference and configurable external providers as optional paths.

The previous workflow `.github/workflows/deploy-vps.yml` targeted `85.190.100.68` and SSH credentials. That target is no longer available. Its trigger is disabled in this migration branch. The protected `main` branch rejected a direct workflow update because all required status checks must pass through a pull request; therefore the retirement takes effect on `main` only after this PR is merged. Do not dispatch the old workflow manually.

## Hosting resources inspected

### Render

Workspace: `My Workspace` (`tea-d1bg1k8dl3ps73elu94g`).

Existing active free web services include Jarvis Mobile API, Jarvis Gateway, and three FacelessVideoGen services. The workspace also has two active static sites. The legacy CortexBuild Render services are suspended and point to the older `cortexbuild-ultimate` repository, not this Cortexx monorepo. They must not be treated as a current deployment.

Render metrics were queried for the five active free web services. Metrics were sparse and did not expose a reliable workspace-wide free-instance-hour balance. Do not create another always-on free service until the workspace's remaining allowance is visible in the dashboard. Render free web services sleep when idle, use ephemeral filesystems, and do not provide SSH or persistent disks. Free service hours are shared at workspace level. Therefore Render is a possible low-cost staging/limited-availability host, not a verified always-on production solution for this workspace.

### Neon

The connected Neon organization is on the Free plan. It contains a project named `cortex` in `aws-eu-west-2` (`crimson-fire-14717428`). Live inspection on 2026-10-30 shows one `production` branch (`br-spring-block-abc7o4nu`) in `ready` state, marked primary/default, with approximately 37 MB logical data. The database contains a populated Cortex-shaped Prisma schema (User, Organization, Project, Invoice, payroll, safety and other business tables) plus Neon Auth tables. It is **not archived** and must be treated as existing potentially important data. Do not restore, overwrite, reinitialize, or apply the Express raw-SQL schema to it.

A second Neon project also exists in the account. Before using either existing project, confirm its ownership and data purpose. The Express API uses `server/db/schema.sql`; the Next.js app uses Prisma migrations. The repository explicitly documents drift between these two models. A database cutover cannot safely run both migration systems without reconciliation. No new project or database has been provisioned.

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
- Render's remaining workspace free hours could not be confirmed from the available metrics; sampled service metrics returned no usable instance-count history. Five active free web services are already present, so do not add a Cortexx service until the workspace usage dashboard is checked.
- The existing Neon `cortex` production branch is populated (approximately 37 MB) and is not a blank destination. No data has been changed. No new isolated Express API database has been provisioned.
- The actual production database and uploads on the unavailable VPS have not been exported; without that source backup, migration cannot be safely completed.
- The Express API and Next.js app are distinct runtimes; no combined production image or end-to-end test has been built for a free host.
- The raw SQL and Prisma data models need reconciliation before database cutover.

This branch intentionally records the safe migration plan and disables the retired VPS deploy trigger. It does not claim that Cortexx has been migrated or deployed.


## Verified account update (30 October 2026)

- Render workspace `My Workspace` (`tea-d1bg1k8dl3ps73elu94g`) contains active free services for Jarvis Mobile, Jarvis Gateway and three FacelessVideoGen deployments. Legacy CortexBuild services are suspended and point to the old `cortexbuild-ultimate` repository. The connected workspace's current monthly free-hour balance is not available through the metrics endpoint.
- The Neon connector is connected; organization plan is `free`. Project `cortex` has a ready, populated `production` branch and Prisma-style tables plus Neon Auth tables. This database was inspected read-only only. The connection credential was not copied into repository files, chat output or hosting settings.
- The separate Property Passport Render Postgres instance was inspected only and remains untouched; it expires 21 November 2026.
- No Render service, Neon project, DNS record, storage bucket, billing account, or production database was created or modified by this audit.


**Protected-branch note:** A direct update to `.github/workflows/deploy-vps.yml` on `main` was rejected by branch protection (8 required status checks). The tombstone remains in PR #433 until CI passes and the PR is merged; do not claim the main-branch workflow is disabled yet.
