import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../server/_core/context";
import {
  collectBindings,
  collectColumns,
  tableName,
} from "./_helpers/drizzle-mock";
import { expectTenantWhere } from "./_helpers/expect-tenant-where";

/**
 * Coverage for the projects sub-router (`server/routers/index.ts`).
 *
 * Procedures: list, create, update (partial-write), delete.
 *
 * Notable behaviours pinned:
 *   - create: number → string coercion for decimal columns (budget,
 *     siteLat, siteLng); geofenceRadius defaults to 200m if omitted;
 *     dates are converted to Date objects.
 *   - update: only writes fields explicitly present (manual `if (v !== undefined)`
 *     filter); spent is number→string coerced too.
 *   - update / delete: tenant-safety — `companyId` (and `id`) actually
 *     reach the WHERE clause AND are bound to input values, not just
 *     the call shape. We walk the drizzle SQL tree passed to
 *     `.where()` via the helpers in `./_helpers/drizzle-mock`.
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
}
const dbCalls: DbCalls = {
  selectFroms: [],
  inserts: [],
  updates: [],
  deletes: [],
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
          const chain: any = {
            where(predicate: unknown) {
              record.whereCols.push(...collectColumns(predicate));
              Object.assign(record.whereBindings, collectBindings(predicate));
              return chain;
            },
            orderBy(_o: unknown) {
              return Promise.resolve([]);
            },
            then(resolve: any) {
              return Promise.resolve([]).then(resolve);
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
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("projects.list", () => {
  it("WHERE binds companyId to input.companyId (not just the column reference)", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.projects.list({ companyId: 7 });
    const selects = dbCalls.selectFroms.filter((s) => s.table === "projects");
    expect(selects).toHaveLength(1);
    // A regression like `eq(projects.companyId, ctx.user.id)` would still
    // mention companyId — the binding assertion catches the wrong source.
    expectTenantWhere(selects[0], { companyId: 7 });
  });
});

describe("projects.create", () => {
  it("number → string coercion for budget / siteLat / siteLng (decimal columns)", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.projects.create({
      companyId: 7,
      name: "Office fit-out",
      budget: 250000,
      siteLat: 51.5074,
      siteLng: -0.1278,
    });
    const v = dbCalls.inserts[0].values;
    expect(v.budget).toBe("250000");
    expect(v.siteLat).toBe("51.5074");
    expect(v.siteLng).toBe("-0.1278");
  });

  it("nulls budget / coords when not provided", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.projects.create({
      companyId: 7,
      name: "Roofing job",
    });
    const v = dbCalls.inserts[0].values;
    expect(v.budget).toBeNull();
    expect(v.siteLat).toBeNull();
    expect(v.siteLng).toBeNull();
    expect(v.description).toBeNull();
    expect(v.clientName).toBeNull();
  });

  it("geofenceRadius defaults to 200m when omitted", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.projects.create({ companyId: 7, name: "X" });
    expect(dbCalls.inserts[0].values.geofenceRadius).toBe(200);
  });

  it("preserves explicit geofenceRadius", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.projects.create({
      companyId: 7,
      name: "X",
      geofenceRadius: 500,
    });
    expect(dbCalls.inserts[0].values.geofenceRadius).toBe(500);
  });

  it("converts startDate / endDate strings to Date objects", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.projects.create({
      companyId: 7,
      name: "Long project",
      startDate: "2026-05-01",
      endDate: "2026-12-31",
    });
    const v = dbCalls.inserts[0].values;
    expect(v.startDate).toBeInstanceOf(Date);
    expect(v.endDate).toBeInstanceOf(Date);
  });

  it("status defaults to 'planning' when omitted", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.projects.create({ companyId: 7, name: "X" });
    expect(dbCalls.inserts[0].values.status).toBe("planning");
  });
});

describe("projects.update — partial-write", () => {
  it("only writes fields explicitly present in input; tenant-safe WHERE binds id AND companyId from input", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.projects.update({ id: 5, companyId: 7, progress: 50 });
    expect(dbCalls.updates).toHaveLength(1);
    expect(dbCalls.updates[0].values).toEqual({ progress: 50 });
    // Tenant-safety: both id AND companyId reach the WHERE clause AND
    // are bound to the user-supplied input values.
    expectTenantWhere(dbCalls.updates[0], { id: 5, companyId: 7 });
  });

  it("number → string coercion on `spent` (decimal column)", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.projects.update({ id: 5, companyId: 7, spent: 12345.67 });
    expect(dbCalls.updates[0].values.spent).toBe("12345.67");
  });

  it("siteLat/siteLng accept string form already (matches partial-write update flow)", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.projects.update({
      id: 5,
      companyId: 7,
      siteLat: "51.5074",
      siteLng: "-0.1278",
      geofenceRadius: 300,
    });
    expect(dbCalls.updates[0].values).toMatchObject({
      siteLat: "51.5074",
      siteLng: "-0.1278",
      geofenceRadius: 300,
    });
  });

  it("no-ops (no UPDATE issued) when only id+companyId are provided", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    const result = await caller.projects.update({ id: 5, companyId: 7 });
    expect(result).toEqual({ success: true });
    expect(dbCalls.updates).toHaveLength(0);
  });
});

describe("projects.delete", () => {
  it("DELETE on projects binds id AND companyId from input in the WHERE clause", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.projects.delete({ id: 5, companyId: 7 });
    expect(dbCalls.deletes).toHaveLength(1);
    expect(dbCalls.deletes[0].table).toBe("projects");
    // Tenant-safety: a regression where companyId is bound to a literal
    // (e.g. `eq(projects.companyId, 1)`) would now fail this test.
    expectTenantWhere(dbCalls.deletes[0], { id: 5, companyId: 7 });
  });
});
