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
- Web/PWA/native/backend/shared-core/deployment are consolidated. Native field workflows now use the same tenant-scoped canonical APIs as web, with SecureStore tokens and offline queue/cache.
- Construction roles and high-risk AI approval boundaries are test-covered.
- Prisma/raw-SQL drift checking exists.
- Core domains exist across projects, tasks, team, timesheets, documents/drawings, RFIs, submittals, defects, safety, equipment, materials, procurement, suppliers, commercial, tenders, scheduling, portals, analytics and Vera/AI.

## P0 gaps
1. Apps routing is connected for Smart Parse, AI Estimate, Photo→Snag, check-in, safety and receipt capture. Receipt capture now performs tenant-scoped AI OCR with structured review/reconciliation and preserves GPS/time evidence; continue improving image/document intelligence instead of adding launcher-only features.
2. Commercial control now persists applications, revisioned certificates, variation links, retention/release and partial/full payment reconciliation; project Finance now exposes adjusted contract value, earned/applied/certified value, valuation cash, recorded cost, commitments, forecast cost/margin, uncertified value and CSV export. Client invoice revenue is explicitly separated from Project.spent cost. Next deepen accounting reconciliation and cost coding.
3. Capture/safety P0 is now end-to-end: receipt OCR/review, progress-photo GPS/time evidence, and incident → investigation → root cause → corrective action → explicit RIDDOR decision/submission record → verified closeout. Serious incidents are flagged for RIDDOR assessment without the app making an automatic legal determination.
4. Native Expo is functional for core field CRUD but needs high-value workflow parity.
5. Construction-role browser journeys now cover Company Admin, Project Manager, Foreman and Operative; project creation is server-enforced as Company Admin-only. Continue broadening tenant/RBAC mutation coverage around finance, team administration and approval-only actions.

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

**Gate B — P0 closure:** canonical project cost coding and reconciliation is now implemented: organisation Cost Codes, an auditable Project Cost Ledger, legacy-spend opening balances, receipt reconciliation, subcontract-invoice accrual/reversal, PO matching, uncoded-cost exceptions, commitment reduction and ledger-derived WIP/margin/cashflow with `Project.spent` retained only as a compatibility mirror. Native high-value field parity is implemented for the core site loop: secure mobile bearer auth with current-membership validation, assignment-scoped jobs/tasks, five-section role-aware navigation, GPS check-in/out, time logging, site diary, photo snags, safety reporting, offline cache/write replay and canonical realtime SSE. Tenant/RBAC mutation and read-boundary coverage is enforced for Company Admin, Project Manager, Foreman and Operative across projects, tasks, dashboards, team, timesheets/approval, invoices, quotes and valuations, with deterministic browser E2E on desktop/mobile. Construction persona is tenant-scoped on each membership/invite (separate from owner/admin/member/viewer workspace access), is assignable from Workspace Settings, and is refreshed from the database for route authorization so multi-company users can hold different roles without stale JWT privilege. Persistent applications/certificates/payments, project WIP/cashflow control, CSV commercial export, Smart Parse, receipt OCR/review, GPS-tagged field evidence, governed incident/RIDDOR investigation-closeout and Apps workflow routing are complete. Bank reconciliation is now implemented with tenant-scoped manual/imported transactions, idempotent external source IDs, partial/full allocation matching and reversal against client invoices, valuation certificates/payments and subcontract invoices. The Xero accounting adapter boundary is implemented with tenant-scoped OAuth state, AES-GCM token storage, granular read-only bank/settings scopes, rotating refresh-token handling, bounded/idempotent bank-transaction import into canonical reconciliation, connection health, tenant-specific disconnect, visible failures and audit events. Existing reconciliation decisions are preserved during refresh. Outbound invoice/bill/payment write-back remains deliberately disabled until account-code, tax/VAT, CIS and approval semantics are explicitly mapped and contract-tested. Live Xero activation still requires deployment-level Xero app credentials and an authorised Xero organisation; no credentials are embedded in code. Native store/device/accessibility hardening remains a Gate F release task.

**Gate C — Commercial/procurement backbone:** unify commercial ledger, complete procurement lifecycle, supplier scorecards, immutable audit events, approval matrices and accounting adapter boundary. Procurement control now covers the full governed buying path from tenant-scoped requisition → approval → RFQ → factual supplier comparison → manual award → traceable PO → auditable partial/full goods receipt → invoice three-way match. It includes tenant-local REQ/RFQ/PO numbering, manager-gated approvals, immutable issued POs, supplier/quote linkage, approved-only commitment accounting, persisted match snapshots, invoice approval/payment blocking with an explicitly audited financial-admin override, and end-to-end REQ/RFQ/quote provenance on the awarded PO. Supplier performance scorecards now show tenant-scoped order/receipt evidence, completed delivery reliability, overdue open orders, missing-date coverage, net values and unreceived commitments. Company Admin access is required; unlinked legacy orders and capped histories are explicitly disclosed. The external accounting adapter boundary is implemented through the governed read-only Xero bank connector above. Remaining Gate C work is explicit/accountable Xero write-back mapping plus richer supplier quality/defect evidence.

**Gate D — Field execution backbone:** programme baselines/look-ahead, diary/labour/plant/materials, check-in/timesheet reconciliation, drawing distribution/markup, safety/quality closeout and offline conflict handling.

**Gate E — Intelligent construction OS:** governed Vera/agent action bus, tenant-isolated project knowledge/RAG with source citations, Tender Scout + Procurement Agent, drawing/vision intelligence, predictive controls and no-code automation marketplace.

**Gate F — Reliability/launch:** browser/device/accessibility/performance/load gates; backup/restore and RPO/RTO drills; observability; security scans and abuse controls; canary/rollback rehearsals; native store releases after parity gates. Production dependency audit is now clean (`npm audit --omit=dev`: 0 findings) after upgrading Playwright to 1.63.0 and compatibility-tested overrides for Prisma's vulnerable `mysql2`/`deepmerge-ts` transitives. Three moderate findings remain dev-only in the Capacitor CLI toolchain; the automated fix would downgrade/misalign Capacitor, so they remain tracked pending an upstream-compatible release.

## Definition of done
A page is done only when reachable; loading/empty/error states exist; domain actions persist; server authorization and tenant boundaries are tested; validation is shared; material changes are audited; offline behavior is defined; required notifications fire; accessibility is checked; and E2E proves the main journey. Integrations additionally require secure auth/secrets, health state, retry/idempotency, visible failures, revoke/disconnect, audit logging and contract tests.

## Architecture direction
Keep one modular monolith until scale proves a service boundary is needed: one canonical Postgres model, authorization policy layer, event/audit model, shared TypeScript contract and adapters for AI/accounting/payments/storage/notifications. The target is a construction operating system where field activity updates controls, controls update commercial forecasts, procurement updates cash/risk, documents feed project knowledge, and Vera/agents act only through governed tools and approvals.
