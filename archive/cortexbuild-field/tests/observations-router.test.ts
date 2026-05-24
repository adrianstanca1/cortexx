import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../server/_core/context";
import {
  collectBindings,
  collectColumns,
  tableName,
} from "./_helpers/drizzle-mock";
import { expectTenantWhere } from "./_helpers/expect-tenant-where";

/**
 * Coverage for the observations sub-router (`server/routers/index.ts`).
 *
 * Procedures: list, create, updateStatus, update, delete.
 *
 * Notable behaviours pinned:
 *   - list: companyId always in WHERE; optional projectId predicate.
 *   - create:
 *       * Cross-tenant FK guard: `projects.id` AND `projects.companyId`
 *         both reach the FK select's WHERE; rejects FORBIDDEN with no
 *         INSERT side effect when the project doesn't belong to the
 *         company. Mirrors incidents.create / tasks.create / etc.
 *       * `observedById` is taken from ctx.user.id, NOT input — a
 *         client cannot impersonate another user as the observer.
 *       * `type` defaults to 'positive'.
 *       * `photoUrls` defaults to the literal string '[]' (the column
 *         is text, not jsonb — the router stores serialised JSON).
 *   - updateStatus: writes ONLY status + updatedAt; tenant-safe WHERE.
 *   - update (partial-write): id / companyId stripped from SET;
 *     updatedAt always set; zod min(1) on title.
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

describe("observations.list", () => {
  it("scoped to companyId; absent projectId means projectId NOT in WHERE", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.observations.list({ companyId: 7 });
    const selects = dbCalls.selectFroms.filter(
      (s) => s.table === "observations",
    );
    expect(selects).toHaveLength(1);
    expectTenantWhere(selects[0], { companyId: 7 });
    expect(selects[0].whereCols).not.toContain("projectId");
  });

  it("with projectId, both companyId AND projectId reach the WHERE", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.observations.list({ companyId: 7, projectId: 3 });
    const selects = dbCalls.selectFroms.filter(
      (s) => s.table === "observations",
    );
    expectTenantWhere(selects[0], { companyId: 7, projectId: 3 });
  });
});

describe("observations.create", () => {
  const baseInput = {
    companyId: 7,
    projectId: 42,
    title: "Workers wearing fall arrest harnesses correctly",
  };

  it("FK guard: rejects when project belongs to a different company; no INSERT side effect", async () => {
    dbCalls.projectsSelectReturn = []; // project NOT in this company
    const caller = appRouter.createCaller(ctxFor(1));
    await expect(caller.observations.create(baseInput)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(
      dbCalls.inserts.filter((i) => i.table === "observations"),
    ).toHaveLength(0);
  });

  it("FK guard select binds id AND companyId from input (distinct values catch a swap)", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.observations.create(baseInput);
    const fkSelect = dbCalls.selectFroms.find((s) => s.table === "projects");
    expect(fkSelect).toBeDefined();
    expectTenantWhere(fkSelect!, {
      id: 42, // input.projectId
      companyId: 7, // input.companyId
    });
  });

  it("observedById is taken from ctx.user.id, NOT input", async () => {
    const caller = appRouter.createCaller(ctxFor(99));
    await caller.observations.create({
      ...baseInput,
      // @ts-expect-error — exercising input ignored at runtime
      observedById: 1,
    });
    const insert = dbCalls.inserts.find((i) => i.table === "observations")!;
    expect(insert.values.observedById).toBe(99);
  });

  it("type defaults to 'positive' when omitted", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.observations.create(baseInput);
    const insert = dbCalls.inserts.find((i) => i.table === "observations")!;
    expect(insert.values.type).toBe("positive");
  });

  it("photoUrls defaults to '[]' string when omitted (text column, not jsonb)", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.observations.create(baseInput);
    const insert = dbCalls.inserts.find((i) => i.table === "observations")!;
    expect(insert.values.photoUrls).toBe("[]");
  });

  it("respects explicit type and photoUrls", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.observations.create({
      ...baseInput,
      type: "near_miss",
      photoUrls: '["a.jpg","b.jpg"]',
    });
    const insert = dbCalls.inserts.find((i) => i.table === "observations")!;
    expect(insert.values.type).toBe("near_miss");
    expect(insert.values.photoUrls).toBe('["a.jpg","b.jpg"]');
  });
});

describe("observations.updateStatus", () => {
  it("writes ONLY status and updatedAt; tenant-safe WHERE binds id AND companyId", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.observations.updateStatus({
      id: 5,
      companyId: 7,
      status: "actioned",
    });
    expect(dbCalls.updates).toHaveLength(1);
    const upd = dbCalls.updates[0];
    expect(upd.table).toBe("observations");
    expect(upd.values).toMatchObject({ status: "actioned" });
    expect(upd.values.updatedAt).toBeInstanceOf(Date);
    // Only status and updatedAt — locks the narrow operation surface.
    expect(Object.keys(upd.values).sort()).toEqual(["status", "updatedAt"]);
    expectTenantWhere(upd, { id: 5, companyId: 7 });
  });
});

describe("observations.update — partial-write", () => {
  it("only writes fields explicitly present; updatedAt always set; id / companyId stripped from SET", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.observations.update({
      id: 5,
      companyId: 7,
      type: "near_miss",
    });
    expect(dbCalls.updates).toHaveLength(1);
    const upd = dbCalls.updates[0];
    expect(upd.values).toMatchObject({ type: "near_miss" });
    expect(upd.values.updatedAt).toBeInstanceOf(Date);
    expect(upd.values).not.toHaveProperty("id");
    expect(upd.values).not.toHaveProperty("companyId");
    expectTenantWhere(upd, { id: 5, companyId: 7 });
  });

  it("rejects empty title via zod min(1); no UPDATE issued", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await expect(
      caller.observations.update({ id: 5, companyId: 7, title: "" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(dbCalls.updates).toHaveLength(0);
  });

  it("issues UPDATE even with no payload fields besides id+companyId (sets updatedAt only)", async () => {
    // Pin existing behaviour: no short-circuit. The router does
    // `{ ...rest, updatedAt: new Date() }` so an empty rest still
    // results in a SET with just updatedAt.
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.observations.update({ id: 5, companyId: 7 });
    expect(dbCalls.updates).toHaveLength(1);
    expect(Object.keys(dbCalls.updates[0].values)).toEqual(["updatedAt"]);
  });
});

describe("observations.delete", () => {
  it("DELETE on observations binds id AND companyId from input in the WHERE clause", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.observations.delete({ id: 5, companyId: 7 });
    expect(dbCalls.deletes).toHaveLength(1);
    expect(dbCalls.deletes[0].table).toBe("observations");
    expectTenantWhere(dbCalls.deletes[0], { id: 5, companyId: 7 });
  });
});
