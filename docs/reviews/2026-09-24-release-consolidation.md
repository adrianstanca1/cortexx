# Consolidated construction release — 24 September 2026

Initial canonical base: main `0d49380`, CortexBuild Pro 1.5.0. This includes the sync repairs, complete valuation ledger, certificates/payments, Smart Parse and capture routing, Agent OS and native snapshots. Earlier branch `fix/construction-sync-reliability` is equivalent to the changes already merged in `6a247b5`; it must not replace the newer release.

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

The integration now includes main `99756c9`: project WIP/cashflow (#189), receipt OCR and GPS capture (#190), and governed safety investigation/closeout (#191). Deeper native parity, accounting reconciliation and broader role/device E2E remain open. PR #192 is merged into this integration branch. A private snapshot of its unfinished VPS work is preserved at /home/administrator/backups/consolidation-20260924/role-work.patch; reviewed route-scope changes are integrated. The original checkout remains untouched. Preserve the video app and data for rollback.

## Integration validation and deployment gate

The release pipeline now starts only after successful main CI, checks successful push CI for the exact release SHA (including manual dispatch), deploys that SHA, and skips stale releases when main has advanced. This prevents deploying an untested newer main commit while an older workflow is running. This does not provide application/database rollback; only ingress rollback exists today.

Local integration verification: 319/319 unit tests; two authentication-context concurrency tests; TypeScript; Prisma/raw SQL drift check. Production build and generated bundle checks also pass. Workflow YAML and embedded shell scripts parse; release-gate checks reject absent CI and malformed SHAs. Browser verification remains required before merge/deployment. The independent role-test worktree was not modified. The user explicitly approved publication and consolidation. The combined work is published in PR #193; main merge and deployment remain subject to validation.


## Final source reconciliation
- Release PR #188 and role PR #192 ancestry is incorporated, with the newer CI-gated deployment workflow and context regression tests retained during conflict resolution.
- Cashflow, receipts, safety, commercial certificates, iOS fixes and sync-reliability branches are patch-equivalent to commits already present in main (verified with git cherry).
- Valuation-ledger predecessor is superseded by the current expanded ledger; its transactional backend mock is identical to the current file.
- Agent OS full source matches current agent-os except for its older mobile dependency. MVP is superseded by full. These historical branches must not downgrade the current product.
- Existing construction repository archives remain preserved. Buildupdate has only an AI Studio README and no implementation to import. Unrelated invoice, video and standalone AI products are outside the construction-version consolidation.
- Recovered durable route scopes cover projects, tasks, dashboard, inbox, team, check-ins and time entries. Tenant context storage is shared across server chunks while per-request stores remain isolated.
- Browser verification exposed server/browser ICU punctuation differences on site diary; date parts now render deterministically with an explicit UTC calendar date.
