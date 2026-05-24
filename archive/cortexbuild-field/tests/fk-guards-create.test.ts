import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../server/_core/context";
import {
  collectBindings,
  collectColumns,
  tableName,
} from "./_helpers/drizzle-mock";
import { expectTenantWhere } from "./_helpers/expect-tenant-where";

/**
 * Regression tests for the cross-tenant FK guards added on
 * `projectId` in four create procedures: rfis.create, drawings.create,
 * announcements.create (when projectId is provided), and
 * actionPlans.create.
 *
 * Without these guards a member of company A could call e.g.
 * `rfis.create({ companyId: A, projectId: <B's project id>, ... })`,
 * which `companyScopedProcedure` admits because alice IS a member of A.
 * The procedure would then insert with companyId=A but projectId pointing
 * at company B's row — a data-integrity leak that breaks UI joins on
 * either side and leaks RFI/drawing presence into B's project.
 *
 * Mirrors the existing guards on inspections.create / observations.create /
 * tasks.create / files.upload / documents.saveGenerated / defects.create,
 * pinned in their respective test files. The shared rfis-router.test.ts
 * already pins the rfis side of this; this file closes the remaining
 * three (drawings, announcements, actionPlans) and adds a parallel
 * sanity check for rfis.
 */

interface DbCalls {
  selectFroms: {
    table: string;
    whereCols: string[];
    whereBindings: Record<string, unknown>;
  }[];
  inserts: { table: string; values: any }[];
  projectsSelectReturn: any[];
  rfisCountReturn: any[];
}
const dbCalls: DbCalls = {
  selectFroms: [],
  inserts: [],
  projectsSelectReturn: [],
  rfisCountReturn: [],
};

