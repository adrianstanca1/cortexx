import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
import type { TrpcContext } from "../server/_core/context";

/**
 * Tests for `announcements.update` — the new procedure that lets
 * authors fix typos / change priority / re-pin without re-creating a
 * post (and losing read receipts, etc.).
 *
 * Three contracts:
 *
 *   1. Only fields actually present in the input are written. A caller
 *      editing just the body must not clobber the priority or pin
 *      state (every other field is optional in the input schema).
 *
 *   2. `expiresAt` is the one tri-state field: `undefined` = leave
 *      alone, `null` = clear the expiry, `string` = parse to Date.
 *      The procedure must distinguish these three cases.
 *
 *   3. The WHERE clause filters BOTH `id` AND `companyId` so a caller
 *      from company A can't edit company B's announcement by guessing
 *      an id (companyScopedProcedure already verified the caller's
 *      membership in `input.companyId`, but the id-belongs-to-this-
 *      company filter is the second lock).
 */

const dbCalls: {
  membershipChecks: number;
  updateSets: Record<string, unknown>[];
  whereClauses: unknown[];
} = { membershipChecks: 0, updateSets: [], whereClauses: [] };

vi.mock("../server/db", () => ({
  getDb: vi.fn(async () => {
    let mode: 'membership' | 'announcement' = 'announcement';
    return {
      select(_columns?: any) {
        return {
          from(table: any) {
            const isMembership = getTableName(table).includes('company_users');
            mode = isMembership ? 'membership' : 'announcement';
            return {
              where(_clause: unknown) {
                if (mode === 'membership') {
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

describe("announcements.update", () => {
  beforeEach(() => {
    dbCalls.membershipChecks = 0;
    dbCalls.updateSets.length = 0;
    dbCalls.whereClauses.length = 0;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("only writes the fields actually present — partial edit doesn't clobber others", async () => {
    const caller = appRouter.createCaller(ctxFor(1));

    await caller.announcements.update({
      id: 5,
      companyId: 7,
      body: 'Updated body text',
    });

    expect(dbCalls.updateSets).toHaveLength(1);
    const set = dbCalls.updateSets[0]!;
    expect(set).toHaveProperty('body', 'Updated body text');
    expect(set).toHaveProperty('updatedAt');
    // Title/priority/isPinned/expiresAt were not in input — must NOT be in the update set.
    expect(set).not.toHaveProperty('title');
    expect(set).not.toHaveProperty('priority');
    expect(set).not.toHaveProperty('isPinned');
    expect(set).not.toHaveProperty('expiresAt');
  });

  it("expiresAt: undefined skips the field, null writes null, string parses to Date", async () => {
    const caller = appRouter.createCaller(ctxFor(1));

    // Case 1: omitted → field not in update set
    await caller.announcements.update({ id: 5, companyId: 7, body: 'x' });
    expect(dbCalls.updateSets[0]).not.toHaveProperty('expiresAt');

    // Case 2: explicit null → cleared
    dbCalls.updateSets.length = 0;
    await caller.announcements.update({ id: 5, companyId: 7, expiresAt: null });
    expect(dbCalls.updateSets[0]).toHaveProperty('expiresAt', null);

    // Case 3: ISO string → Date
    dbCalls.updateSets.length = 0;
    await caller.announcements.update({
      id: 5,
      companyId: 7,
      expiresAt: '2026-12-31T00:00:00.000Z',
    });
    const set = dbCalls.updateSets[0]!;
    expect(set.expiresAt).toBeInstanceOf(Date);
    expect((set.expiresAt as Date).toISOString()).toBe('2026-12-31T00:00:00.000Z');
  });

  it("rejects unauthenticated callers (companyScopedProcedure → protectedProcedure → UNAUTHORIZED)", async () => {
    const unauthCtx = {
      user: null,
      req: { protocol: "https", hostname: "localhost", headers: {} },
      res: { clearCookie: vi.fn() },
    } as unknown as TrpcContext;
    const caller = appRouter.createCaller(unauthCtx);

    await expect(
      caller.announcements.update({ id: 1, companyId: 1, body: 'noop' }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    expect(dbCalls.updateSets).toHaveLength(0);
  });

  it("ran the membership check (companyScopedProcedure middleware) before the update", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.announcements.update({ id: 5, companyId: 7, body: 'x' });
    expect(dbCalls.membershipChecks).toBe(1);
  });
});
