# Consolidated construction release — 24 September 2026

Canonical base: main `0d49380`, CortexBuild Pro 1.5.0. This includes the sync repairs, complete valuation ledger, certificates/payments, Smart Parse and capture routing, Agent OS and native snapshots. Earlier branch `fix/construction-sync-reliability` is equivalent to the changes already merged in `6a247b5`; it must not replace the newer release.

## Branch dispositions

- `fix/release-pipelines-20260924`: integrated; corrected Next health contract, Compose environment interpolation, in-place Caddy updates, rollback on ingress failure, and refusal to overwrite local source edits.
- `feat/valuation-ledger-v15`, `feat/commercial-certificates-payments`, `fix/ios-cap-sync-workdir`, `fix/ios-capacitor-major`: already squash-merged in #184–187.
- `agent-os-full`: product files already present; its mobile manifest is older than main's Expo 57. `agent-os-mvp` is superseded by the full implementation.
- `deploy-cortexx-artifacts`, `fix-vps-exec-target`, `probe-onecom-vps-access`, `vps-exec-logs`: operational predecessors superseded by the construction stack/pipeline; no product feature requires replacing canonical source.
- `fresh-start`: predates the consolidated application by over 200 commits; retained as historical source.
- Dependency PRs #142, #144, #149–152, #181–183: package updates incorporated together with a regenerated lockfile. Prisma client/adapter/CLI and Capacitor root platforms are aligned. Redis v6 explicitly retains RESP2 reply shapes for existing rate-limit code; runtime requires Node 22.
- Expo brace-expansion PR #147: superseded by current lockfile version 5.0.12; do not restore the older Expo tree.

## Uncommitted server work

The old `/home/administrator/workspace/cortexbuild-pro` checkout contains generated dist changes, local deployment configuration, installed dependencies and an untracked browser-gateway prototype. Full source checkpoint plus binary git diff were saved privately under `/home/administrator/backups/construction-cutover-20260924/`. Original files remain intact. Browser gateway controls VPS browser instances; it is a separate prototype with insecure development defaults and is not exposed through the construction product.

## Additional gap closed

Valuation CSV export now covers all matching organisation records, independently of the UI's first page. It includes issued certificates and partial-payment balances, guards organisation context, disables caching and neutralises spreadsheet formulas in user text. Export does not imply external accounting integration.

## Release boundary

Existing roadmap items in `docs/CANONICAL_PRODUCT_AUDIT_2026-09-24.md` remain explicit: OCR/geotag intelligence, full incident investigation, deeper native parity, WIP/accounting integration and broader role/device E2E are not claimed complete by this release. Preserve the video app and data for rollback while moving the main domain to the full construction web application.
