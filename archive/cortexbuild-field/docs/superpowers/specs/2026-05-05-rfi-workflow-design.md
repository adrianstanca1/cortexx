# Phase 3.4 — RFI approval workflow + SendGrid notifications

**Status:** Design — pending implementation
**Date:** 2026-05-05
**Roadmap:** `docs/ROADMAP.md` § Phase 3.4
**Acceptance:** RFIs route through `submitted → answered → approved/rejected`; each transition emails the relevant party.

---

## 1. Goals

1. Replace the existing 2-state RFI lifecycle (`open` / `answered`) with a 4-state workflow that captures contractor review.
2. Email the right parties at every transition so the loop closes — raisers always hear back, answerers learn whether their answer was accepted.
3. Surface a "pending review" queue for managers and admins.
4. Preserve back-compat: in-flight mobile clients still calling `rfis.respond` keep working until they update.

---

## 2. State machine

```
                ┌─────────────┐  answer (manager+)    ┌──────────┐
  rfis.create ──▶  submitted  ├──────────────────────▶│ answered ├─────┐
                └─────────────┘                       └──────────┘     │
                                                          │            │
                            approve (company_admin+) ────┘            │
                                          │                            │
                                          ▼                            │
                                    ┌──────────┐                       │
                                    │ approved │ (terminal)            │
                                    └──────────┘                       │
                                                                       │
                            reject (company_admin+) ──────────────────┘
                            requires reason
                                          │
                                          ▼
                                    ┌──────────┐
                                    │ rejected │ (terminal)
                                    └──────────┘
```

`server/_core/rfi-state-machine.ts` is a pure helper:

```ts
export type RfiStatus = 'submitted' | 'answered' | 'approved' | 'rejected';

const TRANSITIONS: Record<RfiStatus, RfiStatus[]> = {
  submitted: ['answered'],
  answered:  ['approved', 'rejected'],
  approved:  [],
  rejected:  [],
};

export function canTransition(from: RfiStatus, to: RfiStatus): boolean;
export function assertTransition(from: RfiStatus, to: RfiStatus): void; // throws TRPCError BAD_REQUEST
```

All non-terminal status checks live here — never inline in the router.

---

## 3. Schema

Migration `drizzle/0011_rfis_workflow.sql` (idempotent, additive):

```sql
ALTER TABLE rfis ALTER COLUMN status TYPE varchar(20);
ALTER TABLE rfis ALTER COLUMN status SET DEFAULT 'submitted';

UPDATE rfis SET status = 'submitted' WHERE status = 'open';

ALTER TABLE rfis ADD COLUMN IF NOT EXISTS "answeredById"   integer;
ALTER TABLE rfis ADD COLUMN IF NOT EXISTS "approvedById"   integer;
ALTER TABLE rfis ADD COLUMN IF NOT EXISTS "approvedAt"     timestamp;
ALTER TABLE rfis ADD COLUMN IF NOT EXISTS "rejectedById"   integer;
ALTER TABLE rfis ADD COLUMN IF NOT EXISTS "rejectedAt"     timestamp;
ALTER TABLE rfis ADD COLUMN IF NOT EXISTS "rejectedReason" text;

CREATE INDEX IF NOT EXISTS idx_rfis_pending_review ON rfis (companyId, status)
  WHERE status = 'answered';
```

Schema.ts updates mirror the columns. Status stays `varchar(20)` (Zod enforces the value-set at the API edge — same pattern as `projects.status`, `tasks.status`).

`answeredById`, `approvedById`, `rejectedById` are nullable `integer`, no FK constraint — matches existing `raisedById` style. Cross-tenant integrity is enforced at the procedure layer, not at the FK level.

The new partial index targets the manager queue ("rows still awaiting approval"). It's small, write-once-per-RFI, and short-lived per row (rows leave it on approve/reject).

**Journal entry** must be added to `drizzle/meta/_journal.json` as part of this migration — the regression test added in commit `3f5fb92` will fail otherwise.

---

## 4. Procedures

All on `companyScopedProcedure` (tenant gate first), each with role-hierarchy + state-machine guards.