vi.mock("../server/db", () => ({
  getDb: vi.fn(async () => ({
    select(projection?: any) {
      const isCountQuery = projection !== undefined && "c" in projection;
      return {
        from(table: any) {
          const name = tableName(table);
          if (name.includes("company_users")) {
            return {
              where(_c: unknown) {
                return {
                  // companyScopedProcedure middleware: terminates with .limit(1)
                  // after the membership lookup. Returns one row so the gate
                  // accepts the caller as a tenant member.
                  limit() {
                    return Promise.resolve([
                      { companyRole: "manager", isActive: true },
                    ]);
                  },
                  // Phase 3.4 broadcast lookup in rfis.create: terminates by
                  // awaiting the chain (no .limit()). Empty list = no broadcast
                  // emails fired in these tests, which is exactly what we want
                  // — these tests assert the FK guard, not the email surface.
                  then(resolve: any) {
                    return Promise.resolve([]).then(resolve);
                  },
                };
              },
            };
          }
          const record = {
            table: name,
            whereCols: [] as string[],
            whereBindings: {} as Record<string, unknown>,
          };
          dbCalls.selectFroms.push(record);
          const returnRows = isCountQuery
            ? dbCalls.rfisCountReturn
            : name === "projects"
              ? dbCalls.projectsSelectReturn
              : [];
          const chain: any = {
            where(predicate: unknown) {
              record.whereCols.push(...collectColumns(predicate));
              Object.assign(record.whereBindings, collectBindings(predicate));
              return chain;
            },
            orderBy(_o: unknown) {
              return Promise.resolve(returnRows);
            },
            limit(_n: number) {
              return Promise.resolve(returnRows);
            },
            then(resolve: any) {
              return Promise.resolve(returnRows).then(resolve);
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
          return {
            returning() {
              return Promise.resolve([{ id: 999, ...values }]);
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
    req: { protocol: "https", hostname: "localhost", headers: {} } as any,
    res: { clearCookie: vi.fn() } as any,
  };
}

beforeEach(() => {
  dbCalls.selectFroms.length = 0;
  dbCalls.inserts.length = 0;
  // Default: project belongs to the same company so the FK guard passes.
  // Tests that exercise cross-tenant rejection override this.
  dbCalls.projectsSelectReturn = [{ id: 42, companyId: 7 }];
  // count(*) for rfis numbering returns 0 by default.
  dbCalls.rfisCountReturn = [{ c: 0 }];
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("rfis.create — cross-tenant FK guard", () => {
  it("rejects FORBIDDEN when projectId is in another company; no INSERT", async () => {
    dbCalls.projectsSelectReturn = [];
    const caller = appRouter.createCaller(ctxFor(1));
    await expect(
      caller.rfis.create({
        companyId: 7,
        projectId: 999,
        subject: "x",
        question: "y",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(dbCalls.inserts.filter((i) => i.table === "rfis")).toHaveLength(0);
  });

  it("FK select binds projectId AND companyId from input", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.rfis.create({
      companyId: 7,
      projectId: 42,
      subject: "x",
      question: "y",
    });
    const fkSelect = dbCalls.selectFroms.find((s) => s.table === "projects");
    expect(fkSelect).toBeTruthy();
    expectTenantWhere(fkSelect!, { id: 42, companyId: 7 });
  });
});

describe("drawings.create — cross-tenant FK guard", () => {
  it("rejects FORBIDDEN when projectId is in another company; no INSERT", async () => {
    dbCalls.projectsSelectReturn = [];
    const caller = appRouter.createCaller(ctxFor(1));
    await expect(
      caller.drawings.create({
        companyId: 7,
        projectId: 999,
        title: "Plan",
        fileUrl: "/storage/plan.pdf",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(dbCalls.inserts.filter((i) => i.table === "drawings")).toHaveLength(
      0,
    );
  });

  it("succeeds when project belongs to the same company; INSERT happens with uploadedById from ctx", async () => {
    const caller = appRouter.createCaller(ctxFor(5));
    await caller.drawings.create({
      companyId: 7,
      projectId: 42,
      title: "Plan",
      fileUrl: "/storage/plan.pdf",
    });
    const insert = dbCalls.inserts.find((i) => i.table === "drawings")!;
    expect(insert.values.uploadedById).toBe(5);
  });

  it("FK select binds projectId AND companyId from input", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.drawings.create({
      companyId: 7,
      projectId: 42,
      title: "Plan",
      fileUrl: "/storage/plan.pdf",
    });
    const fkSelect = dbCalls.selectFroms.find((s) => s.table === "projects");
    expect(fkSelect).toBeTruthy();
    expectTenantWhere(fkSelect!, { id: 42, companyId: 7 });
  });
});

describe("announcements.create — cross-tenant FK guard (only when projectId is provided)", () => {
  it("rejects FORBIDDEN when projectId is in another company; no INSERT", async () => {
    dbCalls.projectsSelectReturn = [];
    const caller = appRouter.createCaller(ctxFor(1));
    await expect(
      caller.announcements.create({
        companyId: 7,
        projectId: 999,
        title: "Heads up",
        body: "...",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(
      dbCalls.inserts.filter((i) => i.table === "announcements"),
    ).toHaveLength(0);
  });

  it("succeeds when project belongs to the same company", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.announcements.create({
      companyId: 7,
      projectId: 42,
      title: "Heads up",
      body: "...",
    });
    expect(
      dbCalls.inserts.filter((i) => i.table === "announcements"),
    ).toHaveLength(1);
  });

  it("skips the FK guard entirely for company-wide announcements (no projectId)", async () => {
    dbCalls.projectsSelectReturn = []; // doesn't matter — FK select shouldn't run
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.announcements.create({
      companyId: 7,
      title: "Company-wide notice",
      body: "...",
    });
    // INSERT happened, and no projects FK select was issued.
    expect(
      dbCalls.inserts.filter((i) => i.table === "announcements"),
    ).toHaveLength(1);
    expect(
      dbCalls.selectFroms.filter((s) => s.table === "projects"),
    ).toHaveLength(0);
  });

  it("FK select binds projectId AND companyId from input (when projectId is provided)", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.announcements.create({
      companyId: 7,
      projectId: 42,
      title: "x",
      body: "y",
    });
    const fkSelect = dbCalls.selectFroms.find((s) => s.table === "projects");
    expect(fkSelect).toBeTruthy();
    expectTenantWhere(fkSelect!, { id: 42, companyId: 7 });
  });
});

describe("actionPlans.create — cross-tenant FK guard", () => {
  it("rejects FORBIDDEN when projectId is in another company; no INSERT", async () => {
    dbCalls.projectsSelectReturn = [];
    const caller = appRouter.createCaller(ctxFor(1));
    await expect(
      caller.actionPlans.create({
        companyId: 7,
        projectId: 999,
        title: "Stand-down",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(
      dbCalls.inserts.filter((i) => i.table === "action_plans"),
    ).toHaveLength(0);
  });

  it("succeeds when project belongs to the same company; createdById is from ctx", async () => {
    const caller = appRouter.createCaller(ctxFor(5));
    await caller.actionPlans.create({
      companyId: 7,
      projectId: 42,
      title: "Stand-down",
    });
    const insert = dbCalls.inserts.find((i) => i.table === "action_plans")!;
    expect(insert.values.createdById).toBe(5);
  });

  it("FK select binds projectId AND companyId from input", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.actionPlans.create({
      companyId: 7,
      projectId: 42,
      title: "x",
    });
    const fkSelect = dbCalls.selectFroms.find((s) => s.table === "projects");
    expect(fkSelect).toBeTruthy();
    expectTenantWhere(fkSelect!, { id: 42, companyId: 7 });
  });
});
