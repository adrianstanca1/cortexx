# Security Audit & Hardening Status — CortexBuild Field

**Latest audit:** 2026-05-05 (post-refactor)
**Auditor:** Automated review (Claude Code, `feature-dev:code-reviewer` subagent)
**Scope:** `server/routers/` (extracted), `server/_core/`, `drizzle/schema.ts`, `.env*`, `.gitignore`

This document captures findings from the post-refactor security audit, distinguishing what's been **landed** in the current commit chain vs. what's **deferred** (with reasons).

---

## Status overview (as of 2026-05-05, end-of-day)

|  Severity | Count | Landed | Deferred |
| --------: | ----: | -----: | -------: |
|        P0 |     0 |      — |        — |
|        P1 |     6 |      6 |        0 |
|        P2 |     3 |      3 |        0 |
| **Total** | **9** |  **9** |    **0** |

**All audit findings now landed.** Earlier in the day this stood at 0 P0 / 6 P1 deferred / 1 P2 deferred. The remote refactor introduced `companyScopedProcedure` (`server/_core/trpc.ts:100`), and the second pass on 2026-05-05 closed every remaining P1 and P2 — see "Landed in this commit chain" below for commit hashes.

---

## Landed in this commit chain

### P1-A / P1-F — PIN no longer in invite response bodies — LANDED (commit ce818d2)

`server/routers/index.ts` (users.invite, users.resendInvite) — the PIN
previously round-tripped in `result.pin`, `result.onboardingLink`, and a
PIN-bearing `result.message`. New flow:

1. PIN is generated and persisted to DB.
2. `sendEmail()` (new — `server/_core/email.ts`) delivers the PIN to the
   invitee via SendGrid HTTP API. Throws on failure so the admin sees the
   error and can call `resendInvite` to retry (which rotates the PIN).
3. `notifyOwner()` continues to relay the PIN-bearing body to the platform
   owner for ops visibility (best-effort, unchanged).
4. Response body contains only `{ success, expiresAt, message }` — no PIN,
   no onboardingLink.

`app/super-admin.tsx` Alert text changed from "Temporary PIN: ${pin}" to a
"check your email" wording. `app/onboard.tsx` "Forgot PIN" flow no longer
auto-fills the PIN entry field.

`SENDGRID_API_KEY` is required in production (`.env.production.template`
already lists it). In dev, missing key logs a warning and returns success.

### P1-B / P1-C — `users.invite` and `users.listInvites` scoped — LANDED (commit 7f2bc87)

Both procedures promoted from `protectedProcedure` to `companyScopedProcedure`.
Removed `companyId.default(1)` and `companyId.optional()`. companyId is now
required; non-admin callers without active membership in companyId get
FORBIDDEN at the middleware before any DB I/O.

### P1-D — `users.revokeInvite` IDOR closed — LANDED (commit 333e9d9)

Promoted to `companyScopedProcedure`. Input now requires both `id` and
`companyId`; the WHERE clause filters on both, so a caller in tenant A can
no longer revoke an invite belonging to tenant B by guessing its integer id.

### P1-E — `teams.*` scoping + companyId column — LANDED (commit 854ad86)

`drizzle/0008_team_members_companyId.sql` adds `companyId integer NOT NULL
DEFAULT 1` to `team_members` (the last tenant-scoped table that lacked one)
and backfills from the parent project where projectId is set.

