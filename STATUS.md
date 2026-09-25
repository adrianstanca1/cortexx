# CortexBuild Pro — current status

Reviewed 25 September 2026. Canonical repository: `adrianstanca1/cortexx`; release branch: `main`; product line: v1.5.x.

The current workflow roadmap is [Canonical Product Audit & Roadmap](docs/CANONICAL_PRODUCT_AUDIT_2026-09-24.md). Older June/July feature inventories are historical and must not be used as deployment or launch evidence.

## Implemented in main

- Governed procurement: requisitions, approvals, RFQs, quote comparison, manual award, linked purchase orders, goods receipts and invoice three-way matching (PRs #203–204).
- Supplier performance: recorded delivery reliability, overdue issued orders, net values, receipt commitments and evidence links (PR #205). Missing dates remain unassessed.
- Consolidated construction web, PWA, native field client and shared APIs. Role journeys cover Company Admin, Project Manager, Foreman and Operative; only Company Admin creates projects.
- The detailed audit tracks the existing commercial ledger, bank reconciliation, field capture, safety closeout, tenant scope and offline workflow work.

## Current review changes

Supplier mutations now require an active company and explicit write/admin permissions. Creation and updates are audited. Deletion requires Company Admin access and rejects suppliers with procurement history in a serializable transaction; archive remains available. UI actions follow server-returned permissions. These changes are release candidates until their PR passes CI and merges.

## Release evidence and remaining work

- As checked on 25 September, deployment run `36099971646` succeeded for main `843380b` (requisition/RFQ release).
- The deployment for scorecard main `4b23b0e` was skipped by the CI gate. Merged code must not be described as deployed until its main CI and deployment succeed.
- Xcode Cloud project-layout fixes are in PR #206. Linux checks do not establish a successful Apple archive or TestFlight upload.
- External accounting adapters, supplier quality/defect evidence, programme/drawing workflow depth, governed agent tools, device/accessibility/load verification, and backup/restore/rollback drills remain tracked in the canonical roadmap.

A successful build or a page existing does not establish complete launch readiness. Use current CI, integration/browser results and deployment logs for each release.
