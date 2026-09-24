# CortexBuild Pro — Canonical Product Audit & Roadmap

Audit date: 24 September 2026. Canonical repository: `adrianstanca1/cortexx`. Production branch: `main`. Release line: v1.5.x.

## Status
CortexBuild Pro is one product/codebase containing the Next.js web app, offline PWA, Express/PostgreSQL services, Expo/native client, shared API contract, deployment manifests and Agent OS. A page existing is not treated as workflow completion: UI, persistence, authorization, tenant isolation, offline behavior, auditability, error handling and tests must close the loop.

## Consolidation
Superseded repositories remain preserved in GitHub as read-only archives; their feature inventories were compared against the canonical product before archival. Archived in this pass: `cortexbuild-field`, `cortexbuildpro.com`, `BuildTrack`, `cortexx-deploy`, `management`, `yes-i3e0`, `chat-p3kfyf`. Existing archived predecessors include `cortexbuild-pro`, `cortexx-pwa`, `BuildTrack-iOS`, `buildtrack-web`, `buildtrack-api`, `constructtime_pro`, HORUS and `openclaw-mobile`. Unrelated products are intentionally untouched.

## Verified strengths
- Multi-tenant isolation and RBAC are test-covered.
- Offline sync preserves create/update/delete, chunks large queues, handles partial acknowledgement, isolates accounts and protects pending edits.
- Bulk sync validates before write and rolls back failed transactions.
- Web/PWA/native/backend/shared-core/deployment are consolidated.
- Construction roles and high-risk AI approval boundaries are test-covered.
- Prisma/raw-SQL drift checking exists.
- Core domains exist across projects, tasks, team, timesheets, documents/drawings, RFIs, submittals, defects, safety, equipment, materials, procurement, suppliers, commercial, tenders, scheduling, portals, analytics and Vera/AI.

## P0 gaps
1. Apps routing is now connected for Smart Parse, AI Estimate, Photo→Snag, check-in and safety; finish the underlying AI/OCR/photo intelligence rather than adding more launcher tiles.
2. Valuations now persist applications with tenant scope, retention, prior-certified calculation and draft → submitted → certified → paid/rejected lifecycle. Next extend this into certificate revisions, variation linkage, export, payment reconciliation, retention release and project WIP/cashflow.
3. Capture claims still exceed behavior: receipt OCR/auto-file, progress-photo geotag persistence and full incident/RIDDOR investigation/closeout must be completed.
4. Native Expo is functional for core field CRUD but needs high-value workflow parity.
5. Production-critical mutations need broader authenticated tenant-scoped integration tests plus browser/mobile E2E journeys.

## P1 workflow completion
Commercial: one ledger for contract sum, variations, commitments, valuations, certificates, retention, invoices, forecast cost/value and margin.
Procurement: requisition → RFQ → comparison → approval → PO → delivery → invoice/3-way match → supplier performance.
Programme: dependencies, critical path, baselines/revisions, look-ahead, resources, delay events and progress.
Documents/drawings: revision supersession, distribution/acknowledgement, markup, transmittals, OCR/indexing and approvals.
Safety/quality: RAMS, permits, talks, inspections, incidents, observations, NCRs, snags and evidence-based closeout with consistent status/audit patterns.
Portals/notifications/search/AI: scoped external access, one notification event model, cross-project search and one governed AI tool/action layer with project-data citations and approvals.

## P2 differentiation
Drawing intelligence; spatial site layer; Tender Scout and procurement intelligence; predictive schedule/commercial/safety/quality controls; construction automation marketplace; configurable role-specific field-app builder.

## Roadmap
**Gate A — Canonical release:** merge verified release to `main`, protect it with tests/lint/build/drift/security gates, keep one production source of truth and remove stale contradictory docs.

**Gate B — P0 closure:** complete valuation certificates/revisions/variation links/export/reconciliation; OCR/geotag/incident capture; native high-value field parity; tenant/RBAC mutation tests; Playwright Admin/PM/Foreman/Operative journeys. Smart Parse and Apps workflow routing are complete.

**Gate C — Commercial/procurement backbone:** unify commercial ledger, complete procurement lifecycle, supplier scorecards, immutable audit events, approval matrices and accounting adapter boundary.

**Gate D — Field execution backbone:** programme baselines/look-ahead, diary/labour/plant/materials, check-in/timesheet reconciliation, drawing distribution/markup, safety/quality closeout and offline conflict handling.

**Gate E — Intelligent construction OS:** governed Vera/agent action bus, tenant-isolated project knowledge/RAG with source citations, Tender Scout + Procurement Agent, drawing/vision intelligence, predictive controls and no-code automation marketplace.

**Gate F — Reliability/launch:** browser/device/accessibility/performance/load gates; backup/restore and RPO/RTO drills; observability; security scans and abuse controls; canary/rollback rehearsals; native store releases after parity gates.

## Definition of done
A page is done only when reachable; loading/empty/error states exist; domain actions persist; server authorization and tenant boundaries are tested; validation is shared; material changes are audited; offline behavior is defined; required notifications fire; accessibility is checked; and E2E proves the main journey. Integrations additionally require secure auth/secrets, health state, retry/idempotency, visible failures, revoke/disconnect, audit logging and contract tests.

## Architecture direction
Keep one modular monolith until scale proves a service boundary is needed: one canonical Postgres model, authorization policy layer, event/audit model, shared TypeScript contract and adapters for AI/accounting/payments/storage/notifications. The target is a construction operating system where field activity updates controls, controls update commercial forecasts, procurement updates cash/risk, documents feed project knowledge, and Vera/agents act only through governed tools and approvals.
