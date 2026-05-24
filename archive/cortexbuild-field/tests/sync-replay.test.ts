import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
import type { TrpcContext } from "../server/_core/context";

/**
 * Coverage for the `sync.replay` dispatcher in `server/routers/index.ts`.
 *
 * This is the procedure the offline-first sync queue (`lib/sync-queue.tsx`)
 * calls when network returns: each queued mutation comes back through
 * here, routed by `type` (e.g. "defects.create") to the matching
 * procedure on the live router. Without it the queue silently drops
 * user data on reconnect.
 *
 * Three contracts that matter:
 *   1. Allow-list: only types in REPLAYABLE_TYPES are accepted. Off-list
 *      types throw BAD_REQUEST so a misconfigured client (or an attacker
 *      who learns about this endpoint) can't trigger arbitrary internal
 *      procedures.
 *   2. Bad nesting / typo: a type that's allow-listed but doesn't resolve
 *      to a function on the router throws BAD_REQUEST too — defends
 *      against a stale REPLAYABLE_TYPES entry after a router refactor.
 *   3. Successful replay: the resolved procedure runs through its OWN
 *      auth middleware (so `defects.create` still demands a logged-in
 *      caller); the replay handler itself is publicProcedure because
 *      the replay loop fires at the network-recovery boundary.
 */

const dbCalls: { inserts: { table: string; values: any }[] } = { inserts: [] };

function tableName(table: any): string {
  return getTableName(table);
}

vi.mock("../server/db", () => ({
  getDb: vi.fn(async () => ({
    select() {
      return {
        from(table: any) {
          const name = tableName(table);
          if (name.includes('company_users')) {
            return {
              where(_c: unknown) {
                return {
                  limit() {
                    return Promise.resolve([{ companyRole: 'manager', isActive: true }]);
                  },
                };
              },
            };
          }
          // For project-FK lookup in defects.create.
          if (name === 'projects') {
            return {
              where(_c: unknown) {
                return {
                  limit() {
                    return Promise.resolve([{ id: 7, companyId: 7 }]);
                  },
                };
              },
            };
          }
          return {
            where(_c: unknown) {
              return Promise.resolve([]);
            },
          };
        },
      };
    },
    insert(table: any) {
      return {
        values(values: any) {
          const name = tableName(table);
          dbCalls.inserts.push({ table: name, values });
          return { returning() { return Promise.resolve([{ id: 999, ...values }]); } };
        },
      };
    },
  })),
}));

const { appRouter } = await import("../server/routers");

function ctxFor(userId: number): TrpcContext {
  return {
    user: {
      id: userId, openId: `user-${userId}`, name: `User ${userId}`,
      email: `u${userId}@example.com`, loginMethod: "manus", role: "user",
      passwordHash: null, pushPreferences: {}, createdAt: new Date(), updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", hostname: "localhost", headers: {} } as any,
    res: { clearCookie: vi.fn() } as any,
  };
}

const UNAUTH_CTX = {
  user: null,
  req: { protocol: "https", hostname: "localhost", headers: {} },
  res: { clearCookie: vi.fn() },
} as unknown as TrpcContext;

beforeEach(() => {
  dbCalls.inserts.length = 0;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("sync.replay — allow-list gate", () => {
  it("rejects an unknown type with BAD_REQUEST", async () => {
    const caller = appRouter.createCaller(UNAUTH_CTX);
    await expect(caller.sync.replay({
      type: 'definitely.not.replayable',
      payload: {},
    })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it("rejects a procedure-shaped name that ISN'T allow-listed even if it exists on the router", async () => {
    // `system.health` is a real procedure but absolutely should not be
    // queueable through the offline sync. The allow-list MUST gate it
    // out before the createCaller dispatch happens.
    const caller = appRouter.createCaller(UNAUTH_CTX);
    await expect(caller.sync.replay({
      type: 'system.health',
      payload: { timestamp: 1 },
    })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

describe("sync.replay — happy path dispatch", () => {
  it("dispatches checkins.create through to the underlying procedure", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    const result = await caller.sync.replay({
      type: 'checkins.create',
      payload: { workerName: 'Alice', projectId: 7 },
    });
    expect(result.success).toBe(true);
    expect(result.type).toBe('checkins.create');
    expect(result.replayedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    // The replay actually called checkins.create, which inserted a row.
    expect(dbCalls.inserts.filter(i => i.table === 'check_ins')).toHaveLength(1);
  });

  it("dispatches defects.create through to the underlying procedure", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    const result = await caller.sync.replay({
      type: 'defects.create',
      payload: {
        companyId: 7, projectId: 7,
        title: 'Cracked tile', reportedBy: 'alice',
      },
    });
    expect(result.success).toBe(true);
    expect(dbCalls.inserts.filter(i => i.table === 'defects')).toHaveLength(1);
  });

  it("propagates auth failure from the dispatched procedure (UNAUTHORIZED)", async () => {
    // checkins.create is protectedProcedure; no user → UNAUTHORIZED
    // bubbles up through the replay. Confirms the wrapper does NOT
    // accidentally swallow auth errors.
    const caller = appRouter.createCaller(UNAUTH_CTX);
    await expect(caller.sync.replay({
      type: 'checkins.create',
      payload: { workerName: 'Alice', projectId: 7 },
    })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});

describe("sync.replay — output shape", () => {
  it("returns { success, type, replayedAt, result }", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    const result = await caller.sync.replay({
      type: 'checkins.create',
      payload: { workerName: 'Bob', projectId: 7 },
    });
    expect(Object.keys(result).sort()).toEqual(['replayedAt', 'result', 'success', 'type']);
    expect(result.result).toMatchObject({ success: true, checkedInAt: expect.any(String) });
  });
});
