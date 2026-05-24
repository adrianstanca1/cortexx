import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
import type { TrpcContext } from "../server/_core/context";

/**
 * Coverage for `server/routers/finance.ts` — invoices, tenders, and
 * the analytics-overview aggregator. Was 42% covered because
 * `createInvoice` / `createTender` and the analytics rollup had no
 * exercising tests. This file fills:
 *
 *   - listInvoices: companyId always in WHERE; optional projectId/status filters
 *   - createInvoice: ctx.user.id is the author (input.createdById ignored)
 *   - updateInvoiceStatus: 'approved' adds approvedAt+approvedById; 'paid' adds paidAt
 *   - listTenders: companyId always in WHERE; optional status filter
 *   - createTender: ctx.user.id is the author
 *   - analyticsOverview: rolls up totals, filters today's checkins, maps projects
 */

interface DbCalls {
  selectFroms: { table: string; conditions: unknown[] }[];
  inserts: { table: string; values: any }[];
  updates: { table: string; values: any }[];
  selectReturns: Record<string, any[]>;
}
const dbCalls: DbCalls = {
  selectFroms: [], inserts: [], updates: [], selectReturns: {},
};

function tableName(table: any): string {
  return getTableName(table);
}

vi.mock("../server/db", () => ({
  getDb: vi.fn(async () => ({
    select(_columns?: any) {
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
          const recorded: { table: string; conditions: unknown[] } = { table: name, conditions: [] };
          dbCalls.selectFroms.push(recorded);
          const chain: any = {
            where(clause: unknown) {
              recorded.conditions.push(clause);
              return chain;
            },
            orderBy(_o: unknown) {
              return Promise.resolve(dbCalls.selectReturns[name] ?? []);
            },
            then(resolve: any) {
              return Promise.resolve(dbCalls.selectReturns[name] ?? []).then(resolve);
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
          return { returning() { return Promise.resolve([{ id: 999, ...values }]); } };
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
  dbCalls.selectReturns = {};
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("finance.listInvoices", () => {
  it("filters by companyId always; ignores undefined projectId/status", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.finance.listInvoices({ companyId: 7 });
    const invoiceSelects = dbCalls.selectFroms.filter(s => s.table.includes('invoices'));
    expect(invoiceSelects).toHaveLength(1);
    expect(invoiceSelects[0].conditions).toHaveLength(1); // just companyId
  });

  it("adds projectId predicate when provided", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.finance.listInvoices({ companyId: 7, projectId: 42 });
    const invoiceSelects = dbCalls.selectFroms.filter(s => s.table.includes('invoices'));
    expect(invoiceSelects[0].conditions).toHaveLength(1); // companyId + projectId both AND'd
  });

  it("adds status predicate when provided", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.finance.listInvoices({ companyId: 7, status: 'paid' });
    const invoiceSelects = dbCalls.selectFroms.filter(s => s.table.includes('invoices'));
    expect(invoiceSelects).toHaveLength(1);
  });
});

describe("finance.createInvoice", () => {
  it("authors with ctx.user.id even if a different createdById is forged in input", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.finance.createInvoice({
      companyId: 7, invoiceNumber: 'INV-0001',
      // @ts-expect-error — exercise the security boundary: input claims a different author
      createdById: 999,
    });
    expect(dbCalls.inserts).toHaveLength(1);
    expect(dbCalls.inserts[0].table).toContain('invoices');
    expect(dbCalls.inserts[0].values.createdById).toBe(1);
  });

  it("returns the inserted row", async () => {
    const caller = appRouter.createCaller(ctxFor(5));
    const row = await caller.finance.createInvoice({
      companyId: 7, invoiceNumber: 'INV-0002', total: '500.00',
    });
    expect(row).toMatchObject({ id: 999, invoiceNumber: 'INV-0002', total: '500.00', createdById: 5 });
  });
});

describe("finance.updateInvoiceStatus", () => {
  it("status='approved' fills approvedById + approvedAt", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.finance.updateInvoiceStatus({
      id: 5, companyId: 7, status: 'approved', approvedById: 42,
    });
    expect(dbCalls.updates).toHaveLength(1);
    const set = dbCalls.updates[0].values;
    expect(set.status).toBe('approved');
    expect(set.approvedById).toBe(42);
    expect(set.approvedAt).toBeInstanceOf(Date);
    expect(set.paidAt).toBeUndefined();
  });

  it("status='paid' fills paidAt; doesn't touch approvedById/approvedAt", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.finance.updateInvoiceStatus({ id: 5, companyId: 7, status: 'paid' });
    const set = dbCalls.updates[0].values;
    expect(set.status).toBe('paid');
    expect(set.paidAt).toBeInstanceOf(Date);
    expect(set.approvedAt).toBeUndefined();
    expect(set.approvedById).toBeUndefined();
  });

  it("other statuses just write status + updatedAt", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.finance.updateInvoiceStatus({ id: 5, companyId: 7, status: 'draft' });
    const set = dbCalls.updates[0].values;
    expect(set).toMatchObject({ status: 'draft' });
    expect(set.updatedAt).toBeInstanceOf(Date);
    expect(set.approvedAt).toBeUndefined();
    expect(set.paidAt).toBeUndefined();
  });
});

describe("finance.listTenders", () => {
  it("filters by companyId always", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.finance.listTenders({ companyId: 7 });
    const tenderSelects = dbCalls.selectFroms.filter(s => s.table.includes('tender'));
    expect(tenderSelects).toHaveLength(1);
    expect(tenderSelects[0].conditions).toHaveLength(1);
  });

  it("adds status predicate when provided", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.finance.listTenders({ companyId: 7, status: 'submitted' });
    const tenderSelects = dbCalls.selectFroms.filter(s => s.table.includes('tender'));
    expect(tenderSelects).toHaveLength(1);
  });
});

