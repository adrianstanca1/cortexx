# Code and branch review — 27 September 2026

Baseline: `fa888a529e22ea372662f46c1effec9efe480f9a`, canonical repository `adrianstanca1/cortexx`.

## Inventory

GitHub inventory: 247 PRs, 184 merged, 63 closed without merge, zero open before this patch. The four closed non-dependency PRs remain #16, #101, #218 and #226; dispositions are in the 26 September review. This is a complete PR status inventory, not a fresh line-by-line audit of every historical PR.

Remote branch findings:
- `main`: production working tree clean at baseline; remote main matches.
- `feature/drawing-markups-20260927`: patch-equivalent to merged #249 (`git cherry` reports minus).
- `perf/media-pipeline-20260927`: patch-equivalent to merged #248.
- `feature/drawing-transmittals`: tree exactly matches main commit `2a7c0da`; superseded by subsequent media and markup changes. No missing feature to merge.
- `fresh-start`: three Hermes optimization commits, a separate agent experiment; not construction release code.
- `vps-exec-logs`: root contains `latest.txt` and `runs`, an operational log branch rather than application source.

Other construction checkouts: `workspace/cortexx-full`, `workspace/cortexx-construction-release` and both `audit-repos` checkouts have no uncommitted files. They are older checkouts, not the production source of truth.

Archived `cortexbuild-pro` checkout: 96 modified tracked files and 31 untracked status entries (directory entries can contain many files). 94 tracked changes are generated dist JavaScript, all differing from current canonical dist; the other two are Caddy/Compose gateway changes. Untracked entries include generated bundles, dependencies/lockfiles and browser-gateway. Preserved without reset or wholesale merge. Its gateway server fails `node --check` at the embedded HTML template. Additional concerns include a fallback JWT signing secret and an externally bound gateway port. These archived changes are not production-ready. The old generated bundle has not been reconciled line-by-line with current sources.

## Bugs fixed

1. Drawing markup page parsing silently truncated malformed strings/fractions (for example `2oops` and `1.5`). Require a whole page from 1 through 9999, retaining the default for omitted pages.
2. Coordinate parsing accepted null, blanks, booleans and arrays through Number coercion. Reject these invalid values while retaining numeric coordinates and optional null dimensions.
3. Drawing list tested a URLSearchParams result against undefined, although missing values are null. Apply the archivedAt exclusion unless explicitly requesting archived drawings.
4. Negative drawing take values enabled reverse pagination. Clamp to the supported 1–200 range.

## Verification

Baseline quality: integrity audit, lint, TypeScript and 508 unit tests passed. Patched quality: the same gates and all 512 tests passed, including four new regression cases. Integrity audit still reports existing nonblocking UI/accessibility review findings; a passing gate is not a clean accessibility audit.

Baseline main CI run 36329368915 and deployment run 36329648553 succeeded on fa888a5. Live public health check returned healthy app/database/disk/memory during review. Those results apply to the baseline, not this new patch. Hosted PR checks must validate the new patch before release.

## Limits and remaining work

No destructive branch/repository cleanup and no production database mutations were performed. Historical experimental/uncommitted code is preserved. This review does not establish that every feature is defect-free. Outstanding product gates remain in the canonical roadmap. The follow-up below closes the confirmed direct-download project-assignment gap.

## Follow-up: file permissions and PR feedback

- Direct upload reads now check project assignment on document, snag, observation, drawing revision and safety-incident references before reading local bytes or issuing an S3 redirect.
- Document lists, detail, expiring lists and AI tagging use the same scope. Company-wide documents remain available to internal members. Internal files are denied to client personas.
- Document writes check membership write permission and the existing record scope. Creating/reassigning a document also verifies access to the destination project. Read-only users cannot upload bytes, update or delete documents.
- Authenticated file responses and storage redirects are no-store so role switches do not reuse a cached application response. Already issued S3 links remain usable until their existing expiry.
- Archived drawing queries accept either legacy status=archived or a non-null archivedAt, keeping the archive/restore path available. Explicit take=0 clamps to one.

Validation: full quality gate passed with 516 unit tests. Updated targeted tests passed, production build passed, and the desktop/mobile file-access journeys passed against a disposable Postgres database (no retries). Hosted checks must pass on the latest PR head before merge.

This is a project-access and write-permission fix, not an immutable upload provenance registry. Existing APIs associate uploads through document/evidence URLs. Additional hardening should bind upload ownership and attachment changes to a persistent upload record so manually copied URLs cannot be republished through new records; that broader data-model migration remains separate. Archived browser-gateway source remains preserved and undeployed.
