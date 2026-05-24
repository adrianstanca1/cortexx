import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
import type { TrpcContext } from "../server/_core/context";

/**
 * Coverage for the credentials sub-router in `server/routers/index.ts`.
 *
 * Procedures: list, add, delete, checkExpiry, renew, sendExpiryAlerts.
 *
 * Notable behaviours pinned:
 *   - `renew` resets alertSent=0 so the next expiry cycle re-alerts
 *     after a renewal.
 *   - `sendExpiryAlerts` only marks alertSent=1 when notifyOwner
 *     actually delivers — a notify failure does NOT silently swallow
 *     the alert. Pinning this prevents a regression where the row
 *     gets flagged as alerted before the upstream call.
 *   - `checkExpiry` partitions into `expiring` / `expired` based on
 *     daysAhead cutoff; ignores rows with no expiryDate.
 */

const notifyOwnerMock = vi.fn();
vi.mock("../server/_core/notification", () => ({
  notifyOwner: notifyOwnerMock,
}));

interface DbCalls {
  selectFroms: { table: string; whereArgs: any[] }[];
  inserts: { table: string; values: any }[];
  updates: { table: string; values: any; whereArgs: any[] }[];
  deletes: { table: string; whereArgs: any[] }[];
  credentialsSelectReturn: any[];
}
const dbCalls: DbCalls = {
  selectFroms: [], inserts: [], updates: [], deletes: [],
  credentialsSelectReturn: [],
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
              where(_c: unknown) {
                return {
                  limit() {
                    return Promise.resolve([{ companyRole: 'manager', isActive: true }]);
                  },
                };
              },
            };
          }
          const recorded = { table: name, whereArgs: [] as any[] };
          dbCalls.selectFroms.push(recorded);
          const returnRows = name === 'employee_credentials' ? dbCalls.credentialsSelectReturn : [];
          const chain: any = {
            where(c: unknown) { recorded.whereArgs.push(c); return chain; },
            orderBy(_o: unknown) { return Promise.resolve(returnRows); },
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
          return { returning() { return Promise.resolve([{ id: 999, ...values }]); } };
        },
      };
    },
    update(table: any) {
      return {
        set(values: any) {
          const name = tableName(table);
          const recorded = { table: name, values, whereArgs: [] as any[] };
          dbCalls.updates.push(recorded);
          return {
            where(c: unknown) { recorded.whereArgs.push(c); return Promise.resolve(); },
          };
        },
      };
    },
    delete(table: any) {
      const name = tableName(table);
      const recorded = { table: name, whereArgs: [] as any[] };
      return {
        where(c: unknown) {
          recorded.whereArgs.push(c);
          dbCalls.deletes.push(recorded);
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
  dbCalls.credentialsSelectReturn = [];
  notifyOwnerMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("credentials.list", () => {
  it("scoped to companyId", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.credentials.list({ companyId: 7 });
    expect(dbCalls.selectFroms.filter(s => s.table === 'employee_credentials')).toHaveLength(1);
  });
});

describe("credentials.add", () => {
  it("inserts the credential row and returns { success, id, credential }", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    const result = await caller.credentials.add({
      companyId: 7,
      employeeId: 'e-1', employeeName: 'Alice',
      credType: 'CSCS', credNumber: 'CSCS-12345',
      issueDate: '2026-01-01', expiryDate: '2030-01-01',
      notes: 'Gold card',
    });
    expect(result.success).toBe(true);
    expect(result.id).toBe(999);
    expect(result.credential).toMatchObject({ id: 999, credType: 'CSCS' });
    expect(dbCalls.inserts).toHaveLength(1);
    expect(dbCalls.inserts[0].values).toMatchObject({
      employeeId: 'e-1', employeeName: 'Alice', credType: 'CSCS',
      companyId: 7,
    });
  });
});

describe("credentials.delete", () => {
  it("issues a DELETE on credentials", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.credentials.delete({ id: 5, companyId: 7 });
    expect(dbCalls.deletes.filter(d => d.table === 'employee_credentials')).toHaveLength(1);
  });
});

describe("credentials.checkExpiry", () => {
  it("partitions credentials into expiring / expired based on daysAhead cutoff", async () => {
    const now = new Date();
    const past = new Date(now.getTime() - 86400_000); // 1 day ago
    const soon = new Date(now.getTime() + 5 * 86400_000); // 5 days from now
    const later = new Date(now.getTime() + 60 * 86400_000); // 60 days from now
    dbCalls.credentialsSelectReturn = [
      { id: 1, employeeName: 'A', credType: 'CSCS', expiryDate: past.toISOString() },
      { id: 2, employeeName: 'B', credType: 'CSCS', expiryDate: soon.toISOString() },
      { id: 3, employeeName: 'C', credType: 'CSCS', expiryDate: later.toISOString() },
      { id: 4, employeeName: 'D', credType: 'CSCS', expiryDate: null }, // no expiry
    ];
    const caller = appRouter.createCaller(ctxFor(1));
    const result = await caller.credentials.checkExpiry({ companyId: 7, daysAhead: 30 });
    expect(result.expired.map(c => c.id)).toEqual([1]);
    expect(result.expiring.map(c => c.id)).toEqual([2]);
    // 'later' is past the daysAhead cutoff, 'D' has no expiryDate.
  });

  it("returns empty arrays when DB has no credentials", async () => {
    dbCalls.credentialsSelectReturn = [];
    const caller = appRouter.createCaller(ctxFor(1));
    const result = await caller.credentials.checkExpiry({ companyId: 7 });
    expect(result).toEqual({ expiring: [], expired: [] });
  });
});

