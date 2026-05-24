import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
import type { TrpcContext } from "../server/_core/context";

/**
 * Smoke contract for the comprehensive CRUD-completeness pass: each of
 * the 9 resources that previously lacked an `update` and/or `delete`
 * now has one, AND each one rejects unauthenticated callers with
 * UNAUTHORIZED before issuing any DB write.
 *
 * This isn't a deep behavioural test for each procedure (per-resource
 * tests like `tests/announcements-update.test.ts`,
 * `tests/drawings-update-delete.test.ts`, and
 * `tests/defects-update-delete.test.ts` already cover the per-field
 * partial-write semantics in detail). This file is a load-bearing
 * sanity sweep: if a future refactor accidentally drops one of the
 * new procedures, these tests fire.
 */

const dbCalls: { writes: number } = { writes: 0 };

vi.mock("../server/db", () => ({
  getDb: vi.fn(async () => ({
    select(_columns?: any) {
      return {
        from(table: any) {
          const isMembership = getTableName(table).includes('company_users');
          return {
            where(_clause: unknown) {
              if (isMembership) {
                return { limit() { return Promise.resolve([{ companyRole: 'manager', isActive: true }]); } };
              }
              return Promise.resolve([]);
            },
          };
        },
      };
    },
    update(_table: any) {
      return {
        set(_v: Record<string, unknown>) {
          return { where(_c: unknown) { dbCalls.writes += 1; return Promise.resolve(); } };
        },
      };
    },
    delete(_table: any) {
      return {
        where(_c: unknown) { dbCalls.writes += 1; return Promise.resolve(); },
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

const UNAUTH_CTX = {
  user: null,
  req: { protocol: "https", hostname: "localhost", headers: {} },
  res: { clearCookie: vi.fn() },
} as unknown as TrpcContext;

beforeEach(() => { dbCalls.writes = 0; });
afterEach(() => { vi.clearAllMocks(); });

describe("CRUD-completeness pass — every new update/delete procedure exists and is gated", () => {
  it.each([
    // [router, procedure, sample-input]
    ['incidents.update',     { id: 1, companyId: 1, title: 't' } as const],
    ['incidents.delete',     { id: 1, companyId: 1 } as const],
    ['permits.update',       { id: 1, companyId: 1, title: 't' } as const],
    ['permits.delete',       { id: 1, companyId: 1 } as const],
    ['dailyReports.update',  { id: 1, companyId: 1, status: 'submitted' } as const],
    ['dailyReports.delete',  { id: 1, companyId: 1 } as const],
    ['tasks.update',         { id: 1, companyId: 1, title: 't' } as const],
    ['tasks.delete',         { id: 1, companyId: 1 } as const],
    ['inspections.update',   { id: 1, companyId: 1, title: 't' } as const],
    ['inspections.delete',   { id: 1, companyId: 1 } as const],
    ['rfis.update',          { id: 1, companyId: 1, subject: 's' } as const],
    ['rfis.delete',          { id: 1, companyId: 1 } as const],
    ['observations.update',  { id: 1, companyId: 1, title: 't' } as const],
    ['observations.delete',  { id: 1, companyId: 1 } as const],
    ['actionPlans.update',   { id: 1, companyId: 1, title: 't' } as const],
    ['actionPlans.delete',   { id: 1, companyId: 1 } as const],
    ['projects.delete',      { id: 1, companyId: 1 } as const],
  ])('procedure "%s" runs through to a DB write for an authenticated caller', async (path, input) => {
    const caller = appRouter.createCaller(ctxFor(1));
    const [router, proc] = path.split('.') as [string, string];
    // @ts-expect-error — dynamic dispatch through the caller is fine
    await caller[router][proc](input);
    expect(dbCalls.writes).toBeGreaterThanOrEqual(1);
  });

  it.each([
    'incidents.update', 'incidents.delete',
    'permits.update', 'permits.delete',
    'dailyReports.update', 'dailyReports.delete',
    'tasks.update', 'tasks.delete',
    'inspections.update', 'inspections.delete',
    'rfis.update', 'rfis.delete',
    'observations.update', 'observations.delete',
    'actionPlans.update', 'actionPlans.delete',
    'projects.delete',
  ])('procedure "%s" rejects unauthenticated callers with UNAUTHORIZED — no DB write', async (path) => {
    const caller = appRouter.createCaller(UNAUTH_CTX);
    const [router, proc] = path.split('.') as [string, string];
    // Sample minimal input: just id + companyId is enough for delete; for
    // update we add a title field so any min(1) constraint passes.
    const input = { id: 1, companyId: 1, title: 't', subject: 't' };
    await expect(
      // @ts-expect-error — dynamic dispatch through the caller is fine
      caller[router][proc](input),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(dbCalls.writes).toBe(0);
  });
});
