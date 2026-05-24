# Phase 3.6 — Push notification per-event preferences — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users mute specific push event types (e.g. `defect_assigned`) without disabling push entirely, with default-on behaviour and a TypeScript-enforced event taxonomy at the dispatch boundary.

**Architecture:** A small shared registry of event types, a `pushPreferences jsonb` column on `users`, a server-side gate inside `sendPushToUsers` that drops users whose preferences disable the event, two tRPC procedures (read/write preferences), and a simple Settings screen.

**Tech Stack:** TypeScript 5.9 · tRPC v11 · Drizzle ORM (Postgres jsonb) · Vitest · Expo Router · NativeWind / React Native Switch.

**Spec:** `docs/superpowers/specs/2026-05-05-push-preferences-design.md` (commit `106c7e8`).

---

## File map

| File | Status | Responsibility |
|---|---|---|
| `shared/notification-events.ts` | NEW | Single registry of event types + types (`NotificationEventType`, `UserPushPreferences`) + helpers (`isEventEnabled`, `fillDefaults`). |
| `tests/notification-events.test.ts` | NEW | Tests for the helpers. |
| `drizzle/schema.ts` | MODIFY | Add `pushPreferences` column on `users` table (1 line). |
| `drizzle/0012_user_push_preferences.sql` | NEW | Migration: `ALTER TABLE users ADD COLUMN`. |
| `drizzle/meta/_journal.json` | MODIFY | Add idx 9 entry for the new migration. |
| `server/_core/pushNotifications.ts` | MODIFY | Add `eventType` parameter, preference-fetching, gate filter, `muted` field on `PushResult`. |
| `tests/push-notifications.test.ts` | MODIFY | Update existing call sites + fake DB to pass `eventType` and supply `pushPreferences`. |
| `tests/push-preferences.test.ts` | NEW | Unit tests for the gate behaviour. |
| `server/routers/index.ts` | MODIFY | Update two `sendPushToUserByName` call sites with `eventType`; add `pushTokens.preferences` and `pushTokens.updatePreference` procedures. |
| `tests/push-preferences-router.test.ts` | NEW | tRPC-level tests for the two new procedures. |
| `app/notification-settings.tsx` | NEW | Settings screen with per-event toggles. |
| `app/settings.tsx` | MODIFY | Add a row that links to `/notification-settings`. |
| `docs/ROADMAP.md` | MODIFY | Mark § 3.6 ✅ DONE. |

---

## Task 1: Shared notification events registry

The single source of truth for event types. Both client (Settings UI) and server (gate) import from here.

**Files:**
- Create: `shared/notification-events.ts`
- Test: `tests/notification-events.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/notification-events.test.ts`:

```ts
/**
 * Tests for the shared notification-events registry — the helpers that
 * determine whether a given event type is enabled for a user, and the
 * defaults projection used by the Settings UI.
 *
 * Convention reminder (codified in shared/notification-events.ts):
 *   prefs[eventType] === undefined  → enabled (opt-out default)
 *   prefs[eventType] === false      → muted
 *   prefs[eventType] === true       → enabled (explicitly set)
 */
import { describe, expect, it } from "vitest";
import {
  NOTIFICATION_EVENTS,
  NOTIFICATION_EVENT_TYPES,
  isEventEnabled,
  fillDefaults,
} from "../shared/notification-events";

describe("NOTIFICATION_EVENTS registry", () => {
  it("includes the two events we fire today", () => {
    // If you're adding a new event type, also add it here AND wire the
    // call site to pass it to sendPushToUsers — registry-only entries
    // are forbidden by design.
    expect(NOTIFICATION_EVENT_TYPES).toEqual(
      expect.arrayContaining(["defect_assigned", "defect_resolved"]),
    );
  });

  it("every entry has a label and a category", () => {
    for (const t of NOTIFICATION_EVENT_TYPES) {
      expect(NOTIFICATION_EVENTS[t].label).toBeTruthy();
      expect(NOTIFICATION_EVENTS[t].category).toBeTruthy();
    }
  });
});

describe("isEventEnabled", () => {
  it("returns true for an event type missing from the prefs object (opt-out default)", () => {
    expect(isEventEnabled({}, "defect_assigned")).toBe(true);
  });

  it("returns false when prefs explicitly disable the event", () => {
    expect(isEventEnabled({ defect_assigned: false }, "defect_assigned")).toBe(false);
  });

  it("returns true when prefs explicitly enable the event", () => {
    expect(isEventEnabled({ defect_assigned: true }, "defect_assigned")).toBe(true);
  });

  it("treats per-event prefs independently", () => {
    const prefs = { defect_assigned: false };
    expect(isEventEnabled(prefs, "defect_assigned")).toBe(false);
    expect(isEventEnabled(prefs, "defect_resolved")).toBe(true);
  });
});

describe("fillDefaults", () => {
  it("returns every known event type, defaulting missing ones to true", () => {
    const result = fillDefaults({});
    for (const t of NOTIFICATION_EVENT_TYPES) {
      expect(result[t]).toBe(true);
    }
  });

  it("preserves explicit false entries", () => {
    const result = fillDefaults({ defect_assigned: false });
    expect(result.defect_assigned).toBe(false);
    expect(result.defect_resolved).toBe(true);
  });

  it("preserves explicit true entries", () => {
    const result = fillDefaults({ defect_assigned: true });
    expect(result.defect_assigned).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/notification-events.test.ts`
Expected: FAIL — module `../shared/notification-events` does not exist.

- [ ] **Step 3: Create the module**

Create `shared/notification-events.ts`:

```ts
/**
 * Single source of truth for push notification event types.
 *
 * Convention:
 *   prefs[eventType] === undefined  → enabled (opt-out default)
 *   prefs[eventType] === false      → muted
 *   prefs[eventType] === true       → enabled (explicitly set)
 *
 * Sparse storage: when a user re-enables a previously-muted event, the
 * server deletes the key rather than writing `true`. This keeps the
 * column self-cleaning and means a future global-default flip (e.g.
 * opt-in) reaches sparse rows without a backfill.
 *
 * Adding a new event type:
 *   1. Append to NOTIFICATION_EVENTS below.
 *   2. Pass that string literal to sendPushToUsers at the call site.
 *   3. The Settings UI picks it up automatically via fillDefaults.
 *   4. The server gate already handles unknown→muted gracefully via z.enum.
 *
 * The TypeScript boundary is the safety net: an event type that is not
 * in the registry cannot be passed to sendPushToUsers without a cast.
 */

export const NOTIFICATION_EVENTS = {
  defect_assigned: { label: "Defect assigned to me", category: "Defects" },
  defect_resolved: { label: "My defect was resolved", category: "Defects" },
} as const;

export type NotificationEventType = keyof typeof NOTIFICATION_EVENTS;

export const NOTIFICATION_EVENT_TYPES = Object.keys(NOTIFICATION_EVENTS) as NotificationEventType[];

export type UserPushPreferences = Partial<Record<NotificationEventType, boolean>>;

/**
 * Returns true when this event should fire for a user with the given
 * preferences. Missing keys default to true (opt-out).
 */
export function isEventEnabled(
  prefs: UserPushPreferences | null | undefined,
  eventType: NotificationEventType,
): boolean {
  if (!prefs) return true;
  return prefs[eventType] !== false;
}

/**
 * Project a sparse preferences object onto the full registry, filling
 * defaults for missing keys. Used by the Settings UI so the client
 * doesn't need to know about defaults.
 */
export function fillDefaults(
  prefs: UserPushPreferences | null | undefined,
): Record<NotificationEventType, boolean> {
  const out = {} as Record<NotificationEventType, boolean>;
  for (const t of NOTIFICATION_EVENT_TYPES) {
    out[t] = isEventEnabled(prefs, t);
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/notification-events.test.ts`
Expected: PASS — all 9 tests green.

- [ ] **Step 5: Commit**

```bash
git add shared/notification-events.ts tests/notification-events.test.ts
git commit -m "feat(notifications): shared event-type registry + isEventEnabled/fillDefaults helpers

Registry seeds the two events we fire today (defect_assigned,
defect_resolved). Sparse-storage convention: missing key → enabled
(opt-out default), explicit false → muted, explicit true → enabled.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Add `pushPreferences` column to users table

DB schema, migration, journal entry. The migration-journal regression test catches missed journal entries automatically.

**Files:**
- Modify: `drizzle/schema.ts` (the `users` table definition, around line 35-54)
- Create: `drizzle/0012_user_push_preferences.sql`
- Modify: `drizzle/meta/_journal.json`

- [ ] **Step 1: Add the column to the Drizzle schema**

Edit `drizzle/schema.ts`. Find the `users` table (line ~35) and add the column right before `createdAt`:

```ts
// (existing fields above)
  totpSecret:     varchar('totpSecret', { length: 64 }),
  totpVerifiedAt: timestamp('totpVerifiedAt'),
  // Sparse JSONB map of event-type → enabled. Missing keys default to
  // enabled (opt-out). See shared/notification-events.ts for the
  // canonical convention; the gate in server/_core/pushNotifications.ts
  // is the only consumer.
  pushPreferences: jsonb('pushPreferences').$type<import('../shared/notification-events').UserPushPreferences>().notNull().default({}),
  createdAt:    timestamp('createdAt').defaultNow().notNull(),
```

Also ensure `jsonb` is imported at the top of the file. It almost certainly already is (the audit_log uses it), but verify with:

Run: `grep -n "jsonb" drizzle/schema.ts | head -3`
Expected: shows existing `jsonb` import / usage. If not present, add `jsonb` to the imports from `drizzle-orm/pg-core`.

- [ ] **Step 2: Write the migration**

Create `drizzle/0012_user_push_preferences.sql`:

```sql
-- ============================================================================
-- 0012_user_push_preferences.sql
-- ============================================================================
-- Phase 3.6 of docs/ROADMAP.md — per-event push notification preferences.
-- Adds a sparse JSONB column on users; missing keys default to enabled
-- via the convention codified in shared/notification-events.ts. The
-- column ships with default '{}'::jsonb so existing rows see no
-- behaviour change (everything still fires).
-- ============================================================================

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "pushPreferences" jsonb NOT NULL DEFAULT '{}'::jsonb;
```

- [ ] **Step 3: Add the journal entry**

Edit `drizzle/meta/_journal.json`. Append to `entries` (after the existing `idx: 8` entry for `0011_rfis_workflow`):

```jsonc
    {
      "idx": 9,
      "version": "7",
      "when": 1778001000000,
      "tag": "0012_user_push_preferences",
      "breakpoints": true
    }
```

The closing bracket structure must remain:

```jsonc
    {
      "idx": 8,
      "version": "7",
      "when": 1778000000000,
      "tag": "0011_rfis_workflow",
      "breakpoints": true
    },
    {
      "idx": 9,
      "version": "7",
      "when": 1778001000000,
      "tag": "0012_user_push_preferences",
      "breakpoints": true
    }
  ]
}
```

- [ ] **Step 4: Run the journal-completeness regression test**

Run: `pnpm test -- tests/migration-journal-completeness.test.ts`
Expected: PASS — all 4 tests green (file registered, file exists, idx contiguous 0-9, timestamps monotonic).

- [ ] **Step 5: Run typecheck to verify the schema change compiles**

Run: `pnpm check`
Expected: PASS — no new TS errors.

- [ ] **Step 6: Commit**

```bash
git add drizzle/schema.ts drizzle/0012_user_push_preferences.sql drizzle/meta/_journal.json
git commit -m "feat(notifications): users.pushPreferences jsonb column + 0012 migration

Sparse map of event-type → bool. Defaults to '{}'::jsonb so existing
users see no behaviour change. Journal entry added; the regression
test from 3f5fb92 enforces it.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Add the gate to `sendPushToUsers`

Extend `server/_core/pushNotifications.ts` with the preference filter. This task changes the existing API surface (adds a required `eventType` parameter), so we update the existing test file to pass the parameter and add new tests for the gate.

**Files:**
- Modify: `server/_core/pushNotifications.ts`
- Modify: `tests/push-notifications.test.ts`
- Create: `tests/push-preferences.test.ts`

- [ ] **Step 1: Extend the existing fake DB to know about pushPreferences**

The existing `tests/push-notifications.test.ts` mocks `getDb` with a hand-rolled `select().from().where()` chain. We need it to return `pushPreferences` when the procedure queries `users` for prefs.

Edit `tests/push-notifications.test.ts`. Replace the `users` field of `DbState` and the `state.users` mock-row shape:

```ts
interface DbState {
  tokens: FakeRow[];
  users: { id: number; name: string; pushPreferences?: Record<string, boolean> }[];
  deactivatedIds: number[];
  whereCalls: { table: unknown; condition: unknown }[];
}
```

Now, the gate's query selects `id, pushPreferences` from users where `userId IN (...)`. The fake's existing `users` branch returns the whole `state.users` array. That continues to work — the server filters in JS.

