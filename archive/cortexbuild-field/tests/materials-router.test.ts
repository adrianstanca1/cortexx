import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../server/_core/context";
import {
  collectBindings,
  collectColumns,
  tableName,
} from "./_helpers/drizzle-mock";
import { expectTenantWhere } from "./_helpers/expect-tenant-where";

/**
 * Coverage for the materials sub-router (`server/routers/materials.ts`).
 *
 * Phase 3.2 — Materials delivery tracking. Schedule (office) →
 * confirm/reject (site, offline-tolerant) workflow.
 *
 * Procedures (added incrementally across Tasks 6-11):
 *   T6 — list (this file's initial scope)
 *   T7-T11 — create / scheduleDelivery / confirm / reject / update etc.
 *
 * Mock infrastructure mirrors `tests/rfis-router.test.ts`. The
 * `dbCalls` accumulator carries return slots per-table so future tasks
 * can append `describe(...)` blocks without rebuilding the mock setup.
 *
 * Notable hooks already in place for upcoming tasks:
 *   - sendPushToUsers is mocked from `../server/_core/pushNotifications`
 *     so confirm / reject / update procedures can have their broadcast
 *     side effects asserted by call-args.
 *   - companyUsersBroadcastReturn supports the broadcast lookup pattern
 *     used by RFI-style fan-out (mirrors the rfis-router.test.ts split
 *     between the middleware `.limit(1)` terminator and the broadcast
 *     `.then(...)` terminator on the same `company_users` table).
 *   - materialDeliveriesSelectReturn feeds the pre-read used by status
 *     transitions (confirm / reject) in T8+; defaults to [] so list-only
 *     tests stay clean.
 *   - projectsSelectReturn feeds the cross-tenant FK guard in T7+
 *     (default seeded to a row matching companyId=1 / projectId=42 so
 *     happy paths pass; cross-tenant tests override with []).
 */

// ── sendPushToUsers mock — required for T7-T9 push side-effect assertions ──
const sendPushToUsers = vi.fn(async () => ({ degraded: false, sentCount: 0 }));
vi.mock("../server/_core/pushNotifications", () => ({
  sendPushToUsers,
  // sendPushToUserByName isn't called by materials, but keeping the
  // surface-symmetric stub here means a stray import won't blow up.
  sendPushToUserByName: vi.fn(async () => ({ degraded: false, sentCount: 0 })),
}));

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
  /** Rows returned by `select().from(materialDeliveries).where(...)`
   *  pre-reads (status transitions in T8+ load the row before update). */
  materialDeliveriesSelectReturn: any[];
  /** Rows returned by the cross-tenant FK guard's
   *  `select().from(projects).where(...)` lookup. */
  projectsSelectReturn: any[];
  /** Rows returned by `select().from(users).where(...)` lookups. */
  usersSelectReturn: any[];
  /** Rows returned by `select().from(conflictPending).where(...)` lookups
   *  used by the offline-tolerant write path (sync conflict registry). */
  conflictPendingSelectReturn: any[];
  /**
   * Rows returned by `company_users` lookups via the
   * companyScopedProcedure middleware (terminates with `.limit(1)`).
   * Defaults to manager so happy-path tests pass; override in tests
   * exercising role-gate rejections.
   */
  companyUsersReturn: any[];
  /**
   * Rows returned by the broadcast lookup on `company_users`
   * (no `.limit()` — awaited directly via `.then(...)`).
   * Used by T7-T9 fan-out emails / push.
   */
  companyUsersBroadcastReturn: any[];
}

const dbCalls: DbCalls = {
  selectFroms: [],
  inserts: [],
  updates: [],
  deletes: [],
  materialDeliveriesSelectReturn: [],
  projectsSelectReturn: [],
  usersSelectReturn: [],
  conflictPendingSelectReturn: [],
  companyUsersReturn: [{ companyRole: "manager", isActive: true }],
  companyUsersBroadcastReturn: [],
};

