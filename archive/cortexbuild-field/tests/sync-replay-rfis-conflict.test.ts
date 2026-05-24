/**
 * Tests for rfis.update's conflict-aware path, exercised via the sync.replay
 * dispatcher (the same way the offline queue calls it on reconnect).
 *
 * Three branches:
 *   - success: server's row is unchanged or changed only on fields the
 *     client did not touch — applies cleanly, returns { success: true }.
 *   - conflict: server changed at least one field the client also wants
 *     to change — returns { status: 'conflict', conflictId, fields } and
 *     inserts a conflict_pending row in the same transaction.
 *   - row_deleted: SELECT FOR UPDATE returns no row — returns
 *     { status: 'row_deleted' } without writing anything.
 *
 * The original online path (no baseSnapshot) is covered by the existing
 * online behaviour and is not retested here.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";
import {
  rfis as dbRfis,
  conflictPending as dbConflictPending,
  companyUsers as dbCompanyUsers,
} from "../drizzle/schema";

type MockState = {
  rfiRow: Record<string, unknown> | null;
  insertedConflict: any;
  rfiUpdateSet: any;
  rfiUpdateRan: boolean;
};

const state: MockState = {
  rfiRow: null,
  insertedConflict: null,
  rfiUpdateSet: null,
  rfiUpdateRan: false,
};

function makeDb() {
  const txApi = {
    select() {
      return {
        from(table: unknown) {
          return {
            where() {
              return {
                limit() {
                  return {
                    for() {
                      if (table === dbRfis) return Promise.resolve(state.rfiRow ? [state.rfiRow] : []);
                      return Promise.resolve([]);
                    },
                  };
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
          if (table === dbConflictPending) state.insertedConflict = values;
          return {
            returning() {
              if (table === dbConflictPending) return Promise.resolve([{ id: 4242 }]);
              return Promise.resolve([{ id: 1, ...values }]);
            },
          };
        },
      };
    },
    update(table: unknown) {
      return {
        set(values: any) {
          if (table === dbRfis) {
            state.rfiUpdateSet = values;
            state.rfiUpdateRan = true;
          }
          return { where() { return Promise.resolve(); } };
        },
      };
    },
  };

  return {
    select() {
      // Outside transactions: only the companyScopedProcedure membership probe runs here.
      return {
        from(table: unknown) {
          return {
            where() {
              return {
                limit() {
                  if (table === dbCompanyUsers) return Promise.resolve([{ companyRole: "manager", isActive: true }]);
                  return Promise.resolve([]);
                },
              };
            },
          };
        },
      };
    },
    insert() { return { values: () => ({ returning: () => Promise.resolve([]) }) }; },
    update() { return { set: () => ({ where: () => Promise.resolve() }) }; },
    transaction(fn: (tx: any) => any) {
      return fn(txApi);
    },
  };
}

vi.mock("../server/db", () => ({
  getDb: vi.fn(async () => makeDb()),
}));

function ctxWithUser(): TrpcContext {
  return {
    user: {
      id: 11,
      openId: "user-11",
      name: "Test User",
      email: "test@example.com",
      loginMethod: "manus",
      role: "user",
      passwordHash: null,
      pushPreferences: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", hostname: "h", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

beforeEach(() => {
  state.rfiRow = null;
  state.insertedConflict = null;
  state.rfiUpdateSet = null;
  state.rfiUpdateRan = false;
});

afterEach(() => vi.clearAllMocks());

describe("rfis.update — conflict-aware via sync.replay", () => {
  it("returns { success: true } when server changed a different field (auto-merge)", async () => {
    state.rfiRow = {
      id: 1,
      companyId: 7,
      question: "old question",  // unchanged from snapshot
      priority: "high",          // changed server-side, but client doesn't touch priority
      updatedAt: new Date("2026-05-06T10:05:00Z"),
    };
    const caller = appRouter.createCaller(ctxWithUser());
    const result = await caller.sync.replay({
      type: "rfis.update",
      payload: {
        id: 1,
        companyId: 7,
        question: "my new question",
        baseSnapshot: {
          updatedAt: "2026-05-06T10:00:00Z",
          originalValues: { question: "old question" },
        },
      },
    });

    expect(result.success).toBe(true);
    expect(result.result).toMatchObject({ success: true });
    expect(state.rfiUpdateRan).toBe(true);
    expect(state.rfiUpdateSet.question).toBe("my new question");
    expect(state.insertedConflict).toBeNull();
  });

  it("returns { status: 'conflict' } when server changed the same field, and inserts conflict_pending", async () => {
    state.rfiRow = {
      id: 1,
      companyId: 7,
      question: "their new question",  // server changed it
      priority: "low",
      updatedAt: new Date("2026-05-06T10:05:00Z"),
    };
    const caller = appRouter.createCaller(ctxWithUser());
    const result = await caller.sync.replay({
      type: "rfis.update",
      payload: {
        id: 1,
        companyId: 7,
        question: "my new question",
        baseSnapshot: {
          updatedAt: "2026-05-06T10:00:00Z",
          originalValues: { question: "old question" },
        },
      },
    });

    // The replay envelope still wraps with success:true (the dispatcher itself
    // didn't error); the procedure's status is in result.result.status.
    expect(result.result).toMatchObject({
      status: "conflict",
      conflictId: 4242,
      fields: ["question"],
    });

    // conflict_pending row was inserted with mine + theirs values.
    expect(state.insertedConflict).toMatchObject({
      companyId: 7,
      userId: 11,
      tableName: "rfis",
      rowId: 1,
      conflictFields: ["question"],
      mineValues: { question: "my new question" },
      theirsValues: { question: "their new question" },
    });

    // Source row was NOT updated.
    expect(state.rfiUpdateRan).toBe(false);
  });

  it("returns { status: 'row_deleted' } when the row is missing", async () => {
    state.rfiRow = null;
    const caller = appRouter.createCaller(ctxWithUser());
    const result = await caller.sync.replay({
      type: "rfis.update",
      payload: {
        id: 99,
        companyId: 7,
        question: "doesn't matter",
        baseSnapshot: {
          updatedAt: "2026-05-06T10:00:00Z",
          originalValues: { question: "old question" },
        },
      },
    });

    expect(result.result).toMatchObject({ status: "row_deleted" });
    expect(state.rfiUpdateRan).toBe(false);
    expect(state.insertedConflict).toBeNull();
  });

  it("multi-field conflict reports all overlapping fields", async () => {
    state.rfiRow = {
      id: 1,
      companyId: 7,
      question: "their question",
      priority: "low",
      updatedAt: new Date("2026-05-06T10:05:00Z"),
    };
    const caller = appRouter.createCaller(ctxWithUser());
    const result = await caller.sync.replay({
      type: "rfis.update",
      payload: {
        id: 1,
        companyId: 7,
        question: "my question",
        priority: "high",
        baseSnapshot: {
          updatedAt: "2026-05-06T10:00:00Z",
          originalValues: { question: "old question", priority: "medium" },
        },
      },
    });

    const inner = result.result as { status: string; conflictId: number; fields: string[] };
    expect(inner.status).toBe("conflict");
    expect(inner.fields.sort()).toEqual(["priority", "question"]);
    expect(state.insertedConflict.mineValues).toEqual({ question: "my question", priority: "high" });
    expect(state.insertedConflict.theirsValues).toEqual({ question: "their question", priority: "low" });
  });
});
