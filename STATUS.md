# CortexBuild Pro — Product Status

**Audit date:** 24 September 2026  
**Canonical repository:** `adrianstanca1/cortexx`  
**Production branch:** `main`  
**Release candidate:** **v1.5.1**

CortexBuild Pro is the single canonical construction-management product. The repository contains the Next.js web application, offline-first PWA, shared TypeScript contract, Prisma/PostgreSQL application data, Express/raw-SQL compatibility services, Expo/native field client, deployment assets, local AI runtime and Agent OS experiments.

## Current audited surface

| Area | Current state |
|---|---:|
| Next.js pages | 112 |
| Next.js API route files | 207 |
| Prisma models | 85 |
| Prisma migrations | 37 |
| PWA/lib modules | 117 compiled modules |
| Native | Expo SDK 57.0.24 / React Native 0.86.3 |
| Production domain | cortexbuildpro.tech |
| Root release line | v1.5.x |

## Verified in the current release line

- Multi-tenant organization scoping is enforced through the Prisma tenancy extension when `MULTITENANT_ENFORCED=true`.
- Offline replay preserves create/update/delete semantics, isolates account queues, retains partial failures, chunks large batches and protects pending local changes.
- Bulk sync validates before writes and rolls a failed batch back atomically.
- Fresh PostgreSQL migration from zero applies the full migration chain, including the persistent Valuation ledger.
- Persistent Valuations now support draft → submitted → certified → paid/rejected lifecycle, retention, previous-certified calculations, audit retention and tenant scoping.
- Smart Parse is a real authenticated/rate-limited AI workflow rather than an Apps tile stub.
- Apps quick actions now route to authoritative quote, snag, safety and GPS check-in workflows.
- Project creation is being hardened to Company Admin/Owner only; Project Manager is explicitly not a project-creation role.
- Foreman is now a first-class construction role in the shared capability contract.
- Expo native client typechecks, Expo Doctor passes 21/21 and a web bundle export succeeds.
- Construction deployment is self-contained with PostgreSQL, Redis, Ollama, application runtime and persistent uploads.

## Role model

The target hierarchy is:

- **Platform / Super Admin** — platform operations across tenants.
- **Owner** — tenant owner; Company Admin rights plus billing/ownership/destructive workspace controls.
- **Company Admin** — all company tools and financial/managerial controls; creates projects; manages users/roles.
- **Project Manager** — manages assigned projects, team/tasks/approvals, procurement creation, drawings, quality and full safety functions; **cannot create projects**.
- **Foreman** — site-lead workflow: daily tasks, site records, team coordination, drawings, safety and quality capture.
- **Operative** — assigned field work, clocking, photos/documents, safety/quality reporting.
- **Client / Viewer** — restricted external/read/approval access.

Legacy `admin/member/viewer` memberships remain accepted while role migration completes.

## Important gaps that remain

### P0 — correctness and tenant architecture
1. **Project assignment scoping:** org-level tenancy is enforced, but PM/Foreman/Operative access is not yet universally restricted to assigned projects. A reliable User ↔ TeamMember identity relation must be added first, then project policy must be enforced at the data layer.
2. **Physical tenant isolation:** the product requirement is separate database/storage per company. Current production architecture provides logical `organizationId` isolation in shared databases. Physical tenant DB/storage routing is not yet implemented.
3. **One canonical data plane:** Next.js/Prisma and the Express/raw-SQL PWA compatibility layer still represent two persistence paths. Drift checks exist, but the long-term target is one canonical tenant data service.
4. **End-to-end authorization coverage:** every critical mutation still needs role × tenant × project-assignment integration tests and Admin/PM/Foreman/Operative Playwright journeys.

### P1 — workflow completion
- Commercial ledger: connect contract sum, variations, commitments, valuations/certificates, retention, invoices, WIP, forecast value/cost and cash.
- Procurement: requisition → RFQ → comparison → approval → PO → delivery → invoice/3-way match → supplier score.
- Programme: dependencies, baselines/revisions, critical path, look-ahead, resources, delays and progress.
- Documents/drawings: revisions, distribution acknowledgement, mark-up/transmittals, OCR/indexing and approvals.
- Safety/quality: consistent investigation, evidence, root-cause, corrective action and closeout across incidents/NCRs/snags/observations.
- Capture: receipt OCR/structured accounting extraction and geotagged progress-photo metadata.
- Native: high-value mobile parity for the field workflows above.

### P2 — differentiation
- Tender Scout + Procurement Agent.
- Drawing revision intelligence and construction-document RAG with source citations.
- Spatial site layer / live site map.
- Predictive commercial, programme, quality and safety controls.
- No-code construction automation marketplace.
- Configurable role-specific field application builder.

## Security / dependency position

- The critical Next.js advisory found during the clean-install audit was removed by non-breaking dependency updates.
- Root npm still reports high-severity advisories in Prisma CLI/config transitive dependencies. The offered automatic fix is a breaking Prisma 7 → 6 downgrade, so it is not forced into production.
- Expo/Metro still has upstream dependency advisories where the offered force-fix would regress the SDK-compatible router/runtime. Native compatibility gates remain green.
- Security work must continue through dependency monitoring, image scanning, secret scanning, authorization tests and regular upgrade windows.

## Launch gates

A feature is only complete when it is reachable, persists real data, has validation/loading/empty/error states, enforces role + tenant + project policy server-side, creates audit evidence where material, defines offline behavior, and passes E2E for its main journey.

Production release also requires:
- clean install
- lint + TypeScript
- full unit/integration suite
- Prisma migration from fresh database
- schema/drift checks
- production Next build
- native typecheck/Expo Doctor/export
- Docker build and health check
- browser E2E
- backup/restore verification
- post-deploy health and rollback check