All four `teams.*` procedures now use `companyScopedProcedure`:
- `teams.list` ANDs `eq(companyId)` into the WHERE (was returning every
  tenant's members).
- `teams.create` PERSISTS companyId on insert (was deliberately stripping
  it via `const { companyId: _c, ...fields } = input`) and FK-guards
  projectId against the tenant.
- `teams.update` and `teams.delete` scope WHERE by both id AND companyId.

### P2-B — `users.acceptInvite` rate limiting — LANDED (commit f443e90)

Plug `assertLoginAttemptsAllowed` / `recordFailedLoginAttempt` /
`clearLoginAttemptBucket` from `server/_core/login-rate-limit.ts` into
`acceptInvite`. (ip, email) capped at 5 failures per 15s — 6th throws
TOO_MANY_REQUESTS. Successful accept clears the bucket so a typo on first
try doesn't lock out the user.

The earlier "needs a Request adapter" deferral was incorrect: the helpers
already accept `Pick<Request, "headers" | "ip" | "socket">`, and `ctx.req`
in tRPC IS an Express Request. No adapter needed.

### P2-A — `files.upload` payload bounds — LANDED (commit 53de93b)

`server/routers/files.ts`

- `base64Data` now `.min(1).max(14 * 1024 * 1024)` — 14 MB base64 ≈ 10 MB decoded, rejected at zod parse before `Buffer.from` allocates anything. Closes the multi-GB memory-DoS surface.
- `mimeType` now whitelisted via `.refine()` to 12 allowed types (jpeg/png/webp/heic/heif, pdf, doc(x), xls(x), csv, txt). Used `.refine()` instead of `z.enum()` so the static type stays `string` — mobile callers passing `expo-image-picker`'s string-typed mimeType still typecheck without `as` casts.
- `fileName` tightened to `.min(1).max(255)`.

### P2-C — JWT_SECRET startup exit in production — LANDED (commit 53de93b)

`server/_core/index.ts:70-93`

- When `JWT_SECRET` is missing AND `NODE_ENV=production`, the process now `process.exit(1)` instead of just warning. PM2 surfaces the failed startup; the deploy pipeline marks the rollout failed instead of routing traffic to a process that 500s on every login.
- Dev fallback unchanged (warning only) — local `pnpm dev` continues to work without a secret.

### Earlier-chain fixes (still live on main)

- **`.env` gitignored** (commit 79137a5) — closes the secret-in-tracked-file leak vector. Verified `.env` was never committed via `git log --diff-filter=A`. **Owner action required: rotate JWT_SECRET and DB password** in case they leaked through other channels.
- **CIS deduction on labour subtotal not gross-incl-VAT** (commit 6544c9e) — finance bug, not a CVE, but a real legal/financial issue under HMRC CIS rules. Test contract in `tests/ai-doc-generators.test.ts` updated accordingly.
- **5 dependabot alerts resolved** (commit 8afebaf) — happy-dom 15→20.8.9 (1 CRITICAL CVE-2025-61927 + 2 HIGH), uuid override 11→14 (1 MEDIUM), diff override added (1 LOW). Vulnerability count dropped from 11 to 3 on default branch.

---

## Deferred

**None.** All P1 and P2 findings from the 2026-05-05 audit are landed (see commit hashes above).

---

## Other notable findings (not security-classed)

- **CIS labour/material split** — RESOLVED (2026-05-08, PRs #193 → #196). Four-phase rollout: (1) shared HMRC helper `shared/cis.ts` with `cisRateForStatus` / `labourSubtotal` / `computeCisDeduction`, three server-side procedures (`generateInvoice`, `generateTimesheet`, `generateTimesheetSignedOff`) migrated off hardcoded 20%; (2) UI surfaces — per-line `isLabour` toggle on invoice form, 4-state `cisStatus` picker on timesheet form; (3) Drizzle migration `0015_invoices_lineitems_jsonb.sql` (text → jsonb) plus persistence-layer CIS validation gate in `finance.createInvoice` rejecting caller-supplied `cisDeductionAmount` that disagrees with `labour × rate` by more than £0.01; (4) receipt scanner with dedicated AI extraction prompt tagging `isLabour` per line, tap-to-cycle Labour/Materials/Unknown pill, and a server-side carve-out (`type !== 'receipt'`) so supplier bills persist verbatim. Two HMRC bugs fixed end-to-end: gross_payment subbies were over-deducted by 20%, registered_30 subbies were under-deducted by 10%. Spec: `docs/superpowers/specs/2026-05-07-cis-labour-materials-split-design.md`.
- **Pre-commit hook bug** — RESOLVED. Was a local-only `.git/hooks/pre-commit` (untracked, machine-specific) printing `[: <filename>: integer expression expected` from a stat/size variable mix-up. The file no longer exists on this box (likely cleared during the 2026-05-05 VPS bootstrap). Verified absent 2026-05-07.
- **Icon assets** — RESOLVED (commit a0b5238). `icon.png`, `splash-icon.png`, `android-icon-foreground.png` re-quantised via pngquant (78881 → 55805 bytes each, ~70 KB total saving). 512×512 preserved, no visible quality loss. `favicon.png` was already small and untouched.

---

## Three most urgent remaining

None — all audit findings landed. Next-pass scope shifts to "Out of scope" items below.

---

## Out of scope of this audit

- Mobile client auth flow (does the tRPC client send credentials on every request)
- S3 bucket policy / signed URL expiry on the storage proxy
- CSRF protection details (cookie auth cross-origin)
- WAF / DDoS at the edge
- Manual CVE scan beyond what Dependabot covers
- Content Security Policy on the web build
- Production logging / log redaction (does PM2's stdout capture include response bodies?)

These should be assessed before scaling beyond the current internal-test deployment.
