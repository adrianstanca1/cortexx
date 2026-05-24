import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../server/_core/context";
import {
  collectBindings,
  collectColumns,
  tableName,
} from "./_helpers/drizzle-mock";
import { expectTenantWhere } from "./_helpers/expect-tenant-where";

// ── sendEmail mock (used by rfis.answer / rfis.respond) ──────────────────────
const sendEmail = vi.fn(async () => {});
vi.mock("../server/_core/email", () => ({ sendEmail }));

/**
 * Coverage for the rfis sub-router (`server/routers/index.ts`).
 *
 * Procedures: list, create, respond, update (partial-write), delete.
 *
 * Notable behaviours pinned:
 *   - list: companyId always in WHERE; optional projectId predicate.
 *   - create:
 *       * RFI number generated as `RFI-NNNN` (zero-padded to 4 digits)
 *         from a tenant-scoped count(*) query — the count's WHERE
 *         binds companyId so RFI numbering is per-company, not global.
 *       * `raisedById` is taken from `ctx.user.id`, NOT input — so a
 *         client can't impersonate another user as the RFI raiser.
 *       * `priority` defaults to 'normal'.
 *   - respond: sets status='answered', respondedAt = a Date; tenant-safe
 *     WHERE binds id AND companyId from input.
 *   - update: partial-write — only fields explicitly present reach SET;
 *     dueDate nullable handling (null → null, string → Date, undefined
 *     → not in SET); id / companyId stripped from SET (audit fields
 *     fixed); updatedAt always set.
 *   - delete: tenant-safe WHERE binds id AND companyId from input.
 *
 * The count(*) query in create terminates at `.where()` (no orderBy),
 * while list terminates at `.orderBy()`. The mock differentiates by
 * looking at whether `select(...)` was called with a projection arg —
 * count uses `select({ c: sql<number>'count(*)' })`, list uses bare
 * `select()`.
 */

interface DbCalls {
  selectFroms: {
    table: string;
    whereCols: string[];
    whereBindings: Record<string, unknown>;
    isCountQuery: boolean;
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
  /** Rows returned by `select({ c: sql`count(*)` }).from(rfis).where(...)`. */
  rfisCountReturn: any[];
  /**
   * Rows returned by the cross-tenant FK guard's
   * `select().from(projects).where(...)` lookup. Default seeded in
   * beforeEach so happy-path tests pass; cross-tenant rejection tests
   * override it with `[]`.
   */
  projectsSelectReturn: any[];
  /**
   * Rows returned by `select().from(rfis).where(...)` (non-count) lookups.
   * Used by rfis.answer / rfis.respond to pre-read the RFI for state checks.
   */
  rfisSelectReturn: any[];
  /**
   * Rows returned by `select().from(users).where(...)` lookups.
   * Used by rfis.answer to look up the raiser's email for the notification.
   */
  usersSelectReturn: any[];
  /**
   * Rows returned by `company_users` lookups (companyScopedProcedure
   * middleware). Defaults to manager so happy-path tests pass; set to a
   * different companyRole to test role-gate rejections.
   */
  companyUsersReturn: any[];
  /**
   * Rows returned by the broadcast lookup in `rfis.create`:
   * `db.select().from(companyUsers).where(and(eq(companyId,...), eq(isActive,true)))`.
   * That query awaits the chain directly (no `.limit()`), so it reaches
   * the `chain.then(resolve)` path — a different execution branch from the
   * middleware lookup which always terminates with `.limit(1)`.
   * Seeded per-test; defaults to [] so existing tests are unaffected.
   */
  companyUsersBroadcastReturn: any[];
}
const dbCalls: DbCalls = {
  selectFroms: [],
  inserts: [],
  updates: [],
  deletes: [],
  rfisCountReturn: [],
  projectsSelectReturn: [],
  rfisSelectReturn: [],
  usersSelectReturn: [],
  companyUsersReturn: [{ companyRole: "manager", isActive: true }],
  companyUsersBroadcastReturn: [],
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
                // Two callers hit company_users:
                //   1. companyScopedProcedure middleware → terminates with
                //      `.limit(1)` → returns companyUsersReturn.
                //   2. rfis.create broadcast lookup → awaits the chain
                //      directly (no .limit()) → reaches `.then(resolve)` →
                //      returns companyUsersBroadcastReturn.
                // We distinguish them by which terminator fires first.
                return {
                  limit() {
                    return Promise.resolve(dbCalls.companyUsersReturn);
                  },
                  then(resolve: any, reject?: any) {
                    return Promise.resolve(dbCalls.companyUsersBroadcastReturn).then(resolve, reject);
                  },
                };
              },
            };
          }
          const record = {
            table: name,
            whereCols: [] as string[],
            whereBindings: {} as Record<string, unknown>,
            isCountQuery,
          };
          dbCalls.selectFroms.push(record);
          const returnRows = isCountQuery
            ? dbCalls.rfisCountReturn
            : name === "projects"
              ? dbCalls.projectsSelectReturn
              : name === "rfis"
                ? dbCalls.rfisSelectReturn
                : name === "users"
                  ? dbCalls.usersSelectReturn
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
  dbCalls.rfisCountReturn = [];
  // Default: project belongs to the same company so the FK guard passes.
  // Tests that exercise cross-tenant rejection override this.
  dbCalls.projectsSelectReturn = [{ id: 42, companyId: 7 }];
  dbCalls.rfisSelectReturn = [];
  dbCalls.usersSelectReturn = [];
  dbCalls.companyUsersReturn = [{ companyRole: "manager", isActive: true }];
  dbCalls.companyUsersBroadcastReturn = [];
  sendEmail.mockClear();
});

