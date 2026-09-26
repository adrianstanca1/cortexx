# PR integration review — 26 September 2026

## Scope and inventory

Repository: adrianstanca1/cortexx. Baseline: 384b86f40b698b5d3488ea64f338113a96969d17.

Queried all 237 PR records with a 500-record limit: 174 merged, 63 closed and no open PRs. This is a complete status/lineage inventory, not a claim to have re-reviewed every historical changed line.

| Closed feature PR | Disposition and evidence |
| --- | --- |
| #16 | Four modules and ask hardening recovered in #19 (main history 4be54f7 / 9e68057). |
| #101 | Closure records independent credential-file removal and Capacitor/bundle alignment. Tracked remote.env and write_env.py are absent from main. Do not reintroduce the obsolete branch. |
| #218 | Responsive module work is present in main commit 8899c84 and broader #217 redesign. Closure explicitly avoids overriding the newer CSS. |
| #226 | Replaced by #227, merged as d9b7971; same drawing-distribution feature with final validation changes. |

The other 59 closed PRs propose dependency updates. Current package manifests already include later Prisma, React, AWS, Sentry, TypeScript and Capacitor versions. Old major-version proposals are not evidence of missing product features; forcing all of them in would reverse intentional compatibility decisions.

## Branch review

Compared remote branch patch history with main and checked current feature history. Squash merges naturally leave commits that git cherry marks unique. Programme, procurement, supplier, field controls, native, valuation and Xero work have merged feature replacements. The preserved valuation audit branch predates certificate/payment/variation controls and would remove those routes if used as the source of truth. Recovery/probe/log branches and the separate Hermes experiment must not be merged wholesale into the construction release.

## Current release blockers found

- Main CI 36259923225: mobile-chromium-1 failed after cold route compilation and a retry; process exited 143. Other five browser shards, integration, typechecks and build passed. The exact cause of process termination is not established. Prebuilding removes the observed lazy-compilation delay; CI must validate the fix.
- Deployment 36260194472 was skipped, correctly preserving the CI gate.
- iOS run 36258931579: Capacitor explicitly rejected Node 20. Workflow now selects Node 22.
- Xero offset-free midnight strings were interpreted in local server time, shifting the UTC date in positive-offset zones. Normalize offset-free ISO timestamps to UTC while preserving explicit offsets and legacy epoch values. Regression runs in four timezones.

## Validation

After PR #241 merged to main, the review branch was rebuilt cleanly on that base. Clean install reports 0 vulnerabilities; 489 unit tests pass; targeted Xero tests pass including the four-timezone regression; repository-wide lint, Prisma generation and the full Next.js production build pass. Application integrity and schema-drift commands completed; the app audit reports non-blocking review findings and must not be represented as a clean accessibility audit. Browser CI and deployment remain the final gates.

Production checkout had unrelated dependency edits in progress. This review uses a separate worktree and does not overwrite or commit those edits.

## Concurrent security patch

PR #241 was merged independently before this review branch was finalized. PR #240 was then rebuilt on the resulting `main`, so the mobile dependency patch is inherited from the base and is not duplicated in this PR.
