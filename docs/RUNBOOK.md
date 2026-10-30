# Cortexx — operations and migration runbook

## Current operating state

Cortexx is **not yet migrated** from the former VPS. The previous production host and SSH access are unavailable. Do not attempt remote VPS commands or dispatch legacy deployment workflows.

- Repository: https://github.com/adrianstanca1/cortexx
- Production domain: https://cortexbuildpro.tech
- Migration plan: [VPS-free migration](VPS_FREE_MIGRATION.md)
- Migration PR: https://github.com/adrianstanca1/cortexx/pull/433

The existing production domain and all historical databases must remain unchanged until staging is fully verified and a controlled cutover is approved.

## Required release gates

1. CI checks pass on the exact commit intended for release.
2. The authoritative production database and uploads are identified and exported from a verified source backup.
3. The Express raw-SQL schema and Next.js Prisma migration model are reconciled and tested against an isolated destination.
4. Free hosting capacity, database quotas, object storage and DNS authority are confirmed before provisioning.
5. Staging verifies authentication, tenant isolation, projects, tasks, timesheets, documents, offline sync, portal, webhooks, realtime/SSE, cron and mobile API compatibility.
6. Backup restore and rollback are tested before any production DNS change.

## Database and data safety

- The Neon project named `cortex` is existing populated data and is not the Cortexx migration target. Do not overwrite or reinitialize it.
- The separate Neon project `cortexx-vps-free` is an isolated empty destination. Its compute is suspended. It has no imported schema or production data.
- Never apply schema migrations to a production database until a verified backup and restore path exists.
- Do not assume the former VPS database or uploads have been recovered.

## Cost and hosting safety

- Free-only resources are permitted; no paid plan, billing account, paid storage, or upgrade without explicit approval.
- Render free capacity must be checked in the workspace dashboard before adding services.
- Cloud Run remains disabled because it requires an active billing account and may incur charges.
- Treat provider quota alerts as alerts, not hard spending caps.
- Do not store persistent user uploads on ephemeral application filesystems.

## Legacy workflow retirement

The former `.github/workflows/deploy-vps.yml`, `.github/workflows/db-rescue.yml`, and `.github/workflows/vps-exec.yml` workflows are being retired in the migration PR. They must remain inert; do not add VPS credentials or restore their SSH operations.

## Cutover and rollback

No production DNS, existing database, storage bucket, or production service is to be changed as part of preparation. Cutover is a separate gated operation after:
- source backup integrity is verified;
- schema and data restore comparisons pass;
- staging end-to-end checks pass;
- domain and TLS control are confirmed;
- a rollback plan is tested.

If any gate fails, leave production routing unchanged and continue operating from the current state.
