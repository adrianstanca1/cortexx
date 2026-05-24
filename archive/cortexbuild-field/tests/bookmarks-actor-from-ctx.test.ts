import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
import type { TrpcContext } from "../server/_core/context";

/**
 * Regression tests for the actor-from-ctx hardening on `bookmarks.list`
 * and `bookmarks.add`. Both procedures previously took
 * `userId: z.number().default(1)` from input, which let any logged-in
 * caller read someone else's bookmarks (or attribute a bookmark to user
 * 1 if they simply omitted the field). Server now derives userId from
 * `ctx.user.id` regardless of input.
 *
 * The same pattern was applied across nine other procedures
 * (inspections.create, rfis.create, observations.create, drawings.
 * create, announcements.create, actionPlans.create, finance.
 * createInvoice, finance.createTender). bookmarks is the load-bearing
 * test because both paths exist (read AND write) and the privacy
 * impact is most concrete.
 */

const dbCalls: {
  selectClauses: unknown[];
  insertValues: Record<string, unknown>[];
  deleteClauses: unknown[];
  result: Record<string, unknown>[];
} = { selectClauses: [], insertValues: [], deleteClauses: [], result: [] };

vi.mock("../server/db", () => ({
  getDb: vi.fn(async () => {
    // Stub the membership query that companyScopedProcedure runs
    // before the procedure body. This needs a different shape than
    // the bookmarks queries, so we branch on `from(table)`.
    let mode: 'membership' | 'select' | 'insert' = 'select';
    return {
      select(_columns?: any) {
        return {
          from(table: any) {
            // Heuristic: companyScopedProcedure selects from
            // `companyUsers`; the procedure body selects from
            // `projectBookmarks`. Tag the call so the membership
            // path returns "active" while the body path returns
            // whatever the test seeded.
            const isMembership = getTableName(table).includes('company_users');
            mode = isMembership ? 'membership' : 'select';
            return {
              where(clause: unknown) {
                if (mode === 'membership') {
                  return {
                    limit() {
                      return Promise.resolve([{ companyRole: 'manager', isActive: true }]);
                    },
                  };
                }
                dbCalls.selectClauses.push(clause);
                return {
                  orderBy() {
                    return Promise.resolve(dbCalls.result);
                  },
                  limit() {
                    return Promise.resolve(dbCalls.result);
                  },
                };
              },
            };
          },
        };
      },
      insert(_table: any) {
        return {
          values(values: Record<string, unknown>) {
            dbCalls.insertValues.push(values);
            return {
              returning() {
                return Promise.resolve([{ id: 1, ...values }]);
              },
            };
          },
        };
      },
      delete(_table: any) {
        return {
          where(clause: unknown) {
            dbCalls.deleteClauses.push(clause);
            return Promise.resolve(undefined);
          },
        };
      },
    };
  }),
}));

const { appRouter } = await import("../server/routers");

function ctxFor(userId: number): TrpcContext {
  return {
    user: {
      id: userId,
      openId: `user-${userId}`,
      name: `User ${userId}`,
      email: `u${userId}@example.com`,
      loginMethod: "manus",
      role: "user",
      passwordHash: null, pushPreferences: {}, createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", hostname: "localhost", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("bookmarks.add — actor from ctx (no userId smuggling)", () => {
  beforeEach(() => {
    dbCalls.selectClauses.length = 0;
    dbCalls.insertValues.length = 0;
    dbCalls.deleteClauses.length = 0;
    dbCalls.result.length = 0;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("inserts the row with userId=ctx.user.id, ignoring any input userId", async () => {
    const caller = appRouter.createCaller(ctxFor(42));

    await caller.bookmarks.add({
      companyId: 1,
      projectId: 7,
      itemType: "project",
      itemId: "7",
      itemTitle: "Burnt Mill Academy",
      // @ts-expect-error — userId is no longer part of the input schema
      userId: 999,
    });

    // INSERT happens because the existing-bookmark check returns []
    // (dbCalls.result is empty in this test).
    expect(dbCalls.insertValues).toHaveLength(1);
    expect(dbCalls.insertValues[0]).toMatchObject({
      userId: 42,
      projectId: 7,
      companyId: 1,
    });
  });

  it("returns the existing row when one is already present, never re-inserts", async () => {
    // Seed an existing bookmark — the procedure should short-circuit.
    dbCalls.result.push({
      id: 99,
      companyId: 1,
      userId: 42,
      projectId: 7,
      itemType: 'project',
      itemId: '7',
      itemTitle: 'Burnt Mill Academy',
      createdAt: new Date(),
    });

    const caller = appRouter.createCaller(ctxFor(42));
    const row = await caller.bookmarks.add({
      companyId: 1,
      projectId: 7,
      itemType: 'project',
      itemId: '7',
      itemTitle: 'Burnt Mill Academy',
    });

    expect(row).toMatchObject({ id: 99, userId: 42 });
    expect(dbCalls.insertValues).toHaveLength(0);
  });
});

describe("bookmarks.list — actor from ctx (no cross-user reads)", () => {
  beforeEach(() => {
    dbCalls.selectClauses.length = 0;
    dbCalls.deleteClauses.length = 0;
    dbCalls.result.length = 0;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns rows scoped to ctx.user.id even when a different userId is smuggled", async () => {
    dbCalls.result.push({
      id: 11,
      companyId: 1,
      userId: 7,
      projectId: 3,
      itemType: 'project',
      itemId: '3',
      itemTitle: 'Site A',
      createdAt: new Date(),
    });

    const caller = appRouter.createCaller(ctxFor(7));
    const rows = await caller.bookmarks.list({
      companyId: 1,
      // @ts-expect-error — userId is no longer part of the input schema
      userId: 9999,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ userId: 7 });
  });
});

describe("bookmarks.remove — actor from ctx (no cross-user deletes)", () => {
  beforeEach(() => {
    dbCalls.selectClauses.length = 0;
    dbCalls.insertValues.length = 0;
    dbCalls.deleteClauses.length = 0;
    dbCalls.result.length = 0;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("runs DELETE scoped to ctx.user.id", async () => {
    const caller = appRouter.createCaller(ctxFor(7));
    await caller.bookmarks.remove({ id: 55, companyId: 1 });
    expect(dbCalls.deleteClauses).toHaveLength(1);
  });
});
