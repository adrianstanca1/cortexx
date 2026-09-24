# CortexBuild Pro — Canonical Roadmap

**Updated:** 24 September 2026  
**North star:** one efficient, reliable construction operating system, one canonical repository, one governed data model and one role-aware experience from company office to site.

## Gate 0 — Canonical product and repository hygiene

**Status: substantially complete.**

- Keep `adrianstanca1/cortexx` as the only active CortexBuild product repository.
- Preserve useful predecessor source/history, then archive duplicate construction repos.
- Remove obsolete non-PR branches after creating recovery tags.
- Keep unrelated AI/video/invoice projects separate.
- Keep `main` releasable; feature work goes through validated branches/PRs.
- Maintain one product version and one release note/audit source of truth.

**Exit:** one active construction repo, no valuable unmerged predecessor code, no ambiguous production branch.

## Gate 1 — Authorization and tenant boundary

**Priority: P0.**

1. Finish construction-role migration:
   - Owner
   - Company Admin
   - Project Manager
   - Foreman
   - Operative
   - Client / Viewer
2. Keep legacy `admin/member/viewer` compatible during migration.
3. Enforce Company Admin/Owner-only project creation.
4. Add `User ↔ TeamMember` identity relation.
5. Enforce assigned-project scope for PM/Foreman/Operative at the query/write policy layer.
6. Add role × action × tenant × project integration matrix.
7. Implement the requested physical tenant option: per-company database and storage namespace/routing, with provisioning, backup, restore and deletion lifecycle.
8. Collapse Next/Prisma and Express/raw-SQL persistence toward one canonical tenant data plane.

**Exit:** an authenticated user cannot read or mutate a tenant/project outside explicit authorization, proven by automated cross-tenant and cross-project tests.

## Gate 2 — Commercial control backbone

**Priority: P0/P1.**

Already shipped:
- invoices / quotes / sub-invoices
- variations
- CIS/payroll support
- persistent valuation application ledger

Complete:
- contract sum and budget baseline
- variation/change-order linkage into contract value
- valuation revisions and certification evidence
- retention release
- payment reconciliation
- commitments and actual cost
- cost-to-complete / forecast final cost
- earned value / WIP
- project and portfolio margin
- cash-flow forecast
- PDF/client certificate packs
- accounting adapter boundary (Xero first)

**Exit:** every commercial KPI reconciles to auditable source transactions rather than derived demo assumptions.

## Gate 3 — Procurement operating system

**Priority: P1; strategic differentiator.**

- material/service requisitions
- supplier/tender discovery
- RFQ issue + bidder tracking
- normalized bid comparison
- approval matrix
- PO/commitment
- delivery/GRN
- invoice and three-way match
- substitutions / technical approvals
- supplier quality, delivery, price and risk score
- Procurement Agent for savings, lead-time and risk recommendations
- Tender Scout for external work opportunities and bid qualification

**Exit:** requisition-to-payment is one traceable workflow with approvals, supplier performance and commercial impact.

## Gate 4 — Programme and field execution

- programme dependencies and critical path
- baseline/revision comparison
- 2/4/6-week look-ahead
- labour/plant/material allocation
- progress quantities and production rates
- delay events and entitlement evidence
- diary ↔ labour ↔ plant ↔ delivery reconciliation
- check-in ↔ timesheet reconciliation
- geotagged photo/progress capture
- offline-first conflict policy for all critical field writes
- Foreman and Operative mobile-first dashboards

**Exit:** daily field activity updates programme and commercial controls without duplicate entry.

## Gate 5 — Documents, drawings, quality and safety

Documents/drawings:
- revision supersession rules
- distribution and acknowledgement
- transmittals
- mark-up collaboration
- OCR / full-text indexing
- drawing comparison with structured change log
- approval workflows and expiry controls

Safety/quality:
- RAMS and permits
- toolbox talks
- inspections
- observations / NCRs / snags
- incident investigation
- root cause and corrective actions
- evidence-based closeout
- RIDDOR decision/support workflow
- certification/competency checks

**Exit:** every controlled document and safety/quality record has a version, owner, status, evidence, audit trail and closeout.

## Gate 6 — Unified capture and communications

- Smart Parse → reviewed structured records
- voice → RFI / diary / task
- receipt photo → OCR → vendor/amount/VAT/category/project → accounting queue
- photo → snag / progress / safety observation
- email/message intake → project correspondence
- one notification/event model across web/PWA/native
- user preference, escalation, read/acknowledgement and delivery status

**Exit:** site and office information can enter once and become structured, traceable project data.

## Gate 7 — Native parity

- use the canonical API/core contract only
- assigned projects/tasks
- offline clock/check-in/timesheet
- diary + photos
- drawings/markups
- snags/quality
- safety/incident
- RFIs/messages
- approvals appropriate to role
- push notifications
- background sync/conflict UI
- EAS/App Store/Play distribution gates

**Exit:** high-value field journeys do not require desktop/web fallback.

## Gate 8 — Construction intelligence layer

- governed Vera action bus
- tenant/project RAG with source citations
- drawing/document intelligence
- procurement and tender agents
- commercial anomaly and forecast agent
- programme risk agent
- safety/quality trend agent
- approvals for high-risk AI actions
- action audit, rollback/idempotency and cost controls
- local-first model routing with optional approved cloud providers

**Exit:** AI can recommend and execute bounded actions only through permissioned tools with evidence and audit.

## Gate 9 — Spatial and automation platform

- site footprint/drawing spatial model
- live/last-known workforce and asset positions where lawful/consented
- task/progress/issues overlaid on site/drawing context
- automation builder: triggers, conditions, approvals, actions
- installable construction workflows/agents/widgets marketplace
- Company Admin field-app composition

**Exit:** CortexBuild becomes a configurable construction operating platform, not only a fixed application.

## Gate 10 — Reliability and launch discipline

Every release:
- reproducible clean install
- lint / TypeScript / unit / integration green
- migration-from-zero + upgrade migration test
- tenant/role/project security matrix
- Playwright critical journeys
- native doctor/build/export
- accessibility gate
- API performance and load gate
- dependency/container/secret scans
- backup restore test
- observability/Sentry/metrics
- canary deployment
- automated health verification
- documented rollback

Service targets:
- API P95 < 300 ms for ordinary CRUD
- field sync target < 3 s when connected
- offline merge target < 5 s after reconnect
- 99.9% availability target
- RTO < 15 minutes
- RPO < 5 minutes

## Immediate release sequence — v1.5.1

1. Reconcile latest `main` and concurrent valuation/iOS work.
2. Finish role hierarchy alignment and PM project-creation denial.
3. Validate persistent valuation workflow and fresh DB migration.
4. Update canonical status/audit documents.
5. Run full web/PWA/native quality gates.
6. Build and smoke-test production Docker image.
7. Merge through PR and tag v1.5.1.
8. Verify production health on cortexbuildpro.tech.
9. Archive remaining duplicate construction repositories and recovery-tag/delete obsolete branches with no open PR.
10. Start Gate 1 assigned-project scoping as the next P0.
