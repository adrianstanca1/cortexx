# Committed and pending work review — 7 October 2026

This branch combines the compatible dependency refresh (`cde77ca`) and the
accounting/native field implementation (`94c7a0a`, `2cd879c`) on the canonical
`3a6d7a1` baseline, with the defects found during review fixed and regression
coverage added. No retired construction application is reintroduced.

## Corrections from review

- Xero contact, invoice and payment mutations carry stable creation keys scoped
  by connection, operation and local identity. Concurrent edits retain the same
  operation key, so a changed request conflicts instead of creating a new payment.
- Missing or malformed VAT values cannot silently become zero. Paid exports
  require an explicit valid payment date before any remote mutation.
- Changed payloads after pending/error attempts require reconciliation. Missing
  InvoiceID/PaymentID responses cannot be recorded as successful writes.
- Payment recovery fetches full payment details and verifies date, amount,
  reference and bank account. Ambiguous, incomplete or unrelated manual payments
  require reconciliation. Invoice recovery distinguishes sales invoices from
  purchase bills and rejects duplicate number matches.
- Native drawing files download with device bearer authentication and open via
  the native share sheet. Only the canonical upload endpoint receives credentials;
  its authorized streaming option avoids object-store redirects. Private cache
  files are removed afterward. Normal browser downloads retain presigned URLs.
- A stale drawing-detail response cannot reopen a dismissed panel or overwrite
  another selection. Android modal dismissal is handled. RFI overdue counts
  update with a timer rather than reading the clock during render.

Xero's provider key cache lasts six minutes. Persistent local write-back records
and verified remote recovery remain necessary for later retries; provider keys
alone do not establish durable exactly-once effects. See the official
[idempotency guide](https://developer.xero.com/documentation/guides/idempotent-requests/idempotency/).

## Completed verification

| Check | Result |
| --- | --- |
| Full quality gate: app integrity, ESLint, accessibility lint, root types, tests | Passed; 705 tests passed, 9 environment-dependent tests skipped |
| Real disposable PostgreSQL integration suite | 90 passed; all migrations applied |
| Next.js production build under Node 22 | Passed |
| Prisma formatting and raw SQL/model drift | Passed; 112 models, 36 raw SQL tables |
| Generated browser dist | 135 modules in sync |
| Shared core and Expo types | Passed |
| Standalone HTTP smoke | Database health, login/form/CSP, static JS, CSRF and unauthenticated write-back rejection passed |
| Native dependency graph | Compatible Expo 57 sharing module added; 16 high audit entries rooted in upstream braces/node-forge build tooling |

The first limited-memory build was killed during page-data collection; the final
build passed with an 8 GB limit and bounded CPU use. The original drawing contract
assumed direct browser file opening; it now checks the authenticated helper, with
separate behavioral coverage for downloads, cleanup and upload authorization.

The web production dependency audit from the combined dependency refresh reports
zero findings; its full development audit retains the seven known braces-chain
findings. Native tooling also retains unpatched braces/node-forge findings; forced
Expo/React Native downgrades are not applied. The installed registry node-forge
release remains 1.4.0 as of this review.

No live Xero financial mutation or signed native installation was performed.
Existing Xero connections need the granular scopes and an explicit admin mapping
before enabling write-back. CIS subcontract exports remain blocked until dedicated
CIS treatment is mapped. Native device validation and Apple signing remain release
gates. Latest-head hosted CI is checked on the existing PR after this checkpoint.

Detailed logs and source before-images are retained on the VPS under
`/home/administrator/backups/work-review-20261007T114146Z/`.
