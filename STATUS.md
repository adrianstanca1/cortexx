# CortexBuild Pro — current status

Reviewed 4 October 2026. Canonical repository: `adrianstanca1/cortexx`; production branch: `main`; release line: v1.5.x.

## Production baseline

Production is the isolated Next.js Docker Compose stack on the One.com VPS, served at <https://cortexbuildpro.tech>. The authoritative deployment definition is `docker-compose.construction.yml`; operational procedures are in `docs/RUNBOOK.md` and `docs/CONSTRUCTION_RECOVERY.md`. Retired `/opt/cortexx`, static/Express, host-Postgres, nginx and PM2 procedures are not part of the production path.

The reviewed baseline includes PR #264 (`67ce6e5`) and this readiness-hardening follow-up. The public health endpoint reports healthy application, database, disk and memory checks. That establishes service health, but does not by itself prove every authenticated workflow or the exact image provenance.

## Integrated work through PR #264

The release includes the procurement, commercial, programme, drawing, document, field-operation and closeout work recorded in the canonical product audit, plus the following recent reliability and security changes:

- #249–#251: persisted drawing markups, drawing-access regressions, project-file permissions and company-wide document mutation protection;
- #252: automated accessibility baseline and CI enforcement;
- #259: retry-safe field uploads;
- #260: durable offline media outbox and automatic synchronization;
- #261: per-user/company offline isolation and reconnect recovery;
- #262: versioned records and explicit offline conflict handling instead of silent overwrites;
- #263: encrypted off-site construction backup export, restore validation and retained GitHub Actions recovery artifacts;
- #264: complete shift-handover evidence display, stale-request protection and explicit handover request failure handling.

The production deployment workflow requires the exact `main` SHA to have passed CI, builds the Next.js standalone app and tools images, applies Prisma migrations, bootstraps the construction tenant, waits for the local health contract, updates maintenance schedules, switches Caddy ingress and verifies the public endpoint.

## Verification and recovery

The hosted matrix covers build/typecheck, integration, browser/PWA, iOS, audit/security and secret scanning. The current stack also has:

- daily database and uploads backups with checksums and atomic publication;
- a weekly isolated restore drill against a disposable PostgreSQL container;
- hosted verification of backup freshness and the local restore marker;
- encrypted off-site export and a second restore validation before artifact retention;
- automated recovery issue creation when verification fails.

Operational evidence remains time-sensitive. Confirm the latest CI, deploy and Backup Verify runs before a release decision; use `docs/RUNBOOK.md` for the checklist and `docs/CONSTRUCTION_RECOVERY.md` for recovery limits.

## Remaining completion gates

The [canonical roadmap](docs/CANONICAL_PRODUCT_AUDIT_2026-09-24.md) remains the workflow scope. Material gates still include governed accounting write-back, richer supplier-quality evidence, governed agent tools/marketplace, physical-device/accessibility/performance/load verification, PostgreSQL WAL archiving/PITR for a substantially lower RPO, protected off-box secret recovery, and a controlled full-stack rollback/cutover drill.

Live Xero activation requires a configured authorised organisation. Native store delivery requires successful Apple build, signing and upload evidence. Encrypted off-site backup artifacts reduce host-loss risk, but they do not provide continuous PITR or archive production secrets. Merged PRs and passing automated tests do not establish complete launch readiness.
