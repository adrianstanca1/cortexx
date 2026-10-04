# CortexBuild Pro — current status

Reviewed 4 October 2026. Canonical repository: `adrianstanca1/cortexx`; production branch: `main`; release line: v1.5.x.

## Production baseline

Production is the isolated Next.js Docker Compose stack on the One.com VPS, served at <https://cortexbuildpro.tech>. The authoritative deployment definition is `docker-compose.construction.yml`; operational procedures are in `docs/RUNBOOK.md` and `docs/CONSTRUCTION_RECOVERY.md`. Retired `/opt/cortexx`, static/Express, host-Postgres, nginx and PM2 procedures are not part of the production path.

The reviewed baseline is PR #273 (`b4b0655eef2445cf5cac02c41a8a7774a16a1e76`). [CI run 37187339135](https://github.com/adrianstanca1/cortexx/actions/runs/37187339135), [verification run 37187339150](https://github.com/adrianstanca1/cortexx/actions/runs/37187339150) and [One.com deployment 37187639371](https://github.com/adrianstanca1/cortexx/actions/runs/37187639371) all succeeded for that exact SHA. At 08:10 UTC on 4 October, the public health endpoint reported healthy application, database, disk and memory checks; the VPS checkout was clean and matched `origin/main`. The endpoint reports version `1.5.0`, not a commit SHA; release attribution comes from the deployment run. See [the session reconciliation](docs/reviews/2026-10-04-session-reconciliation.md) for evidence and limits.

## Integrated work through PR #273

The release includes the procurement, commercial, programme, drawing, document, field-operation and closeout work recorded in the canonical product audit, plus the following recent reliability and security changes:

- #249–#251: persisted drawing markups, drawing-access regressions, project-file permissions and company-wide document mutation protection;
- #252: automated accessibility baseline and CI enforcement;
- #259: retry-safe field uploads;
- #260: durable offline media outbox and automatic synchronization;
- #261: per-user/company offline isolation and reconnect recovery;
- #262: versioned records and explicit offline conflict handling instead of silent overwrites;
- #263: encrypted off-site construction backup export, restore validation and retained GitHub Actions recovery artifacts;
- #264: complete shift-handover evidence display, stale-request protection and explicit handover request failure handling;
- #266: tenant-bound upload provenance and recovery coverage;
- #267: outstanding construction/readiness work, including bounded load-smoke tooling and recovery/deployment guidance;
- #269: reviewed dependency consolidation;
- #271: task mutations keep fallback project progress aligned;
- #272: encrypted off-site recovery now includes protected construction environment and owner credentials;
- #273: bulk task mutations preserve programme-owned project progress.

The production deployment workflow requires the exact `main` SHA to have passed CI, builds the Next.js standalone app and tools images, applies Prisma migrations, bootstraps the construction tenant, waits for the local health contract, updates maintenance schedules, switches Caddy ingress and verifies the public endpoint.

## Verification and recovery

The baseline CI passed 553 unit tests, 61 database integration tests, all six browser/PWA shards, and the desktop/mobile accessibility sweep. Supplier-performance browser journeys ran on both desktop and mobile; the earlier missing-TypeScript handoff came from a separate checkout without installed dependencies. The [iOS run](https://github.com/adrianstanca1/cortexx/actions/runs/37182408075) passed unsigned build/archive checks, but signing, IPA export and TestFlight upload were skipped. The audit job is advisory and its success alone does not establish zero vulnerabilities.

The current stack also has:

- daily database and uploads backups with checksums and atomic publication;
- a weekly isolated restore drill against a disposable PostgreSQL container;
- hosted verification of backup freshness and the local restore marker;
- encrypted off-site export and a second restore validation before artifact retention;
- protected `.env.construction` and owner credentials inside the encrypted recovery archive, with permissions/content validation;
- successful post-merge Backup Verify run [37188252961](https://github.com/adrianstanca1/cortexx/actions/runs/37188252961) on `b4b0655`;
- automated recovery issue creation when verification fails;
- protected `main`: pull requests required, eight meaningful CI/native status checks required, conversations resolved, linear history enforced, force-push/deletion disabled, and rules enforced for administrators.

Operational evidence remains time-sensitive. Confirm the latest CI, deploy and Backup Verify runs before a release decision; use `docs/RUNBOOK.md` for the checklist and `docs/CONSTRUCTION_RECOVERY.md` for recovery limits.

## Remaining completion gates

The [canonical roadmap](docs/CANONICAL_PRODUCT_AUDIT_2026-09-24.md) remains the workflow scope. Material gates still include governed accounting write-back, richer supplier-quality evidence, governed agent tools/marketplace, physical-device/accessibility/performance/load verification, PostgreSQL WAL archiving/PITR for a substantially lower RPO, and a controlled full-stack rollback/cutover drill. Protected off-box secret recovery is now implemented and post-merge restore-verified; it remains a periodic operational control rather than continuous PITR.

Live Xero activation requires a configured authorised organisation. Native store delivery requires successful Apple build, signing and upload evidence. Encrypted off-site backup artifacts now include the protected construction environment and owner credentials, reducing host-loss risk, but they still do not provide continuous PITR. Merged PRs and passing automated tests do not establish complete launch readiness.

GitHub currently reports two high-severity alerts in `expo/package-lock.json`: [braces #208](https://github.com/adrianstanca1/cortexx/security/dependabot/208) (`3.0.3`) and [node-forge #207](https://github.com/adrianstanca1/cortexx/security/dependabot/207) (`1.4.0`). The alert API lists no patched version for either as of this review. They remain open; successful root audit and native typechecks do not resolve them.
