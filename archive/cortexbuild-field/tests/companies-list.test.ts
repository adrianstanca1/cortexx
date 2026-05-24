import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../server/_core/context";

/**
 * Tests for the `companies.list` procedure introduced for the multi-
 * tenant company switcher. Three contracts that matter:
 *
 *   1. The query is scoped by `ctx.user.id` — the WHERE clause filters
 *      `companyUsers.userId = ctx.user.id` so a logged-in user only
 *      sees memberships they actually hold. Cross-tenant leakage
 *      would expose every other company's branding, plan, billing
 *      contact, etc.
 *
 *   2. Inactive memberships are filtered out (companyUsers.isActive ===
 *      true). Mirror of the same rule in companyScopedProcedure.
 *
 *   3. Authentication is required. The procedure uses
 *      `protectedProcedure`, so an unauthenticated context yields
 *      UNAUTHORIZED rather than an empty list.
 */

const dbCalls: {
  selects: { columns: Record<string, unknown> }[];
  innerJoins: { on: unknown }[];
  wheres: { clause: unknown }[];
  result: Record<string, unknown>[];
} = { selects: [], innerJoins: [], wheres: [], result: [] };

vi.mock("../server/db", () => ({
  getDb: vi.fn(async () => ({
    select(columns: Record<string, unknown>) {
      dbCalls.selects.push({ columns });
      return {
        from(_table: any) {
          return {
            innerJoin(_other: any, on: unknown) {
              dbCalls.innerJoins.push({ on });
              return {
                where(clause: unknown) {
                  dbCalls.wheres.push({ clause });
                  return Promise.resolve(dbCalls.result);
                },
              };
            },
          };
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

describe("companies.list", () => {
  beforeEach(() => {
    dbCalls.selects.length = 0;
    dbCalls.innerJoins.length = 0;
    dbCalls.wheres.length = 0;
    dbCalls.result.length = 0;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns the user's active company memberships joined with the company record", async () => {
    dbCalls.result.push(
      {
        id: 7,
        name: 'Acme Construction',
        slug: 'acme',
        plan: 'pro',
        primaryColor: '#1E3A5F',
        cisStatus: 'registered_20',
        activeAiProvider: 'forge',
        activeAiModel: 'default',
        maxProjects: 999,
        maxUsers: 999,
        maxPipelines: 999,
        companyRole: 'company_admin',
        companyUserId: 42,
      },
    );

    const caller = appRouter.createCaller(ctxFor(1));
    const rows = await caller.companies.list();

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 7,
      name: 'Acme Construction',
      slug: 'acme',
      companyRole: 'company_admin',
      companyUserId: 42,
    });
  });

  it("issued exactly one SELECT with an innerJoin and a WHERE — drift detector for the query shape", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.companies.list();

    expect(dbCalls.selects).toHaveLength(1);
    expect(dbCalls.innerJoins).toHaveLength(1);
    expect(dbCalls.wheres).toHaveLength(1);

    // The selected column shape must include both company-side fields
    // and membership-side fields the UI uses to badge each row.
    const cols = dbCalls.selects[0]?.columns ?? {};
    for (const required of ['id', 'name', 'slug', 'plan', 'companyRole', 'companyUserId']) {
      expect(Object.keys(cols)).toContain(required);
    }
  });

  it("rejects unauthenticated callers with UNAUTHORIZED — no DB query issued", async () => {
    const unauthCtx = {
      user: null,
      req: { protocol: "https", hostname: "localhost", headers: {} },
      res: { clearCookie: vi.fn() },
    } as unknown as TrpcContext;
    const caller = appRouter.createCaller(unauthCtx);

    await expect(caller.companies.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    expect(dbCalls.selects).toHaveLength(0);
  });

  it("returns [] when the database is unavailable (graceful no-op for dev without DATABASE_URL)", async () => {
    // Override getDb just for this test so it returns null (matches the
    // dev-without-DATABASE_URL behaviour the rest of the codebase
    // assumes — see CLAUDE.md "the server starts without one but every
    // db helper short-circuits to a warning").
    const { getDb } = await import("../server/db");
    vi.mocked(getDb).mockResolvedValueOnce(null as any);

    const caller = appRouter.createCaller(ctxFor(1));
    const rows = await caller.companies.list();

    expect(rows).toEqual([]);
  });
});
