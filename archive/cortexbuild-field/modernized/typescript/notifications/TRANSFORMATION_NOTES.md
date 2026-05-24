# NotificationGateway — Transformation Notes

> **Same-stack consolidation** (TS → TS). The skill template assumes
> cross-stack rewrites with `legacy/` + `modernized/` source trees; this
> module's real code lives in-place at `server/_core/notifications/`,
> and **this directory holds the audit doc only**.

## Scope

| | |
|---|---|
| Repo | `cortexbuild-field` |
| Source pattern | open-coded `for (const r of recipients) { void sendEmail(...).catch(...) }` fan-out duplicated across 5 `rfis.*` mutations |
| New module | `server/_core/notifications/` (`gateway.ts`, `recipients.ts`, `index.ts`) |
| Smoke target | **`rfis.create` only** — other 4 RFI sites left as legacy in this PR (deferred to follow-up) |
| Equivalence proof | `tests/integration/rfis-create-notification-equivalence.test.ts` — passes against both legacy and migrated `rfis.create` with **no test modification** |

## Mapping table — legacy → modern, per behaviour

Behaviours here are derived from `server/routers/index.ts:2135–2161` (legacy
fan-out at HEAD~1) and the new code that replaces it.

| # | Behaviour | Legacy site | Modern site |
|---|---|---|---|
| 1 | Resolve recipients = active members of `companyId` whose `companyRole >= manager` | `index.ts:2139–2149` (inline `RECIPIENT_ROLES` whitelist + 2 SQL queries + `.filter(...includes...)`) | `recipients.ts:42–66` (`recipientsByCompanyRole`); calls into `ROLE_LEVELS` from `role-check.ts` |
| 2 | Skip recipients with no `email` on file | `index.ts:2151` (`if (!r.email) continue`) | `gateway.ts:71–75` (`addressable = to.filter(r => r.email !== null && r.email !== "")`) |
| 3 | Build per-recipient email body using `rfiSubmittedEmail({...})` | `index.ts:2152–2160` (template applied inline inside the loop) | `index.ts:2143–2150` (template moved into `channels.email.template` callback; gateway calls it per recipient at `gateway.ts:90`) |
| 4 | Fire-and-forget posture (caller doesn't wait, errors logged) | `index.ts:2152` + `:2160` (`void sendEmail({...}).catch(err => console.error("[rfis.create] email send failed:", err))`) | `gateway.ts:89–98` + `:104–108` (default `mode: "fire-and-forget"`; `.catch` attached internally; log shape `[${context}] email send failed:` matches legacy verbatim) |
| 5 | One Brevo POST per addressable recipient (sequential dispatch) | `index.ts:2150` (`for (const r of recipients)`) | `gateway.ts:88–98` (`addressable.map(...)` — synchronous dispatch, same call count, same call-arg shape) |
| 6 | Active-membership filter + role hierarchy | inline (`isActive=true` in SQL; role whitelist in JS) | `recipients.ts:48–58` (SQL `isActive=true` + JS `isActive===true` + JS `ROLE_LEVELS[role] >= ROLE_LEVELS[minRole]`) — defensive belt-and-suspenders mirrors legacy instinct |

## Deliberate deviations from legacy

| Deviation | Rationale |
|---|---|
| **Role hierarchy is now numeric (`ROLE_LEVELS[role] >= ROLE_LEVELS[min]`) instead of inline whitelist (`["manager","company_admin","super_admin"].includes(...)`)** | Single source of truth — the same numeric hierarchy already exists at `server/_core/role-check.ts#ROLE_LEVELS` (used by `requireCompanyRole`). Whitelist drift was a real risk: a future seventh role would have needed manual whitelist edits at every `rfis.*` site. Behaviour is identical for today's six roles (`worker=20`, `supervisor=40`, `manager=60`, `company_admin=80`, `super_admin=100`, `viewer=10`) — locked by the equivalence test. |
| **`ROLE_LEVELS` exported from `role-check.ts`** | Was `const`, now `export const`. The CLAUDE.md rule "framework primitives may be extended in `_core/`" applies. No behaviour change — only visibility. |
| **Defensive JS `isActive === true` filter alongside SQL `eq(isActive, true)`** | Legacy's SQL filter was correctness-critical and load-bearing; the new gateway adds a JS check on top so a future drizzle bug or fake-DB shortcut can't silently re-include inactive members. Costs zero in production (filtered set is already small). |
| **`mode: "fire-and-forget" \| "awaited"` is now an explicit param** | Legacy posture was always fire-and-forget for `rfis.*` (every call site uses `void sendEmail(...)`) but `auth.requestPasswordReset` (`auth.ts:245`) intentionally awaits + audits. Making the mode explicit is what unlocks future migration of the awaited site without inventing a second gateway. Today, `rfis.create` uses the default — bit-for-bit equivalent to legacy. |
| **Log shape preserved** (`[${context}] email send failed:`) | Existing greps and ops dashboards match this exact prefix. Changing it would break observability without warning. The `context` param defaults to caller's procedure name. |

## NOT migrated (live status)

| Item | Status | Reason / Notes |
|---|---|---|
| `rfis.answer` (`index.ts:2186`) | ✅ **migrated** (slice 2) | Now uses `recipientsByUserIds(db, [rfi.raisedById])` + `notify({...context: "rfis.answer"...})`. |
| `rfis.respond` (`index.ts:2243`) | ✅ **migrated** (slice 2) | `@deprecated` alias migrated alongside its canonical sibling so the duplication doesn't outlive the deprecation. |
| `rfis.approve` (`index.ts:2287`) | ✅ **migrated** (slice 2) | Now uses `recipientsByUserIds(db, [rfi.raisedById, rfi.answeredById])`; resolver short-circuits empty/all-null input so the legacy `userIds.length ? ... : []` guard is gone. |
| `rfis.reject` (`index.ts:2335`) | ✅ **migrated** (slice 2) | Same shape as approve. |
| `auth.requestPasswordReset` (`auth.ts:245`) | ✅ **migrated** (slice 3) | Now uses `notify({ mode: "awaited" })` with an inline single-recipient array (no resolver — caller already has the user object). Audit log reads `result.sent === 1` instead of branching on a try/catch. The legacy `error: err.message` field on the audit row was deliberately dropped — the error is still logged via `console.error("[auth.requestPasswordReset] email send failed:", err)` to stderr (and any future Sentry/Datadog pipeline). The anti-enumeration property is preserved structurally (every path returns `{success: true}`); it no longer relies on exception swallowing. |
| `index.ts:1051, 1223` (`users.invite` / `users.resendInvite`) | ✅ **migrated** (slice 4) | PIN-delivery flows that **deliberately throw on send failure** (admin retries via resendInvite). The gateway catches errors internally, so awaited `NotifyResult.errors[]` was added so callers can `throw result.errors[0]` and preserve the original Brevo error message. The 20-test `users-invite-resend.test.ts` suite — including `.rejects.toThrow(/Brevo/i)` assertions — passes unchanged. |
| `materials.ts:*` and other domains' `sendEmail` sites | ⏳ deferred | FOLLOWUPS#2 estimates these as opportunistic — don't bundle. |
| Push channel (`channels.push`) | ⏳ deferred | No RFI event registered in `shared/notification-events.ts` today. Wiring push would mean adding a new `NotificationEventType` AND updating every recipient's `pushPreferences` UI surface — a separate change. The gateway's `channels` shape is open for it (just add a `push?: PushChannel` key) when the time comes. |

## Slice 2 — 4 RFI sites migrated (closes architect M4)

After the slice 1 smoke test landed, the architect's MEDIUM finding **M4** flagged a behavioural divergence: `rfis.create` was on the new open `ROLE_LEVELS` hierarchy, while `rfis.answer/respond/approve/reject` still used the legacy closed whitelist. A future role at level ≥ 60 would have been silently inconsistent across migrated/unmigrated paths. Slice 2 closes that window.

**What changed:**
- New resolver: `recipientsByUserIds(db, userIds)` in `recipients.ts` — sibling of `recipientsByCompanyRole`. Filters null/undefined inputs (legacy `.filter((id): id is number => id != null)` posture); short-circuits empty input without issuing a SQL query. Does NOT filter by `isActive` (specific known users — a deactivated raiser is still entitled to know their RFI was answered, matches legacy).
- Four call sites in `server/routers/index.ts` migrated to `notify({...})` + `recipientsByUserIds(...)` (lines 2184/2241/2285/2333). Same fire-and-forget posture, same template bodies, same context-tagged log shape.
- 4 new unit tests: happy path (preserves null email), strips null/undefined IDs, all-null input is no-op (no SQL issued), empty input is no-op.
- `pnpm test -- tests/rfi*` (42 tests) and `tests/_core/notifications` (16 tests) all green; `pnpm check` clean; the original `rfis-create-notification-equivalence` integration test still passes (proves slice 1 wasn't regressed by slice 2 wiring).

**M4 verdict:** applied. Hierarchy is now uniformly the open `ROLE_LEVELS` semantics across all 5 RFI mutations. The `RECIPIENT_ROLES = ["manager", "company_admin", "super_admin"]` whitelist no longer exists in the codebase.

**Equivalence proof:** the existing `tests/rfis-router.test.ts` (31 cases) already asserted on the exact `sendEmail` call shapes for the 4 sites under mocked sendEmail. Those tests passed before AND after the migration — that's a free equivalence proof that the call shapes (recipients, subject, body) are unchanged. A real-Postgres integration test in the style of `rfis-create-notification-equivalence` was considered for `rfis.approve` (the most complex, dual-recipient case) but rejected: the existing 31 unit assertions plus the slice-1 integration test already cover every observable property at the same layer. Adding it now would be ceremony, not proof.

## Slice 3 — `auth.requestPasswordReset` migrated (closes architect L3 review)

The last unmigrated `sendEmail` site in the auth flow now goes through the gateway in `mode: "awaited"`. This is the first production caller of awaited mode — until slice 3, only unit tests exercised that branch.

**What changed:**
- `server/routers/auth.ts:244` — replaced inline `try { await sendEmail(...) } catch { ... }` block with `await notify({ mode: "awaited", ... })` + branching on `result.sent === 1` for the audit log entry.
- Inline single-recipient array (no resolver) — the caller already has the `user` object from `getUserByEmail` upstream; constructing a one-element `to: [{userId, email, name}]` is cleaner than introducing a `recipientsByUserId` (single) helper.
- `import { sendEmail } from "../_core/email"` removed; `import { notify } from "../_core/notifications"` added.
- 6/6 existing `tests/auth-password-reset.test.ts` cases pass unchanged (the test mocks `../server/_core/email#sendEmail` at the module level, which `notify` calls into). Free equivalence proof — same call args, same call count, same anti-enumeration response shape.

**Deliberate behaviour change:** the audit log entry on send failure no longer carries an `error: err.message` field. The Brevo error string is still emitted via `console.error("[auth.requestPasswordReset] email send failed:", err)` — ops dashboards / Sentry pipelines can correlate by the context tag. The decision was made explicitly (user-confirmed in the migration prompt) — the cost of extending `NotifyResult` with an `errors[]` array (touching every existing awaited test) outweighed the audit-log forensics gap.

**Anti-enumeration:** previously enforced by the outer try/catch swallowing send errors. After slice 3, it's enforced **structurally** — every code path returns `{success: true}`, and `notify` never throws sendEmail rejections out of awaited mode. This is a stronger guarantee: a future maintainer can't accidentally reintroduce a "throw on send failure" path because the gateway never offers one.

**Architect L3 reassessment:** with 5 fire-and-forget callers and 1 awaited caller, the `mode` default earns its keep at the current ratio. The L3 nit is downgraded — defer making `mode` required until awaited:fire-and-forget approaches parity (today: 1:5, very far from parity).

## Slice 4 — last 2 admin sites migrated; awaited `NotifyResult` gains `errors[]`

The two remaining `sendEmail` call sites in `server/routers/index.ts` (`users.invite` and `users.resendInvite`) had a fundamentally different posture from everything migrated so far: **awaited + deliberately throw on send failure**. The thrown Brevo error is part of their contract — admin-facing tests pin it via `.rejects.toThrow(/Brevo/i)` — so the gateway's "catch internally, return failed: N" behaviour was incompatible until extended.

**Gateway extension:**
- `NotifyResult` (awaited variant) gains a new field: `errors: ReadonlyArray<unknown>` — captured rejection reasons in dispatch order, same length as `failed`. Empty array when `failed === 0`.
- Callers that need to re-throw: `throw result.errors[0]`. Preserves the original cause without surrounding the gateway with another try/catch.
- Fire-and-forget mode does NOT include `errors` (the result returns before sends settle, so there's nothing to surface). The discriminated union enforces this — TypeScript prevents reading `errors` from a fire-and-forget result.

**Migrations:**
- `users.invite`: gateway call + `if (result.failed > 0) throw result.errors[0]`. Preserves the legacy throw-on-failure contract. The `notifyOwner(...)` ops-relay call below is intentionally NOT migrated — it's a different system (Manus webhook, see `_core/notification.ts`) and uses its own best-effort posture.
- `users.resendInvite`: same shape as `users.invite`.
- Removed unused `import { sendEmail } from '../_core/email'` from `routers/index.ts` — no remaining direct callers in routers/.

**Test impact:**
- 3 existing awaited-mode tests updated to assert on the new `errors` field. None of the assertions changed semantics — they previously had `expect(result).toEqual({...})` without `errors`, now they include `errors: []` (no failures) or `errors: [<captured-error>]` (test 4: 1 rejection).
- New unit test "awaited result.errors preserves rejection causes in dispatch order" pins the load-bearing property: with 3 sends (1 reject / 1 ok / 1 reject), `result.errors` has length 2 and contains the exact Error instances in dispatch order.
- 20/20 `tests/users-invite-resend.test.ts` cases pass unchanged — including the 2 `.rejects.toThrow(/Brevo/i)` assertions. Free equivalence proof for both admin sites.

**Why not extend the gateway with a `throwOnFailure: true` flag instead?** That was option C in the design discussion. Rejected because it adds a new param to `NotifyParams` (more API surface) and forks the gateway's own behaviour. Adding `errors[]` to the result is purely additive — the gateway's catch-and-continue behaviour is unchanged, the caller decides whether to re-throw. Smaller blast radius, more composable.

**State after slice 4:** every user-facing email-send call site in `server/routers/` now goes through the gateway. The `sendEmail` import has been removed from `routers/index.ts`. The only direct `sendEmail` consumer in the codebase is the gateway itself (`gateway.ts:113`).

## Slice 5 — `safeRecipients` helper closes architect M5

Pre-slice-5, every migrated RFI site had a hidden vulnerability the original architect-critic flagged as **M5**: the resolver runs *after* the row mutation has committed, so a transient drizzle SELECT failure (pool exhaustion, mid-flight DB drop) leaked through to tRPC as `INTERNAL_SERVER_ERROR`. Clients retry; the mutation runs again; duplicate row.

**The fix:** a single small helper.

```ts
export async function safeRecipients(
  fn: () => Promise<NotificationRecipient[]>,
  context: string,
): Promise<NotificationRecipient[]> {
  try { return await fn(); }
  catch (err) {
    console.error(`[${context}] recipient resolution failed:`, err);
    return [];
  }
}
```

**Why a helper, not a gateway change?**
- The architect offered two options: (1) move resolution inside `notify()` (gateway owns end-to-end safety, but bigger API change — `notify({ recipients: () => Promise<...>, ... })`), or (2) wrap the call site. Slice 5 takes option 2.
- Smaller blast radius: 1 new helper, 5 one-line wraps, no resolver signature changes, no gateway API change.
- Same posture documented for the push pipeline in `pushNotifications.ts` and `CLAUDE.md`: "notification failure must NEVER block the originating mutation."
- Refactoring path open: if push channel later forces option 1, `safeRecipients` is one of two consumers and trivially removable.

**Migrations:**
- All 5 RFI sites (`rfis.create`, `rfis.answer`, `rfis.respond`, `rfis.approve`, `rfis.reject`) now use `safeRecipients(() => recipientsByX(...), "rfis.X")`.
- The 3 inline-recipient sites (`auth.requestPasswordReset`, `users.invite`, `users.resendInvite`) deliberately do NOT use the helper — they construct `[{...}]` literally, no resolver to fail.

**Test coverage:**
- New `tests/_core/notifications/recipients.test.ts` cases: "returns the resolver's value on success (no logging)" + "returns [] when the resolver throws; logs the cause with the context tag". 9/9 recipients tests now pass.
- All 5 RFI sites' existing tests pass unchanged — the helper is transparent on success path. Free equivalence proof.
- `pnpm test:integration tests/integration/rfis-create-notification-equivalence.test.ts` still 2/2 green; tsc strict clean.

**Log shape:** `[${context}] recipient resolution failed:` matches the `[${context}] email send failed:` shape from `gateway.ts`, so ops can grep by context tag and tell the two failure modes apart at a glance.

## Follow-ups for the next module that depends on this

1. **Add `recipientsByUserIds(db, userIds)`** in `recipients.ts` — needed to migrate `rfis.answer/respond/approve/reject` (single-/multi-user-id recipient shape, no role filter). ~15 lines, plus 1–2 unit tests.
2. **Add `mode: "awaited"` migration of `auth.requestPasswordReset`** — needs `notify({...})` to return the `NotifyResult` BEFORE the audit log fires (so `result.sent: true/false` lands accurately in the audit). The current gateway already returns accurate counts in awaited mode; the migration is just a wiring change.
3. **Delete `rfis.respond`** — already marked `@deprecated`. Track via telemetry whether any client still calls it; drop in a follow-up commit.
4. **Tighten `EmailChannel.template` type** — currently receives `NotificationRecipient` (where `email: string | null`), forcing every template to do `r.email ?? ""`. Once we're sure all templates set `to: r.email!` directly, narrow to `NotificationRecipient & { email: string }`. Today the unit tests use the `?? ""` fallback so tightening would break them.
5. **Remove the deprecated `RECIPIENT_ROLES` const idiom from any remaining call sites** as they migrate. The `ROLE_LEVELS` lookup is the single source of truth now.
6. **Open question — push event registration**: when the next PR adds push for RFI events, the new `NotificationEventType` strings (`"rfi.created"`, `"rfi.answered"`, etc.) need a one-line add to `shared/notification-events.ts` AND a UI surface in `pushPreferences`. The gateway shape is forward-compatible.

## Side-by-side: legacy fan-out (`rfis.create`, HEAD~1) → modern (`rfis.create`, HEAD)

Captured at the time of transformation:

| Legacy (`server/routers/index.ts:2135–2161`, 27 lines) | Modern (`server/routers/index.ts:2135–2153`, 18 lines) |
|---|---|
| `const RECIPIENT_ROLES = ["manager", "company_admin", "super_admin"] as const;` | *(removed — hierarchy lives in `role-check.ts#ROLE_LEVELS`)* |
| `const memberships = await db.select().from(dbCompanyUsers).where(and(...));` | `const recipients = await recipientsByCompanyRole(db, input.companyId, "manager");` |
| `const recipientUserIds = memberships.filter(...).map(...);` | *(folded into the resolver)* |
| `const recipients = recipientUserIds.length ? await db.select().from(dbUsers).where(inArray(...)) : [];` | *(folded into the resolver)* |
| `for (const r of recipients) { if (!r.email) continue; void sendEmail({...}).catch(err => console.error("[rfis.create] email send failed:", err)); }` | `void notify({ to: recipients, channels: { email: { template: (r) => ({...}) } }, context: "rfis.create" });` |
| Net: 27 lines, 4 distinct concerns (role const, recipient lookup, null-skip, fan-out + log) interleaved | Net: 18 lines, single declarative call. Concerns hidden in the gateway are unit-tested in isolation. |

## Test coverage

| File | Cases | Status |
|---|---|---|
| `tests/_core/notifications/gateway.test.ts` | **9** (7 original + H1 sync-throw + H3 unhandledRejection) | ✅ all green |
| `tests/_core/notifications/recipients.test.ts` | 3 | ✅ all green |
| `tests/integration/rfis-create-notification-equivalence.test.ts` | 2 | ✅ all green (real Postgres testcontainer + mocked Brevo) |
| `pnpm check` | tsc strict | ✅ no errors |

## Architecture review — Step 5 outcome

The `architecture-critic` subagent flagged 3 HIGH / 5 MEDIUM / 7 LOW findings. HIGH severity applied in this PR; MEDIUM and LOW tracked below.

### HIGH severity — applied

| ID | Finding | Resolution |
|---|---|---|
| **H1** | `template(recipient)` was called *outside* the `.catch` chain inside `addressable.map(...)`. A sync throw from a template (today: not happening; tomorrow: a malformed input on a future template) would abort the loop AND, in fire-and-forget mode, escape via `void notify(...)` as an `unhandledRejection`. | `gateway.ts:88-98` now wraps the synchronous call: `Promise.resolve().then(() => sendEmail(template(recipient)))`. Sync throws now land in the same `.catch` as async rejections. New unit test pins this: `gateway.test.ts` "sync throw inside channel.template". |
| **H2** | `NotifyResult` was a single shape `{sent, skipped, failed}` for both modes. In fire-and-forget mode, `sent` was `addressable.length` regardless of outcome — i.e. **a lie**. A future caller writing `auditLog({ delivered: result.sent })` from a fire-and-forget call would silently log false data. | `NotifyResult` is now a **discriminated union** keyed on `mode` — `{mode: "fire-and-forget", dispatched, skipped} \| {mode: "awaited", sent, failed, skipped}`. Callers MUST narrow to read counts; the type system makes the misuse impossible. Mirrors the `PushResult` precedent in `pushNotifications.ts`. |
| **H3** | "Fire-and-forget never produces `unhandledRejection`" was a load-bearing safety property defended only by reviewer attention — no test pinned it. A future refactor that detached the inline `.catch` (e.g. "centralise logging") would silently kill production. | New unit test `gateway.test.ts` "fire-and-forget never produces unhandledRejection" attaches a `process.on("unhandledRejection", ...)` listener, forces `sendEmail` to reject, asserts no rejection escapes. The invariant is now a tripwire. |

### MEDIUM severity — deferred to follow-ups

| ID | Finding | Why deferred / next step |
|---|---|---|
| **M1** | Fake DB at `recipients.test.ts:60-90` discards `where(...)` predicates; impl compensates with JS-level filters. Unit tests pass even if SQL `where` is wrong. Integration test catches it — but is the only line of defence. | Either upgrade the fake to honour predicates, OR add a unit test that captures the `.where(...)` argument and asserts on the drizzle expression shape. Defer: integration test is currently green, so the gap is theoretical. |
| **M2** | `channels: { email?: ... }` is open shape, but push channel will need `eventType` + `payload` (per-call, not per-recipient) and routes through `sendPushToUsers(userIds, ...)` as a batch — asymmetric to email's per-recipient template. The shape WILL be rewritten when push lands. | Either rename `template` → `bodyFor` now, or pick a flatter shape (`notify({to, email?, push?, context, mode})`). Defer: no push-RFI event registered today; revisit when the first push migration is queued. |
| **M3** | `recipientsByCompanyRole(db, ...)` accepts non-null `Db`; project's `getDb()` posture returns `Db \| null`. Caller must null-check before calling. The convention is implicit, not enforced. | Either accept `Db \| null` and short-circuit to `[]`, or add explicit JSDoc requiring callers to null-check. Defer: today's only call site does null-check (`if (!db) throw dbUnavailable()`). Revisit when `recipientsByUserIds` lands. |
| **M4** ✅ | Legacy whitelist (`["manager","company_admin","super_admin"]`) is a closed set; new `ROLE_LEVELS[role] >= ROLE_LEVELS["manager"]` is an **open hierarchy**. Was a divergence between migrated/unmigrated sites. | **Applied in slice 2.** All 4 remaining RFI sites migrated to use `recipientsByUserIds(...)` (no role filter — the recipients are specific known users, not role-derived). The `RECIPIENT_ROLES = [...]` whitelist no longer exists in the codebase. Hierarchy semantics is now uniformly open across `rfis.*`. |
| **M5** ✅ | If `recipientsByCompanyRole` / `recipientsByUserIds` throws (drizzle SELECT failure mid-mutation), the error propagated to tRPC and the client saw `INTERNAL_SERVER_ERROR` **after** the row mutation had committed — risk of duplicate-on-retry. | **Applied in slice 5.** New `safeRecipients(fn, context)` helper in `recipients.ts` wraps the thunk in a try/catch, logs `[<context>] recipient resolution failed:` to stderr, returns `[]` on failure. All 5 RFI sites updated to use it. Notification failure can no longer block the originating mutation — same posture as `pushNotifications.ts`'s internal try/catch chain. Pure call-site wrap; resolver signatures and gateway API both unchanged. |

### LOW severity / nits — tracked

| ID | Finding | Disposition |
|---|---|---|
| **L1** | `void notify(...)` schedules a fire-and-forget Promise; on SIGTERM (PM2 reload) before sendEmail's HTTP call completes, the email is lost. Identical to legacy posture — no regression. | Track for future: graceful-shutdown drain queue when migrating awaited / audit-tracked sends. |
| **L2** | `NotificationRecipient.email: string \| null` forces every template to write `r.email ?? ""`. Gateway already partitions to non-null inside, then "forgets" the narrowing. | Tighten `EmailChannel.template` parameter to `NotificationRecipient & { email: string }`. Drop `?? ""` everywhere. Small touch surface today; do alongside the next migration. |
| **L3** ⚠️ now in scope | `mode` has a default. After slice 3, the codebase has 5 fire-and-forget callers (`rfis.*`) and 1 awaited caller (`auth.requestPasswordReset`). Defaults that match 5/6 callers are not a smell — the asymmetry is real. | Reassessed after slice 3: defer making `mode` required. The 5:1 ratio means the default earns its keep. Revisit if the awaited:fire-and-forget ratio tips toward parity. |
| **L4** | Log shape `[${context}] email send failed:` is unstructured. | Future structured-logging migration (Sentry/Datadog) — gateway can ship `console.error("[notify]", { context, error: err })` and existing greps still match. |
| **L5** | `m.companyRole as UserRole` cast is unsafe — the rescue is at runtime via `level !== undefined`, but the cast lies to TS. | Replace with `(ROLE_LEVELS as Record<string, number \| undefined>)[m.companyRole]`. Same runtime, more honest types. |
| **L6** | Test fake uses `Symbol.for("drizzle:Name")` — explicitly forbidden by the project's CLAUDE.md ("use `getTableName(table)` from `drizzle-orm` — the latter is internal and breaks on Drizzle minor upgrades"). | Replace with `getTableName(table)` in the fake. Cosmetic but contradicts a documented project rule. |
| **L7** | Empty `channels: {}` returns `dispatched: 0, skipped: N` for N addressable recipients — the recipients were neither dispatched nor skipped, they were "no channel configured". | Either count them as skipped, or tighten `channels: { email: EmailChannel }` (no `?`). YAGNI — no caller does this. |

### Things considered but rejected (architect's notes worth preserving)

- **Compose `sendPushToUsers` today even if push isn't wired**: rejected. No RFI event registered, push pipeline already owns its observability, speculative coupling.
- **Revert the gateway and inline at the single call site**: rejected — but barely. Justified only by the queued follow-up migrations; if those don't land within ~2 weeks, the abstraction loses its value.
- **`mode: "fire-and-forget"` should `queueMicrotask`**: rejected — synchronous dispatch via `addressable.map(...)` is what makes the tests' `toHaveBeenCalledWith` assertions deterministic, and what guarantees the `.catch` is attached before `notify()` returns.
- **Triple-defence on `companyId` filter (SQL + JS)**: rejected. For tenant scoping, the SQL filter MUST be the single source of truth — a JS filter that diverges would silently leak cross-tenant data, which is worse than the failure mode it would catch.

## Verification commands

```bash
cd /root/cortexbuild-field
NODE_OPTIONS="" pnpm test -- tests/_core/notifications
NODE_OPTIONS="" pnpm test:integration tests/integration/rfis-create-notification-equivalence.test.ts
NODE_OPTIONS="" pnpm check
```

## One test-infra fix shipped alongside

The agent-written `recipients.test.ts` had a closure-vs-reassignment bug in
`makeFakeDb()` — `Object.assign({}, state)` made `db.mockRows` and the
closure's `state.mockRows` distinct references after the test reassigned
`db.mockRows = {...}`. Fixed by collapsing to a single live object whose
`.mockRows` is read at query time. This is a test-fake fix, not a contract
change; the test cases themselves are unchanged.