- [ ] **Step 2: Update existing test calls to pass the new `eventType` parameter**

In `tests/push-notifications.test.ts`, every `sendPushToUsers([…], { title, body }, fetchSpy)` call signature changes to `sendPushToUsers([…], 'defect_assigned', { title, body }, fetchSpy)`.

Replace each occurrence — there are 9 in `describe("sendPushToUsers", …)`:

```ts
const result = await sendPushToUsers([], 'defect_assigned', { title: "x", body: "y" }, fetchSpy as any);
// ...
const result = await sendPushToUsers([42], 'defect_assigned', { title: "x", body: "y" }, fetchSpy as any);
// ...etc
```

Similarly for `sendPushToUserByName` calls (4 in `describe("sendPushToUserByName", …)`):

```ts
const result = await sendPushToUserByName("   ", 'defect_assigned', { title: "x", body: "y" }, fetchSpy as any);
// ...
const result = await sendPushToUserByName("Site team", 'defect_assigned', { title: "x", body: "y" }, fetchSpy as any);
// ...etc
```

Also update the `expect(result).toEqual(...)` shapes in tests that pass an empty userIds list, an empty token list, or a SELECT failure — the `PushResult` now includes `muted: 0`:

```ts
expect(result).toEqual({ attempted: 0, accepted: 0, rejected: 0, deactivated: 0, muted: 0 });
```

- [ ] **Step 3: Run modified test to confirm it now fails (signature mismatch)**

Run: `pnpm test -- tests/push-notifications.test.ts`
Expected: FAIL — `Argument of type 'string' is not assignable to parameter of type 'PushPayload'` (TypeScript) or runtime `Cannot read properties of undefined (reading 'title')` (runtime if TS errors are demoted).

- [ ] **Step 4: Update `pushNotifications.ts` signature and add the gate**

Edit `server/_core/pushNotifications.ts`. Replace the file with:

```ts
/**
 * Push notification dispatch via the Expo Push API.
 *
 * Why this exists: `lib/use-notifications.ts` registers Expo push tokens
 * with `pushTokens.register` (so they land in the `push_tokens` table),
 * but before this module nothing on the server ever READ those tokens
 * to send a notification. Tokens accumulated forever, unused.
 *
 * This module:
 *   1. Filters userIds by per-event push preferences (Phase 3.6).
 *   2. Looks up active push tokens for the surviving user IDs.
 *   3. POSTs them to https://exp.host/--/api/v2/push/send (Expo's free
 *      relay to APNs/FCM/web push).
 *   4. Marks tokens that the relay reports as DeviceNotRegistered as
 *      inactive, so we don't keep retrying dead devices.
 *
 * The Expo Push API requires no auth — Expo identifies the project from
 * the token itself. See https://docs.expo.dev/push-notifications/sending-notifications/
 *
 * All failures are non-fatal: we log and return a result object. DB
 * lookup failures (pool timeout, transient errors) must never reject —
 * the caller's mutation may already have committed (e.g. defect status).
 */
import { eq, inArray } from "drizzle-orm";
import { pushTokens as dbPushTokens, users as dbUsers, type PushToken } from "../../drizzle/schema";
import {
  isEventEnabled,
  type NotificationEventType,
  type UserPushPreferences,
} from "../../shared/notification-events";
import { getDb } from "../db";

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface PushResult {
  attempted: number;
  accepted: number;
  rejected: number;
  deactivated: number;
  /** Number of users dropped by the per-event preference gate (Phase 3.6). */
  muted: number;
}

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface ExpoTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

interface ExpoResponse {
  data?: ExpoTicket | ExpoTicket[];
  errors?: { code: string; message: string }[];
}

function isExpoToken(token: string): boolean {
  return /^Expo(?:nent)?PushToken\[[^\]]+\]$/.test(token);
}

/**
 * Drop user IDs whose pushPreferences disable this event type.
 * Reads users.pushPreferences in one query; never throws (a DB failure
 * here is logged and treated as "everyone allowed" so a transient
 * error doesn't accidentally silence the world).
 */
async function filterByPreferences(
  userIds: number[],
  eventType: NotificationEventType,
): Promise<{ allowed: number[]; muted: number }> {
  if (userIds.length === 0) return { allowed: [], muted: 0 };
  const db = await getDb();
  if (!db) return { allowed: userIds, muted: 0 };

  let rows: { id: number; pushPreferences: UserPushPreferences | null }[];
  try {
    rows = await db.select({
      id: dbUsers.id,
      pushPreferences: dbUsers.pushPreferences,
    }).from(dbUsers).where(inArray(dbUsers.id, userIds));
  } catch (error) {
    console.warn("[Push] Failed to read pushPreferences; allowing all:", error);
    return { allowed: userIds, muted: 0 };
  }

  // Index by id so users without a row (shouldn't happen, but be safe)
  // are treated as opt-out enabled.
  const prefsById = new Map(rows.map(r => [r.id, r.pushPreferences ?? {}]));
  const allowed: number[] = [];
  let muted = 0;
  for (const id of userIds) {
    const prefs = prefsById.get(id) ?? {};
    if (isEventEnabled(prefs, eventType)) {
      allowed.push(id);
    } else {
      muted++;
    }
  }
  return { allowed, muted };
}

/**
 * Send a push notification to every active token belonging to the given
 * user IDs, gated by per-event preferences. Returns a summary result;
 * never throws on DB or Expo failures (logs them and continues).
 */
export async function sendPushToUsers(
  userIds: number[],
  eventType: NotificationEventType,
  payload: PushPayload,
  fetchImpl: typeof fetch = fetch,
): Promise<PushResult> {
  const result: PushResult = { attempted: 0, accepted: 0, rejected: 0, deactivated: 0, muted: 0 };
  if (userIds.length === 0) return result;

  const { allowed, muted } = await filterByPreferences(userIds, eventType);
  result.muted = muted;
  if (allowed.length === 0) return result;

  const db = await getDb();
  if (!db) {
    console.warn("[Push] Database unavailable; cannot look up push tokens");
    return result;
  }

  let tokens: PushToken[];
  try {
    tokens = await db.select().from(dbPushTokens)
      .where(inArray(dbPushTokens.userId, allowed));
  } catch (error) {
    console.warn("[Push] Failed to look up push tokens:", error);
    return result;
  }

  const activeValid = tokens.filter(t => t.active && isExpoToken(t.token));
  if (activeValid.length === 0) return result;

  result.attempted = activeValid.length;

  const messages = activeValid.map(t => ({
    to: t.token,
    title: payload.title,
    body: payload.body,
    data: payload.data,
    sound: "default" as const,
  }));

  try {
    const response = await fetchImpl(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        accept: "application/json",
        "accept-encoding": "gzip, deflate",
        "content-type": "application/json",
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      console.warn(`[Push] Expo returned HTTP ${response.status}`);
      result.rejected = result.attempted;
      return result;
    }

    const json = (await response.json()) as ExpoResponse;
    const tickets = Array.isArray(json.data) ? json.data : json.data ? [json.data] : [];

    const tokensToDeactivate: number[] = [];
    tickets.forEach((ticket, idx) => {
      if (ticket.status === "ok") {
        result.accepted++;
      } else {
        result.rejected++;
        if (ticket.details?.error === "DeviceNotRegistered") {
          tokensToDeactivate.push(activeValid[idx].id);
        }
      }
    });

    if (tokensToDeactivate.length > 0) {
      try {
        await db.update(dbPushTokens)
          .set({ active: false, updatedAt: new Date() })
          .where(inArray(dbPushTokens.id, tokensToDeactivate));
        result.deactivated = tokensToDeactivate.length;
      } catch (error) {
        console.warn("[Push] Failed to deactivate dead push tokens:", error);
      }
    }

    return result;
  } catch (error) {
    console.warn("[Push] Failed to call Expo Push API:", error);
    result.rejected = result.attempted;
    return result;
  }
}

/**
 * Convenience: notify the user whose `name` matches an `assignedTo`
 * string on a defect/permit/RFI/etc. Resolves the name to user IDs and
 * forwards to `sendPushToUsers` (which applies the preference gate).
 *
 * If no exact-name match exists, this is a no-op — we never guess.
 */
export async function sendPushToUserByName(
  displayName: string,
  eventType: NotificationEventType,
  payload: PushPayload,
  fetchImpl: typeof fetch = fetch,
): Promise<PushResult> {
  const empty: PushResult = { attempted: 0, accepted: 0, rejected: 0, deactivated: 0, muted: 0 };
  const trimmed = displayName.trim();
  if (!trimmed) return empty;

  const db = await getDb();
  if (!db) return empty;

  let matches: { id: number }[];
  try {
    matches = await db.select({ id: dbUsers.id }).from(dbUsers).where(eq(dbUsers.name, trimmed));
  } catch (error) {
    console.warn("[Push] Failed to resolve user by display name:", error);
    return empty;
  }
  if (matches.length === 0) return empty;

  return sendPushToUsers(matches.map(u => u.id), eventType, payload, fetchImpl);
}
```