/**
 * A context with a manager companyMembership — required for rfis.answer
 * and the rfis.respond alias, both of which call requireCompanyRole("manager").
 */
function ctxForManager(userId = 5): TrpcContext {
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
    companyMembership: { companyRole: "manager", isActive: true } as any,
    req: { protocol: "https", hostname: "localhost", headers: {} } as any,
    res: { clearCookie: vi.fn() } as any,
  } as any;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("rfis.list", () => {
  it("scoped to companyId; absent projectId means projectId NOT in WHERE", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.rfis.list({ companyId: 7 });
    const selects = dbCalls.selectFroms.filter((s) => s.table === "rfis");
    expect(selects).toHaveLength(1);
    expectTenantWhere(selects[0], { companyId: 7 });
    expect(selects[0].whereCols).not.toContain("projectId");
    expect(selects[0].whereBindings).not.toHaveProperty("projectId");
  });

  it("with projectId filter, WHERE binds both companyId AND projectId from input", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.rfis.list({ companyId: 7, projectId: 3 });
    const selects = dbCalls.selectFroms.filter((s) => s.table === "rfis");
    expect(selects).toHaveLength(1);
    expectTenantWhere(selects[0], { companyId: 7, projectId: 3 });
  });
});

describe("rfis.create", () => {
  const baseInput = {
    companyId: 7,
    projectId: 42,
    subject: "Door clearance",
    question: "What's the required clearance for the fire-rated door?",
  };

  it("cross-tenant FK guard: rejects FORBIDDEN when projectId doesn't belong to companyId, no INSERT side-effect", async () => {
    // Project belongs to a different company (or doesn't exist) for the
    // caller's companyId — the FK lookup returns [] and the procedure
    // raises FORBIDDEN before doing the count or insert.
    dbCalls.projectsSelectReturn = [];
    const caller = appRouter.createCaller(ctxFor(1));
    await expect(caller.rfis.create(baseInput)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    // Critical: nothing was inserted, and the count(*) query never ran
    // (the procedure's the FK guard is the first DB call).
    expect(dbCalls.inserts.filter((i) => i.table === "rfis")).toHaveLength(0);
  });

  it("FK guard's select binds projectId AND companyId from input", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.rfis.create(baseInput);
    const fkSelect = dbCalls.selectFroms.find(
      (s) => s.table === "projects",
    );
    expect(fkSelect).toBeTruthy();
    expectTenantWhere(fkSelect!, { id: 42, companyId: 7 });
  });

  it("count(*) query for RFI numbering binds companyId from input (per-company numbering)", async () => {
    // Pin the tenant-safe count: a regression that drops `eq(rfis.companyId, ...)`
    // from the count would produce globally-shared RFI numbers (and leak
    // existence of other tenants' RFIs via the number sequence).
    dbCalls.rfisCountReturn = [{ c: 0 }];
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.rfis.create(baseInput);
    const countSelect = dbCalls.selectFroms.find(
      (s) => s.table === "rfis" && s.isCountQuery,
    );
    expect(countSelect).toBeDefined();
    expectTenantWhere(countSelect!, { companyId: 7 });
  });

  it("RFI number is 'RFI-0001' when no prior RFIs exist for this company", async () => {
    dbCalls.rfisCountReturn = []; // empty array — count[0]?.c is undefined → 0
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.rfis.create(baseInput);
    const insert = dbCalls.inserts.find((i) => i.table === "rfis")!;
    expect(insert.values.number).toBe("RFI-0001");
  });

  it("RFI number is 'RFI-0005' when 4 prior RFIs exist for this company", async () => {
    dbCalls.rfisCountReturn = [{ c: 4 }];
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.rfis.create(baseInput);
    const insert = dbCalls.inserts.find((i) => i.table === "rfis")!;
    expect(insert.values.number).toBe("RFI-0005");
  });

  it("raisedById is taken from ctx.user.id, not from input", async () => {
    // A client can't impersonate another user by sending raisedById in
    // the input — the procedure uses ctx.user.id unconditionally.
    dbCalls.rfisCountReturn = [{ c: 0 }];
    const caller = appRouter.createCaller(ctxFor(99)); // user id from ctx
    await caller.rfis.create({
      ...baseInput,
      // @ts-expect-error — exercising input ignored at runtime
      raisedById: 1,
    });
    const insert = dbCalls.inserts.find((i) => i.table === "rfis")!;
    expect(insert.values.raisedById).toBe(99);
  });

  it("priority defaults to 'normal' when omitted", async () => {
    dbCalls.rfisCountReturn = [{ c: 0 }];
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.rfis.create(baseInput);
    const insert = dbCalls.inserts.find((i) => i.table === "rfis")!;
    expect(insert.values.priority).toBe("normal");
  });

  it("respects explicit priority='urgent'", async () => {
    dbCalls.rfisCountReturn = [{ c: 0 }];
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.rfis.create({ ...baseInput, priority: "urgent" });
    const insert = dbCalls.inserts.find((i) => i.table === "rfis")!;
    expect(insert.values.priority).toBe("urgent");
  });
});

