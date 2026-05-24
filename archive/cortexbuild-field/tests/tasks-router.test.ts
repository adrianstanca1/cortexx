import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../server/_core/context";
import {
  collectBindings,
  collectColumns,
  tableName,
} from "./_helpers/drizzle-mock";
import { expectTenantWhere } from "./_helpers/expect-tenant-where";

/**
 * Coverage for the tasks sub-router (`server/routers/index.ts`).
 *
 * Procedures: list, create (FK-guarded), updateStatus, update
 * (partial-write), delete.
 *
 * Notable behaviours pinned:
 *   - list: companyId always in WHERE; optional projectId AND status
 *     filters compose via `and(...)` — both, either, or neither.
 *   - create: FK-checks the project belongs to the company BEFORE
 *     INSERT (parallel to incidents.create / documents.saveGenerated);
 *     dueDate string is converted to Date; status defaults to
 *     'not_started'; priority defaults to 'medium'.
 *   - updateStatus: writes status AND updatedAt, nothing else; tenant
 *     -safe WHERE binds id AND companyId from input.
 *   - update: partial-write — only fields explicitly present reach
 *     SET; dueDate three-way handling (undefined / null / string);
 *     id / companyId stripped from SET; updatedAt always set.
 *   - delete: tenant-safe WHERE binds id AND companyId from input.
 */

interface DbCalls {
  selectFroms: {
    table: string;
    whereCols: string[];
    whereBindings: Record<string, unknown>;
  }[];
  inserts: { table: string; values: any }[];
  updates: {
    table: string;
    values: any;
    whereCols: string[];
    whereBindings: Record<string, unknown>;
  }[];
  deletes: {
    table: string;
    whereCols: string[];
    whereBindings: Record<string, unknown>;
  }[];
  projectsSelectReturn: any[];
}
const dbCalls: DbCalls = {
  selectFroms: [],
  inserts: [],
  updates: [],
  deletes: [],
  projectsSelectReturn: [],
};

