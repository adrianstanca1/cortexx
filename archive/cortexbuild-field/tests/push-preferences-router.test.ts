/**
 * Unit tests for the tRPC procedures behind the per-event push
 * preferences: pushTokens.preferences (query) and
 * pushTokens.updatePreference (mutation).
 *
 * Scope: input validation, contextual fall-throughs (NOT_FOUND on a
 * missing row), and the read-side defaults projection. The SQL-shape
 * and key-deletion semantics live in
 * tests/integration/push-preferences.integration.test.ts where they
 * run against a real Postgres container — that's the only way to
 * prove jsonb_set and the JSONB `-` operator behave as the procedure
 * expects, and an integration test survives a Drizzle internal-API
 * refactor that would break a queryChunks-walking unit test.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
    execute(_query: any) {
      // Returning a singleton matches state.users[0] so the procedure's
      // rows-affected check passes; setting state.users = [] simulates
      // a missing row → NOT_FOUND.
      const matched = state.users.length > 0 ? [{ id: state.users[0].id }] : [];
      return Promise.resolve(matched);
    },
  };
}

vi.mock("../server/db", () => ({ getDb: async () => makeDb() }));

const { appRouter } = await import("../server/routers");

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

  it("throws NOT_FOUND when the UPDATE affects zero rows", async () => {
    // Simulates user row deleted between auth and mutation, or
    // schema drift on the column type. Without this guard the
    // mutation reports {success:true} and the toggle silently
    // doesn't persist.
    state.users = [];
    const caller = appRouter.createCaller(makeCtx(1) as any);
    await expect(
      caller.pushTokens.updatePreference({ eventType: "defect_assigned", enabled: false }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