describe("credentials.renew", () => {
  it("updates the credential and resets alertSent=0 (next cycle re-alerts)", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.credentials.renew({
      id: 5, companyId: 7,
      credNumber: 'CSCS-NEW',
      issueDate: '2026-05-01',
      expiryDate: '2031-05-01',
      notes: 'Renewed',
    });
    expect(dbCalls.updates).toHaveLength(1);
    expect(dbCalls.updates[0].values).toMatchObject({
      credNumber: 'CSCS-NEW',
      issueDate: '2026-05-01',
      expiryDate: '2031-05-01',
      notes: 'Renewed',
      alertSent: 0, // load-bearing: re-arm alert for the renewed expiry
    });
  });
});

describe("credentials.sendExpiryAlerts", () => {
  it("sends an alert + flips alertSent=1 only when notifyOwner delivers", async () => {
    const now = new Date();
    const soon = new Date(now.getTime() + 5 * 86400_000);
    dbCalls.credentialsSelectReturn = [
      { id: 1, employeeName: 'Alice', credType: 'CSCS', credNumber: 'X-1', expiryDate: soon.toISOString(), alertSent: 0 },
    ];
    notifyOwnerMock.mockResolvedValueOnce(true);
    const caller = appRouter.createCaller(ctxFor(1));
    const result = await caller.credentials.sendExpiryAlerts({ companyId: 7 });
    expect(result.alertsSent).toBe(1);
    expect(notifyOwnerMock).toHaveBeenCalledTimes(1);
    expect(dbCalls.updates).toHaveLength(1);
    expect(dbCalls.updates[0].values).toMatchObject({ alertSent: 1 });
  });

  it("does NOT mark alertSent when notifyOwner returns false (alert can be retried next cycle)", async () => {
    const now = new Date();
    const soon = new Date(now.getTime() + 5 * 86400_000);
    dbCalls.credentialsSelectReturn = [
      { id: 1, employeeName: 'Alice', credType: 'CSCS', credNumber: 'X', expiryDate: soon.toISOString(), alertSent: 0 },
    ];
    notifyOwnerMock.mockResolvedValueOnce(false);
    const caller = appRouter.createCaller(ctxFor(1));
    const result = await caller.credentials.sendExpiryAlerts({ companyId: 7 });
    expect(result.alertsSent).toBe(0);
    expect(dbCalls.updates).toHaveLength(0); // nothing flipped
  });

  it("catches notifyOwner throws and continues; the row stays unalerted", async () => {
    const now = new Date();
    const soon = new Date(now.getTime() + 5 * 86400_000);
    dbCalls.credentialsSelectReturn = [
      { id: 1, employeeName: 'Alice', credType: 'CSCS', expiryDate: soon.toISOString(), alertSent: 0 },
    ];
    notifyOwnerMock.mockRejectedValueOnce(new Error('upstream down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const caller = appRouter.createCaller(ctxFor(1));
    const result = await caller.credentials.sendExpiryAlerts({ companyId: 7 });
    expect(result.alertsSent).toBe(0);
    expect(dbCalls.updates).toHaveLength(0);
  });

  it("skips rows already alerted (alertSent truthy) — no duplicate notifications", async () => {
    const now = new Date();
    const soon = new Date(now.getTime() + 5 * 86400_000);
    dbCalls.credentialsSelectReturn = [
      { id: 1, employeeName: 'Alice', credType: 'CSCS', expiryDate: soon.toISOString(), alertSent: 1 },
    ];
    const caller = appRouter.createCaller(ctxFor(1));
    const result = await caller.credentials.sendExpiryAlerts({ companyId: 7 });
    expect(result.alertsSent).toBe(0);
    expect(notifyOwnerMock).not.toHaveBeenCalled();
  });

  it("uses the [EXPIRED] prefix for already-past expiry dates", async () => {
    const past = new Date(Date.now() - 86400_000);
    dbCalls.credentialsSelectReturn = [
      { id: 1, employeeName: 'Bob', credType: 'CSCS', expiryDate: past.toISOString(), alertSent: 0 },
    ];
    notifyOwnerMock.mockResolvedValueOnce(true);
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.credentials.sendExpiryAlerts({ companyId: 7 });
    const call = notifyOwnerMock.mock.calls[0][0];
    expect(call.title).toMatch(/^\[EXPIRED\]/);
    expect(call.content).toContain('Status: EXPIRED');
  });

  it("uses [Expiring in Nd] prefix for future-but-soon expiries", async () => {
    const soon = new Date(Date.now() + 5 * 86400_000);
    dbCalls.credentialsSelectReturn = [
      { id: 1, employeeName: 'Bob', credType: 'CSCS', expiryDate: soon.toISOString(), alertSent: 0 },
    ];
    notifyOwnerMock.mockResolvedValueOnce(true);
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.credentials.sendExpiryAlerts({ companyId: 7 });
    const call = notifyOwnerMock.mock.calls[0][0];
    expect(call.title).toMatch(/^\[Expiring in \d+d\]/);
  });
});
