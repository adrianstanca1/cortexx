import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../server/_core/context";
import {
  collectBindings,
  collectColumns,
  tableName,
} from "./_helpers/drizzle-mock";
import { expectTenantWhere } from "./_helpers/expect-tenant-where";

/**
 * Coverage for the inspections sub-router (`server/routers/index.ts`).
 *
 * Procedures: list, create, complete, update (partial-write), delete.
 *
 * Notable behaviours pinned:
 *   - list: companyId always in WHERE; optional projectId predicate.
 *   - create:
 *       * Cross-tenant FK guard: `projects.id` AND `projects.companyId`
 *         both reach the FK select's WHERE; rejects FORBIDDEN with no
 *         INSERT side effect when the project doesn't belong to the
 *         company. Mirrors incidents.create / tasks.create / etc.
 *       * `conductedById` is taken from ctx.user.id, NOT input — fixes
 *         a prior security issue where the procedure took
 *         `conductedById` with `.default(1)`, letting callers forge
 *         attribution or silently attribute to user 1 (super-admin)
 *         when omitted.
 *       * `status` is hard-set to 'scheduled' on creation (not from
 *         input).
 *       * `type` defaults to 'general'.
 *   - complete: writes the closing fields (checklistItems, overallResult,
 *     notes, photoUrls, status='completed', completedAt, updatedAt) AND
 *     binds id+companyId in WHERE.
 *   - update: partial-write — only fields explicitly present reach SET;
 *     scheduledAt three-way handling (undefined / null / string);
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
  dbCalls.updates.length = 0;
  dbCalls.deletes.length = 0;
  // Default: project belongs to the same company so the FK guard
  // passes. Tests that exercise cross-tenant rejection override this.
  dbCalls.projectsSelectReturn = [{ id: 42, companyId: 7 }];
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("inspections.list", () => {
  it("scoped to companyId; absent projectId means projectId NOT in WHERE", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.inspections.list({ companyId: 7 });
    const selects = dbCalls.selectFroms.filter(
      (s) => s.table === "inspections",
    );
    expect(selects).toHaveLength(1);
    expectTenantWhere(selects[0], { companyId: 7 });
    expect(selects[0].whereCols).not.toContain("projectId");
  });

  it("with projectId filter, both companyId AND projectId reach the WHERE", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.inspections.list({ companyId: 7, projectId: 3 });
    const selects = dbCalls.selectFroms.filter(
      (s) => s.table === "inspections",
    );
    expectTenantWhere(selects[0], { companyId: 7, projectId: 3 });
  });
});

describe("inspections.create", () => {
  const baseInput = {
    companyId: 7,
    projectId: 42,
    title: "Weekly site walk",
  };

  it("FK guard: rejects when project belongs to a different company; no INSERT side effect", async () => {
    dbCalls.projectsSelectReturn = []; // project NOT in this company
    const caller = appRouter.createCaller(ctxFor(1));
    await expect(caller.inspections.create(baseInput)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(
      dbCalls.inserts.filter((i) => i.table === "inspections"),
    ).toHaveLength(0);
  });

  it("FK guard select binds id AND companyId from input (distinct values catch a swap)", async () => {
    // Input projectId=42, companyId=7 are distinct so a swapped predicate
    // would land bindings { id: 7, companyId: 42 } and fail this assertion.
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.inspections.create(baseInput);
    const fkSelect = dbCalls.selectFroms.find((s) => s.table === "projects");
    expect(fkSelect).toBeDefined();
    expectTenantWhere(fkSelect!, {
      id: 42, // input.projectId
      companyId: 7, // input.companyId
    });
  });

  it("conductedById is taken from ctx.user.id, NOT input (fixes prior forging vulnerability)", async () => {
    // The router previously took conductedById from input with .default(1),
    // letting any caller forge attribution OR silently attribute to user 1
    // (super-admin) when omitted. The current procedure ignores any
    // conductedById in input and uses ctx.user.id.
    const caller = appRouter.createCaller(ctxFor(99));
    await caller.inspections.create({
      ...baseInput,
      // @ts-expect-error — exercising input ignored at runtime
      conductedById: 1, // attempted forgery
    });
    const insert = dbCalls.inserts.find((i) => i.table === "inspections")!;
    expect(insert.values.conductedById).toBe(99);
  });

  it("status is hard-set to 'scheduled' on creation; not configurable from input", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.inspections.create({
      ...baseInput,
      // @ts-expect-error — exercising status ignored at create
      status: "completed",
    });
    const insert = dbCalls.inserts.find((i) => i.table === "inspections")!;
    expect(insert.values.status).toBe("scheduled");
  });

  it("type defaults to 'general' when omitted", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.inspections.create(baseInput);
    const insert = dbCalls.inserts.find((i) => i.table === "inspections")!;
    expect(insert.values.type).toBe("general");
  });

  it("respects explicit type", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.inspections.create({
      ...baseInput,
      type: "scaffold",
    });
    const insert = dbCalls.inserts.find((i) => i.table === "inspections")!;
    expect(insert.values.type).toBe("scaffold");
  });
});

describe("inspections.complete", () => {
  it("writes closing fields and tenant-safe WHERE binds id AND companyId from input", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.inspections.complete({
      id: 5,
      companyId: 7,
      checklistItems: '[{"item":"helmets","ok":true}]',
      overallResult: "pass",
      notes: "All clear",
      photoUrls: '["a.jpg"]',
    });
    expect(dbCalls.updates).toHaveLength(1);
    const upd = dbCalls.updates[0];
    expect(upd.table).toBe("inspections");
    expect(upd.values).toMatchObject({
      checklistItems: '[{"item":"helmets","ok":true}]',
      overallResult: "pass",
      notes: "All clear",
      photoUrls: '["a.jpg"]',
      status: "completed",
    });
    expect(upd.values.completedAt).toBeInstanceOf(Date);
    expect(upd.values.updatedAt).toBeInstanceOf(Date);
    expectTenantWhere(upd, { id: 5, companyId: 7 });
  });

  it("photoUrls defaults to '[]' string when omitted", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.inspections.complete({
      id: 5,
      companyId: 7,
      checklistItems: "[]",
      overallResult: "pass",
    });
    expect(dbCalls.updates[0].values.photoUrls).toBe("[]");
  });
});

describe("inspections.update — partial-write", () => {
  it("only writes fields explicitly present; updatedAt always set; id / companyId stripped from SET", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.inspections.update({
      id: 5,
      companyId: 7,
      type: "fire-safety",
    });
    expect(dbCalls.updates).toHaveLength(1);
    const upd = dbCalls.updates[0];
    expect(upd.values).toMatchObject({ type: "fire-safety" });
    expect(upd.values.updatedAt).toBeInstanceOf(Date);
    expect(upd.values).not.toHaveProperty("id");
    expect(upd.values).not.toHaveProperty("companyId");
    expectTenantWhere(upd, { id: 5, companyId: 7 });
  });

  it("scheduledAt=null is preserved as null in SET (explicit clear)", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.inspections.update({
      id: 5,
      companyId: 7,
      scheduledAt: null,
    });
    expect(dbCalls.updates[0].values.scheduledAt).toBeNull();
  });

  it("scheduledAt=string is converted to Date in SET", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.inspections.update({
      id: 5,
      companyId: 7,
      scheduledAt: "2026-12-31T10:00:00Z",
    });
    expect(dbCalls.updates[0].values.scheduledAt).toBeInstanceOf(Date);
  });

  it("absent scheduledAt is NOT in SET (partial-write semantics)", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.inspections.update({
      id: 5,
      companyId: 7,
      title: "Renamed",
    });
    expect(dbCalls.updates[0].values).not.toHaveProperty("scheduledAt");
  });

  it("rejects empty title via zod min(1); no UPDATE issued", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await expect(
      caller.inspections.update({ id: 5, companyId: 7, title: "" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(dbCalls.updates).toHaveLength(0);
  });
});

describe("inspections.delete", () => {
  it("DELETE on inspections binds id AND companyId from input in the WHERE clause", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.inspections.delete({ id: 5, companyId: 7 });
    expect(dbCalls.deletes).toHaveLength(1);
    expect(dbCalls.deletes[0].table).toBe("inspections");
    expectTenantWhere(dbCalls.deletes[0], { id: 5, companyId: 7 });
  });
});