- [ ] **Step 5: Run the existing push tests against the new signature**

Run: `pnpm test -- tests/push-notifications.test.ts`
Expected: PASS — all existing behaviours preserved with the new parameter (the fake DB returns the whole `state.users` array including any `pushPreferences` field, so users without prefs default to enabled).

- [ ] **Step 6: Write the new gate-specific test file**

Create `tests/push-preferences.test.ts`:

```ts
/**
 * Tests for the Phase 3.6 push-notification preference gate inside
 * `sendPushToUsers`. The gate filters userIds by users.pushPreferences
 * BEFORE looking up push tokens or POSTing to Expo, so a muted user
 * causes no Expo traffic at all.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  pushTokens as dbPushTokens,
  users as dbUsers,
} from "../drizzle/schema";

interface FakeToken {
  id: number;
  userId: number;
  token: string;
  platform: "ios" | "android" | "web";
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface FakeUser {
  id: number;
  name?: string;
  pushPreferences?: Record<string, boolean>;
}

const state = {
  tokens: [] as FakeToken[],
  users: [] as FakeUser[],
};

function makeDb() {
  return {
    select(_proj?: unknown) {
      return {
        from(table: unknown) {
          return {
            where(_cond: unknown) {
              if (table === dbPushTokens) return Promise.resolve(state.tokens);
              if (table === dbUsers) {
                return Promise.resolve(
                  state.users.map(u => ({
                    id: u.id,
                    name: u.name,
                    pushPreferences: u.pushPreferences ?? {},
                  })),
                );
              }
              return Promise.resolve([]);
            },
          };
        },
      };
    },
    update(_t: unknown) {
      return { set(_v: unknown) { return { where(_c: unknown) { return Promise.resolve(); } }; } };
    },
  };
}

const getDbMock = vi.fn(async () => makeDb());
vi.mock("../server/db", () => ({ getDb: () => getDbMock() }));

const { sendPushToUsers } = await import("../server/_core/pushNotifications");

beforeEach(() => {
  state.tokens = [];
  state.users = [];
  getDbMock.mockImplementation(async () => makeDb());
});
afterEach(() => vi.clearAllMocks());

function expoToken(id: number, userId: number): FakeToken {
  return {
    id, userId, token: `ExponentPushToken[t${id}]`, platform: "ios",
    active: true, createdAt: new Date(), updatedAt: new Date(),
  };
}

describe("sendPushToUsers — preference gate", () => {
  it("fires for a user with empty pushPreferences (opt-out default)", async () => {
    state.users = [{ id: 1, pushPreferences: {} }];
    state.tokens = [expoToken(10, 1)];
    const fetchSpy = vi.fn(async () => new Response(
      JSON.stringify({ data: [{ status: "ok", id: "x" }] }),
      { status: 200 },
    ));
    const result = await sendPushToUsers([1], "defect_assigned", { title: "t", body: "b" }, fetchSpy as any);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ attempted: 1, accepted: 1, muted: 0 });
  });

  it("filters out a user whose pushPreferences disable the event", async () => {
    state.users = [{ id: 1, pushPreferences: { defect_assigned: false } }];
    state.tokens = [expoToken(10, 1)];
    const fetchSpy = vi.fn();
    const result = await sendPushToUsers([1], "defect_assigned", { title: "t", body: "b" }, fetchSpy as any);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result).toMatchObject({ attempted: 0, muted: 1 });
  });

  it("treats per-event prefs independently — muting one does not mute another", async () => {
    state.users = [{ id: 1, pushPreferences: { defect_assigned: false } }];
    state.tokens = [expoToken(10, 1)];
    const fetchSpy = vi.fn(async () => new Response(
      JSON.stringify({ data: [{ status: "ok", id: "x" }] }),
      { status: 200 },
    ));
    const result = await sendPushToUsers([1], "defect_resolved", { title: "t", body: "b" }, fetchSpy as any);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ attempted: 1, muted: 0 });
  });

  it("filters a mixed batch: 1 muted, 2 not", async () => {
    state.users = [
      { id: 1, pushPreferences: { defect_assigned: false } }, // muted
      { id: 2, pushPreferences: {} },                          // default → fires
      { id: 3, pushPreferences: { defect_assigned: true } },   // explicit → fires
    ];
    state.tokens = [expoToken(10, 2), expoToken(11, 3)];
    const fetchSpy = vi.fn(async () => new Response(
      JSON.stringify({ data: [{ status: "ok", id: "a" }, { status: "ok", id: "b" }] }),
      { status: 200 },
    ));
    const result = await sendPushToUsers([1, 2, 3], "defect_assigned", { title: "t", body: "b" }, fetchSpy as any);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const sent = JSON.parse((fetchSpy.mock.calls[0] as any)[1].body);
    expect(sent).toHaveLength(2);
    expect(result).toMatchObject({ attempted: 2, accepted: 2, muted: 1 });
  });

  it("does not POST to Expo at all when every userId is muted", async () => {
    state.users = [
      { id: 1, pushPreferences: { defect_assigned: false } },
      { id: 2, pushPreferences: { defect_assigned: false } },
    ];
    state.tokens = [expoToken(10, 1), expoToken(11, 2)];
    const fetchSpy = vi.fn();
    const result = await sendPushToUsers([1, 2], "defect_assigned", { title: "t", body: "b" }, fetchSpy as any);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result).toMatchObject({ attempted: 0, muted: 2 });
  });

  it("treats a user without a row (empty users SELECT) as opt-out enabled", async () => {
    // Edge case: filterByPreferences sees no row for id=1 and falls back
    // to default-enabled. The push then proceeds as if no prefs existed.
    state.users = [];
    state.tokens = [expoToken(10, 1)];
    const fetchSpy = vi.fn(async () => new Response(
      JSON.stringify({ data: [{ status: "ok", id: "x" }] }),
      { status: 200 },
    ));
    const result = await sendPushToUsers([1], "defect_assigned", { title: "t", body: "b" }, fetchSpy as any);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ attempted: 1, muted: 0 });
  });
});
```

