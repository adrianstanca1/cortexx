# Cortexx VPS-free hosting migration

**Status: preparation only — no production services, databases, DNS records, or billing settings have been changed.**

## Why this migration is needed

The existing Compose deployment is not a single static site. It currently combines:
- the PWA and static assets;
- an Express API with PostgreSQL, authentication, tenant data, SSE and integrations;
- a Next.js server for the admin/app-router surface and cron routes;
- local Ollama inference;
- Caddy/Traefik ingress and TLS.

The repository also contains a legacy VPS workflow which assumes SSH access to a host. That workflow is now manual-only so a successful CI run cannot repeatedly attempt a deployment to a host that is not available.

## Free-first target architecture

| Component | Candidate | Notes / constraints |
|---|---|---|
| PWA/static assets | Render Static Site (existing connected account) or Cloudflare Pages | Static hosting; no app data or secrets in published directory. Build an explicit allowlist output directory rather than publishing the repository root. |
| Express API | Render Free Web Service | Docker/Node compatible; sleeps after 15 minutes idle, shared 750 workspace instance-hours, no persistent disk or SSH. Must be treated as a low-traffic pilot, not production-grade availability. |
| Next.js admin/server | Separate Render Free Web Service only if required by verified routes | Adds another consumer of the same workspace free instance-hour pool. Assess whether the Next.js routes can be moved behind a single server before provisioning. |
| PostgreSQL | New Neon Free project, isolated from all other products | Neon Free currently advertises 1 GB storage/project and 100 CU-hours/month; confirm the live account quota before provisioning. Never reuse the Property Passport Render database. |
| Uploads/photos | Cloudflare R2 Standard | 10 GB-month, 1 million Class A and 10 million Class B requests included monthly; egress is free. Usage above the free allocation can be billed, so set alerts/controls and do not enable paid add-ons. |
| CI | GitHub Actions | Keep CI and deployment separate; deploy only after required checks pass. |
| AI | Browser WebGPU / optional user-configured OpenAI-compatible endpoint | Do not deploy Ollama on a small free web-service instance. Keep deterministic fallback; do not silently add paid model calls. |

### Important Render constraints

Render Free web services sleep after 15 minutes without inbound traffic and can take about a minute to wake. Their filesystem is ephemeral, they have no SSH or persistent disks, and free Postgres expires after 30 days. The workspace has 750 free instance-hours per calendar month shared across services. The connected workspace already runs other free web services, so the monthly allowance must be checked in the Render dashboard before creating any Cortexx service. The Render metrics connector did not return usable instance-count history for the sampled services, so there is no verified remaining-hours figure yet.

Use an external Postgres provider and object storage; never write user uploads or SQLite data to a Render service filesystem.

## Google Cloud Run assessment — not activated

Cloud Run can run the existing container images and has a request-based billing mode, which is the appropriate mode for sporadic HTTP traffic. However, the free allowance is not the same as a guaranteed zero-cost deployment: a billing account is required, and usage beyond included allowances can be charged.

Google documents project spend caps that pause Cloud Run workloads when reached, but these are an enforcement mechanism rather than a reason to enable billing. Budget alerts alone do **not** cap spending. Some networking resources (including VPC connector VMs) are outside Cloud Run spend-cap coverage.

**Policy:** do not link a billing account, enable billing, create Artifact Registry resources, deploy Cloud Run, enable paid APIs, or create networking resources without separate explicit approval. If approval is later given, use a dedicated project, request-based billing, min instances = 0, a strict max-instance limit, no VPC connector, and a Cloud Run spend cap before deployment. Confirm the cap's scope and exclusions in the console first.

## Data safety and migration sequence

1. Inventory the existing production database and file storage through an authorized source. No production database connection is currently available through this repository inspection.
2. Create a separate destination Neon project only after the Neon account is connected and its free quota is confirmed.
3. Generate a schema-only compatibility report: the Express API uses `server/db/schema.sql`; the Next.js app uses Prisma migrations. The repository documents drift between these models. Do not run either migration set against a production database until the target schema and migration order are reviewed.
4. Create a verified backup of the source database and uploads. Record checksums and row/table counts. Keep the source untouched.
5. Test restore into the new destination, then run API integration tests and tenant-isolation checks.
6. Build an allowlisted static PWA artifact and verify that no `.env`, vault, source-only server files, credentials, or private build files are published.
7. Provision the minimum required free runtime only after Render workspace usage is checked. Set health checks, explicit environment variables, CORS allowlists, and external database/storage connections.
8. Verify health, registration/login, tenant separation, CRUD, uploads/downloads, realtime/SSE, portal access, cron routes, PWA offline behavior and mobile API compatibility.
9. Only after all checks pass, prepare a DNS cutover plan for `cortexbuildpro.tech`. Do not change DNS as part of a test deployment.
10. Keep the old deployment configuration and a tested rollback path until the new deployment has passed an agreed observation period.

## Required environment configuration (names only)

Secrets must be set in the hosting provider's secret/environment-variable interface, never committed:
- Express: `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS`, `APP_URL`, and any enabled integration secrets.
- Next.js: `DATABASE_URL`, `NEXTAUTH_SECRET` / `AUTH_SECRET`, `NEXTAUTH_URL` / `AUTH_URL`, `NEXT_PUBLIC_API_URL`, and cron secret if cron routes are enabled.
- R2: S3-compatible endpoint, bucket, access key and secret key, with least-privilege credentials.
- Optional LLM: runtime/base/model/key only when the user has explicitly selected a provider.

## Current blockers

- No VPS or SSH access is available; the legacy automatic deploy trigger is disabled.
- Render workspace free-hour usage is not exposed by the connected metrics result; the dashboard's Monthly Included Usage must be checked before adding services.
- No Cortexx-specific Render services exist.
- No Neon project is connected yet. The Neon connector must be connected before a destination database can be created and verified.
- No Cloudflare account/DNS/R2 access is connected here.
- Production database and uploads have not been exported or inspected. No data migration has been run.
- Google Cloud billing is not enabled by this migration and must remain untouched without approval.

## Acceptance criteria

A migration is complete only when the destination database has been restored and reconciled, all required clients and API paths pass their checks, uploads persist outside the runtime filesystem, security/tenant tests pass, a public health check is green, and rollback is documented. A successful container build alone is not a production deployment.
