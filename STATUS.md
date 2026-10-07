# CortexBuild Pro — current status

Reviewed 6 October 2026. Canonical repository: `adrianstanca1/cortexx`; production branch: `main`; release line: v1.5.x.

## Production baseline

Production is the isolated Next.js Docker Compose stack on the One.com VPS, served at <https://cortexbuildpro.tech>. The authoritative deployment definition is `docker-compose.construction.yml`; operational procedures are in `docs/RUNBOOK.md` and `docs/CONSTRUCTION_RECOVERY.md`. Retired `/opt/cortexx`, static/Express, host-Postgres, nginx and PM2 procedures are not part of the production path.

The reviewed baseline is PR #273 (`b4b0655eef2445cf5cac02c41a8a7774a16a1e76`). [CI run 37187339135](https://github.com/adrianstanca1/cortexx/actions/runs/37187339135), [verification run 37187339150](https://github.com/adrianstanca1/cortexx/actions/runs/37187339150) and [One.com deployment 37187639371](https://github.com/adrianstanca1/cortexx/actions/runs/37187639371) all succeeded for that exact SHA. At 08:10 UTC on 4 October, the public health endpoint reported healthy application, database, disk and memory checks; the VPS checkout was clean and matched `origin/main`. The endpoint reports version `1.5.0`, not a commit SHA; release attribution comes from the deployment run. See [the session reconciliation](docs/reviews/2026-10-04-session-reconciliation.md) for evidence and limits.

## Integrated work through the 6 October consolidation

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

The [canonical roadmap](docs/CANONICAL_PRODUCT_AUDIT_2026-09-24.md) remains the workflow scope. Material gates still include physical-device/performance/load verification, live Apple store-delivery evidence, operational enablement and timed proof of the PostgreSQL WAL/PITR path, and a controlled full-stack rollback/cutover drill. Governed Xero write-back now uses company-admin-approved live Xero account/tax mappings, explicit client-invoice net/VAT data, dry-run previews, idempotent external IDs and separate payment write-back; UK CIS subcontract bills remain deliberately blocked until dedicated CIS mapping/treatment is configured rather than inferred. Native field parity now includes first-class RFIs and drawing/revision access alongside the existing offline field workflows. Richer tenant-scoped supplier-quality evidence, governed read-only AI answers with server-owned citations, and the governed Agent OS control-plane/skill/delegation foundations are implemented. Protected off-box secret recovery remains a periodic operational control alongside the new opt-in PITR tooling.

Existing Xero connections must be re-authorised if they do not yet carry the granular invoice/payment/contact scopes, and each company must select its own valid Xero account/tax mappings before write-back can be enabled. Native store delivery still requires successful Apple signing and TestFlight/App Store upload evidence. Encrypted off-site backup artifacts include the protected construction environment and owner credentials. PITR code adds WAL archiving, physical base backups and isolated restore drills, but production RPO is not claimed lower until that opt-in path is enabled and timed operationally. Merged PRs and passing automated tests do not by themselves establish complete launch readiness.

The production/root dependency graph and standalone API are clean at high/critical severity after pinning patched `sharp`, `source-map-js` and `proxy-addr`; the Expo lockfile also pins patched `shell-quote` and `source-map-js`. The remaining high-severity mobile-tooling advisory families are `braces` and `node-forge` inside the current Expo toolchain. GitHub/npm may report those transitively against more than one mobile manifest, but no compatible patched upstream version is available as of this review; forcing npm's suggested Expo/React Native downgrade would be a breaking regression and is intentionally not used.
