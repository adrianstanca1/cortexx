/**
 * Integration test: Phase 3.6 sparse-storage semantics on real Postgres.
 *
 * Pins the load-bearing JSONB invariants the unit tests cannot prove:
 *   - The migration's `DEFAULT '{}'::jsonb` actually applies on insert.
 *   - `jsonb_set` and the JSONB `-` operator behave the way the
 *     procedure expects (mute writes `false`, re-enable removes the key).
 *   - The `WHERE id = ctx.user.id` predicate scopes the UPDATE — a
 *     regression that dropped or hard-coded it would mass-update.
 *   - 0-row UPDATE → NOT_FOUND.
 *   - `pushTokens.preferences` reads the live row.
 *
 * The previous unit-level queryChunks introspection walked Drizzle's
 * undocumented internal API; this file replaces it with behaviour
 * assertions that survive a Drizzle minor upgrade.
 *
 * Run with: pnpm test:integration
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import {
  setupTestPostgres,
  teardownTestPostgres,
  getTestDb,
  truncate,
} from "./setup";
import { users } from "../../drizzle/schema";
import { NOTIFICATION_EVENT_TYPES } from "../../shared/notification-events";

let appRouter: typeof import("../../server/routers")["appRouter"];

// Derive the expected fillDefaults({}) shape from the live registry so this
// test does not need a manual edit every time a new NOTIFICATION_EVENTS key
// lands. A regression that drops an event from the default-enabled set still
// fails loudly here (the resulting object loses a key) — we just stop
// hard-coding which keys it should be.
function allEventsEnabled(): Record<string, boolean> {
  return Object.fromEntries(NOTIFICATION_EVENT_TYPES.map(t => [t, true]));
}

beforeAll(async () => {
  await setupTestPostgres();
  process.env.JWT_SECRET = process.env.JWT_SECRET ?? "integration-test-secret";
  ({ appRouter } = await import("../../server/routers"));
}, 120_000);

afterAll(async () => {
  await teardownTestPostgres();
}, 30_000);

beforeEach(async () => {
  await truncate(["users"]);
});

function ctx(userId: number) {
  return {
    user: {
      id: userId, openId: `oid-${userId}`, name: `User ${userId}`,
      email: `u${userId}@x.com`, loginMethod: "manus", role: "user" as const,
      passwordHash: null, pushPreferences: {},
      createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
    },
    companyMembership: null,
    req: { protocol: "https", hostname: "localhost", headers: {} } as any,
    res: { clearCookie: vi.fn() } as any,
  } as any;
}

async function readPrefs(userId: number): Promise<Record<string, unknown>> {
  const db = getTestDb();
  const [row] = await db.select({ pushPreferences: users.pushPreferences })
    .from(users).where(eq(users.id, userId)).limit(1);
  return row?.pushPreferences as Record<string, unknown>;
}

describe("pushTokens.updatePreference — sparse storage on real PG", () => {
  it("freshly-inserted users get pushPreferences = {} via the migration default", async () => {
    const db = getTestDb();
    const [u] = await db.insert(users).values({
      openId: "fresh", name: "Fresh", email: "fresh@x.com", role: "user",
    }).returning();
    expect(await readPrefs(u.id)).toEqual({});
  });

  it("mute writes the event key as explicit false", async () => {
    const db = getTestDb();
    const [u] = await db.insert(users).values({
      openId: "mute", name: "Mute", email: "mute@x.com", role: "user",
    }).returning();

    const caller = appRouter.createCaller(ctx(u.id));
    await caller.pushTokens.updatePreference({ eventType: "defect_assigned", enabled: false });

    expect(await readPrefs(u.id)).toEqual({ defect_assigned: false });
  });

  it("re-enable deletes the key (sparse storage), not writes true", async () => {
    const db = getTestDb();
    const [u] = await db.insert(users).values({
      openId: "rt", name: "RT", email: "rt@x.com", role: "user",
    }).returning();

    const caller = appRouter.createCaller(ctx(u.id));
    await caller.pushTokens.updatePreference({ eventType: "defect_assigned", enabled: false });
    expect(await readPrefs(u.id)).toEqual({ defect_assigned: false });

    await caller.pushTokens.updatePreference({ eventType: "defect_assigned", enabled: true });
    // The key is gone — fresh and re-enabled users are
    // indistinguishable on the read path. This is the property that
    // lets a future global-default flip work without a backfill.
    expect(await readPrefs(u.id)).toEqual({});
  });

  it("muting one event leaves another event's preference untouched", async () => {
    const db = getTestDb();
    const [u] = await db.insert(users).values({
      openId: "two", name: "Two", email: "two@x.com", role: "user",
    }).returning();

    const caller = appRouter.createCaller(ctx(u.id));
    await caller.pushTokens.updatePreference({ eventType: "defect_assigned", enabled: false });
    await caller.pushTokens.updatePreference({ eventType: "defect_resolved", enabled: false });
    expect(await readPrefs(u.id)).toEqual({ defect_assigned: false, defect_resolved: false });

    await caller.pushTokens.updatePreference({ eventType: "defect_assigned", enabled: true });
    // jsonb_set must merge with the existing keys, not replace the column.
    expect(await readPrefs(u.id)).toEqual({ defect_resolved: false });
  });

  it("scopes the UPDATE by ctx.user.id — does NOT touch other users' rows", async () => {
    // The WHERE-clause guarantee in production: a regression that
    // dropped or hard-coded the predicate would mass-update every row.
    const db = getTestDb();
    const [alice] = await db.insert(users).values({
      openId: "alice", name: "Alice", email: "a@x.com", role: "user",
    }).returning();
    const [bob] = await db.insert(users).values({
      openId: "bob", name: "Bob", email: "b@x.com", role: "user",
    }).returning();

    await appRouter.createCaller(ctx(alice.id)).pushTokens.updatePreference({
      eventType: "defect_assigned", enabled: false,
    });

    expect(await readPrefs(alice.id)).toEqual({ defect_assigned: false });
    // Bob must be untouched — the migration default still applies.
    expect(await readPrefs(bob.id)).toEqual({});
  });

  it("throws NOT_FOUND when the caller's user row was deleted", async () => {
    const db = getTestDb();
    const [ghost] = await db.insert(users).values({
      openId: "ghost", name: "Ghost", email: "g@x.com", role: "user",
    }).returning();
    // The mutation is authenticated against ghost.id, but the row
    // disappears between auth and write — the rows-affected guard
    // must catch this.
    await db.delete(users).where(eq(users.id, ghost.id));
    await expect(
      appRouter.createCaller(ctx(ghost.id)).pushTokens.updatePreference({
        eventType: "defect_assigned", enabled: false,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("pushTokens.preferences — read on real PG", () => {
  it("returns fillDefaults({}) when the row's column is empty", async () => {
    const db = getTestDb();
    const [u] = await db.insert(users).values({
      openId: "read1", name: "R1", email: "r1@x.com", role: "user",
    }).returning();

    const prefs = await appRouter.createCaller(ctx(u.id)).pushTokens.preferences();
    expect(prefs).toEqual(allEventsEnabled());
  });

  it("preserves an explicit false read back from the column", async () => {
    const db = getTestDb();
    const [u] = await db.insert(users).values({
      openId: "read2", name: "R2", email: "r2@x.com", role: "user",
    }).returning();
    const caller = appRouter.createCaller(ctx(u.id));
    await caller.pushTokens.updatePreference({ eventType: "defect_assigned", enabled: false });

    const prefs = await caller.pushTokens.preferences();
    expect(prefs).toEqual({ ...allEventsEnabled(), defect_assigned: false });
  });
});