vi.mock("../server/db", () => ({
  getDb: vi.fn(async () => ({
    select() {
      return {
        from(table: any) {
          const name = tableName(table);
          if (name.includes("company_users")) {
            return {
              where(_c: unknown) {
                return {
                  limit() {
                    return Promise.resolve([
                      { companyRole: "manager", isActive: true },
                    ]);
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
          const returnRows =
            name === "projects" ? dbCalls.projectsSelectReturn : [];
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
    update(table: any) {
      return {
        set(values: any) {
          const name = tableName(table);
          const record = {
            table: name,
            values,
            whereCols: [] as string[],
            whereBindings: {} as Record<string, unknown>,
          };
          dbCalls.updates.push(record);
          return {
            where(predicate: unknown) {
              record.whereCols.push(...collectColumns(predicate));
              Object.assign(record.whereBindings, collectBindings(predicate));
              return Promise.resolve();
            },
          };
        },
      };
    },
    delete(table: any) {
      const name = tableName(table);
      const record = {
        table: name,
        whereCols: [] as string[],
        whereBindings: {} as Record<string, unknown>,
      };
      dbCalls.deletes.push(record);
      return {
        where(predicate: unknown) {
          record.whereCols.push(...collectColumns(predicate));
          Object.assign(record.whereBindings, collectBindings(predicate));
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
      passwordHash: null, pushPreferences: {},
      createdAt: new Date(),
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
  dbCalls.updates.length = 0;
  dbCalls.deletes.length = 0;
  // Default: project belongs to the same company. Tests that exercise
  // the cross-tenant FK guard override this to [].
  dbCalls.projectsSelectReturn = [{ id: 7, companyId: 7 }];
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("tasks.list", () => {
  it("scoped to companyId; absent projectId/status means neither in WHERE", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.tasks.list({ companyId: 7 });
    const selects = dbCalls.selectFroms.filter((s) => s.table === "tasks");
    expect(selects).toHaveLength(1);
    expectTenantWhere(selects[0], { companyId: 7 });
    expect(selects[0].whereCols).not.toContain("projectId");
    expect(selects[0].whereCols).not.toContain("status");
  });

  it("with projectId, both companyId AND projectId reach WHERE", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.tasks.list({ companyId: 7, projectId: 3 });
    const selects = dbCalls.selectFroms.filter((s) => s.table === "tasks");
    expect(selects).toHaveLength(1);
    expectTenantWhere(selects[0], { companyId: 7, projectId: 3 });
    expect(selects[0].whereCols).not.toContain("status");
  });

  it("with status, both companyId AND status reach WHERE", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.tasks.list({ companyId: 7, status: "in_progress" });
    const selects = dbCalls.selectFroms.filter((s) => s.table === "tasks");
    expect(selects).toHaveLength(1);
    expectTenantWhere(selects[0], { companyId: 7, status: "in_progress" });
    expect(selects[0].whereCols).not.toContain("projectId");
  });

  it("with all three (companyId, projectId, status), all reach WHERE", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.tasks.list({
      companyId: 7,
      projectId: 3,
      status: "completed",
    });
    const selects = dbCalls.selectFroms.filter((s) => s.table === "tasks");
    expectTenantWhere(selects[0], {
      companyId: 7,
      projectId: 3,
      status: "completed",
    });
  });
});

describe("tasks.create", () => {
  const baseInput = {
    companyId: 7,
    projectId: 42,
    title: "Pour foundation slab",
  };

  it("FK guard: rejects when project belongs to a different company; no INSERT side effect", async () => {
    dbCalls.projectsSelectReturn = []; // project NOT in this company
    const caller = appRouter.createCaller(ctxFor(1));
    await expect(caller.tasks.create(baseInput)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(dbCalls.inserts.filter((i) => i.table === "tasks")).toHaveLength(0);
  });

  it("FK guard select binds both id AND companyId from input (distinct values catch a swap)", async () => {
    dbCalls.projectsSelectReturn = [{ id: 42, companyId: 7 }];
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.tasks.create(baseInput);
    const fkSelect = dbCalls.selectFroms.find((s) => s.table === "projects");
    expect(fkSelect).toBeDefined();
    expectTenantWhere(fkSelect!, {
      id: 42, // input.projectId
      companyId: 7, // input.companyId
    });
  });

  it("succeeds when project belongs to same company; status / priority defaults; exactly one INSERT", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.tasks.create(baseInput);
    const inserts = dbCalls.inserts.filter((i) => i.table === "tasks");
    expect(inserts).toHaveLength(1);
    expect(inserts[0].values).toMatchObject({
      companyId: 7,
      projectId: 42,
      title: "Pour foundation slab",
      status: "not_started", // default
      priority: "medium", // default
    });
  });

  it("dueDate string is converted to Date; absent dueDate is undefined in INSERT values", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.tasks.create({ ...baseInput, dueDate: "2026-12-31" });
    const insert = dbCalls.inserts.find((i) => i.table === "tasks")!;
    expect(insert.values.dueDate).toBeInstanceOf(Date);

    // Reset and call without dueDate.
    dbCalls.inserts.length = 0;
    await caller.tasks.create(baseInput);
    expect(dbCalls.inserts[0].values.dueDate).toBeUndefined();
  });

  it("rejects unknown status enum; no FK select, no INSERT", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await expect(
      caller.tasks.create({
        ...baseInput,
        // @ts-expect-error — exercising zod enum at runtime
        status: "made-up-status",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(
      dbCalls.selectFroms.filter((s) => s.table === "projects"),
    ).toHaveLength(0);
    expect(dbCalls.inserts.filter((i) => i.table === "tasks")).toHaveLength(0);
  });
});

describe("tasks.updateStatus", () => {
  it("writes status AND updatedAt only; tenant-safe WHERE binds id AND companyId", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.tasks.updateStatus({
      id: 5,
      companyId: 7,
      status: "completed",
    });
    expect(dbCalls.updates).toHaveLength(1);
    const upd = dbCalls.updates[0];
    expect(upd.table).toBe("tasks");
    expect(upd.values).toMatchObject({ status: "completed" });
    expect(upd.values.updatedAt).toBeInstanceOf(Date);
    // Only status and updatedAt — no other fields slip through.
    expect(Object.keys(upd.values).sort()).toEqual(["status", "updatedAt"]);
    expectTenantWhere(upd, { id: 5, companyId: 7 });
  });
});

describe("tasks.update — partial-write", () => {
  it("only writes fields explicitly present; updatedAt always set; id / companyId stripped from SET", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.tasks.update({
      id: 5,
      companyId: 7,
      priority: "high",
    });
    expect(dbCalls.updates).toHaveLength(1);
    const upd = dbCalls.updates[0];
    expect(upd.values).toMatchObject({ priority: "high" });
    expect(upd.values.updatedAt).toBeInstanceOf(Date);
    expect(upd.values).not.toHaveProperty("id");
    expect(upd.values).not.toHaveProperty("companyId");
    expectTenantWhere(upd, { id: 5, companyId: 7 });
  });

  it("dueDate=null is preserved as null in SET (explicit clear)", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.tasks.update({ id: 5, companyId: 7, dueDate: null });
    expect(dbCalls.updates[0].values.dueDate).toBeNull();
  });

  it("dueDate=string is converted to Date in SET", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.tasks.update({
      id: 5,
      companyId: 7,
      dueDate: "2026-12-31",
    });
    expect(dbCalls.updates[0].values.dueDate).toBeInstanceOf(Date);
  });

  it("absent dueDate is NOT in SET (partial-write semantics)", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.tasks.update({
      id: 5,
      companyId: 7,
      title: "Renamed",
    });
    expect(dbCalls.updates[0].values).not.toHaveProperty("dueDate");
  });

  it("rejects empty title via zod min(1); no UPDATE issued", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await expect(
      caller.tasks.update({ id: 5, companyId: 7, title: "" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(dbCalls.updates).toHaveLength(0);
  });
});

describe("tasks.delete", () => {
  it("DELETE on tasks binds id AND companyId from input in the WHERE clause", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.tasks.delete({ id: 5, companyId: 7 });
    expect(dbCalls.deletes).toHaveLength(1);
    expect(dbCalls.deletes[0].table).toBe("tasks");
    expectTenantWhere(dbCalls.deletes[0], { id: 5, companyId: 7 });
  });
});