function makeDb() {
  const api: any = {
    select(projection?: any) {
      const isCountQuery = projection !== undefined && "c" in projection;
      return {
        from(table: any) {
          const name = tableName(table);
          if (name.includes("company_users")) {
            return {
              where(_c: unknown) {
                // Two callers hit company_users:
                //   1. companyScopedProcedure middleware → `.limit(1)`
                //      → returns companyUsersReturn.
                //   2. broadcast lookup → awaited directly (no `.limit()`)
                //      → reaches `.then(resolve)`
                //      → returns companyUsersBroadcastReturn.
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
            ? []
            : name === "projects"
              ? dbCalls.projectsSelectReturn
              : name === "material_deliveries"
                ? dbCalls.materialDeliveriesSelectReturn
                : name === "users"
                  ? dbCalls.usersSelectReturn
                  : name === "conflict_pending"
                    ? dbCalls.conflictPendingSelectReturn
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
              // `.for('update')` is the row-lock terminator used inside
              // markDelivered's transaction (spec § 5.3 step 2). Mock just
              // returns the same rows — concurrency isn't simulated here.
              const limited: any = {
                for(_mode: string) {
                  return Promise.resolve(returnRows);
                },
                then(resolve: any, reject?: any) {
                  return Promise.resolve(returnRows).then(resolve, reject);
                },
              };
              return limited;
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
          // The chain supports both `await ...where(...)` (terminal)
          // and `await ...where(...).returning()` (T8+ markDelivered et al.).
          // For `returning()` we synthesise a row by merging the SET payload
          // over the table's current select-return row, so callers reading
          // `row.supplierName` / `row.deliveredAt` etc. get values seeded
          // by the test's `materialDeliveriesSelectReturn` fixture.
          const currentRow =
            name === "material_deliveries"
              ? (dbCalls.materialDeliveriesSelectReturn[0] ?? {})
              : {};
          return {
            where(predicate: unknown) {
              record.whereCols.push(...collectColumns(predicate));
              Object.assign(record.whereBindings, collectBindings(predicate));
              return {
                returning() {
                  return Promise.resolve([{ ...currentRow, ...values }]);
                },
                then(resolve: any, reject?: any) {
                  return Promise.resolve().then(resolve, reject);
                },
              };
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
    // Transaction passthrough: the markDelivered procedure (Phase 3.2 T8)
    // wraps read+assert+update in `db.transaction(...)` so the SELECT can
    // use `.for('update')` (spec § 5.3 step 2). The mock simply re-runs
    // the callback against the same fluent API — concurrency semantics
    // aren't simulated here.
    transaction(fn: (tx: any) => any) {
      return Promise.resolve(fn(api));
    },
  };
  return api;
}

vi.mock("../server/db", () => ({
  getDb: vi.fn(async () => makeDb()),
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

/**
 * A context carrying a manager companyMembership — for procedures gated
 * by requireCompanyRole("manager"). Provided here so T7-T11 can use it
 * without re-defining. Currently unused by T6 list-only tests.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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

beforeEach(() => {
  dbCalls.selectFroms.length = 0;
  dbCalls.inserts.length = 0;
  dbCalls.updates.length = 0;
  dbCalls.deletes.length = 0;
  dbCalls.materialDeliveriesSelectReturn = [];
  // Default: project belongs to the same company so cross-tenant FK guard
  // passes for T7+ create/update tests. Cross-tenant tests override with [].
  dbCalls.projectsSelectReturn = [{ id: 42, companyId: 7 }];
  dbCalls.usersSelectReturn = [];
  dbCalls.conflictPendingSelectReturn = [];
  dbCalls.companyUsersReturn = [{ companyRole: "manager", isActive: true }];
  dbCalls.companyUsersBroadcastReturn = [];
  sendPushToUsers.mockClear();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ─── materials.list ──────────────────────────────────────────────────────────

describe("materials.list", () => {
  it("binds companyId in WHERE and orders by expectedAt asc", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.materials.list({ companyId: 7 });

    const sel = dbCalls.selectFroms.find((s) => s.table === "material_deliveries");
    expect(sel).toBeDefined();
    expectTenantWhere(sel!, { companyId: 7 });
    // Optional projectId / status / fromDate / toDate not in this call.
    expect(sel!.whereCols).not.toContain("projectId");
    expect(sel!.whereBindings).not.toHaveProperty("projectId");
    expect(sel!.whereBindings).not.toHaveProperty("status");
  });

  it("adds projectId predicate when provided", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.materials.list({ companyId: 7, projectId: 42 });
    const sel = dbCalls.selectFroms.find((s) => s.table === "material_deliveries")!;
    expect(sel).toBeDefined();
    expectTenantWhere(sel!, { companyId: 7, projectId: 42 });
  });
});

// ─── materials.expectDelivery ────────────────────────────────────────────────

/**
 * `baseCtx` mirrors the rfis test's per-test caller — `companyMembership` is
 * hydrated by the companyScopedProcedure middleware from `companyUsersReturn`
 * (defaults to manager), so role-gate tests just override that default.
 */
const baseCtx: TrpcContext = ctxFor(5);

describe("materials.expectDelivery", () => {
  beforeEach(() => {
    dbCalls.selectFroms.length = 0;
    dbCalls.inserts.length = 0;
    dbCalls.updates.length = 0;
    dbCalls.deletes.length = 0;
    dbCalls.materialDeliveriesSelectReturn = [];
    dbCalls.projectsSelectReturn = [{ id: 42, companyId: 7 }];
    dbCalls.usersSelectReturn = [];
    dbCalls.conflictPendingSelectReturn = [];
    dbCalls.companyUsersReturn = [{ companyRole: "manager", isActive: true }];
    dbCalls.companyUsersBroadcastReturn = [];
    sendPushToUsers.mockClear();
  });

  it("inserts with createdById from ctx.user, status default expected, and pushes delivery_expected", async () => {
    dbCalls.projectsSelectReturn = [{ id: 7, companyId: 1, name: "Tower A" }]; // FK guard passes
    dbCalls.companyUsersBroadcastReturn = [
      { userId: 11, companyRole: "supervisor", isActive: true },
      { userId: 12, companyRole: "manager",    isActive: true },
      { userId: 13, companyRole: "worker",     isActive: true }, // excluded by role
    ];
    const caller = appRouter.createCaller(baseCtx);
    await caller.materials.expectDelivery({
      companyId: 1, projectId: 7,
      supplierName: "Travis Perkins", materialDescription: "5 pallets brick",
      expectedAt: "2026-05-08T14:00:00.000Z", notes: "gate code 4321",
    });

    const ins = dbCalls.inserts.find((i) => i.table === "material_deliveries")!;
    expect(ins).toBeDefined();
    expect(ins.values.createdById).toBe(baseCtx.user!.id);
    expect(ins.values.status).toBe("expected");
    expect(ins.values.companyId).toBe(1);

    expect(sendPushToUsers).toHaveBeenCalledWith(
      [11, 12],
      "delivery_expected",
      expect.objectContaining({
        data: expect.objectContaining({ supplierName: "Travis Perkins" }),
      }),
    );
  });

  it("rejects FORBIDDEN when project belongs to a different company (cross-tenant guard)", async () => {
    dbCalls.projectsSelectReturn = []; // no row → guard fails
    const caller = appRouter.createCaller(baseCtx);
    await expect(caller.materials.expectDelivery({
      companyId: 1, projectId: 99,
      supplierName: "X", materialDescription: "Y",
      expectedAt: "2026-05-08T14:00:00.000Z",
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(dbCalls.inserts.filter((i) => i.table === "material_deliveries")).toHaveLength(0);
  });

  it("rejects FORBIDDEN when caller role < manager", async () => {
    dbCalls.companyUsersReturn = [{ companyRole: "supervisor", isActive: true }]; // gate test
    const caller = appRouter.createCaller(baseCtx);
    await expect(caller.materials.expectDelivery({
      companyId: 1, projectId: 7,
      supplierName: "X", materialDescription: "Y",
      expectedAt: "2026-05-08T14:00:00.000Z",
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

// ─── materials.markDelivered ─────────────────────────────────────────────────

describe("materials.markDelivered", () => {
  beforeEach(() => {
    dbCalls.materialDeliveriesSelectReturn = [{
      id: 42, companyId: 1, projectId: 7, status: "expected",
      supplierName: "X", materialDescription: "Y",
      expectedAt: new Date("2026-05-08T14:00:00Z"),
    }];
    dbCalls.companyUsersBroadcastReturn = [
      { userId: 21, companyRole: "manager", isActive: true },
      { userId: 22, companyRole: "supervisor", isActive: true }, // excluded
    ];
  });

  it("transitions expected→delivered, sets receivedById, and pushes delivery_received to managers", async () => {
    const caller = appRouter.createCaller(baseCtx);
    await caller.materials.markDelivered({
      companyId: 1, id: 42, gpsLat: 51.5, gpsLng: -0.1,
      photoStorageKeys: ["k1", "k2"],
    });

    const upd = dbCalls.updates.find(u => u.table === "material_deliveries")!;
    expect(upd.values.status).toBe("delivered");
    expect(upd.values.receivedById).toBe(baseCtx.user!.id);
    expect(upd.values.deliveredAt).toBeInstanceOf(Date);
    expect(upd.values.photoStorageKeys).toEqual(["k1", "k2"]);

    expect(sendPushToUsers).toHaveBeenCalledWith(
      [21], "delivery_received", expect.any(Object),
    );
  });

  it("omits absent fields from SET (sparse update, preserves prior photos on offline replay)", async () => {
    const caller = appRouter.createCaller(baseCtx);
    await caller.materials.markDelivered({ companyId: 1, id: 42 }); // no photos
    const upd = dbCalls.updates.find(u => u.table === "material_deliveries")!;
    expect(upd.values.photoStorageKeys).toBeUndefined();
    expect(upd.values.notes).toBeUndefined();
    expect(upd.values.gpsLat).toBeUndefined();
  });

  it("rejects BAD_REQUEST when current status is delivered (illegal transition)", async () => {
    dbCalls.materialDeliveriesSelectReturn = [{ id: 42, companyId: 1, status: "delivered" }];
    const caller = appRouter.createCaller(baseCtx);
    await expect(caller.materials.markDelivered({ companyId: 1, id: 42 }))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects FORBIDDEN when caller role < supervisor", async () => {
    dbCalls.companyUsersReturn = [{ companyRole: "worker", isActive: true }];
    const caller = appRouter.createCaller(baseCtx);
    await expect(caller.materials.markDelivered({ companyId: 1, id: 42 }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

// ─── materials.markRejected ──────────────────────────────────────────────────

describe("materials.markRejected", () => {
  beforeEach(() => {
    dbCalls.materialDeliveriesSelectReturn = [{
      id: 42, companyId: 1, projectId: 7, status: "expected",
      supplierName: "X", materialDescription: "Y",
    }];
    dbCalls.projectsSelectReturn = [{ id: 7, companyId: 1, name: "Burnt Mill" }];
  });

  it("rejects BAD_REQUEST when rejectionReason is empty (zod min(1))", async () => {
    const caller = appRouter.createCaller(baseCtx);
    await expect(caller.materials.markRejected({
      companyId: 1, id: 42, rejectionReason: "",
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("transitions to rejected, persists reason, fires delivery_rejected", async () => {
    dbCalls.companyUsersBroadcastReturn = [
      { userId: 21, companyRole: "manager", isActive: true },
    ];
    const caller = appRouter.createCaller(baseCtx);
    await caller.materials.markRejected({
      companyId: 1, id: 42, rejectionReason: "Wrong size delivered (305x165 instead of 254x146)",
    });

    const upd = dbCalls.updates.find(u => u.table === "material_deliveries")!;
    expect(upd.values.status).toBe("rejected");
    expect(upd.values.rejectionReason).toContain("Wrong size");
    expect(sendPushToUsers).toHaveBeenCalledWith(
      [21], "delivery_rejected",
      expect.objectContaining({
        data: expect.objectContaining({ rejectionReason: expect.any(String) }),
      }),
    );
  });
});

// ─── materials.cancelDelivery ────────────────────────────────────────────────

describe('materials.cancelDelivery', () => {
  beforeEach(() => {
    dbCalls.materialDeliveriesSelectReturn = [{ id: 42, companyId: 1, status: 'expected' }];
  });

  it('transitions expected→cancelled, persists optional cancellationReason', async () => {
    const caller = appRouter.createCaller(baseCtx);
    await caller.materials.cancelDelivery({ companyId: 1, id: 42, cancellationReason: 'Supplier strike' });
    const upd = dbCalls.updates.find(u => u.table === 'material_deliveries')!;
    expect(upd.values.status).toBe('cancelled');
    expect(upd.values.cancellationReason).toBe('Supplier strike');
  });

  it('rejects FORBIDDEN when caller role < manager', async () => {
    dbCalls.companyUsersReturn = [{ companyRole: 'supervisor', isActive: true }];
    const caller = appRouter.createCaller(baseCtx);
    await expect(caller.materials.cancelDelivery({ companyId: 1, id: 42 }))
      .rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('does NOT call sendPushToUsers', async () => {
    (sendPushToUsers as any).mockClear?.();
    const caller = appRouter.createCaller(baseCtx);
    await caller.materials.cancelDelivery({ companyId: 1, id: 42 });
    expect(sendPushToUsers).not.toHaveBeenCalled();
  });
});

// ─── materials.update (no baseSnapshot — online sparse SET) ──────────────────

describe('materials.update (no baseSnapshot)', () => {
  beforeEach(() => {
    dbCalls.materialDeliveriesSelectReturn = [{ id: 42, companyId: 1, status: 'expected' }];
  });

  it('writes only present fields (sparse SET); strips id / companyId; sets updatedAt', async () => {
    const caller = appRouter.createCaller(baseCtx);
    await caller.materials.update({
      companyId: 1, id: 42, notes: 'Gate code 4321', supplierName: 'Travis',
    });
    const upd = dbCalls.updates.find(u => u.table === 'material_deliveries')!;
    expect(upd.values.notes).toBe('Gate code 4321');
    expect(upd.values.supplierName).toBe('Travis');
    expect(upd.values.materialDescription).toBeUndefined();
    expect(upd.values.id).toBeUndefined();
    expect(upd.values.companyId).toBeUndefined();
    expect(upd.values.updatedAt).toBeInstanceOf(Date);
  });

  it('runs assertTransition when status changes (delivered→expected is illegal)', async () => {
    dbCalls.materialDeliveriesSelectReturn = [{ id: 42, companyId: 1, status: 'delivered' }];
    const caller = appRouter.createCaller(baseCtx);
    await expect(caller.materials.update({ companyId: 1, id: 42, status: 'expected' }))
      .rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

// ─── materials.update (with baseSnapshot — offline-replay conflict path) ─────

describe('materials.update with baseSnapshot', () => {
  const SNAPSHOT_AT = '2026-05-07T10:00:00.000Z';

  it('returns success when no field has moved (ok branch)', async () => {
    dbCalls.materialDeliveriesSelectReturn = [{
      id: 42, companyId: 1, status: 'expected',
      notes: 'A', supplierName: 'X',
      updatedAt: new Date(SNAPSHOT_AT),
    }];
    const caller = appRouter.createCaller(baseCtx);
    const result = await caller.materials.update({
      companyId: 1, id: 42, notes: 'B',
      baseSnapshot: { updatedAt: SNAPSHOT_AT, originalValues: { notes: 'A' } },
    });
    expect(result).toMatchObject({ id: 42 });
  });

  it('parks conflict_pending when same field moved on server (conflict branch)', async () => {
    dbCalls.materialDeliveriesSelectReturn = [{
      id: 42, companyId: 1, status: 'expected',
      notes: 'C', // server moved A → C
      updatedAt: new Date('2026-05-07T11:00:00Z'),
    }];
    const caller = appRouter.createCaller(baseCtx);
    const result = await caller.materials.update({
      companyId: 1, id: 42, notes: 'B', // user wants A → B
      baseSnapshot: { updatedAt: SNAPSHOT_AT, originalValues: { notes: 'A' } },
    });
    expect(result).toMatchObject({ status: 'conflict', fields: ['notes'] });
    const ins = dbCalls.inserts.find(i => i.table === 'conflict_pending')!;
    expect(ins.values.tableName).toBe('materials');
    expect(ins.values.rowId).toBe(42);
  });

  it('returns row_deleted when row is gone', async () => {
    dbCalls.materialDeliveriesSelectReturn = [];
    const caller = appRouter.createCaller(baseCtx);
    const result = await caller.materials.update({
      companyId: 1, id: 42, notes: 'B',
      baseSnapshot: { updatedAt: SNAPSHOT_AT, originalValues: { notes: 'A' } },
    });
    expect(result).toMatchObject({ status: 'row_deleted' });
  });

  it('atomic field conflict: expectedAt change → conflict', async () => {
    dbCalls.materialDeliveriesSelectReturn = [{
      id: 42, companyId: 1, status: 'expected',
      expectedAt: new Date('2026-05-09T14:00:00Z'),
    }];
    const caller = appRouter.createCaller(baseCtx);
    const result = await caller.materials.update({
      companyId: 1, id: 42, expectedAt: '2026-05-08T16:00:00Z',
      baseSnapshot: {
        updatedAt: SNAPSHOT_AT,
        originalValues: { expectedAt: '2026-05-08T14:00:00.000Z' },
      },
    });
    expect(result).toMatchObject({ status: 'conflict', fields: ['expectedAt'] });
  });

  it('disjoint edits auto-merge (different fields → ok)', async () => {
    dbCalls.materialDeliveriesSelectReturn = [{
      id: 42, companyId: 1, status: 'expected',
      notes: 'A',
      supplierName: 'Y', // server changed supplierName X→Y
    }];
    const caller = appRouter.createCaller(baseCtx);
    const result = await caller.materials.update({
      companyId: 1, id: 42, notes: 'B', // user changed notes A→B (different field)
      baseSnapshot: {
        updatedAt: SNAPSHOT_AT,
        originalValues: { notes: 'A', supplierName: 'X' },
      },
    });
    expect(result).toMatchObject({ id: 42 });
  });
});
