# CortexBuild Pro — current status

Reviewed 27 September 2026. Canonical repository: `adrianstanca1/cortexx`; production branch: `main`; release line: v1.5.x.

## Integration review

The complete PR inventory at review start contained 237 PRs: 174 merged, 63 closed without merge, and zero open. Four closed PRs contain feature/security work; their replacements are accounted for in [the PR review](docs/reviews/2026-09-26-pr-integration.md). The other 59 are dependency updates; closed historical upgrade proposals must not be applied over the current lockfiles.

Main includes procurement/requisitions/RFQs/receipts/matching, commercial and bank reconciliation, read-only Xero integration, role-aware field operations and closeout, drawing distribution, programme baselines/delays/resources, construction innovation pilots/standards, field command briefs and equipment permission fixes through #239, the release/browser/Xero reconciliation in #240, the mobile dependency security patch in #241, public Web Vitals proxy repair in #242, and verified construction backup/recovery automation in #243.

## Verification and release

At review start the production checkout was at `384b86f`, and the public health endpoint reported healthy app/database/disk/memory. That proves service health, not every authenticated workflow or exact running-image provenance.

Main CI run 36259923225 passed unit/build, shared/native typechecks, integration tests and five browser shards. The mobile-chromium-1 shard failed; deployment run 36260194472 was therefore skipped. iOS run 36258931579 failed because its workflow selected Node 20 while Capacitor requires Node 22.

The review patch normalizes offset-free Xero dates independently of server timezone, aligns the remaining iOS workflow to Node 22, and makes CI browser journeys exercise the production standalone runtime instead of compiling routes lazily during timed tests. It also fixes a first-service-worker-claim race that could reload a fresh session and abort its first navigation, and centralizes E2E authentication through the real Auth.js credentials callback while preserving an explicit UI-login test. PR #240 passed all required GitHub checks and merged at `51bb7c5`; PR #242 then fixed anonymous Web Vitals reporting and also passed the complete build/integration/iOS/security/browser matrix. PR #243 added current-stack backup/recovery automation and merged at `25f7aa1`, with its hosted Backup Verify workflow succeeding on the merged commit. Production now runs the current `main` image `sha256:7308b1f93e9c5f7be71567a9e3f3ae9363d2ff6eea9cace8d48bfcca8b87e2fe` healthy with zero restarts. A valid anonymous `/api/metrics` Web Vital returns 200, invalid metrics remain rejected, three fresh mobile login sessions complete without 4xx/5xx or page errors, and the production dependency audit reports 0 vulnerabilities. Local validation passes 493/493 tests, repository-wide lint, TypeScript and the full Next.js production build.

## Remaining completion gates

The [canonical roadmap](docs/CANONICAL_PRODUCT_AUDIT_2026-09-24.md) remains the workflow scope. Outstanding areas include governed accounting write-back, richer supplier quality evidence, persisted drawing markup/transmittals, comprehensive field offline conflict coverage, governed agent tools/marketplace, physical-device/accessibility/load verification, off-site backup/PITR, and a controlled full-stack rollback/cutover drill. Local database/upload backup and isolated restore verification are now implemented and verified.

Live Xero activation requires a configured authorised organisation. Native store delivery requires successful Apple build/signing/upload evidence. Merged PRs and passing unit tests do not establish complete launch readiness.