- [ ] **Step 7: Run the new test file**

Run: `pnpm test -- tests/push-preferences.test.ts`
Expected: PASS — all 6 tests green.

- [ ] **Step 8: Run the entire push test suite together to check for regressions**

Run: `pnpm test -- tests/push`
Expected: PASS — both `push-notifications.test.ts` and `push-preferences.test.ts` pass.

- [ ] **Step 9: Commit**

```bash
git add server/_core/pushNotifications.ts tests/push-notifications.test.ts tests/push-preferences.test.ts
git commit -m "feat(notifications): per-event preference gate in sendPushToUsers

Required eventType parameter at the dispatch boundary; gate filters
userIds by users.pushPreferences before token lookup so a muted user
generates zero Expo traffic. New PushResult.muted counts filtered users.

DB read failure → fail open (everyone allowed) so a transient pool
timeout doesn't accidentally silence the world.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Update existing call sites (defects.create, defects.updateStatus)

The two existing `sendPushToUserByName` calls in `server/routers/index.ts` need the new `eventType` parameter. Compiler will flag any miss.

**Files:**
- Modify: `server/routers/index.ts` (around lines 510-525 and 610-625)

- [ ] **Step 1: Run typecheck to confirm the compiler flags the existing calls**

Run: `pnpm check`
Expected: FAIL — two errors at the existing `sendPushToUserByName` call sites: "Expected 4 arguments, but got 3" or similar (the new required `eventType` parameter is missing).

- [ ] **Step 2: Update `defects.create` push call**

Edit `server/routers/index.ts`. Find the call around line 514 inside `defects.create`:

```ts
              await sendPushToUserByName(assigneeForPush, {
                title: `New ${input.priority} defect assigned`,
                body: input.title,
                data: { route: 'defects', priority: input.priority },
              });
```

Replace with:

```ts
              await sendPushToUserByName(assigneeForPush, 'defect_assigned', {
                title: `New ${input.priority} defect assigned`,
                body: input.title,
                data: { route: 'defects', priority: input.priority },
              });
```

- [ ] **Step 3: Update `defects.updateStatus` push call**

In the same file, find the call around line 615 inside `defects.updateStatus`:

```ts
              await sendPushToUserByName(previous.reportedBy, {
                title: 'Defect resolved',
                body: previous.title,
                data: { route: 'defects', defectId: previous.id },
              });
```

Replace with:

```ts
              await sendPushToUserByName(previous.reportedBy, 'defect_resolved', {
                title: 'Defect resolved',
                body: previous.title,
                data: { route: 'defects', defectId: previous.id },
              });
```

- [ ] **Step 4: Run typecheck again**

Run: `pnpm check`
Expected: PASS — no errors.

- [ ] **Step 5: Run the full unit suite to confirm no regression**

Run: `pnpm test`
Expected: PASS — all tests green (count should match the previous baseline plus the new tests from Tasks 1 + 3).

- [ ] **Step 6: Commit**

```bash
git add server/routers/index.ts
git commit -m "feat(notifications): tag existing defect push calls with event types

defects.create → 'defect_assigned'; defects.updateStatus(resolved) →
'defect_resolved'. Now subject to the per-event preference gate.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: tRPC procedures for read/write preferences

Add `pushTokens.preferences` (query) and `pushTokens.updatePreference` (mutation) to the existing pushTokens sub-router. Sparse storage: re-enabling deletes the key.

**Files:**
- Modify: `server/routers/index.ts` (around lines 1497-1521, the `pushTokens` block)
- Create: `tests/push-preferences-router.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/push-preferences-router.test.ts`:

```ts
/**
 * Tests for the tRPC procedures behind the per-event push preferences:
 * pushTokens.preferences (query) and pushTokens.updatePreference (mutation).
 *
 * The test exercises the procedures directly via the appRouter caller
 * pattern used elsewhere in this repo — same as tests/auth-totp-enroll.test.ts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "../server/routers";
import {
  NOTIFICATION_EVENT_TYPES,
} from "../shared/notification-events";

interface FakeUserRow {
  id: number;
  name: string;
  email: string;
  role: "admin" | "user";
  pushPreferences: Record<string, boolean>;
}

const state = {
  users: [] as FakeUserRow[],
  // Capture the most recent UPDATE statement's SQL fragment so we can
  // assert the sparse-storage behaviour (key deletion vs. set false).
  lastExecuteSql: null as string | null,
};

function makeDb() {
  return {
    select(proj?: unknown) {
      return {
        from(_table: unknown) {
          return {
            where(_cond: unknown) {
              return {
                limit(_n: number) {
                  return Promise.resolve(state.users.map(u => {
                    if (proj && typeof proj === "object" && "pushPreferences" in proj) {
                      return { pushPreferences: u.pushPreferences };
                    }
                    return u;
                  }));
                },
              };
            },
          };
        },
      };
    },
    execute(query: any) {
      // Drizzle sql`…` produces an object with .queryChunks / toString —
      // we just stringify and snapshot it.
      state.lastExecuteSql = String(query);
      return Promise.resolve();
    },
  };
}

vi.mock("../server/db", () => ({ getDb: async () => makeDb() }));

function makeCtx(userId: number) {
  return {
    user: { id: userId, role: "user" as const, openId: `oid-${userId}` },
    req: undefined,
    res: undefined,
  };
}

beforeEach(() => {
  state.users = [
    { id: 1, name: "Alice", email: "a@x.com", role: "user", pushPreferences: {} },
  ];
  state.lastExecuteSql = null;
});
afterEach(() => vi.clearAllMocks());

describe("pushTokens.preferences (query)", () => {
  it("returns every known event type defaulted to true for an empty prefs row", async () => {
    const caller = appRouter.createCaller(makeCtx(1) as any);
    const prefs = await caller.pushTokens.preferences();
    for (const t of NOTIFICATION_EVENT_TYPES) {
      expect(prefs[t]).toBe(true);
    }
  });

  it("preserves explicit false entries from the row", async () => {
    state.users[0].pushPreferences = { defect_assigned: false };
    const caller = appRouter.createCaller(makeCtx(1) as any);
    const prefs = await caller.pushTokens.preferences();
    expect(prefs.defect_assigned).toBe(false);
    expect(prefs.defect_resolved).toBe(true);
  });
});

describe("pushTokens.updatePreference (mutation)", () => {
  it("rejects an unknown event type via z.enum", async () => {
    const caller = appRouter.createCaller(makeCtx(1) as any);
    await expect(
      caller.pushTokens.updatePreference({
        eventType: "made_up_event" as any,
        enabled: false,
      }),
    ).rejects.toThrow();
  });

  it("issues a sparse UPDATE that removes the key when enabling", async () => {
    const caller = appRouter.createCaller(makeCtx(1) as any);
    await caller.pushTokens.updatePreference({
      eventType: "defect_assigned",
      enabled: true,
    });
    expect(state.lastExecuteSql).toBeTruthy();
    // Sparse: the SQL must use the JSONB `-` (subtraction) operator to
    // delete the key, NOT jsonb_set with 'true'.
    expect(state.lastExecuteSql).toMatch(/-/);
    expect(state.lastExecuteSql).not.toMatch(/jsonb_set/);
  });

  it("issues a jsonb_set UPDATE that writes false when muting", async () => {
    const caller = appRouter.createCaller(makeCtx(1) as any);
    await caller.pushTokens.updatePreference({
      eventType: "defect_assigned",
      enabled: false,
    });
    expect(state.lastExecuteSql).toBeTruthy();
    expect(state.lastExecuteSql).toMatch(/jsonb_set/);
    expect(state.lastExecuteSql).toMatch(/false/);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `pnpm test -- tests/push-preferences-router.test.ts`
Expected: FAIL — `pushTokens.preferences is not a function` (procedures don't exist yet).

- [ ] **Step 3: Add the procedures to the pushTokens router**

Edit `server/routers/index.ts`. Find the `pushTokens: router({` block (around line 1476). Just below the existing `register: protectedProcedure...` mutation and BEFORE the closing `}),` of the `pushTokens` router, add:

```ts
    /**
     * Read the authenticated user's push preferences with defaults
     * filled in for every known event type. The Settings UI uses this
     * to render a complete switch list without needing the registry
     * client-side (although the client imports the registry anyway for
     * labels). Convention codified in shared/notification-events.ts.
     */
    preferences: protectedProcedure
      .query(async ({ ctx }) => {
        const db = await getDb();
        if (!db) return fillDefaults({});
        const rows = await db.select({ pushPreferences: dbUsers.pushPreferences })
          .from(dbUsers)
          .where(eq(dbUsers.id, ctx.user.id))
          .limit(1);
        return fillDefaults(rows[0]?.pushPreferences ?? {});
      }),

    /**
     * Update a single per-event preference for the authenticated user.
     *
     * Sparse storage: re-enabling deletes the key (JSONB `-` operator)
     * rather than writing `true`. This keeps the column self-cleaning
     * and means a future global-default flip reaches sparse rows
     * without a backfill.
     *
     * z.enum validates the event type at the boundary — passing a
     * string not in NOTIFICATION_EVENT_TYPES returns a 400 with a
     * typed validation error.
     */
    updatePreference: protectedProcedure
      .input(z.object({
        eventType: z.enum(NOTIFICATION_EVENT_TYPES as [NotificationEventType, ...NotificationEventType[]]),
        enabled: z.boolean(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database unavailable');
        if (input.enabled) {
          // Remove the key: opt-out default takes effect.
          await db.execute(sql`
            UPDATE users
            SET "pushPreferences" = "pushPreferences" - ${input.eventType}
            WHERE id = ${ctx.user.id}
          `);
        } else {
          // Set explicit false; jsonb_set with create_missing=true
          // creates the key if absent.
          await db.execute(sql`
            UPDATE users
            SET "pushPreferences" = jsonb_set(
              "pushPreferences",
              ${`{${input.eventType}}`},
              'false'::jsonb,
              true
            )
            WHERE id = ${ctx.user.id}
          `);
        }
        return { success: true };
      }),
```

- [ ] **Step 4: Add the imports at the top of `server/routers/index.ts`**

Find the imports block at the top of the file. Add (or extend existing imports if already partially imported):

```ts
import { sql } from 'drizzle-orm';
import { users as dbUsers } from '../../drizzle/schema';
import {
  fillDefaults,
  NOTIFICATION_EVENT_TYPES,
  type NotificationEventType,
} from '../../shared/notification-events';
```

Verify with:

Run: `grep -n "^import" server/routers/index.ts | head -20`
Expected: shows the new imports added.

If `dbUsers` (or `users`) is already imported under a different alias, reuse the existing alias rather than duplicating.

If `sql` is already imported from `drizzle-orm`, merge into the existing import.

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm test -- tests/push-preferences-router.test.ts`
Expected: PASS — all 5 tests green.

- [ ] **Step 6: Run typecheck and full unit suite**

Run: `pnpm check && pnpm test`
Expected: PASS — no TypeScript errors; full suite green.

- [ ] **Step 7: Commit**

```bash
git add server/routers/index.ts tests/push-preferences-router.test.ts
git commit -m "feat(notifications): pushTokens.preferences and updatePreference tRPC procedures

Read fills defaults so the client doesn't need the registry to render.
Mutation uses sparse storage: enable removes the key via JSONB -, mute
writes false via jsonb_set. z.enum validates event types at the
boundary — unknown types return 400.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Settings UI — `/notification-settings` screen

Per-event toggles backed by the new tRPC procedures. Optimistic update on toggle, rollback on error.

**Files:**
- Create: `app/notification-settings.tsx`
- Modify: `app/settings.tsx`

- [ ] **Step 1: Create the new screen**

Create `app/notification-settings.tsx`:

```tsx
import React, { useMemo, useState } from 'react';
import {
  ScrollView, View, Text, StyleSheet, Switch, ActivityIndicator, Alert,
} from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { trpc } from '@/lib/trpc';
import {
  NOTIFICATION_EVENTS,
  NOTIFICATION_EVENT_TYPES,
  type NotificationEventType,
} from '@shared/notification-events';

/**
 * Per-event push notification preferences. Default is opt-out (every
 * event fires unless muted). Toggling here writes a sparse key into
 * users.pushPreferences via tRPC; the dispatch gate consults the
 * same column on every push attempt.
 */
export default function NotificationSettingsScreen() {
  const colors = useColors();
  const utils = trpc.useUtils();
  const prefsQuery = trpc.pushTokens.preferences.useQuery();
  const updateMutation = trpc.pushTokens.updatePreference.useMutation({
    onSuccess: () => utils.pushTokens.preferences.invalidate(),
    onError: (err) => Alert.alert('Could not update preference', err.message),
  });

  // Local state mirrors the server query for instant feedback. We
  // overlay it on the latest server-fetched prefs so server-side
  // changes from another device still come through.
  const [overrides, setOverrides] = useState<Partial<Record<NotificationEventType, boolean>>>({});

  const merged = useMemo(() => {
    const base = prefsQuery.data ?? {} as Record<NotificationEventType, boolean>;
    return { ...base, ...overrides } as Record<NotificationEventType, boolean>;
  }, [prefsQuery.data, overrides]);

  // Group event types by category for visual grouping. Same flat data
  // shape — categories are presentational only.
  const grouped = useMemo(() => {
    const m = new Map<string, NotificationEventType[]>();
    for (const t of NOTIFICATION_EVENT_TYPES) {
      const cat = NOTIFICATION_EVENTS[t].category;
      if (!m.has(cat)) m.set(cat, []);
      m.get(cat)!.push(t);
    }
    return Array.from(m.entries());
  }, []);

  const onToggle = (eventType: NotificationEventType, next: boolean) => {
    setOverrides(o => ({ ...o, [eventType]: next }));
    updateMutation.mutate(
      { eventType, enabled: next },
      {
        onError: () => {
          // Rollback the optimistic local override.
          setOverrides(o => {
            const copy = { ...o };
            delete copy[eventType];
            return copy;
          });
        },
      },
    );
  };

  if (prefsQuery.isLoading) {
    return (
      <ScreenContainer>
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  if (prefsQuery.isError) {
    return (
      <ScreenContainer>
        <Text style={[styles.error, { color: colors.foreground }]}>
          Could not load preferences: {prefsQuery.error.message}
        </Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={[styles.title, { color: colors.foreground }]}>Notifications</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>
          Choose which push notifications to receive. Disabling an event silences it on every device.
        </Text>

        {grouped.map(([category, events]) => (
          <View key={category} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.muted }]}>
              {category.toUpperCase()}
            </Text>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {events.map((t, i) => (
                <View key={t}>
                  <View style={styles.row}>
                    <Text style={[styles.rowLabel, { color: colors.foreground }]}>
                      {NOTIFICATION_EVENTS[t].label}
                    </Text>
                    <Switch
                      value={merged[t]}
                      onValueChange={(next) => onToggle(t, next)}
                      trackColor={{ true: colors.primary }}
                    />
                  </View>
                  {i < events.length - 1 && (
                    <View style={[styles.divider, { backgroundColor: colors.border }]} />
                  )}
                </View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 14, marginBottom: 24 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 12, fontWeight: '600', letterSpacing: 0.6, marginBottom: 8 },
  card: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  rowLabel: { fontSize: 15, flex: 1, marginRight: 12 },
  divider: { height: 1, marginHorizontal: 16 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  error: { padding: 24, fontSize: 14 },
});
```

- [ ] **Step 2: Add an entry from Settings to this screen**

Edit `app/settings.tsx`. Find the "Push Notifications" Switch row (around line 122-129) inside the Notifications section. Right BELOW that row's closing `</View>` and the divider, add a new row that drills into `/notification-settings`:

```tsx
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <TouchableOpacity style={styles.settingRow} onPress={() => router.push('/notification-settings' as any)}>
            <View style={[styles.settingIcon, { backgroundColor: '#0EA5E9' + '20' }]}>
              <IconSymbol name="bell.badge.fill" size={18} color="#0EA5E9" />
            </View>
            <Text style={[styles.settingLabel, { color: colors.foreground }]}>Notification preferences</Text>
            <IconSymbol name="chevron.right" size={16} color={colors.muted} />
          </TouchableOpacity>
```

The new row goes inside the existing `<View style={[styles.section, ...]}>` that holds the "Push Notifications" and "Safety Alerts" rows, replacing the trailing closing `</View>` only after this new row.

If `bell.badge.fill` is not in `components/ui/icon-symbol.tsx`'s mapping, fall back to `bell.fill` and search the file for available icons:

Run: `grep -E "'bell" components/ui/icon-symbol.tsx | head -5`

- [ ] **Step 3: Run typecheck**

Run: `pnpm check`
Expected: PASS — no errors. The `@shared/notification-events` import resolves because both `tsconfig.json` and `vitest.config.ts` declare the alias.

- [ ] **Step 4: Run lint**

Run: `pnpm lint`
Expected: PASS — no new lint errors.

- [ ] **Step 5: Manually verify the screen renders**

Start the dev server in a separate terminal:

Run: `pnpm dev`

Then on web:
1. Open `http://localhost:3000` (or whichever port `pnpm dev` picked).
2. Sign in.
3. Navigate to Settings → Notification preferences.
4. Verify the screen shows two toggles: "Defect assigned to me" and "My defect was resolved", both ON.
5. Toggle "My defect was resolved" off.
6. Reload the page; the toggle should still be off (round-trip via DB succeeded).
7. Toggle it back on; reload; still on (sparse-storage path succeeded).

If the dev server isn't running on port 3000, find the actual port from `pnpm dev` output. If you cannot run a browser, just verify the screen file compiles and tRPC types resolve (`pnpm check` covers this).

- [ ] **Step 6: Commit**

```bash
git add app/notification-settings.tsx app/settings.tsx
git commit -m "feat(notifications): per-event preferences settings screen

New /notification-settings drilldown from Settings → Notification
preferences. Optimistic toggle with rollback on tRPC error. Categories
are presentational only — data shape stays flat per event type.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Roadmap update + final verification

Mark Phase 3.6 done in the roadmap and run the full suite + typecheck + lint as a closeout.

**Files:**
- Modify: `docs/ROADMAP.md`

- [ ] **Step 1: Mark § 3.6 done**

Edit `docs/ROADMAP.md`. Find the Phase status table near the top:

```markdown
| **3** | Feature completion | 🟡 IN PROGRESS | Per-module gap closure across Drawings/Materials/Equipment/RFIs/Tenders/AI/Reports/Push/Sync — 3.1 ⏳, 3.2 ⏳, 3.3 ⏳, 3.4 ✅ |
```

Replace with:

```markdown
| **3** | Feature completion | 🟡 IN PROGRESS | Per-module gap closure across Drawings/Materials/Equipment/RFIs/Tenders/AI/Reports/Push/Sync — 3.1 ⏳, 3.2 ⏳, 3.3 ⏳, 3.4 ✅, 3.6 ✅ |
```

Find § 3.6 (around line 266) and replace its body to match the post-shipped style used by 3.4 and 2.6:

```markdown
### 3.6 — Push notifications: per-event preferences ✅ DONE (2026-05-05)

**Tasks:**
1. ✅ Add `users.pushPreferences` (sparse JSONB column). Migration `0012_user_push_preferences.sql`.
2. ✅ tRPC: `pushTokens.preferences` (read with defaults filled) and `pushTokens.updatePreference` (sparse storage — re-enable deletes the key).
3. ✅ Wrap `sendPushToUsers` and `sendPushToUserByName` with required `eventType` parameter; gate consults preferences before token lookup.
4. ✅ UI: Settings → Notification preferences screen.

**Acceptance:** Users can mute specific event types (e.g. `defect_assigned`) without disabling push entirely. ✅ Met.

**Tests added:** `tests/notification-events.test.ts` (registry + helpers), `tests/push-preferences.test.ts` (gate behaviour), `tests/push-preferences-router.test.ts` (tRPC procedures). Updated `tests/push-notifications.test.ts` to pass `eventType`.

**Spec:** `docs/superpowers/specs/2026-05-05-push-preferences-design.md`. Plan: `docs/superpowers/plans/2026-05-05-push-preferences.md`.
```

- [ ] **Step 2: Final verification — run the full battery**

Run all four gates in sequence:

```bash
pnpm test
pnpm check
pnpm lint
```

Expected:
- `pnpm test` — every existing test plus the new ~21 push-preferences/registry tests pass.
- `pnpm check` — no TypeScript errors.
- `pnpm lint` — no new lint errors.

- [ ] **Step 3: Optional integration smoke (only if Docker is available)**

Run: `pnpm test:integration -- tests/integration` (if the suite exists in this repo)
Expected: PASS — real Postgres applies `0012_user_push_preferences.sql`, the new column survives a fresh migration cycle.

If Docker is unavailable on the box, skip. The unit suite + the migration-journal regression test together pin the contract.

- [ ] **Step 4: Commit + push**

```bash
git add docs/ROADMAP.md
git commit -m "docs(roadmap): mark Phase 3.6 (push preferences) done

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"

git push origin main
```

- [ ] **Step 5: Verify prod deploy**

Wait for the GitHub Actions deploy workflow on `main` to finish (usually 2-3 min). Then probe prod:

```bash
curl -s https://field.cortexbuildpro.com/api/health | jq .sha
```

Expected: the SHA of the just-pushed commit.

If the SHA does not update within 5 min, check `pm2 logs cortexbuild-field` and the GHA run. Do NOT roll forward another change before deploy is verified.

---

## Self-review

**1. Spec coverage:**

| Spec section | Plan task |
|---|---|
| § 4.1 shared event registry | Task 1 |
| § 4.2 preferences shape + helpers | Task 1 |
| § 4.3 schema | Task 2 |
| § 5 migration + journal | Task 2 |
| § 6.1 `pushTokens.preferences` | Task 5 |
| § 6.2 `pushTokens.updatePreference` (sparse storage) | Task 5 |
| § 7 gate semantics in `sendPushToUsers` | Task 3 |
| § 7 `sendPushToUserByName` forwards eventType | Task 3 |
| § 8 settings UI | Task 6 |
| § 9.1 new push-preferences tests | Task 3 (gate) + Task 5 (router) |
| § 9.2 modified push-notifications tests | Task 3 (step 2) |
| § 9.3 migration journal regression | Task 2 (step 4) |
| § 12 acceptance: ROADMAP marked, tests pass | Task 7 |

All spec sections accounted for.

**2. Placeholder scan:** No "TBD"/"TODO"/"implement later" in the plan body. The one phrase "search the file for available icons" in Task 6 step 2 is a concrete fallback instruction with the exact `grep` command, not a placeholder.

**3. Type consistency:**
- `NotificationEventType` is defined in Task 1 and used unchanged in Tasks 3, 5, 6.
- `UserPushPreferences` is defined in Task 1 and referenced via `import('../shared/notification-events')` in Task 2.
- `PushResult` in Task 3 includes `muted: number`; the modified existing tests in Task 3 step 2 expect this shape.
- `sendPushToUsers(userIds, eventType, payload, fetchImpl)` and `sendPushToUserByName(displayName, eventType, payload, fetchImpl)` — same signature shape across Tasks 3, 4.
- `pushTokens.preferences` and `pushTokens.updatePreference` — same names in Tasks 5, 6, and 7.
- Sparse-storage SQL: `"pushPreferences" - $key` for re-enable and `jsonb_set(..., 'false'::jsonb, true)` for mute — both match between Task 5 step 3 and Task 5 step 1 (the assertions in the router test).

No drift between tasks.