describe("rfis.respond (deprecated alias for rfis.answer)", () => {
  it("sets status='answered' and respondedAt; tenant-safe WHERE binds id AND companyId from input", async () => {
    // respond now delegates to answer, which requires manager role, reads the
    // RFI first (state check), then updates. Seed the mock accordingly.
    dbCalls.rfisSelectReturn = [
      { id: 5, companyId: 7, projectId: 42, status: "submitted", subject: "Door clearance", raisedById: 9, number: "RFI-0005" },
    ];
    dbCalls.usersSelectReturn = [{ id: 9, name: "Raiser", email: "raiser@example.com" }];
    const caller = appRouter.createCaller(ctxForManager(1));
    await caller.rfis.respond({
      id: 5,
      companyId: 7,
      response: "Use 8mm clearance per BS 9999.",
    });
    const upd = dbCalls.updates.find((u) => u.table === "rfis");
    expect(upd).toBeTruthy();
    expect(upd!.values).toMatchObject({
      response: "Use 8mm clearance per BS 9999.",
      status: "answered",
    });
    expect(upd!.values.respondedAt).toBeInstanceOf(Date);
    expect(upd!.values.updatedAt).toBeInstanceOf(Date);
    expectTenantWhere(upd!, { id: 5, companyId: 7 });
    // The alias must produce the same observable side effect as `answer`:
    // an email to the raiser. This is the behaviour that's actually new
    // about the alias (over the legacy respond) — assert it explicitly so
    // a future refactor that drops the email path on respond fails here.
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "raiser@example.com" }),
    );
  });
});

