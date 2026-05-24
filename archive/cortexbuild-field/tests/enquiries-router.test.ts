import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
import type { TrpcContext } from "../server/_core/context";

/**
 * Coverage for `server/routers/enquiries.ts` — sales pipeline + leads.
 * Was 57% covered: the list helpers were grazed via the scoping smoke
 * tests, but createPipeline / create / updateStage had no exercising
 * tests. Lifts to 99%.
 */

interface DbCalls {
  selectFroms: { table: string }[];
  inserts: { table: string; values: any }[];
  updates: { table: string; values: any }[];
}
const dbCalls: DbCalls = { selectFroms: [], inserts: [], updates: [] };

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
          const chain: any = {
            where(_clause: unknown) { return chain; },
            orderBy(_o: unknown) { return Promise.resolve([]); },
            then(resolve: any) { return Promise.resolve([]).then(resolve); },
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
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("enquiries.listPipelines", () => {
  it("scopes to companyId", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.enquiries.listPipelines({ companyId: 7 });
    const pipelineSelects = dbCalls.selectFroms.filter(s => s.table.includes('pipeline'));
    expect(pipelineSelects).toHaveLength(1);
  });
});

describe("enquiries.createPipeline", () => {
  it("JSON-stringifies the stages array before insert", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.enquiries.createPipeline({
      companyId: 7,
      name: 'Roofing pipeline',
      stages: ['Lead', 'Survey', 'Quote', 'Won'],
    });
    expect(dbCalls.inserts).toHaveLength(1);
    expect(dbCalls.inserts[0].table).toContain('pipeline');
    expect(dbCalls.inserts[0].values.name).toBe('Roofing pipeline');
    expect(dbCalls.inserts[0].values.stages).toBe(JSON.stringify(['Lead', 'Survey', 'Quote', 'Won']));
    expect(dbCalls.inserts[0].values.isDefault).toBe(false);
  });

  it("falls back to the default stages array when not provided", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.enquiries.createPipeline({
      companyId: 7, name: 'Default pipeline',
    });
    expect(dbCalls.inserts[0].values.stages).toBe(
      JSON.stringify(['New Enquiry', 'Quoted', 'Follow-up', 'Won', 'Lost']),
    );
  });

  it("isDefault=true is preserved on the insert", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.enquiries.createPipeline({
      companyId: 7, name: 'Primary', stages: ['A', 'B'], isDefault: true,
    });
    expect(dbCalls.inserts[0].values.isDefault).toBe(true);
  });
});

describe("enquiries.list", () => {
  it("scopes to companyId; ignores absent pipelineId/status", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.enquiries.list({ companyId: 7 });
    const enquirySelects = dbCalls.selectFroms.filter(s => s.table === 'enquiries');
    expect(enquirySelects).toHaveLength(1);
  });

  it("works with pipelineId provided", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.enquiries.list({ companyId: 7, pipelineId: 3 });
    expect(dbCalls.selectFroms.filter(s => s.table === 'enquiries')).toHaveLength(1);
  });

  it("works with status provided", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.enquiries.list({ companyId: 7, status: 'open' });
    expect(dbCalls.selectFroms.filter(s => s.table === 'enquiries')).toHaveLength(1);
  });
});

describe("enquiries.create", () => {
  it("inserts the full enquiry payload", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.enquiries.create({
      companyId: 7, pipelineId: 3,
      clientName: 'Acme Ltd', clientEmail: 'a@b.com', clientPhone: '07700900000',
      title: 'New office fit-out', description: 'Phase 2', value: '50000',
      stage: 'Lead', source: 'web',
    });
    expect(dbCalls.inserts).toHaveLength(1);
    expect(dbCalls.inserts[0].table).toBe('enquiries');
    expect(dbCalls.inserts[0].values).toMatchObject({
      companyId: 7, pipelineId: 3, clientName: 'Acme Ltd',
      stage: 'Lead', source: 'web',
    });
  });

  it("source defaults to 'manual' when not provided", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.enquiries.create({
      companyId: 7, pipelineId: 3,
      clientName: 'X', title: 'Y', stage: 'Z',
    });
    expect(dbCalls.inserts[0].values.source).toBe('manual');
  });
});

describe("enquiries.updateStage", () => {
  it("issues an update with the new stage and a fresh updatedAt", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.enquiries.updateStage({ id: 5, companyId: 7, stage: 'Quote' });
    expect(dbCalls.updates).toHaveLength(1);
    expect(dbCalls.updates[0].table).toBe('enquiries');
    expect(dbCalls.updates[0].values.stage).toBe('Quote');
    expect(dbCalls.updates[0].values.updatedAt).toBeInstanceOf(Date);
  });
});
