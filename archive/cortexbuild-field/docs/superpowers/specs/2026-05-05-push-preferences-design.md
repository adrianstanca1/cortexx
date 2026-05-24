# Phase 3.6 — Push notification per-event preferences

**Status:** Design — pending implementation
**Date:** 2026-05-05
**Roadmap:** `docs/ROADMAP.md` § Phase 3.6
**Acceptance:** Users can mute specific event types (e.g. `defect_assigned`) without disabling push entirely. Adding a new event type to the codebase is a single PR with no opt-in registry plumbing.

---

## 1. Goals

1. Per-event-type opt-out for push notifications, granular enough to let a user mute "defect resolved" without losing safety alerts.
2. Existing `defects.create` and `defects.updateStatus` push call sites continue to fire by default for users who never touch settings.
3. Adding a new event type means: append one line to a shared registry, declare it at the dispatch call site, and wire it into the settings screen — no DB migration, no enum extension.
4. The dispatch boundary forces every caller to declare what event it is sending. Untyped pushes are not allowed.

---

## 2. Decisions table

| Choice | Decision | Why |
|---|---|---|
| **Granularity** | Per event type, flat (no project / category dimension) | Matches roadmap. Future category UI can group on top of the same flat shape without migration. |
| **Default behaviour** | Opt-out (firing by default; user must mute) | The user already accepted OS-level push permission. Silencing them by default surprises them. |
| **Event taxonomy at ship** | `defect_assigned`, `defect_resolved` | Only the events we actually fire today. New event types are added at the same PR that adds the call site that needs them — single source of truth, no inert entries. |
| **Storage** | `users.pushPreferences jsonb NOT NULL DEFAULT '{}'::jsonb` | One column, no extra table. Hot path is a one-row read by user id; JSONB is faster and simpler than a join. Adding event types does not migrate. |
| **Pref convention** | Missing key → fires; `false` → muted; `true` → fires | Sparse storage: the user's row only carries explicit overrides. Default behaviour survives a wiped column or an unknown event type. |
| **Critical-bypass mechanism** | Out of scope — no critical events exist today | When evacuation / safety-incident alerts arrive, bypass at the call site (omit `eventType`, or call a future `sendUrgentPush` helper). Avoid building a tiered policy engine for events we do not have. |
| **Gate location** | New required `eventType` parameter on `sendPushToUsers` and `sendPushToUserByName` | Forces every dispatch to declare what it is — self-documenting. The gate runs server-side after token lookup, before the Expo POST. |
| **Backward compat** | `eventType` is required (TypeScript-enforced) at the dispatch boundary | Two existing call sites get a one-line change. No silent-pass behaviour; the compiler catches missed sites. |

---

## 3. Architecture

```
┌─────────────────────────────┐
│ app/notification-settings   │  Settings UI: list of toggles per event
│   .tsx (new screen)         │  trpc.pushTokens.preferences (query)
└───────────────┬─────────────┘  trpc.pushTokens.updatePreference (mutation)
                │
┌───────────────▼─────────────┐
│ server/routers/index.ts     │  preferences: returns the user's full
│   pushTokens (extend)       │     preference object, with all known
│                             │     event types filled in to defaults.
│                             │  updatePreference: writes one
│                             │     {eventType, enabled} key via jsonb_set.
└───────────────┬─────────────┘
                │
┌───────────────▼─────────────┐
│ server/_core/                │  EVENT_TYPES registry (shared with client)
│   pushNotifications.ts       │  filterByPreferences(userIds, eventType)
│   (extend, gate added here)  │  sendPushToUsers(userIds, eventType, payload)
└───────────────┬─────────────┘     ↑ gate runs here, before the Expo POST
                │
┌───────────────▼─────────────┐
│ drizzle/schema.ts            │  users.pushPreferences jsonb default '{}'
│ drizzle/0012_*.sql           │  ALTER TABLE users ADD COLUMN ...
│ drizzle/migrations/          │  matching _journal.json entry
│   _journal.json              │  (the regression test added in 3f5fb92
│                              │   already enforces journal completeness)
└──────────────────────────────┘
```

---

## 4. Data shapes

### 4.1 Shared event registry

```ts
// shared/notification-events.ts (new)
export const NOTIFICATION_EVENTS = {
  defect_assigned: { label: "Defect assigned to me", category: "Defects" },
  defect_resolved: { label: "My defect was resolved", category: "Defects" },
} as const;

export type NotificationEventType = keyof typeof NOTIFICATION_EVENTS;
export const NOTIFICATION_EVENT_TYPES = Object.keys(NOTIFICATION_EVENTS) as NotificationEventType[];
```

The registry is the single place new event types are added. Clients import the same module so the settings UI is automatically in sync with the server.