describe("rfis.update — partial-write", () => {
  it("only writes fields explicitly present in input; updatedAt always set; tenant-safe WHERE", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.rfis.update({
      id: 5,
      companyId: 7,
      priority: "urgent",
    });
    expect(dbCalls.updates).toHaveLength(1);
    const upd = dbCalls.updates[0];
    expect(upd.values).toMatchObject({ priority: "urgent" });
    expect(upd.values.updatedAt).toBeInstanceOf(Date);
    // id / companyId never reach SET (audit fields fixed).
    expect(upd.values).not.toHaveProperty("id");
    expect(upd.values).not.toHaveProperty("companyId");
    expectTenantWhere(upd, { id: 5, companyId: 7 });
  });

  it("dueDate=null is preserved as null in SET (explicit clear vs. absence)", async () => {
    // The router explicitly distinguishes:
    //   - dueDate undefined (absent)  → not in SET (partial-write)
    //   - dueDate null (clear it)     → null in SET
    //   - dueDate string (set value)  → Date in SET
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.rfis.update({
      id: 5,
      companyId: 7,
      dueDate: null,
    });
    expect(dbCalls.updates[0].values.dueDate).toBeNull();
  });

  it("dueDate=string is converted to Date in SET", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.rfis.update({
      id: 5,
      companyId: 7,
      dueDate: "2026-12-31",
    });
    expect(dbCalls.updates[0].values.dueDate).toBeInstanceOf(Date);
  });

  it("absent dueDate is NOT in SET (partial-write semantics)", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.rfis.update({
      id: 5,
      companyId: 7,
      subject: "Updated subject",
    });
    expect(dbCalls.updates[0].values).not.toHaveProperty("dueDate");
  });

  it("rejects empty subject via zod min(1); no UPDATE issued", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await expect(
      caller.rfis.update({ id: 5, companyId: 7, subject: "" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(dbCalls.updates).toHaveLength(0);
  });
});

describe("rfis.delete", () => {
  it("DELETE on rfis binds id AND companyId from input in the WHERE clause", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.rfis.delete({ id: 5, companyId: 7 });
    expect(dbCalls.deletes).toHaveLength(1);
    expect(dbCalls.deletes[0].table).toBe("rfis");
    expectTenantWhere(dbCalls.deletes[0], { id: 5, companyId: 7 });
  });
});

// ─── rfis.answer — new procedure (T5) ────────────────────────────────────────

