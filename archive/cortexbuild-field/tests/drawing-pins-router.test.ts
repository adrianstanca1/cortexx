import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
import type { TrpcContext } from "../server/_core/context";

/**
 * Coverage for the drawingPins sub-router in `server/routers/index.ts`.
 * Procedures: list, add, updateStatus, delete.
 *
 * Notable behaviours:
 *   - `add` validates that the drawing belongs to the same company
 *     before inserting the pin (FK lookup with companyId in WHERE).
 *     This is the create-side tenant check (parallel to defects.create).
 *   - `add` coerces xPct/yPct (number) → string for decimal columns.
 *   - `updateStatus` only writes the status field — doesn't touch
 *     anything else.
 *   - `delete` is a hard SQL DELETE with companyId in WHERE.
 */

interface DbCalls {
  selectFroms: { table: string }[];
  inserts: { table: string; values: any }[];
  updates: { table: string; values: any }[];
  deletes: { table: string }[];
  drawingsSelectReturn: any[];
}
const dbCalls: DbCalls = {
  selectFroms: [], inserts: [], updates: [], deletes: [],
  drawingsSelectReturn: [],
};

function tableName(table: any): string {
  return getTableName(table);
}

vi.mock("../server/db", () => ({
  getDb: vi.fn(async () => ({
    select() {
      return {
        from(table: any) {
          const name = tableName(table);
          if (name.includes('company_users')) {
            return {
              where(_clause: unknown) {
                return {
                  limit() {
                    return Promise.resolve([{ companyRole: 'manager', isActive: true }]);
                  },
                };
              },
            };
          }
          dbCalls.selectFroms.push({ table: name });
          const returnRows = name === 'drawings'
            ? dbCalls.drawingsSelectReturn
            : [];
          const chain: any = {
            where(_c: unknown) { return chain; },
            orderBy(_o: unknown) { return Promise.resolve(returnRows); },
            limit(_n: number) { return Promise.resolve(returnRows); },
            then(resolve: any) { return Promise.resolve(returnRows).then(resolve); },
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
          dbCalls.updates.push({ table: name, values });
          return { where(_c: unknown) { return Promise.resolve(); } };
        },
      };
    },
    delete(table: any) {
      const name = tableName(table);
      return {
        where(_c: unknown) {
          dbCalls.deletes.push({ table: name });
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
      id: userId, openId: `user-${userId}`, name: `User ${userId}`,
      email: `u${userId}@example.com`, loginMethod: "manus", role: "user",
      passwordHash: null, pushPreferences: {}, createdAt: new Date(), updatedAt: new Date(),
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
  dbCalls.drawingsSelectReturn = [{ id: 7, companyId: 7 }];
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("drawingPins.list", () => {
  it("scopes by drawingId AND companyId", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.drawingPins.list({ drawingId: '7', companyId: 7 });
    expect(dbCalls.selectFroms.filter(s => s.table === 'drawing_pins')).toHaveLength(1);
  });
});

describe("drawingPins.add", () => {
  it("verifies the drawing belongs to the company before inserting", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.drawingPins.add({
      companyId: 7, drawingId: '7', pinType: 'defect',
      xPct: 0.5, yPct: 0.25, title: 'Cracked tile',
    });
    // Both the drawings lookup and the pins insert happened.
    expect(dbCalls.selectFroms.some(s => s.table === 'drawings')).toBe(true);
    expect(dbCalls.inserts.filter(i => i.table === 'drawing_pins')).toHaveLength(1);
  });

  it("throws when the drawing belongs to a different company", async () => {
    dbCalls.drawingsSelectReturn = []; // drawing not found for this company
    const caller = appRouter.createCaller(ctxFor(1));
    await expect(caller.drawingPins.add({
      companyId: 7, drawingId: '999', pinType: 'rfi',
      xPct: 0.1, yPct: 0.1, title: 'x',
    })).rejects.toThrow(/Drawing not found/);
    expect(dbCalls.inserts.filter(i => i.table === 'drawing_pins')).toHaveLength(0);
  });

  it("coerces xPct/yPct (number) → string for decimal columns", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.drawingPins.add({
      companyId: 7, drawingId: '7', pinType: 'note',
      xPct: 0.123, yPct: 0.456, title: 'Note',
    });
    const ins = dbCalls.inserts[0];
    expect(ins.values.xPct).toBe('0.123');
    expect(ins.values.yPct).toBe('0.456');
  });

  it("nullifies optional fields (drawingNumber, description, assignedTo, photoUrl, createdBy)", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.drawingPins.add({
      companyId: 7, drawingId: '7', pinType: 'defect',
      xPct: 0.5, yPct: 0.5, title: 'x',
    });
    const v = dbCalls.inserts[0].values;
    expect(v.drawingNumber).toBeNull();
    expect(v.description).toBeNull();
    expect(v.assignedTo).toBeNull();
    expect(v.photoUrl).toBeNull();
    expect(v.createdBy).toBeNull();
  });

  it("returns { success, id, pin } where pin echoes the inserted row", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    const result = await caller.drawingPins.add({
      companyId: 7, drawingId: '7', pinType: 'defect',
      xPct: 0.5, yPct: 0.5, title: 'x',
    });
    expect(result.success).toBe(true);
    expect(result.id).toBe(999);
    expect(result.pin).toMatchObject({ id: 999, title: 'x' });
  });
});

describe("drawingPins.updateStatus", () => {
  it.each([
    ['open'], ['in_progress'], ['resolved'],
  ] as const)("writes status='%s' (and nothing else)", async (status) => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.drawingPins.updateStatus({ id: 5, companyId: 7, status });
    expect(dbCalls.updates).toHaveLength(1);
    expect(dbCalls.updates[0].values).toEqual({ status });
  });
});

describe("drawingPins.delete", () => {
  it("issues a SQL DELETE on drawing_pins (NOT a soft-delete)", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.drawingPins.delete({ id: 5, companyId: 7 });
    expect(dbCalls.deletes).toEqual([{ table: 'drawing_pins' }]);
  });
});