### 4.2 Preferences shape

```ts
// shared/notification-events.ts (new)
export type UserPushPreferences = Partial<Record<NotificationEventType, boolean>>;

// Convention:
//   prefs[eventType] === undefined → enabled (opt-out default)
//   prefs[eventType] === false     → muted
//   prefs[eventType] === true      → enabled (explicitly set)
//
// Helpers (also in shared/notification-events.ts):
export function isEventEnabled(prefs: UserPushPreferences, eventType: NotificationEventType): boolean {
  return prefs[eventType] !== false;
}
export function fillDefaults(prefs: UserPushPreferences): Record<NotificationEventType, boolean> {
  return Object.fromEntries(
    NOTIFICATION_EVENT_TYPES.map(t => [t, isEventEnabled(prefs, t)])
  ) as Record<NotificationEventType, boolean>;
}
```

`isEventEnabled` is the gate. Every code path that needs to ask "should this fire?" calls this — the answer is centralised.

### 4.3 Schema

```ts
// drizzle/schema.ts — append to users() table
pushPreferences: jsonb('pushPreferences').$type<UserPushPreferences>().notNull().default({}),
```

---

## 5. Migration

```sql
-- drizzle/0012_user_push_preferences.sql
ALTER TABLE "users" ADD COLUMN "pushPreferences" jsonb NOT NULL DEFAULT '{}'::jsonb;
```

Plus the journal entry — emitted by `drizzle-kit generate` automatically when the migration is generated through the CLI; no hand-editing of `_journal.json` is intended.

```jsonc
// drizzle/migrations/_journal.json — appended automatically
{ "idx": 12, "version": "7", "when": 1746460000000, "tag": "0012_user_push_preferences", "breakpoints": true }
```

The migration-journal regression test (`tests/migration-journal-completeness.test.ts`, commit `3f5fb92`) already pins this contract — if a hand-written migration is added without the journal catching up, CI will fail.

---

## 6. tRPC procedures

Both live under the existing `pushTokens` sub-router (`server/routers/index.ts`).

### 6.1 `pushTokens.preferences` (query, protectedProcedure)

```ts
preferences: protectedProcedure.query(async ({ ctx }) => {
  const db = await getDb();
  const [user] = await db.select({ pushPreferences: dbUsers.pushPreferences })
    .from(dbUsers).where(eq(dbUsers.id, ctx.user.id)).limit(1);
  return fillDefaults(user?.pushPreferences ?? {});
})
```

Returns: `{ defect_assigned: true, defect_resolved: true }` (or whatever the user has muted). Fills in defaults so the client never needs to know the registry to render the screen — but it does anyway, for labels.

### 6.2 `pushTokens.updatePreference` (mutation, protectedProcedure)

```ts
updatePreference: protectedProcedure
  .input(z.object({
    eventType: z.enum(NOTIFICATION_EVENT_TYPES as [NotificationEventType, ...NotificationEventType[]]),
    enabled: z.boolean(),
  }))
  .mutation(async ({ ctx, input }) => {
    const db = await getDb();
    // Sparse storage: when re-enabling, remove the key rather than writing `true`.
    if (input.enabled) {
      await db.execute(sql`
        UPDATE users
        SET "pushPreferences" = "pushPreferences" - ${input.eventType}
        WHERE id = ${ctx.user.id}
      `);
    } else {
      await db.execute(sql`
        UPDATE users
        SET "pushPreferences" = jsonb_set("pushPreferences", ${`{${input.eventType}}`}, 'false'::jsonb, true)
        WHERE id = ${ctx.user.id}
      `);
    }
    return { success: true };
  })
```

Two reasons for sparse storage: (a) makes the column self-cleaning if a user re-enables every event, and (b) makes a server-side default flip in future visible to existing users (today opt-out; if we ever flip to opt-in, sparse rows do not block the new default).

`z.enum` with `NOTIFICATION_EVENT_TYPES` gives us a free runtime check and a TS narrow — passing an unknown event type returns 400 with a typed error.

---

## 7. Gate semantics

```ts
// server/_core/pushNotifications.ts — modified

export interface PushResult {
  attempted: number;
  accepted: number;
  rejected: number;
  deactivated: number;
  muted: number; // ← NEW: count of users filtered by preferences
}

export async function sendPushToUsers(
  userIds: number[],
  eventType: NotificationEventType,  // ← new required parameter
  payload: PushPayload,
  fetchImpl: typeof fetch = fetch,
): Promise<PushResult>
```

Internal flow:

1. If `userIds.length === 0` → return zero result.
2. Read `pushPreferences` for all `userIds` in one query (`select id, pushPreferences from users where id = any(?)`).
3. Filter to user IDs where `isEventEnabled(prefs, eventType)`. Increment `result.muted` by the count of dropped users.
4. If filtered list is empty → return result (with `muted` populated, `attempted = 0`).
5. Continue with the existing token lookup and Expo POST for the surviving user IDs.

`sendPushToUserByName` is updated to forward the `eventType` argument; it remains the convenience helper for "I have an assigned-to display name and want to push to that user."

---

## 8. UI — `app/notification-settings.tsx`

- Header: "Notifications" (matches the existing settings-screen header style).
- Loading skeleton while `trpc.pushTokens.preferences` resolves.
- Body: section per category (currently only "Defects"); each row is `{label, switch}`.
- Each `<Switch>` uses an optimistic-update pattern: tap toggles local state immediately, fires `updatePreference`, rolls back on error with a `Toast` (or whatever the existing pattern is — to be matched in the implementation plan).
- Entry: a row added to the existing settings list in `app/(tabs)/more.tsx` (or wherever the in-app settings index lives — implementation plan will confirm).

UI does not need to know about defaults — `pushTokens.preferences` returns a fully-filled object via `fillDefaults`.

---

## 9. Tests (TDD-first)

### 9.1 New: `tests/push-preferences.test.ts`

| Case | Setup | Expect |
|---|---|---|
| Default opt-out | User with empty `pushPreferences` | `sendPushToUsers([uid], 'defect_assigned', ...)` POSTs to Expo, `result.muted === 0` |
| Explicit mute | User with `{defect_assigned: false}` | No Expo POST for that user, `result.muted === 1` |
| Mute is per-event | User with `{defect_assigned: false}` | `sendPushToUsers([uid], 'defect_resolved', ...)` still fires |
| Mixed batch | 3 users, 2 muted | `result.attempted === 1`, `result.muted === 2` |
| Re-enable removes key | Mute then re-enable | DB column ends as `'{}'::jsonb`, not `'{"defect_assigned":true}'` |
| Tenant isolation | Update prefs for user A | User B's prefs unchanged in DB |
| Unknown event | `updatePreference({eventType: 'made_up', ...})` | tRPC returns input-validation error (z.enum) |
| `preferences` fills defaults | User with `{defect_resolved: false}` | Returns `{defect_assigned: true, defect_resolved: false}` (both keys present) |

### 9.2 Modified: `tests/push-notifications.test.ts`

Update existing "fires push to assignee" / "fires push to reporter on resolve" tests to pass `eventType: 'defect_assigned'` / `'defect_resolved'`. No semantic change — purely API-shape compatibility.

### 9.3 Existing regression test in play

`tests/migration-journal-completeness.test.ts` will fail if `0012_user_push_preferences` is added without a journal entry. No change needed; it's the safety net.

---

## 10. Out of scope (deliberately)

- **Critical-event bypass.** No critical events fire today. When evacuation / safety alerts arrive, decide bypass policy then.
- **Per-project muting.** YAGNI. Membership-change semantics (what happens when a user is removed from a project they had muted?) get ugly.
- **Channels / digest / quiet hours.** Feature creep on a 3-toggle screen.
- **Email preferences.** Separate system. The RFI workflow uses email; that initiative will get its own preference layer if/when needed.
- **Backfill.** New column ships empty (`'{}'::jsonb`). The opt-out default handles this — existing users see no behaviour change.

---

## 11. Files touched

| File | Change |
|---|---|
| `shared/notification-events.ts` | NEW — registry + types + helpers |
| `drizzle/schema.ts` | +1 line on `users` table |
| `drizzle/0012_user_push_preferences.sql` | NEW migration |
| `drizzle/migrations/_journal.json` | +1 entry |
| `server/_core/pushNotifications.ts` | Add gate; add `eventType` parameter; update `PushResult` |
| `server/routers/index.ts` | Two existing `sendPushToUserByName` call sites get `eventType`; add `pushTokens.preferences` and `pushTokens.updatePreference` procedures |
| `app/notification-settings.tsx` | NEW screen |
| `app/(tabs)/more.tsx` (or settings index) | One row added linking to the new screen |
| `tests/push-preferences.test.ts` | NEW |
| `tests/push-notifications.test.ts` | Update call sites with `eventType` parameter |

Estimated net: ~300 lines across ~10 files; ~150 of those are tests.

---

## 12. Acceptance

- All existing tests pass; new push-preferences tests pass.
- A mid-call mute via `pushTokens.updatePreference` is reflected on the next push attempt without server restart.
- A user can navigate to `/notification-settings`, mute "defect_resolved", and the next time someone resolves their defect they receive no push (verified manually in dev or via integration test).
- `pnpm check` and `pnpm lint` pass.
- ROADMAP.md § 3.6 row updated to ✅ DONE.