describe("finance.createTender", () => {
  it("authors with ctx.user.id (forged input ignored)", async () => {
    const caller = appRouter.createCaller(ctxFor(3));
    await caller.finance.createTender({
      companyId: 7, title: 'Bridge resurfacing',
      // @ts-expect-error — security boundary
      createdById: 999,
    });
    expect(dbCalls.inserts).toHaveLength(1);
    expect(dbCalls.inserts[0].table).toContain('tender');
    expect(dbCalls.inserts[0].values.createdById).toBe(3);
  });
});

describe("finance.analyticsOverview", () => {
  it("rolls up totals across the five aggregated tables", async () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    dbCalls.selectReturns = {
      projects: [
        { id: 1, name: 'A', status: 'active', budget: '100000', spent: '40000', progress: 30 },
        { id: 2, name: 'B', status: 'completed', budget: '50000', spent: '50000', progress: 100 },
      ],
      timesheets: [
        { totalHours: '8.5' }, { totalHours: '4' },
      ],
      defects: [
        { status: 'open' }, { status: 'open' }, { status: 'closed' },
      ],
      incidents: [
        { status: 'open' }, { status: 'resolved' },
      ],
      check_ins: [
        { checkInTime: today, createdAt: today },
        { checkInTime: yesterday, createdAt: yesterday },
        { checkInTime: null, createdAt: today },
      ],
    };

    const caller = appRouter.createCaller(ctxFor(1));
    const overview = await caller.finance.analyticsOverview({ companyId: 7 });

    expect(overview).toMatchObject({
      totalProjects: 2,
      activeProjects: 1,
      totalBudget: 150000,
      totalSpent: 90000,
      budgetVariance: 60000,
      openDefects: 2,
      openIncidents: 1,
      totalHours: 12.5,
      checkInsToday: 2,
    });
    expect(overview!.projects).toHaveLength(2);
    expect(overview!.projects[0]).toMatchObject({
      id: 1, name: 'A', status: 'active', budget: 100000, spent: 40000, progress: 30,
    });
  });

  it("returns zeros and an empty projects array when nothing's seeded", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    const overview = await caller.finance.analyticsOverview({ companyId: 7 });
    expect(overview).toMatchObject({
      totalProjects: 0, activeProjects: 0, totalBudget: 0, totalSpent: 0,
      budgetVariance: 0, openDefects: 0, openIncidents: 0,
      totalHours: 0, checkInsToday: 0,
    });
    expect(overview!.projects).toEqual([]);
  });
});
