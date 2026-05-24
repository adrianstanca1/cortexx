/**
 * Tests for `server/_core/pushNotifications.ts` — the Expo Push API
 * dispatcher that finally turns the `push_tokens` table into actual
 * notifications on user devices.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { log } from "../server/_core/logger";
import {
  pushTokens as dbPushTokens,
  users as dbUsers,
} from "../drizzle/schema";

interface FakeRow {
  id: number;
  userId: number;
  token: string;
  platform: "ios" | "android" | "web";
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface DbState {
  tokens: FakeRow[];
  users: { id: number; name: string; pushPreferences?: Record<string, boolean> }[];
  deactivatedIds: number[];
  whereCalls: { table: unknown; condition: unknown }[];
}

const state: DbState = {
  tokens: [],
  users: [],
  deactivatedIds: [],
  whereCalls: [],
};

function makeDb(overrides?: {
  pushTokenSelectError?: Error;
  userSelectError?: Error;
}) {
  return {
    select(_proj?: unknown) {
      return {
        from(table: unknown) {
          return {
            where(condition: unknown) {
              state.whereCalls.push({ table, condition });
              if (table === dbPushTokens) {
                if (overrides?.pushTokenSelectError) {
                  return Promise.reject(overrides.pushTokenSelectError);
                }
                // Return tokens for ALL queried users; the procedure
                // applies its own active/format filter in JS.
                return Promise.resolve(state.tokens);
              }
              if (table === dbUsers) {
                if (overrides?.userSelectError) {
                  return Promise.reject(overrides.userSelectError);
                }
                // Look up by name match — return whichever rows match.
                // We don't try to introspect the `eq()` condition; the
                // tests set state.users to exactly what should match.
                return Promise.resolve(state.users);
              }
              return Promise.resolve([]);
            },
          };
        },
      };
    },
    update(table: unknown) {
      return {
        set(_values: unknown) {
          return {
            where(condition: any) {
              if (table === dbPushTokens) {
                // condition is `inArray(dbPushTokens.id, [ids])` — we
                // can't easily introspect, so we trust the caller's
                // intent and record that an update happened. The
                // helper passes the deactivated token IDs through
                // result.deactivated which the test asserts on.
                state.deactivatedIds.push(0); // sentinel
              }
              return Promise.resolve();
            },
          };
        },
      };
    },
  };
}

const getDbMock = vi.fn(async () => makeDb());

vi.mock("../server/db", () => ({
  getDb: () => getDbMock(),
}));

const { sendPushToUsers, sendPushToUserByName } = await import("../server/_core/pushNotifications");

beforeEach(() => {
  state.tokens = [];
  state.users = [];
  state.deactivatedIds = [];
  state.whereCalls = [];
  getDbMock.mockImplementation(async () => makeDb());
});

afterEach(() => {
  vi.clearAllMocks();
});

function token(id: number, userId: number, value = `ExponentPushToken[abc${id}]`, active = true): FakeRow {
  return {
    id,
    userId,
    token: value,
    platform: "ios",
    active,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("sendPushToUsers", () => {
  it("returns zeroes when userIds list is empty (no DB call needed)", async () => {
    const fetchSpy = vi.fn();
    const result = await sendPushToUsers([], "defect_assigned", { title: "x", body: "y" }, fetchSpy as any);
    expect(result).toEqual({ attempted: 0, accepted: 0, rejected: 0, deactivated: 0, muted: 0, degraded: false });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns zeroes when the user has no tokens (no Expo POST)", async () => {
    state.tokens = [];
    const fetchSpy = vi.fn();
    const result = await sendPushToUsers([42], "defect_assigned", { title: "x", body: "y" }, fetchSpy as any);
    expect(result.attempted).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("filters out inactive tokens and bad token formats before POSTing", async () => {
    state.tokens = [
      token(1, 42, "ExponentPushToken[good]", true),
      token(2, 42, "ExponentPushToken[inactive]", false),       // active=false
      token(3, 42, "raw-fcm-token-not-expo-format", true),       // wrong format
    ];

    const fetchSpy = vi.fn(async () => new Response(
      JSON.stringify({ data: [{ status: "ok", id: "ticket-1" }] }),
      { status: 200, headers: { "content-type": "application/json" } },
    ));
    const result = await sendPushToUsers([42], "defect_assigned", { title: "Hi", body: "x" }, fetchSpy as any);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0] as any;
    const sent = JSON.parse(init.body);
    // Only the one good token made it into the request.
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("ExponentPushToken[good]");
    expect(result).toMatchObject({ attempted: 1, accepted: 1, rejected: 0 });
  });

  it("counts ok / error tickets correctly", async () => {
    state.tokens = [token(1, 42), token(2, 42), token(3, 42)];
    const fetchSpy = vi.fn(async () => new Response(
      JSON.stringify({ data: [
        { status: "ok", id: "t1" },
        { status: "error", message: "Failed", details: { error: "MessageRateExceeded" } },
        { status: "ok", id: "t3" },
      ] }),
      { status: 200, headers: { "content-type": "application/json" } },
    ));
    const result = await sendPushToUsers([42], "defect_assigned", { title: "x", body: "y" }, fetchSpy as any);
    expect(result).toMatchObject({ attempted: 3, accepted: 2, rejected: 1, deactivated: 0 });
  });

  it("deactivates tokens reported as DeviceNotRegistered", async () => {
    // The ONLY way Expo can tell us a token is dead is the
    // `details.error === 'DeviceNotRegistered'` ticket. We must mark
    // those inactive in the DB, otherwise we'll keep retrying every
    // notification for a device that's been uninstalled, hammering
    // Expo and risking rate-limit penalties.
    state.tokens = [
      token(1, 42, "ExponentPushToken[live]"),
      token(2, 42, "ExponentPushToken[dead]"),
    ];
    const fetchSpy = vi.fn(async () => new Response(
      JSON.stringify({ data: [
        { status: "ok", id: "t1" },
        { status: "error", message: "Not registered", details: { error: "DeviceNotRegistered" } },
      ] }),
      { status: 200, headers: { "content-type": "application/json" } },
    ));
    const result = await sendPushToUsers([42], "defect_assigned", { title: "x", body: "y" }, fetchSpy as any);
    expect(result).toMatchObject({ attempted: 2, accepted: 1, rejected: 1, deactivated: 1 });
    expect(state.deactivatedIds.length).toBeGreaterThan(0);
  });

  it("does not throw when Expo returns 5xx — counts all as rejected", async () => {
    state.tokens = [token(1, 42), token(2, 42)];
    const fetchSpy = vi.fn(async () => new Response("upstream broken", { status: 503 }));
    const result = await sendPushToUsers([42], "defect_assigned", { title: "x", body: "y" }, fetchSpy as any);
    expect(result).toMatchObject({ attempted: 2, accepted: 0, rejected: 2 });
  });

  it("does not throw when fetch itself rejects (network failure)", async () => {
    state.tokens = [token(1, 42)];
    const fetchSpy = vi.fn(async () => { throw new Error("EAI_AGAIN"); });
    const result = await sendPushToUsers([42], "defect_assigned", { title: "x", body: "y" }, fetchSpy as any);
    expect(result).toMatchObject({ attempted: 1, accepted: 0, rejected: 1 });
  });

  it("classifies invalid JSON from Expo distinctly (console.error, not warn)", async () => {
    // Distinct severity matters: network blips warn, but a malformed
    // response means Expo's API contract changed and we should
    // investigate before silently treating future batches as rejected.
    state.tokens = [token(1, 42), token(2, 42)];
    const fetchSpy = vi.fn(async () => new Response("not json at all", {
      status: 200, headers: { "content-type": "text/plain" },
    }));
    const errorSpy = vi.spyOn(log, "error").mockImplementation(() => {});
    const result = await sendPushToUsers([42], "defect_assigned", { title: "x", body: "y" }, fetchSpy as any);
    expect(result).toMatchObject({ attempted: 2, accepted: 0, rejected: 2 });
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("not valid JSON"),
      expect.anything(),
    );
    errorSpy.mockRestore();
  });

  it("does not throw when push token SELECT fails (e.g. pool timeout)", async () => {
    getDbMock.mockImplementation(async () => makeDb({ pushTokenSelectError: new Error("timeout") }));
    const fetchSpy = vi.fn();
    const result = await sendPushToUsers([42], "defect_assigned", { title: "x", body: "y" }, fetchSpy as any);
    expect(result).toEqual({ attempted: 0, accepted: 0, rejected: 0, deactivated: 0, muted: 0, degraded: false });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("sendPushToUserByName", () => {
  it("is a no-op when the name is empty/whitespace", async () => {
    const fetchSpy = vi.fn();
    const result = await sendPushToUserByName("   ", "defect_assigned", { title: "x", body: "y" }, fetchSpy as any);
    expect(result.attempted).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("is a no-op when no user with that display name exists (does NOT guess) and warns ops", async () => {
    state.users = []; // no match
    const fetchSpy = vi.fn();
    const warnSpy = vi.spyOn(log, "warn").mockImplementation(() => {});
    const result = await sendPushToUserByName("Site team", "defect_assigned", { title: "x", body: "y" }, fetchSpy as any);
    expect(result.attempted).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
    // Surfaces stale assignments to ops without surprising the caller.
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("no user matched displayName"));
    warnSpy.mockRestore();
  });

  it("dispatches to all push tokens of the matched user", async () => {
    state.users = [{ id: 7, name: "Alice Worker" }];
    state.tokens = [
      token(10, 7, "ExponentPushToken[alice-phone]"),
      token(11, 7, "ExponentPushToken[alice-tablet]"),
    ];
    const fetchSpy = vi.fn(async () => new Response(
      JSON.stringify({ data: [
        { status: "ok", id: "a" },
        { status: "ok", id: "b" },
      ] }),
      { status: 200, headers: { "content-type": "application/json" } },
    ));
    const result = await sendPushToUserByName("Alice Worker", "defect_assigned", { title: "Defect", body: "Crack" }, fetchSpy as any);
    expect(result).toMatchObject({ attempted: 2, accepted: 2 });
  });

  it("does not throw when user lookup SELECT fails (e.g. pool timeout)", async () => {
    getDbMock.mockImplementation(async () => makeDb({ userSelectError: new Error("timeout") }));
    const fetchSpy = vi.fn();
    const result = await sendPushToUserByName("Alice Worker", "defect_assigned", { title: "x", body: "y" }, fetchSpy as any);
    expect(result).toEqual({ attempted: 0, accepted: 0, rejected: 0, deactivated: 0, muted: 0, degraded: false });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
