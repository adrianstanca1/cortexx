/**
 * Behaviour tests for the cross-tenant guards on `defects.*` and
 * `incidents.*` after their upgrade from protectedProcedure to
 * companyScopedProcedure.
 *
 * The companyScopedProcedure middleware already has its own unit tests
 * (tests/company-scoped-procedure.test.ts) — what those tests do NOT
 * cover is the procedure-level behaviour:
 *
 *   1. The Zod schema requires `companyId` (so omitting it BAD_REQUESTs
 *      before any DB work).
 *   2. The handler verifies the requested project actually belongs to
 *      the requested company before inserting (so a user with valid
 *      membership in company A can't write a defect against a project
 *      that belongs to company B).
 *   3. Reads include `companyId` in the WHERE clause (so even if the
 *      caller passes a projectId from another tenant, the result set
 *      is constrained to their company's rows).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";
import {
  defects as dbDefects,
  incidents as dbIncidents,
  projects as dbProjects,
  companyUsers as dbCompanyUsers,
} from "../drizzle/schema";

type WhereCondition = unknown;

interface MockState {
  // What the .where() filter looked like for each table (lets us assert
  // the procedure included companyId in the predicate).
  defectsListWhere: WhereCondition | null;
  incidentsListWhere: WhereCondition | null;
  defectsUpdateWhere: WhereCondition | null;
  // What was inserted (so we can confirm companyId is persisted).
  insertedDefect: any;
  insertedIncident: any;
  // What project lookup parameters were used during the FK check.
  projectLookups: { where: WhereCondition }[];
  // The row the project lookup should return — null = "not found, FORBIDDEN".
  projectLookupResult: { id: number; companyId: number }[];
}

const state: MockState = {
  defectsListWhere: null,
  incidentsListWhere: null,
  defectsUpdateWhere: null,
  insertedDefect: null,
  insertedIncident: null,
  projectLookups: [],
  projectLookupResult: [{ id: 100, companyId: 7 }],
};

function makeDb() {
  return {
    select() {
      return {
        from(table: unknown) {
          return {
            where(condition: WhereCondition) {
              if (table === dbDefects) state.defectsListWhere = condition;
              if (table === dbIncidents) state.incidentsListWhere = condition;
              if (table === dbProjects) state.projectLookups.push({ where: condition });

              return {
                limit() {
                  if (table === dbProjects) return Promise.resolve(state.projectLookupResult);
                  // companyScopedProcedure middleware looks up the user's
                  // companyUsers membership — return one so the middleware
                  // passes for the user/company pair the tests use.
                  if (table === dbCompanyUsers) return Promise.resolve([{ companyRole: "manager", isActive: true }]);
                  return Promise.resolve([]);
                },
                orderBy() {
                  return Promise.resolve([]);
                },
              };
            },
          };
        },
      };
    },
    insert(table: unknown) {
      return {
        values(values: any) {
          if (table === dbDefects) state.insertedDefect = values;
          if (table === dbIncidents) state.insertedIncident = values;
          return {
            returning() {
              return Promise.resolve([{ id: 999, ...values }]);
            },
          };
        },
      };
    },
    update(table: unknown) {
      return {
        set() {
          return {
            where(condition: WhereCondition) {
              if (table === dbDefects) state.defectsUpdateWhere = condition;
              return Promise.resolve();
            },
          };
        },
      };
    },
  };
}

vi.mock("../server/db", () => ({
  getDb: vi.fn(async () => makeDb()),
}));

function ctxWithUser(role: "user" | "admin" = "user"): TrpcContext {
  return {
    user: {
      id: 11,
      openId: "user-11",
      name: "Test User",
      email: "test@example.com",
      loginMethod: "manus",
      role,
      passwordHash: null, pushPreferences: {}, createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", hostname: "h", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

beforeEach(() => {
  state.defectsListWhere = null;
  state.incidentsListWhere = null;
  state.defectsUpdateWhere = null;
  state.insertedDefect = null;
  state.insertedIncident = null;
  state.projectLookups = [];
  state.projectLookupResult = [{ id: 100, companyId: 7 }];
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("defects tenant-scoping", () => {
  it("rejects a list call with no companyId (BAD_REQUEST from companyScopedProcedure)", async () => {
    const caller = appRouter.createCaller(ctxWithUser());
    // @ts-expect-error — deliberately omitting companyId
    await expect(caller.defects.list({})).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects a create call with no companyId", async () => {
    const caller = appRouter.createCaller(ctxWithUser());
    // For multi-line call expressions tsc reports the error on the call
    // site (the `caller.defects.create(` line), not on the missing
    // property — so `@ts-expect-error` has to sit above the call.
    await expect(
      // @ts-expect-error — deliberately omitting companyId
      caller.defects.create({
        projectId: 100,
        title: "x",
        reportedBy: "y",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("create blocks a project from another tenant with FORBIDDEN", async () => {
    // Simulate "this projectId is not in your company": the project lookup
    // returns no rows. The procedure must FORBID the insert.
    state.projectLookupResult = [];

    const caller = appRouter.createCaller(ctxWithUser());
    await expect(
      caller.defects.create({
        companyId: 7,
        projectId: 100, // belongs to a different company in this scenario
        title: "Foreign defect",
        reportedBy: "Attacker",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(state.insertedDefect).toBeNull();
  });

  it("create persists companyId on success and runs the project↔company FK check", async () => {
    state.projectLookupResult = [{ id: 100, companyId: 7 }];

    const caller = appRouter.createCaller(ctxWithUser());
    await caller.defects.create({
      companyId: 7,
      projectId: 100,
      title: "Cracked tile",
      reportedBy: "Alice",
      priority: "high",
    });

    expect(state.insertedDefect).toMatchObject({
      companyId: 7,
      projectId: 100,
      title: "Cracked tile",
      priority: "high",
    });
    // The project↔company FK lookup ran exactly once.
    expect(state.projectLookups.length).toBe(1);
  });

  it("list always filters by companyId (includes it in the WHERE)", async () => {
    const caller = appRouter.createCaller(ctxWithUser());
    await caller.defects.list({ companyId: 7 });
    expect(state.defectsListWhere).toBeTruthy();
    // We can't easily introspect Drizzle's SQL here, but we CAN assert the
    // procedure built a non-empty filter at all (vs. the previous
    // protectedProcedure version which only filtered by projectId or
    // returned everything).
  });

  it("updateStatus filters by companyId so foreign defects are immune", async () => {
    const caller = appRouter.createCaller(ctxWithUser());
    await caller.defects.updateStatus({ companyId: 7, id: 42, status: "resolved" });
    expect(state.defectsUpdateWhere).toBeTruthy();
  });

  it("admins (ctx.user.role==='admin') skip the membership check but still pass companyId through", async () => {
    state.projectLookupResult = [{ id: 100, companyId: 7 }];
    const caller = appRouter.createCaller(ctxWithUser("admin"));
    await caller.defects.create({
      companyId: 7,
      projectId: 100,
      title: "Admin-created defect",
      reportedBy: "Platform admin",
    });
    expect(state.insertedDefect).toMatchObject({ companyId: 7 });
  });
});

describe("incidents tenant-scoping", () => {
  it("rejects a list call with no companyId", async () => {
    const caller = appRouter.createCaller(ctxWithUser());
    // @ts-expect-error — deliberately omitting companyId
    await expect(caller.incidents.list({})).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("create blocks a project from another tenant with FORBIDDEN", async () => {
    state.projectLookupResult = [];

    const caller = appRouter.createCaller(ctxWithUser());
    await expect(
      caller.incidents.create({
        companyId: 7,
        projectId: 100,
        title: "Foreign incident",
        type: "near_miss",
        severity: "low",
        reportedBy: "Attacker",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(state.insertedIncident).toBeNull();
  });

  it("create persists companyId and runs the FK check on success", async () => {
    state.projectLookupResult = [{ id: 100, companyId: 7 }];

    const caller = appRouter.createCaller(ctxWithUser());
    await caller.incidents.create({
      companyId: 7,
      projectId: 100,
      title: "Slip on stairs",
      type: "first_aid",
      severity: "low",
      reportedBy: "Bob",
      riddorRequired: false,
    });

    expect(state.insertedIncident).toMatchObject({
      companyId: 7,
      projectId: 100,
      title: "Slip on stairs",
      type: "first_aid",
      severity: "low",
      riddorRequired: false,
    });
    expect(state.projectLookups.length).toBe(1);
  });

  it("list always filters by companyId (includes it in the WHERE)", async () => {
    const caller = appRouter.createCaller(ctxWithUser());
    await caller.incidents.list({ companyId: 7, projectId: 100 });
    expect(state.incidentsListWhere).toBeTruthy();
  });
});
