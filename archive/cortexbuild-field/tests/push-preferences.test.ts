/**
 * Tests for the Phase 3.6 push-notification preference gate inside
 * `sendPushToUsers`. The gate filters userIds by users.pushPreferences
 * BEFORE looking up push tokens or POSTing to Expo, so a muted user
 * causes no Expo traffic at all.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { log } from "../server/_core/logger";
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

function makeDb(overrides?: { userSelectError?: Error }) {
  return {
    select(_proj?: unknown) {
      return {
        from(table: unknown) {
          return {
            where(_cond: unknown) {
              if (table === dbPushTokens) return Promise.resolve(state.tokens);
              if (table === dbUsers) {
                if (overrides?.userSelectError) return Promise.reject(overrides.userSelectError);
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

  it("fails open when the users SELECT errors (transient pool timeout)", async () => {
    // Load-bearing invariant: a transient DB error in the prefs lookup
    // must not silently silence the world. Allowing the push to
    // proceed (and possibly over-notify a muted user) is recoverable;
    // dropping a real assignment on every transient blip is not.
    // A regression that flipped this catch to fail-closed would ship
    // green without this test.
    state.users = [
      { id: 1, pushPreferences: { defect_assigned: false } }, // muted, but unreachable
    ];
    state.tokens = [expoToken(10, 1)];
    getDbMock.mockImplementation(async () => makeDb({ userSelectError: new Error("pool timeout") }));
    const fetchSpy = vi.fn(async () => new Response(
      JSON.stringify({ data: [{ status: "ok", id: "x" }] }),
      { status: 200 },
    ));
    const warnSpy = vi.spyOn(log, "warn").mockImplementation(() => {});
    const result = await sendPushToUsers([1], "defect_assigned", { title: "t", body: "b" }, fetchSpy as any);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    // degraded: true is the observability hook — distinguishes
    // "everyone allowed because nobody muted" (degraded:false) from
    // "everyone allowed because the gate couldn't read prefs"
    // (degraded:true). Behaviour is unchanged; only the surface is.
    expect(result).toMatchObject({ attempted: 1, accepted: 1, muted: 0, degraded: true });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Failed to read pushPreferences"),
      expect.anything(),
    );
    warnSpy.mockRestore();
  });

  it("happy path leaves degraded=false (so observability can distinguish from fail-open)", async () => {
    state.users = [{ id: 1, pushPreferences: {} }];
    state.tokens = [expoToken(10, 1)];
    const fetchSpy = vi.fn(async () => new Response(
      JSON.stringify({ data: [{ status: "ok", id: "x" }] }),
      { status: 200 },
    ));
    const result = await sendPushToUsers([1], "defect_assigned", { title: "t", body: "b" }, fetchSpy as any);
    expect(result.degraded).toBe(false);
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

describe("PUSH_GATE_FAIL_MODE — fail-closed override", () => {
  const original = process.env.PUSH_GATE_FAIL_MODE;
  afterEach(() => {
    if (original === undefined) delete process.env.PUSH_GATE_FAIL_MODE;
    else process.env.PUSH_GATE_FAIL_MODE = original;
  });

  it("PUSH_GATE_FAIL_MODE=closed drops everyone when the SELECT fails (no Expo POST)", async () => {
    process.env.PUSH_GATE_FAIL_MODE = "closed";
    state.users = [{ id: 1, pushPreferences: {} }];
    state.tokens = [expoToken(10, 1)];
    getDbMock.mockImplementation(async () => makeDb({ userSelectError: new Error("pool timeout") }));
    const fetchSpy = vi.fn();
    const warnSpy = vi.spyOn(log, "warn").mockImplementation(() => {});
    const result = await sendPushToUsers([1], "defect_assigned", { title: "t", body: "b" }, fetchSpy as any);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result).toMatchObject({ attempted: 0, accepted: 0, muted: 0, degraded: true });
    warnSpy.mockRestore();
  });

  it("PUSH_GATE_FAIL_MODE=closed leaves the happy path unaffected", async () => {
    process.env.PUSH_GATE_FAIL_MODE = "closed";
    state.users = [{ id: 1, pushPreferences: {} }];
    state.tokens = [expoToken(10, 1)];
    const fetchSpy = vi.fn(async () => new Response(
      JSON.stringify({ data: [{ status: "ok", id: "x" }] }),
      { status: 200 },
    ));
    const result = await sendPushToUsers([1], "defect_assigned", { title: "t", body: "b" }, fetchSpy as any);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ attempted: 1, accepted: 1, muted: 0, degraded: false });
  });

  it("invalid PUSH_GATE_FAIL_MODE values fall back to 'open' (safe default)", async () => {
    process.env.PUSH_GATE_FAIL_MODE = "garbage";
    state.users = [];
    state.tokens = [expoToken(10, 1)];
    getDbMock.mockImplementation(async () => makeDb({ userSelectError: new Error("pool timeout") }));
    const fetchSpy = vi.fn(async () => new Response(
      JSON.stringify({ data: [{ status: "ok", id: "x" }] }),
      { status: 200 },
    ));
    const warnSpy = vi.spyOn(log, "warn").mockImplementation(() => {});
    const result = await sendPushToUsers([1], "defect_assigned", { title: "t", body: "b" }, fetchSpy as any);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ attempted: 1, degraded: true });
    warnSpy.mockRestore();
  });
});

describe("graceful degradation via Redis cache", () => {
  // Stub the cache module's exports so the gate sees a controllable
  // 'last-known prefs' source without spinning up real Redis.
  const cacheStore = new Map<number, Record<string, boolean>>();

  beforeEach(async () => {
    cacheStore.clear();
    const cacheModule = await import("../server/_core/push-prefs-cache");
    vi.spyOn(cacheModule, "readCachedPrefs").mockImplementation(
      async (ids: number[]) => {
        const out = new Map();
        for (const id of ids) {
          if (cacheStore.has(id)) out.set(id, cacheStore.get(id)!);
        }
        return out;
      },
    );
    vi.spyOn(cacheModule, "writeCachedPrefs").mockImplementation(
      async (entries: { userId: number; prefs: Record<string, boolean> }[]) => {
        for (const e of entries) cacheStore.set(e.userId, e.prefs);
      },
    );
  });

  it("DB-down with cache hit honours the cached mute (degraded:true, muted:1)", async () => {
    cacheStore.set(1, { defect_assigned: false });
    state.tokens = [expoToken(10, 1)];
    getDbMock.mockImplementation(async () => makeDb({ userSelectError: new Error("pool timeout") }));
    const fetchSpy = vi.fn();
    const warnSpy = vi.spyOn(log, "warn").mockImplementation(() => {});
    const result = await sendPushToUsers([1], "defect_assigned", { title: "t", body: "b" }, fetchSpy as any);
    // Cache said muted, so we did NOT POST.
    expect(fetchSpy).not.toHaveBeenCalled();
    // muted:1 because the cache hit gave us a definite mute (vs
    // fail-mode which doesn't increment muted).
    expect(result).toMatchObject({ attempted: 0, muted: 1, degraded: true });
    warnSpy.mockRestore();
  });

  it("DB-down with cache hit honours an enabled cached pref (degraded:true, push fires)", async () => {
    cacheStore.set(1, {}); // empty prefs → enabled by default
    state.tokens = [expoToken(10, 1)];
    getDbMock.mockImplementation(async () => makeDb({ userSelectError: new Error("pool timeout") }));
    const fetchSpy = vi.fn(async () => new Response(
      JSON.stringify({ data: [{ status: "ok", id: "x" }] }),
      { status: 200 },
    ));
    const warnSpy = vi.spyOn(log, "warn").mockImplementation(() => {});
    const result = await sendPushToUsers([1], "defect_assigned", { title: "t", body: "b" }, fetchSpy as any);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ attempted: 1, accepted: 1, muted: 0, degraded: true });
    warnSpy.mockRestore();
  });

  it("DB-down without a cache hit applies the configured fail mode (default open)", async () => {
    // No cache entry for id=1 → falls back to default fail-open.
    state.tokens = [expoToken(10, 1)];
    getDbMock.mockImplementation(async () => makeDb({ userSelectError: new Error("pool timeout") }));
    const fetchSpy = vi.fn(async () => new Response(
      JSON.stringify({ data: [{ status: "ok", id: "x" }] }),
      { status: 200 },
    ));
    const warnSpy = vi.spyOn(log, "warn").mockImplementation(() => {});
    const result = await sendPushToUsers([1], "defect_assigned", { title: "t", body: "b" }, fetchSpy as any);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ attempted: 1, muted: 0, degraded: true });
    warnSpy.mockRestore();
  });

  it("happy path WRITES to the cache so the next DB-down path can use it", async () => {
    state.users = [{ id: 1, pushPreferences: { defect_assigned: false } }];
    state.tokens = [expoToken(10, 1)];
    const fetchSpy = vi.fn();
    const result = await sendPushToUsers([1], "defect_assigned", { title: "t", body: "b" }, fetchSpy as any);
    // Happy path: the cache write is fire-and-forget, give the
    // microtask a chance to land before asserting.
    await new Promise(r => setImmediate(r));
    expect(result).toMatchObject({ muted: 1, degraded: false });
    expect(cacheStore.get(1)).toEqual({ defect_assigned: false });
  });
});