| Procedure | Min company role | Transition | Schema writes | Email recipients |
|---|---|---|---|---|
| `rfis.create` (existing, retarget default to `submitted`) | any member | → submitted | new row | every active `companyUsers` row with `companyRole IN ('manager','company_admin','super_admin')` |
| `rfis.answer` *(new)* | `manager` | submitted → answered | `response`, `status='answered'`, `respondedAt`, `answeredById` | raiser |
| `rfis.approve` *(new)* | `company_admin` | answered → approved | `status='approved'`, `approvedAt`, `approvedById` | raiser + answerer |
| `rfis.reject` *(new)* | `company_admin` | answered → rejected | `status='rejected'`, `rejectedAt`, `rejectedById`, `rejectedReason` (required, non-empty) | raiser + answerer |
| `rfis.respond` *(deprecated alias)* | `manager` | submitted → answered | thin wrapper that calls `answer` | same as `answer` |

`respond` stays as a 1-line wrapper that delegates to `answer` so in-flight mobile clients keep working. To be removed in a follow-up commit once EAS update has propagated.

### Role-check helper

`server/_core/role-check.ts` (new):

```ts
// Throws FORBIDDEN if ctx.companyMembership.companyRole is below `min` per
// the lib/company-context.tsx hierarchy: super_admin > company_admin > manager
// > supervisor > worker > viewer.
export function requireCompanyRole(
  membership: { companyRole: string } | null,
  min: CompanyRole,
): void;
```

This lives in `_core` because it's a procedure-builder primitive — the role layer of the gate, in the same way `companyScopedProcedure` is the tenant layer. Existing procedures that should have role checks but don't are out of scope here.

### Email send semantics

Fire-and-forget after the DB write. If SendGrid fails, the transition still succeeds and the audit log records it — we don't roll back business state on a notification failure. The error is logged via the redacting logger (Phase 2.2).

---

## 5. Email content

`server/_core/email-templates/rfi.ts` — four pure functions, each returns `{ subject, text, html }`. No template engine; template literals only (matches `pin-email.ts`).

```ts
export function rfiSubmittedEmail(args): EmailParams;
export function rfiAnsweredEmail (args): EmailParams;
export function rfiApprovedEmail (args): EmailParams;
export function rfiRejectedEmail (args): EmailParams;
```

Subject lines (designed for inbox scanning — number + verb + project):

- Submitted: `[RFI-0042] New RFI on <project name>: <subject>`
- Answered:  `[RFI-0042] Answered: <subject>`
- Approved:  `[RFI-0042] Approved on <project name>`
- Rejected:  `[RFI-0042] Rejected: needs revision`

Body (text), example for "rejected":

```
Hi <recipient.name>,

<rejecter.name> has rejected RFI <rfi.number> on <project.name>.

Subject: <rfi.subject>
Reason: <rfi.rejectedReason>

Open in CortexBuild Field: <APP_BASE_URL>/rfis?id=<rfi.id>

— CortexBuild Field
```

HTML body is the same content with `<p>` wrapping + a single styled CTA button. Identical structure to `pin-email.ts`.

`APP_BASE_URL` resolves to `https://field.cortexbuildpro.com`. Native users tap the link and `app/_layout.tsx`'s deep-link handler routes them through OAuth back to the RFI — same path that invite emails already use.

---

## 6. UI

`app/rfis.tsx` is ~700 LoC and already exists. Three additions, all bounded:

### 6.1 Status pill

`components/rfi-status-pill.tsx` (new, ~25 LoC). Pure presentational, takes `status: RfiStatus`.

| Status | Colour |
|---|---|
| submitted | amber |
| answered  | blue |
| approved  | green |
| rejected  | red |

### 6.2 "Pending review" tab

Tab strip at the top of `app/rfis.tsx` with two views: `All` and `Pending review`. The Pending tab:

- Filters client-side to `status === 'answered'`.
- Only renders when `useCompany().companyRole >= 'manager'` (uses existing `hasPermission`).

Client-side filter is acceptable up to ~500 RFIs/company; server-side filter is a 1-line addition later if it becomes a bottleneck.

### 6.3 Contextual action buttons

The RFI detail row grows three buttons that surface only when state + role allow:

- `submitted` + role ≥ `manager` → **Answer** (existing inline flow, relabelled from "Respond")
- `answered` + role ≥ `company_admin` → **Approve** + **Reject**

The **Reject** sheet has a required `<TextInput>` for the reason. Submit disabled until non-empty — UX friction at the irreversible step (mirrors the Phase 2.6 "I saved my codes" gate).

