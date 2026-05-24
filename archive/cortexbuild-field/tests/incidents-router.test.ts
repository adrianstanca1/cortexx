import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../server/_core/context";
import {
  collectBindings,
  collectColumns,
  tableName,
} from "./_helpers/drizzle-mock";
import { expectTenantWhere } from "./_helpers/expect-tenant-where";

/**
 * Coverage for the incidents sub-router (`server/routers/index.ts`).
 *
 * Procedures: list, create (with cross-tenant FK guard), update
 * (partial-write), delete.
 *
 * Notable behaviours pinned:
 *   - list: companyId always in WHERE; optional projectId predicate.
 *   - create: FK-checks the project belongs to the company BEFORE
 *     INSERT (parallel to documents.saveGenerated and defects.create);
 *     photoUrls array is JSON-stringified at the boundary; absent
 *     optional fields become NULL; riddorRequired defaults to false.
 *   - update: partial-write — only fields explicitly present in input
 *     reach the UPDATE; photoUrls is re-serialised to JSON when
 *     present.
 *   - tenant-safety: the column references AND bound values reach
 *     the WHERE clause (uses the shared collectColumns / collectBindings
 *     helpers from `./_helpers/drizzle-mock`).
 *
 * NOTE: Unlike projects.update, incidents.update does NOT short-circuit
 * when no payload fields are present — it issues `UPDATE … SET WHERE …`
 * with an empty SET. That's existing behaviour; the test below pins it.
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
          return Promise.resolve();
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
  // Default: project belongs to the same company. Tests that exercise
  // the cross-tenant FK guard override this to [].
  dbCalls.projectsSelectReturn = [{ id: 7, companyId: 7 }];
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("incidents.list", () => {
  it("scoped to companyId; absent projectId means projectId NOT in WHERE", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.incidents.list({ companyId: 7 });
    const selects = dbCalls.selectFroms.filter((s) => s.table === "incidents");
    expect(selects).toHaveLength(1);
    expectTenantWhere(selects[0], { companyId: 7 });
    // Absence assertions stay inline — expectTenantWhere only checks
    // presence (toMatchObject is permissive about extras).
    expect(selects[0].whereCols).not.toContain("projectId");
    expect(selects[0].whereBindings).not.toHaveProperty("projectId");
  });

  it("with projectId filter, WHERE binds both companyId AND projectId from input", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.incidents.list({ companyId: 7, projectId: 3 });
    const selects = dbCalls.selectFroms.filter((s) => s.table === "incidents");
    expect(selects).toHaveLength(1);
    expectTenantWhere(selects[0], { companyId: 7, projectId: 3 });
  });
});

describe("incidents.create", () => {
  const baseInput = {
    companyId: 7,
    projectId: 42,
    title: "Worker slipped on stairs",
    type: "near_miss" as const,
    severity: "low" as const,
    reportedBy: "Site Manager",
  };

  it("FK guard: rejects when project belongs to a different company; no INSERT side effect", async () => {
    dbCalls.projectsSelectReturn = []; // project NOT in this company
    const caller = appRouter.createCaller(ctxFor(1));
    await expect(caller.incidents.create(baseInput)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(dbCalls.inserts.filter((i) => i.table === "incidents")).toHaveLength(
      0,
    );
  });

  it("FK guard select binds both id AND companyId from input", async () => {
    // Distinct id vs companyId so a swap (`eq(projects.id, input.companyId)`)
    // would surface in the bindings assertion.
    dbCalls.projectsSelectReturn = [{ id: 42, companyId: 7 }];
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.incidents.create(baseInput);
    const fkSelect = dbCalls.selectFroms.find((s) => s.table === "projects");
    expect(fkSelect).toBeDefined();
    expectTenantWhere(fkSelect!, {
      id: 42, // input.projectId
      companyId: 7, // input.companyId
    });
  });

  it("succeeds when project belongs to the same company; defaults absent fields to null / false; exactly one INSERT", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.incidents.create(baseInput);
    const incidentInserts = dbCalls.inserts.filter(
      (i) => i.table === "incidents",
    );
    // Exactly one INSERT: a future regression that adds an audit-log row
    // alongside the main insert would surface here rather than pass silently.
    expect(incidentInserts).toHaveLength(1);
    expect(incidentInserts[0].values).toMatchObject({
      companyId: 7,
      projectId: 42,
      title: "Worker slipped on stairs",
      type: "near_miss",
      severity: "low",
      reportedBy: "Site Manager",
      description: null,
      location: null,
      immediateAction: null,
      photoUrls: null,
      riddorRequired: false,
    });
  });

  it("photoUrls array is JSON-stringified at the boundary", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.incidents.create({
      ...baseInput,
      photoUrls: ["a.jpg", "b.jpg"],
    });
    const insert = dbCalls.inserts.find((i) => i.table === "incidents")!;
    expect(insert.values.photoUrls).toBe('["a.jpg","b.jpg"]');
  });

  it("photoUrls=[] serialises to '[]' (truthy empty array, NOT null)", async () => {
    // The router gate is `input.photoUrls ? JSON.stringify(...) : null`.
    // Empty arrays are truthy in JS, so [] takes the JSON.stringify branch
    // and yields the SQL value '[]', not null. Pin this so a refactor to
    // `input.photoUrls?.length ? ... : null` (which would change [] → null)
    // becomes a deliberate test update.
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.incidents.create({ ...baseInput, photoUrls: [] });
    const insert = dbCalls.inserts.find((i) => i.table === "incidents")!;
    expect(insert.values.photoUrls).toBe("[]");
  });

  it("respects explicit riddorRequired=true", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.incidents.create({ ...baseInput, riddorRequired: true });
    const insert = dbCalls.inserts.find((i) => i.table === "incidents")!;
    expect(insert.values.riddorRequired).toBe(true);
  });

  it("rejects unknown type via zod enum gate; no FK select, no INSERT", async () => {
    // Pins the order: zod runs BEFORE the FK select, so a bad enum can
    // never produce a DB round-trip. If a future refactor moves zod
    // validation off the procedure builder, this test surfaces the
    // change rather than silently allowing wasted DB work.
    const caller = appRouter.createCaller(ctxFor(1));
    await expect(
      caller.incidents.create({
        ...baseInput,
        // @ts-expect-error — exercising zod enum at runtime
        type: "made-up-incident-type",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(
      dbCalls.selectFroms.filter((s) => s.table === "projects"),
    ).toHaveLength(0);
    expect(dbCalls.inserts.filter((i) => i.table === "incidents")).toHaveLength(
      0,
    );
  });
});

describe("incidents.update — partial-write", () => {
  it("only writes fields explicitly present in input; tenant-safe WHERE binds id AND companyId", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.incidents.update({
      id: 5,
      companyId: 7,
      severity: "high",
    });
    expect(dbCalls.updates).toHaveLength(1);
    expect(dbCalls.updates[0].values).toEqual({ severity: "high" });
    expectTenantWhere(dbCalls.updates[0], { id: 5, companyId: 7 });
  });

  it("photoUrls array is JSON-stringified on update too", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.incidents.update({
      id: 5,
      companyId: 7,
      photoUrls: ["new.jpg"],
    });
    expect(dbCalls.updates[0].values.photoUrls).toBe('["new.jpg"]');
  });

  it("strips id and companyId from the SET clause (audit fields stay fixed)", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.incidents.update({
      id: 5,
      companyId: 7,
      title: "Renamed",
    });
    const set = dbCalls.updates[0].values;
    expect(set).not.toHaveProperty("id");
    expect(set).not.toHaveProperty("companyId");
    expect(set).toEqual({ title: "Renamed" });
  });

  it("rejects empty title via zod min(1); no UPDATE issued", async () => {
    // The update input has `title: z.string().min(1).optional()`. An empty
    // string is rejected at the zod boundary, so the procedure body never
    // runs. Asserts both the rejection and the absence of side effects.
    const caller = appRouter.createCaller(ctxFor(1));
    await expect(
      caller.incidents.update({ id: 5, companyId: 7, title: "" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(dbCalls.updates).toHaveLength(0);
  });

  it("issues UPDATE even with no payload fields (does not short-circuit)", async () => {
    // Pinning current behaviour: incidents.update does NOT have the
    // `if (Object.keys(...).length > 0)` guard that projects.update has,
    // so an empty payload still runs `UPDATE incidents SET WHERE …`.
    // If this is ever changed to short-circuit, this test will surface
    // the change deliberately.
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.incidents.update({ id: 5, companyId: 7 });
    expect(dbCalls.updates).toHaveLength(1);
    expect(dbCalls.updates[0].values).toEqual({});
    expectTenantWhere(dbCalls.updates[0], { id: 5, companyId: 7 });
  });
});

describe("incidents.delete", () => {
  it("DELETE on incidents binds id AND companyId from input in the WHERE clause", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.incidents.delete({ id: 5, companyId: 7 });
    expect(dbCalls.deletes).toHaveLength(1);
    expect(dbCalls.deletes[0].table).toBe("incidents");
    expectTenantWhere(dbCalls.deletes[0], { id: 5, companyId: 7 });
  });
});
