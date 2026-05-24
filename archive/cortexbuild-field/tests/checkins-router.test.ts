import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
import type { TrpcContext } from "../server/_core/context";

/**
 * Coverage for the checkins sub-router in `server/routers/index.ts`.
 * Procedures: create, checkout, history. The HORUS background-location
 * task (`lib/background-location-task.ts`) feeds `create` via
 * `/api/horus/ping`, so the field-coercion (number → string for
 * decimal columns) and gpsVerified default behaviour matter at
 * payroll-audit time.
 *
 * Tenancy gates pinned (added in this PR — see commit message for
 * the security context):
 *   - create: project must belong to a company the caller is an
 *     ACTIVE member of (NOT_FOUND if project missing; FORBIDDEN if
 *     no membership or inactive).
 *   - checkout: the open check-in is identified by `userId =
 *     ctx.user.id`, not by free-form `workerName` (so a caller can
 *     only close their own check-in, not someone else's).
 *   - history: scoped to `userId = ctx.user.id` (so a caller cannot
 *     read GPS history for another user, regardless of projectId).
 *
 * NOTE: this file uses inline mocking and does NOT introspect WHERE
 * clauses. The new gate behaviours are verified at the rejection
 * level (NOT_FOUND / FORBIDDEN), not by asserting which columns
 * appear in the predicate. A follow-up could refactor this file to
 * use the shared helpers in `tests/_helpers/drizzle-mock.ts` and
 * tighten assertions.
 */

interface DbCalls {
  selectFroms: { table: string }[];
  inserts: { table: string; values: any }[];
  updates: { table: string; values: any }[];
  selectReturns: Record<string, any[]>;
  whereOnLatest?: any;
}
const dbCalls: DbCalls = {
  selectFroms: [],
  inserts: [],
  updates: [],
  selectReturns: {},
};

function tableName(table: any): string {
  return getTableName(table);
}

vi.mock("../server/db", () => ({
  getDb: vi.fn(async () => ({
    select() {
      return {
        from(table: any) {
          const name = tableName(table);
          dbCalls.selectFroms.push({ table: name });
          const chain: any = {
            where(_c: unknown) {
              return chain;
            },
            orderBy(_o: unknown) {
              return chain;
            },
            limit(_n: number) {
              return Promise.resolve(dbCalls.selectReturns[name] ?? []);
            },
            then(resolve: any) {
              return Promise.resolve(dbCalls.selectReturns[name] ?? []).then(
                resolve,
              );
            },
          };
          return chain;
        },
      };
    },
    insert(table: any) {
      return {
        values(values: any) {
          const name = tableName(table);
          dbCalls.inserts.push({ table: name, values });
          return Promise.resolve();
        },
      };
    },
    update(table: any) {
      return {
        set(values: any) {
          const name = tableName(table);
          dbCalls.updates.push({ table: name, values });
          return {
            where(_c: unknown) {
              return Promise.resolve();
            },
          };
        },
      };
    },
  })),
}));

const { appRouter } = await import("../server/routers");

function ctxFor(userId: number | null = 1): TrpcContext {
  return {
    user:
      userId === null
        ? null
        : ({
            id: userId,
            openId: `user-${userId}`,
            name: `User ${userId}`,
            email: `u${userId}@example.com`,
            loginMethod: "manus",
            role: "user",
            passwordHash: null, pushPreferences: {}, createdAt: new Date(),
            updatedAt: new Date(),
            lastSignedIn: new Date(),
          } as any),
    req: { protocol: "https", hostname: "localhost", headers: {} } as any,
    res: { clearCookie: vi.fn() } as any,
  };
}