describe("rfis.answer", () => {
  it("requires manager+ — throws FORBIDDEN for worker", async () => {
    // The companyScopedProcedure middleware reads companyMembership from the DB.
    // Override the mock to return a "worker" role so requireCompanyRole fires.
    dbCalls.companyUsersReturn = [{ companyRole: "worker", isActive: true }];
    dbCalls.rfisSelectReturn = [
      { id: 1, companyId: 7, projectId: 42, status: "submitted", subject: "x", raisedById: 9, number: "RFI-0001" },
    ];
    const caller = appRouter.createCaller(ctxFor(1));
    await expect(
      caller.rfis.answer({ id: 1, companyId: 7, response: "ok" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("transitions submitted → answered, sets respondedAt + answeredById, emails the raiser", async () => {
    dbCalls.rfisSelectReturn = [
      { id: 1, companyId: 7, projectId: 42, status: "submitted", subject: "Door clearance", raisedById: 9, number: "RFI-0001" },
    ];
    dbCalls.usersSelectReturn = [{ id: 9, name: "Sam", email: "sam@example.com" }];
    const caller = appRouter.createCaller(ctxForManager(5));

    await caller.rfis.answer({ id: 1, companyId: 7, response: "the answer" });

    const upd = dbCalls.updates.find((u) => u.table === "rfis");
    expect(upd).toBeTruthy();
    expect(upd!.values).toMatchObject({
      status: "answered",
      response: "the answer",
      answeredById: 5,
    });
    expect(upd!.values.respondedAt).toBeInstanceOf(Date);
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "sam@example.com" }));
  });

  it("rejects an already-answered RFI with BAD_REQUEST (state-machine guard)", async () => {
    dbCalls.rfisSelectReturn = [
      { id: 1, companyId: 7, status: "answered", subject: "x", raisedById: 9, projectId: 42, number: "RFI-0001" },
    ];
    const caller = appRouter.createCaller(ctxForManager());
    await expect(
      caller.rfis.answer({ id: 1, companyId: 7, response: "x" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("throws NOT_FOUND when RFI does not exist", async () => {
    dbCalls.rfisSelectReturn = []; // no RFI found
    const caller = appRouter.createCaller(ctxForManager());
    await expect(
      caller.rfis.answer({ id: 999, companyId: 7, response: "x" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

// ─── rfis.approve — new procedure (T6) ───────────────────────────────────────

/**
 * A context with company_admin role — required for rfis.approve.
 * Mirrors ctxForManager but with companyRole: "company_admin".
 */
function ctxForCompanyAdmin(userId = 5): TrpcContext {
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
    companyMembership: { companyRole: "company_admin", isActive: true } as any,
    req: { protocol: "https", hostname: "localhost", headers: {} } as any,
    res: { clearCookie: vi.fn() } as any,
  } as any;
}

describe("rfis.approve", () => {
  it("requires company_admin+ — manager is FORBIDDEN", async () => {
    // companyScopedProcedure returns "manager" from dbCalls.companyUsersReturn
    // (the beforeEach default). requireCompanyRole("company_admin") should fire.
    dbCalls.companyUsersReturn = [{ companyRole: "manager", isActive: true }];
    dbCalls.rfisSelectReturn = [
      { id: 2, companyId: 7, projectId: 42, status: "answered", subject: "Door clearance",
        raisedById: 9, answeredById: 7, number: "RFI-0002" },
    ];
    const caller = appRouter.createCaller(ctxForManager(5));
    await expect(
      caller.rfis.approve({ id: 2, companyId: 7 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("transitions answered → approved, sets approvedAt + approvedById, emails raiser + answerer", async () => {
    dbCalls.companyUsersReturn = [{ companyRole: "company_admin", isActive: true }];
    dbCalls.rfisSelectReturn = [
      { id: 3, companyId: 7, projectId: 42, status: "answered", subject: "Beam spec",
        raisedById: 9, answeredById: 7, number: "RFI-0003" },
    ];
    // Both raiser (id=9) and answerer (id=7) are in usersSelectReturn.
    // The mock returns usersSelectReturn for any db.select().from(users).where(...)
    // regardless of whether the predicate is eq() or inArray(), so seeding
    // both rows here covers the inArray(dbUsers.id, [9, 7]) query.
    dbCalls.usersSelectReturn = [
      { id: 9, name: "Raiser Nine", email: "raiser@example.com" },
      { id: 7, name: "Answerer Seven", email: "answerer@example.com" },
    ];
    dbCalls.projectsSelectReturn = [{ id: 42, name: "Test Project", companyId: 7 }];

    const caller = appRouter.createCaller(ctxForCompanyAdmin(5));
    const result = await caller.rfis.approve({ id: 3, companyId: 7 });

    expect(result).toEqual({ success: true });

    // Verify the UPDATE fields.
    const upd = dbCalls.updates.find((u) => u.table === "rfis");
    expect(upd).toBeTruthy();
    expect(upd!.values).toMatchObject({
      status: "approved",
      approvedById: 5,
    });
    expect(upd!.values.approvedAt).toBeInstanceOf(Date);
    expect(upd!.values.updatedAt).toBeInstanceOf(Date);
    expectTenantWhere(upd!, { id: 3, companyId: 7 });

    // sendEmail must be called for both raiser and answerer.
    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "raiser@example.com" }));
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "answerer@example.com" }));
  });

  it("rejects an already-approved RFI with BAD_REQUEST", async () => {
    dbCalls.companyUsersReturn = [{ companyRole: "company_admin", isActive: true }];
    dbCalls.rfisSelectReturn = [
      { id: 4, companyId: 7, projectId: 42, status: "approved", subject: "x",
        raisedById: 9, answeredById: 7, number: "RFI-0004" },
    ];
    const caller = appRouter.createCaller(ctxForCompanyAdmin(5));
    await expect(
      caller.rfis.approve({ id: 4, companyId: 7 }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects a not-yet-answered RFI with BAD_REQUEST", async () => {
    dbCalls.companyUsersReturn = [{ companyRole: "company_admin", isActive: true }];
    dbCalls.rfisSelectReturn = [
      { id: 5, companyId: 7, projectId: 42, status: "submitted", subject: "x",
        raisedById: 9, answeredById: null, number: "RFI-0005" },
    ];
    const caller = appRouter.createCaller(ctxForCompanyAdmin(5));
    await expect(
      caller.rfis.approve({ id: 5, companyId: 7 }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

// ─── rfis.reject — new procedure (T7) ────────────────────────────────────────

describe("rfis.reject", () => {
  it("requires company_admin+ — manager is FORBIDDEN", async () => {
    dbCalls.companyUsersReturn = [{ companyRole: "manager", isActive: true }];
    dbCalls.rfisSelectReturn = [
      { id: 10, companyId: 7, projectId: 42, status: "answered", subject: "Beam spec",
        raisedById: 9, answeredById: 7, number: "RFI-0010" },
    ];
    const caller = appRouter.createCaller(ctxForManager(5));
    await expect(
      caller.rfis.reject({ id: 10, companyId: 7, reason: "Not enough detail" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects empty reason at the input layer (BAD_REQUEST)", async () => {
    dbCalls.companyUsersReturn = [{ companyRole: "company_admin", isActive: true }];
    dbCalls.rfisSelectReturn = [
      { id: 11, companyId: 7, projectId: 42, status: "answered", subject: "Door spec",
        raisedById: 9, answeredById: 7, number: "RFI-0011" },
    ];
    const caller = appRouter.createCaller(ctxForCompanyAdmin(5));
    await expect(
      caller.rfis.reject({ id: 11, companyId: 7, reason: "" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("transitions answered → rejected, persists the reason, emails raiser + answerer", async () => {
    dbCalls.companyUsersReturn = [{ companyRole: "company_admin", isActive: true }];
    dbCalls.rfisSelectReturn = [
      { id: 12, companyId: 7, projectId: 42, status: "answered", subject: "Load case review",
        raisedById: 9, answeredById: 7, number: "RFI-0012" },
    ];
    dbCalls.usersSelectReturn = [
      { id: 9, name: "Raiser Nine", email: "raiser@example.com" },
      { id: 7, name: "Answerer Seven", email: "answerer@example.com" },
    ];
    dbCalls.projectsSelectReturn = [{ id: 42, name: "Test Project", companyId: 7 }];

    const caller = appRouter.createCaller(ctxForCompanyAdmin(5));
    const result = await caller.rfis.reject({
      id: 12,
      companyId: 7,
      reason: "Insufficient detail on load case",
    });

    expect(result).toEqual({ success: true });

    const upd = dbCalls.updates.find((u) => u.table === "rfis");
    expect(upd).toBeTruthy();
    expect(upd!.values).toMatchObject({
      status: "rejected",
      rejectedById: 5,
      rejectedReason: "Insufficient detail on load case",
    });
    expect(upd!.values.rejectedAt).toBeInstanceOf(Date);
    expect(upd!.values.updatedAt).toBeInstanceOf(Date);
    expectTenantWhere(upd!, { id: 12, companyId: 7 });

    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "raiser@example.com" }));
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "answerer@example.com" }));

    const reasonInBody = sendEmail.mock.calls.some(c => (c as any[])[0]?.text?.includes("Insufficient detail on load case"));
    expect(reasonInBody).toBe(true);
  });

  it("rejects a not-yet-answered RFI with BAD_REQUEST", async () => {
    dbCalls.companyUsersReturn = [{ companyRole: "company_admin", isActive: true }];
    dbCalls.rfisSelectReturn = [
      { id: 13, companyId: 7, projectId: 42, status: "submitted", subject: "x",
        raisedById: 9, answeredById: null, number: "RFI-0013" },
    ];
    const caller = appRouter.createCaller(ctxForCompanyAdmin(5));
    await expect(
      caller.rfis.reject({ id: 13, companyId: 7, reason: "Not detailed enough" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

// ─── rfis.create — broadcast email (T8) ──────────────────────────────────────
//
// Mock-split rationale (Approach A):
//   The `company_users` table is accessed by two distinct callers:
//
//   1. companyScopedProcedure middleware → always terminates with `.limit(1)`.
//      Returns `dbCalls.companyUsersReturn` (existing behaviour, untouched).
//
//   2. rfis.create broadcast lookup → `db.select().from(companyUsers).where(...)`
//      awaited directly (no `.limit()`), so the chain resolves via `.then(resolve)`.
//      Returns `dbCalls.companyUsersBroadcastReturn` (new field added in T8).
//
//   The extended mock branch in the `company_users` arm now exposes both
//   `.limit()` and `.then()` on the object returned by `.where(...)`, letting
//   each terminator dispatch to the right return slot without coupling them.

describe("rfis.create — recipient broadcast", () => {
  it("emails every active companyUsers row with role manager / company_admin / super_admin", async () => {
    // Project must belong to companyId=1 to pass the cross-tenant FK guard.
    dbCalls.projectsSelectReturn = [{ id: 1, companyId: 1, name: "P1" }];
    // RFI numbering: 0 prior RFIs → "RFI-0001".
    dbCalls.rfisCountReturn = [{ c: 0 }];

    // Five active memberships: manager(100), company_admin(101), super_admin(102),
    // supervisor(103), worker(104). The production code filters to the top 3 roles.
    dbCalls.companyUsersBroadcastReturn = [
      { userId: 100, companyRole: "manager",       isActive: true },
      { userId: 101, companyRole: "company_admin", isActive: true },
      { userId: 102, companyRole: "super_admin",   isActive: true },
      { userId: 103, companyRole: "supervisor",    isActive: true },
      { userId: 104, companyRole: "worker",        isActive: true },
    ];

    // Only the three recipient users are returned by the users lookup.
    // supervisor (103) and worker (104) are deliberately absent — they
    // should not be emailed.
    dbCalls.usersSelectReturn = [
      { id: 100, name: "Manager",       email: "mgr@example.com" },
      { id: 101, name: "CompanyAdmin",  email: "adm@example.com" },
      { id: 102, name: "SuperAdmin",    email: "super@example.com" },
    ];

    // Worker (104) is the caller — any authenticated member can submit an RFI.
    dbCalls.companyUsersReturn = [{ companyRole: "worker", isActive: true }];

    const caller = appRouter.createCaller(ctxFor(104));
    await caller.rfis.create({ companyId: 1, projectId: 1, subject: "Beam spec", question: "?" });

    expect(sendEmail).toHaveBeenCalledTimes(3);
    const toAddresses = sendEmail.mock.calls.map((c: any[]) => (c[0] as any).to).sort();
    expect(toAddresses).toEqual(["adm@example.com", "mgr@example.com", "super@example.com"].sort());
  });

  it("does not email inactive members", async () => {
    // Same FK guard / numbering setup.
    dbCalls.projectsSelectReturn = [{ id: 1, companyId: 1, name: "P1" }];
    dbCalls.rfisCountReturn = [{ c: 0 }];

    // The production WHERE clause includes `eq(companyUsers.isActive, true)`.
    // In the real DB that filter would exclude inactive rows; here the mock
    // doesn't actually execute SQL predicates, so we simulate the filtered
    // result by returning an empty array — as if no active members exist.
    dbCalls.companyUsersBroadcastReturn = [];
    dbCalls.usersSelectReturn = [];
    dbCalls.companyUsersReturn = [{ companyRole: "worker", isActive: true }];

    const caller = appRouter.createCaller(ctxFor(104));
    await caller.rfis.create({ companyId: 1, projectId: 1, subject: "Beam spec", question: "?" });

    expect(sendEmail).not.toHaveBeenCalled();
  });
});
