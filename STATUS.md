# CortexBuild Pro — current status

Reviewed 24 November 2026. Canonical repository: `adrianstanca1/cortexx`; production branch: `main`; canonical release: v1.7.6 (owner-selected, aligned with `CHANGELOG.md`).

## Current operating state (verified 24 November 2026)

This section supersedes the production statements below. Those describe the 6 October baseline and remain historical evidence, not the current operating state.

- **The public domain does not serve HTTPS.** `https://cortexbuildpro.tech` fails at the TLS handshake (observed in a browser and by text fetch on 24 November 2026), and its A record still resolves to `85.190.100.68` — the former host that [`docs/VPS_REPLACEMENT_MIGRATION.md`](docs/VPS_REPLACEMENT_MIGRATION.md) records as retired. No cutover, no source-data restore on the replacement and no production acceptance has been recorded. The owner reports that a verified database-and-uploads backup is ready; transfer and isolated restore validation remain outstanding.
- **The replacement stack runs on the new host.** `85.190.122.27` has the intended Compose stack started. PR #476 fixed the browser-gateway container-start failure it exposed and records the gateway, database, cache and application healthy with Prisma migrations applied and `/api/health` OK. That is staging evidence, not production acceptance.
- **The merged PR #476 CI matrix passed** (20 passed, 1 skipped), including unit, database-integration, browser/accessibility, lint, typecheck, `dist/` integrity, data-model drift and dependency-audit checks. GitHub still shows the historical Backup Verify SSH failure against the retired host (`85.190.100.68`, job `138209909667`). Health Monitor remains gated by `PRODUCTION_RETIRED=true`. Local workflow changes now target the One.com host: the manual app rebuild uses `VPS_REBUILD_ENABLED=true`, while Backup Verify uses `REPLACEMENT_VPS_BACKUP_VERIFY_ENABLED=true`; neither change is active on `main` until reviewed and pushed.
- **Repository state:** upstream `main` is `d409dad` and was up to date at the last fetch. The local working tree contains uncommitted edits; it is not clean. The outage and unverified recovery chain remain tracked in issues #368, #370 and #473.
- **Repo-side consistency does not make production live.** Nothing here proves the application works for a real user; the acceptance and rollback gates in [`docs/RUNBOOK.md`](docs/RUNBOOK.md) remain the boundary.

## Historical production baseline (6 October 2026)

At that baseline, the isolated Next.js Docker Compose stack on the One.com VPS was reported at <https://cortexbuildpro.tech>. The deployment definition is `docker-compose.construction.yml`; current operational procedures and acceptance limits are in `docs/RUNBOOK.md` and `docs/CONSTRUCTION_RECOVERY.md`. That historical evidence is superseded by the current state above: the public domain is not reachable over HTTPS and the replacement has not passed production acceptance.

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

## Historical verification and recovery (September 2026 baseline)

The baseline CI passed 553 unit tests, 61 database integration tests, all six browser/PWA shards, and the desktop/mobile accessibility sweep. Supplier-performance browser journeys ran on both desktop and mobile; the earlier missing-TypeScript handoff came from a separate checkout without installed dependencies. The [iOS run](https://github.com/adrianstanca1/cortexx/actions/runs/37182408075) passed unsigned build/archive checks, but signing, IPA export and TestFlight upload were skipped. These are historical checks; the audit job's success alone does not establish zero vulnerabilities.

At that historical baseline, the stack's documented controls included:

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

The last documented dependency review found the production/root graph clean at high/critical severity after pinning patched `sharp`, `source-map-js` and `proxy-addr`; it also listed `braces` and `node-forge` advisories in the Expo tooling. The blocking CI audit in `.github/workflows/ci.yml` runs `npm audit --omit=dev` for the root production graph, not a full Expo-tooling audit. Recheck the Expo lockfile against current advisories before a native release; do not treat the root audit result as proof that mobile tooling is clear.