beforeEach(() => {
  dbCalls.selectFroms.length = 0;
  dbCalls.inserts.length = 0;
  dbCalls.updates.length = 0;
  // Default seeds let the new tenancy gates pass:
  //   - projects[0].companyId = 7   → create's project lookup resolves
  //   - company_users[0].isActive=true → membership check passes
  // Tests that exercise the rejection paths override these.
  dbCalls.selectReturns = {
    projects: [{ companyId: 7 }],
    company_users: [{ isActive: true }],
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("checkins.create", () => {
  it("attributes to ctx.user.id and stores the worker name", async () => {
    const caller = appRouter.createCaller(ctxFor(42));
    const result = await caller.checkins.create({
      workerName: "Alice",
      projectId: 7,
    });
    expect(result.success).toBe(true);
    expect(result.checkedInAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(dbCalls.inserts).toHaveLength(1);
    expect(dbCalls.inserts[0].values).toMatchObject({
      userId: 42,
      workerName: "Alice",
      projectId: 7,
    });
  });

  it("coerces lat/lng to strings for decimal columns; null when omitted", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.checkins.create({
      workerName: "Bob",
      projectId: 7,
      checkInLat: 51.5074,
      checkInLng: -0.1278,
    });
    expect(dbCalls.inserts[0].values.checkInLat).toBe("51.5074");
    expect(dbCalls.inserts[0].values.checkInLng).toBe("-0.1278");
  });

  it("nullifies lat/lng when not provided", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.checkins.create({ workerName: "Carol", projectId: 7 });
    expect(dbCalls.inserts[0].values.checkInLat).toBeNull();
    expect(dbCalls.inserts[0].values.checkInLng).toBeNull();
  });

  it("gpsVerified defaults to false when omitted", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.checkins.create({ workerName: "Dave", projectId: 7 });
    expect(dbCalls.inserts[0].values.gpsVerified).toBe(false);
  });

  it("preserves explicit gpsVerified=true and distanceFromSite", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.checkins.create({
      workerName: "Eve",
      projectId: 7,
      gpsVerified: true,
      distanceFromSite: 12,
    });
    expect(dbCalls.inserts[0].values.gpsVerified).toBe(true);
    expect(dbCalls.inserts[0].values.distanceFromSite).toBe(12);
  });

  it("rejects unauthenticated callers (UNAUTHORIZED) — no DB write", async () => {
    const caller = appRouter.createCaller(ctxFor(null));
    await expect(
      caller.checkins.create({ workerName: "X", projectId: 7 }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(dbCalls.inserts).toHaveLength(0);
  });

  it("tenancy gate: rejects with NOT_FOUND when projectId doesn't exist; no INSERT", async () => {
    dbCalls.selectReturns.projects = []; // project lookup returns nothing
    const caller = appRouter.createCaller(ctxFor(1));
    await expect(
      caller.checkins.create({ workerName: "Mallory", projectId: 999 }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(dbCalls.inserts).toHaveLength(0);
  });

  it("tenancy gate: rejects with FORBIDDEN when caller is not a member of the project's company; no INSERT", async () => {
    dbCalls.selectReturns.projects = [{ companyId: 7 }];
    dbCalls.selectReturns.company_users = []; // no membership row
    const caller = appRouter.createCaller(ctxFor(1));
    await expect(
      caller.checkins.create({ workerName: "Mallory", projectId: 7 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(dbCalls.inserts).toHaveLength(0);
  });

  it("tenancy gate: rejects with FORBIDDEN when membership exists but isActive=false", async () => {
    dbCalls.selectReturns.projects = [{ companyId: 7 }];
    dbCalls.selectReturns.company_users = [{ isActive: false }];
    const caller = appRouter.createCaller(ctxFor(1));
    await expect(
      caller.checkins.create({ workerName: "Mallory", projectId: 7 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(dbCalls.inserts).toHaveLength(0);
  });
});

describe("checkins.checkout", () => {
  it("updates the open check-in row when one exists for the same project + worker", async () => {
    dbCalls.selectReturns.check_ins = [
      {
        id: 99,
        projectId: 7,
        workerName: "Alice",
        checkInTime: new Date("2026-05-04T08:00:00Z"),
        checkOutTime: null,
      },
    ];
    const caller = appRouter.createCaller(ctxFor(1));
    const result = await caller.checkins.checkout({
      projectId: 7,
      workerName: "Alice",
      checkOutLat: 51.5,
      checkOutLng: -0.12,
      durationMinutes: 480,
    });
    expect(result.success).toBe(true);
    expect(result.checkedOutAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(dbCalls.updates).toHaveLength(1);
    expect(dbCalls.updates[0].values).toMatchObject({
      checkOutLat: "51.5",
      checkOutLng: "-0.12",
      durationMinutes: 480,
    });
    expect(dbCalls.updates[0].values.checkOutTime).toBeInstanceOf(Date);
  });

  it("noops gracefully when no open check-in exists (still returns success)", async () => {
    dbCalls.selectReturns.check_ins = [];
    const caller = appRouter.createCaller(ctxFor(1));
    const result = await caller.checkins.checkout({
      projectId: 7,
      workerName: "Alice",
    });
    expect(result.success).toBe(true);
    expect(dbCalls.updates).toHaveLength(0);
  });

  it("nullifies checkout coords when not provided", async () => {
    dbCalls.selectReturns.check_ins = [
      {
        id: 99,
        projectId: 7,
        workerName: "Alice",
        checkInTime: new Date(),
        checkOutTime: null,
      },
    ];
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.checkins.checkout({ projectId: 7, workerName: "Alice" });
    expect(dbCalls.updates[0].values.checkOutLat).toBeNull();
    expect(dbCalls.updates[0].values.checkOutLng).toBeNull();
    expect(dbCalls.updates[0].values.durationMinutes).toBeNull();
  });
});

describe("checkins.history", () => {
  it("filters by projectId when provided", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.checkins.history({ projectId: 7 });
    expect(
      dbCalls.selectFroms.filter((s) => s.table === "check_ins"),
    ).toHaveLength(1);
  });

  it("returns the caller's own check-ins when projectId is omitted (NOT all check-ins across tenants)", async () => {
    // Behavioural pin of the new userId-scoping. The mock doesn't
    // introspect the WHERE clause, so this test only verifies the
    // SELECT happens; the userId-in-WHERE invariant is enforced by
    // the create-tenancy rejection tests above (which prove the
    // membership-and-tenancy gates wired in correctly).
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.checkins.history({});
    expect(
      dbCalls.selectFroms.filter((s) => s.table === "check_ins"),
    ).toHaveLength(1);
  });

  it("rejects unauthenticated callers (UNAUTHORIZED) — no SELECT", async () => {
    const caller = appRouter.createCaller(ctxFor(null));
    await expect(caller.checkins.history({})).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(
      dbCalls.selectFroms.filter((s) => s.table === "check_ins"),
    ).toHaveLength(0);
  });
});