All three actions go through `useOfflineMutation` so they queue when offline.

The action-visibility logic is extracted into a pure helper `lib/rfi-actions.ts: visibleRfiActions(status, companyRole)` so it can be unit-tested without RTL.

### Out of scope

- List query shape (no change)
- RFI creation form (no change)
- Attachments handling (no change)
- Tab navigation outside `rfis.tsx`
- Comments/threads on RFIs
- Approval notes (we explicitly chose to skip these)

---

## 7. Tests

| File | Type | Cases |
|---|---|---|
| `tests/_core/rfi-state-machine.test.ts` | unit | every (from, to) pair: 16 cells, ~6 valid + 10 invalid; `assertTransition` throws BAD_REQUEST on invalid |
| `tests/_core/role-check.test.ts` | unit | matrix of 6 roles × 6 minimums + null membership case |
| `tests/_core/email-templates/rfi.test.ts` | unit | each of 4 templates: subject contains RFI number, project name, action verb; body contains `recipient.name`, the deep link, and (for rejected) the reason |
| `tests/rfis-router.test.ts` | unit (mocked DB) | `answer` requires `manager`+, transitions only `submitted → answered`; `approve` requires `company_admin`+, transitions only `answered → approved`; `reject` rejects empty `reason`; `respond` is a true alias of `answer` |
| `tests/integration/rfis-workflow.integration.test.ts` | integration (real PG) | full happy-path lifecycle on real DB; cross-tenant: company B's admin cannot approve company A's RFI |
| `tests/rfi-actions.test.ts` | unit | `visibleRfiActions(status, companyRole)` matrix |
| `tests/rfi-status-pill.component.test.tsx` | RTL | renders correct colour for each of 4 statuses |

Email-send is mocked in router tests (`vi.mock('../server/_core/email')`); the assertion is "send was called with `{to, subject}` matching the recipient + template". Integration tests have email mocked out the same way (no SendGrid in CI).

Tenant-isolation topology test (`tests/tenant-isolation.test.ts`) auto-tracks the new procedures via the `companyScopedProcedure` regex — no manual update needed.

---

## 8. Migration journal

This spec adds `drizzle/0011_rfis_workflow.sql` AND its journal entry in `drizzle/meta/_journal.json`. The regression test from commit `3f5fb92` (`tests/migration-journal-completeness.test.ts`) will fail if either is missing.

`when` timestamp: ms since epoch at the time the migration is committed.

---

## 9. Rollout

Single push to `main`. Deploy workflow:

1. esbuild + expo export web build
2. `pnpm db:push` applies `0011_rfis_workflow.sql` against prod Postgres
3. PM2 restart picks up the new server bundle

Existing prod rows: `UPDATE rfis SET status='submitted' WHERE status='open'` runs as part of the migration; no separate data-fix step.

In-flight mobile clients calling `respond` continue to work via the alias. EAS update can ship later with the new tab UI; until then the panel just displays the new status colours via the existing list query.

No feature flag — the workflow is strictly more capable than the existing 2-state surface, and any client that doesn't yet know about `approve`/`reject` simply doesn't render the buttons (only managers + admins see them anyway, and they're a small minority of users).

---

## 10. Risks + mitigations

| Risk | Mitigation |
|---|---|
| SendGrid outage blocks RFI workflow | Email is fire-and-forget; transitions succeed even if email throws. Logged + auditable. |
| In-flight mobile client gets confused by new statuses | `respond` alias keeps writing semantics; new statuses (`approved`/`rejected`) are read-only on old clients (status pill renders default colour). |
| Cross-tenant approval | `companyScopedProcedure` already filters by `companyId`; integration test pins the cross-tenant FORBIDDEN case. |
| Manager queue grows huge in long-lived companies | Partial index `idx_rfis_pending_review` keeps queue queries fast. Client-side filter sufficient up to ~500 rows/company; server filter is a 1-line addition later. |
| Recipient list contains an inactive user | `companyUsers.isActive=true` is already enforced by membership lookups; inactive members aren't recipients. |

---

## 11. Out of scope

- RFI threading / comments
- File attachments on responses (existing `attachmentUrls` field unchanged)
- Approval notes (only rejection requires a reason)
- Re-opening a closed RFI (`approved`/`rejected` are terminal — re-raise as a new RFI)
- Per-user notification preferences (Phase 3.6)
- Email digest / batching
