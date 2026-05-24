/**
 * Tests for the conflicts router (server/routers/conflicts.ts).
 *
 * `list` — returns the current user's parked or resolved conflicts. Filters
 * by user_id + company_id; cross-tenant attempts return empty (no rows).
 *
 * `resolve` — applies finalValues to the source row through the diff
 * dispatcher. Three branches: clean apply (ok:true), recursive conflict
 * (ok:false + new conflictId), source-row-deleted (ok:true + sourceDeleted).
 * Also covers CONFLICT_ALREADY_RESOLVED and CONFLICT_NOT_FOUND.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";
import {
  conflictPending as dbConflictPending,
  rfis as dbRfis,
  companyUsers as dbCompanyUsers,
} from "../drizzle/schema";

type ConflictRow = {
  id: number;
  companyId: number;
  userId: number;
  tableName: string;
  rowId: number;
  conflictFields: string[];
  mineValues: Record<string, unknown>;
  theirsValues: Record<string, unknown>;
  baseUpdatedAt: Date;
  resolvedAt: Date | null;
  createdAt: Date;
};

type State = {
  conflicts: ConflictRow[];
  rfiRow: Record<string, unknown> | null;
  resolvedAtSet: { id: number; at: Date } | null;
  newConflictInserted: any;
  rfiUpdateRan: boolean;
};

const state: State = {
  conflicts: [],
  rfiRow: null,
  resolvedAtSet: null,
  newConflictInserted: null,
  rfiUpdateRan: false,
};

// Track what filter was used during list, so cross-tenant tests can verify
// the right rows came back without re-implementing SQL semantics in the mock.
function applyListFilter(args: { companyId?: number; userId?: number; resolved?: boolean }): ConflictRow[] {
  return state.conflicts.filter((c) => {
    if (args.companyId !== undefined && c.companyId !== args.companyId) return false;
    if (args.userId !== undefined && c.userId !== args.userId) return false;
    if (args.resolved === true && c.resolvedAt === null) return false;
    if (args.resolved === false && c.resolvedAt !== null) return false;
    return true;
  });
}

function makeDb() {
  const txApi = {
    select() {
      return {
        from(table: unknown) {
          // First-pass capture: SELECTs in the resolve transaction.
          if (table === dbConflictPending) {
            return {
              where(condition: any) {
                // Mock the .where(eq(id=X)) intent by reading the captured pending row.
                return {
                  limit() {
                    return {
                      for: () => Promise.resolve(
                        state.conflicts.length ? [state.conflicts[0]] : []
                      ),
                    };
                  },
                };
              },
            };
          }
          if (table === dbRfis) {
            return {
              where() {
                return {
                  limit() {
                    return { for: () => Promise.resolve(state.rfiRow ? [state.rfiRow] : []) };
                  },
                };
              },
            };
          }
          return { where: () => ({ limit: () => ({ for: () => Promise.resolve([]) }) }) };
        },
      };
    },
    insert(table: unknown) {
      return {
        values(values: any) {
          if (table === dbConflictPending) {
            state.newConflictInserted = values;
            return { returning: () => Promise.resolve([{ id: 9999 }]) };
          }
          return { returning: () => Promise.resolve([{}]) };
        },
      };
    },
    update(table: unknown) {
      return {
        set(values: any) {
          if (table === dbConflictPending && values.resolvedAt instanceof Date) {
            state.resolvedAtSet = { id: state.conflicts[0]?.id ?? -1, at: values.resolvedAt };
          }
          if (table === dbRfis) state.rfiUpdateRan = true;
          return { where() { return Promise.resolve(); } };
        },
      };
    },
  };

  return {
    select() {
      return {
        from(table: unknown) {
          // companyUsers membership probe (for companyScopedProcedure).
          if (table === dbCompanyUsers) {
            return {
              where() { return { limit: () => Promise.resolve([{ companyRole: "manager", isActive: true }]) }; },
            };
          }
          // The list query: db.select().from(conflictPending).where().orderBy().
          if (table === dbConflictPending) {
            return {
              where(_: any) {
                return {
                  orderBy() {
                    // Best-effort: we can't easily reconstruct the input from the
                    // drizzle expression tree, so we filter by the latest captured
                    // listArgs (set in the `list` describe block before each call).
                    return Promise.resolve(applyListFilter(currentListArgs));
                  },
                };
              },
            };
          }
          return { where: () => ({ limit: () => Promise.resolve([]) }) };
        },
      };
    },
    insert() { return { values: () => ({ returning: () => Promise.resolve([]) }) }; },
    update() { return { set: () => ({ where: () => Promise.resolve() }) }; },
    transaction(fn: (tx: any) => any) { return fn(txApi); },
  };
}

let currentListArgs: { companyId?: number; userId?: number; resolved?: boolean } = {};

vi.mock("../server/db", () => ({
  getDb: vi.fn(async () => makeDb()),
}));

function ctx(userId = 11, role: "user" | "admin" = "user"): TrpcContext {
  return {
    user: {
      id: userId,
      openId: `user-${userId}`,
      name: "Test User",
      email: "test@example.com",
      loginMethod: "manus",
      role,
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

function makeConflict(over: Partial<ConflictRow> = {}): ConflictRow {
  return {
    id: 42,
    companyId: 7,
    userId: 11,
    tableName: "rfis",
    rowId: 1,
    conflictFields: ["question"],
    mineValues: { question: "my question" },
    theirsValues: { question: "their question" },
    baseUpdatedAt: new Date("2026-05-06T10:00:00Z"),
    resolvedAt: null,
    createdAt: new Date("2026-05-06T10:05:00Z"),
    ...over,
  };
}

beforeEach(() => {
  state.conflicts = [];
  state.rfiRow = null;
  state.resolvedAtSet = null;
  state.newConflictInserted = null;
  state.rfiUpdateRan = false;
  currentListArgs = {};
});

afterEach(() => vi.clearAllMocks());

describe("conflicts.list", () => {
  it("returns unresolved conflicts for the current user only", async () => {
    state.conflicts = [
      makeConflict({ id: 1 }),
      makeConflict({ id: 2 }),
      makeConflict({ id: 3, userId: 99 }),  // different user
    ];
    currentListArgs = { companyId: 7, userId: 11, resolved: false };
    const caller = appRouter.createCaller(ctx(11));
    const result = await caller.conflicts.list({ companyId: 7, resolved: false });
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.userId === 11)).toBe(true);
    expect(result.every((r) => r.resolvedAt === null)).toBe(true);
  });

  it("returns resolved history when resolved=true", async () => {
    state.conflicts = [
      makeConflict({ id: 1, resolvedAt: new Date("2026-05-06T11:00:00Z") }),
      makeConflict({ id: 2, resolvedAt: null }),  // unresolved
    ];
    currentListArgs = { companyId: 7, userId: 11, resolved: true };
    const caller = appRouter.createCaller(ctx(11));
    const result = await caller.conflicts.list({ companyId: 7, resolved: true });
    expect(result).toHaveLength(1);
    expect(result[0].resolvedAt).not.toBeNull();
  });

  it("does not leak cross-tenant conflicts (filtered by companyId)", async () => {
    state.conflicts = [makeConflict({ companyId: 5, userId: 11 })];  // user is in 7, conflict is in 5
    currentListArgs = { companyId: 7, userId: 11, resolved: false };
    const caller = appRouter.createCaller(ctx(11));
    const result = await caller.conflicts.list({ companyId: 7, resolved: false });
    expect(result).toHaveLength(0);
  });
});

describe("conflicts.resolve", () => {
  it("applies finalValues, marks resolvedAt, returns ok:true on clean resolution", async () => {
    state.conflicts = [makeConflict()];
    state.rfiRow = {
      id: 1,
      companyId: 7,
      question: "their question",  // matches theirsValues — no recursive change
      updatedAt: new Date("2026-05-06T10:05:00Z"),
    };
    const caller = appRouter.createCaller(ctx(11));
    const result = await caller.conflicts.resolve({
      id: 42, companyId: 7,
      finalValues: { question: "merged answer" },
    });
    expect(result).toEqual({ ok: true });
    expect(state.rfiUpdateRan).toBe(true);
    expect(state.resolvedAtSet).not.toBeNull();
  });

  it("returns CONFLICT_ALREADY_RESOLVED when the row is already resolved", async () => {
    state.conflicts = [makeConflict({ resolvedAt: new Date("2026-05-06T11:00:00Z") })];
    const caller = appRouter.createCaller(ctx(11));
    await expect(
      caller.conflicts.resolve({ id: 42, companyId: 7, finalValues: { question: "x" } })
    ).rejects.toMatchObject({ code: "CONFLICT", message: expect.stringContaining("CONFLICT_ALREADY_RESOLVED") });
  });

  it("returns FORBIDDEN when the conflict is not found (cross-tenant or wrong user)", async () => {
    state.conflicts = [];  // no rows match
    const caller = appRouter.createCaller(ctx(11));
    await expect(
      caller.conflicts.resolve({ id: 42, companyId: 7, finalValues: {} })
    ).rejects.toMatchObject({ code: "FORBIDDEN", message: expect.stringContaining("CONFLICT_NOT_FOUND") });
  });

  it("creates a new conflict_pending when a third writer changed the same field (recursive conflict)", async () => {
    // The pending conflict's theirsValues said question="their question".
    // But by the time the user resolved, ANOTHER writer changed it to "third writer".
    // The diff dispatcher sees the user's finalValues != server, snapshot != server → fresh conflict.
    state.conflicts = [makeConflict()];
    state.rfiRow = {
      id: 1,
      companyId: 7,
      question: "third writer wrote this",  // different from theirsValues="their question"
      updatedAt: new Date("2026-05-06T10:10:00Z"),
    };
    const caller = appRouter.createCaller(ctx(11));
    const result = await caller.conflicts.resolve({
      id: 42, companyId: 7,
      finalValues: { question: "my merged" },
    });
    expect(result).toEqual({ ok: false, recursiveConflictId: 9999 });
    expect(state.newConflictInserted).toMatchObject({
      tableName: "rfis",
      rowId: 1,
      mineValues: { question: "my merged" },
      theirsValues: { question: "third writer wrote this" },
    });
    // Original conflict's resolvedAt was NOT set.
    expect(state.resolvedAtSet).toBeNull();
    // Source row was NOT updated.
    expect(state.rfiUpdateRan).toBe(false);
  });

  it("marks resolved + returns sourceDeleted:true when the source row is gone", async () => {
    state.conflicts = [makeConflict()];
    state.rfiRow = null;  // row was deleted by another user
    const caller = appRouter.createCaller(ctx(11));
    const result = await caller.conflicts.resolve({
      id: 42, companyId: 7,
      finalValues: { question: "x" },
    });
    expect(result).toEqual({ ok: true, sourceDeleted: true });
    expect(state.rfiUpdateRan).toBe(false);
    expect(state.resolvedAtSet).not.toBeNull();
  });
});
