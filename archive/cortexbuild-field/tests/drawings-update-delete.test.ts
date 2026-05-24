import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
import type { TrpcContext } from "../server/_core/context";

/**
 * Tests for `drawings.update` and `drawings.delete` — the new
 * procedures that complete the CRUD set for the drawings register.
 *
 * Same partial-write rule as `announcements.update`: only fields
 * actually present in the input are written, so a caller editing
 * just the title doesn't clobber the revision. `uploadedById`
 * is intentionally NOT updatable (it's the provenance trail).
 */

const dbCalls: {
  membershipChecks: number;
  updateSets: Record<string, unknown>[];
  deletes: number;
  whereClauses: unknown[];
} = { membershipChecks: 0, updateSets: [], deletes: 0, whereClauses: [] };

vi.mock("../server/db", () => ({
  getDb: vi.fn(async () => ({
    select(_columns?: any) {
      return {
        from(table: any) {
          const isMembership = getTableName(table).includes('company_users');
          return {
            where(_clause: unknown) {
              if (isMembership) {
                dbCalls.membershipChecks += 1;
                return {
                  limit() {
                    return Promise.resolve([{ companyRole: 'manager', isActive: true }]);
                  },
                };
              }
              return Promise.resolve([]);
            },
          };
        },
      };
    },
    update(_table: any) {
      return {
        set(values: Record<string, unknown>) {
          dbCalls.updateSets.push(values);
          return {
            where(clause: unknown) {
              dbCalls.whereClauses.push(clause);
              return Promise.resolve();
            },
          };
        },
      };
    },
    delete(_table: any) {
      return {
        where(clause: unknown) {
          dbCalls.deletes += 1;
          dbCalls.whereClauses.push(clause);
          return Promise.resolve();
        },
      };
    },
  })),
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

describe("drawings.update", () => {
  beforeEach(() => {
    dbCalls.membershipChecks = 0;
    dbCalls.updateSets.length = 0;
    dbCalls.deletes = 0;
    dbCalls.whereClauses.length = 0;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("only writes fields actually present in input — partial edit doesn't clobber others", async () => {
    const caller = appRouter.createCaller(ctxFor(1));

    await caller.drawings.update({
      id: 5,
      companyId: 7,
      title: 'Floor Plan – Level 2 (rev C)',
    });

    expect(dbCalls.updateSets).toHaveLength(1);
    const set = dbCalls.updateSets[0]!;
    expect(set).toHaveProperty('title', 'Floor Plan – Level 2 (rev C)');
    expect(set).toHaveProperty('updatedAt');
    // Revision/discipline/fileUrl/etc. were not in the input — must NOT be in the update.
    expect(set).not.toHaveProperty('revision');
    expect(set).not.toHaveProperty('discipline');
    expect(set).not.toHaveProperty('fileUrl');
    // uploadedById can never be passed (input schema doesn't include it)
    expect(set).not.toHaveProperty('uploadedById');
  });

  it("rejects unauthenticated callers (UNAUTHORIZED) — no DB write", async () => {
    const unauthCtx = {
      user: null,
      req: { protocol: "https", hostname: "localhost", headers: {} },
      res: { clearCookie: vi.fn() },
    } as unknown as TrpcContext;
    const caller = appRouter.createCaller(unauthCtx);

    await expect(
      caller.drawings.update({ id: 1, companyId: 1, title: 'noop' }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    expect(dbCalls.updateSets).toHaveLength(0);
  });
});

describe("drawings.delete", () => {
  beforeEach(() => {
    dbCalls.membershipChecks = 0;
    dbCalls.updateSets.length = 0;
    dbCalls.deletes = 0;
    dbCalls.whereClauses.length = 0;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("issues exactly one DELETE through companyScopedProcedure", async () => {
    const caller = appRouter.createCaller(ctxFor(1));

    await caller.drawings.delete({ id: 5, companyId: 7 });

    expect(dbCalls.deletes).toBe(1);
    // Membership middleware ran once before the delete.
    expect(dbCalls.membershipChecks).toBe(1);
  });

  it("rejects unauthenticated callers (UNAUTHORIZED) — no DELETE issued", async () => {
    const unauthCtx = {
      user: null,
      req: { protocol: "https", hostname: "localhost", headers: {} },
      res: { clearCookie: vi.fn() },
    } as unknown as TrpcContext;
    const caller = appRouter.createCaller(unauthCtx);

    await expect(
      caller.drawings.delete({ id: 1, companyId: 1 }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    expect(dbCalls.deletes).toBe(0);
  });
});
