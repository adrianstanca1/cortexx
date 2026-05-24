import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
import type { TrpcContext } from "../server/_core/context";

/**
 * Coverage for the settings sub-router in `server/routers/index.ts`.
 *
 * Procedures: get, update (partial write), listApiKeys, saveApiKey,
 * updateApiKey, deleteApiKey, listFeatureFlags, setFeatureFlag.
 *
 * Notable behaviours pinned:
 *   - `update` is a no-op (returns success without issuing UPDATE)
 *     when no fields are provided beyond companyId.
 *   - `saveApiKey` masks the raw key as `xxxxxx...yyyy` for display
 *     and base64-encodes it for storage. The "built-in" sentinel
 *     fires when no rawKey is provided.
 *   - `saveApiKey` and `updateApiKey` demote any other key flagged
 *     `isDefault=true` BEFORE inserting/updating, so the default
 *     stays unique.
 *   - `setFeatureFlag` is an upsert: SELECT first, UPDATE if exists,
 *     INSERT otherwise.
 */

interface DbCalls {
  selectFroms: { table: string }[];
  inserts: { table: string; values: any }[];
  updates: { table: string; values: any }[];
  deletes: { table: string }[];
  featureFlagSelectReturn: any[];
  companiesSelectReturn: any[];
}
const dbCalls: DbCalls = {
  selectFroms: [], inserts: [], updates: [], deletes: [],
  featureFlagSelectReturn: [],
  companiesSelectReturn: [],
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
          dbCalls.selectFroms.push({ table: name });
          let returnRows: any[] = [];
          if (name.includes('feature_flags')) returnRows = dbCalls.featureFlagSelectReturn;
          else if (name === 'companies') returnRows = dbCalls.companiesSelectReturn;
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
            returning() { return Promise.resolve([{ id: 999, ...values }]); },
            then(resolve: any) { return Promise.resolve().then(resolve); },
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
  dbCalls.featureFlagSelectReturn = [];
  dbCalls.companiesSelectReturn = [{ id: 7, name: 'Test Co' }];
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("settings.get", () => {
  it("returns the company row", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    const result = await caller.settings.get({ companyId: 7 });
    expect(result).toMatchObject({ id: 7, name: 'Test Co' });
  });

  it("returns null when no row found", async () => {
    dbCalls.companiesSelectReturn = [];
    const caller = appRouter.createCaller(ctxFor(1));
    const result = await caller.settings.get({ companyId: 999 });
    expect(result).toBeNull();
  });
});

describe("settings.update — partial write", () => {
  it("only writes fields present in input", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.settings.update({ companyId: 7, name: 'New Co Name' });
    expect(dbCalls.updates).toHaveLength(1);
    expect(dbCalls.updates[0].values).toEqual({ name: 'New Co Name' });
  });

  it("no-ops (returns success without UPDATE) when only companyId is provided", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    const result = await caller.settings.update({ companyId: 7 });
    expect(result).toEqual({ success: true });
    expect(dbCalls.updates).toHaveLength(0);
  });

  it("payrollEmail must be a valid email (zod schema)", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await expect(caller.settings.update({
      companyId: 7, payrollEmail: 'not-an-email',
    })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(dbCalls.updates).toHaveLength(0);
  });
});

describe("settings.saveApiKey", () => {
  it("masks the raw key as <first6>...<last4> and base64-encodes for storage", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.settings.saveApiKey({
      companyId: 7, provider: 'openai', keyName: 'prod-key',
      rawKey: 'sk-test1234567890SECRETXYZ',
    });
    const ins = dbCalls.inserts.find(i => i.table === 'company_api_keys')!;
    expect(ins.values.maskedKey).toBe('sk-tes...TXYZ');
    expect(ins.values.encryptedKey).toBe(
      Buffer.from('sk-test1234567890SECRETXYZ').toString('base64'),
    );
    expect(ins.values.model).toBe('default');
    expect(ins.values.isActive).toBe(true);
    expect(ins.values.isDefault).toBe(false);
  });

  it("uses 'built-in' sentinel when no rawKey provided", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.settings.saveApiKey({
      companyId: 7, provider: 'anthropic', keyName: 'fallback',
    });
    const ins = dbCalls.inserts.find(i => i.table === 'company_api_keys')!;
    expect(ins.values.maskedKey).toBe('built-in');
    expect(ins.values.encryptedKey).toBe('built-in');
  });

  it("when isDefault=true, demotes other keys before insert", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.settings.saveApiKey({
      companyId: 7, provider: 'openai', keyName: 'new-default',
      rawKey: 'sk-AAAA-BBBB-CCCC',
      isDefault: true,
    });
    // First UPDATE: demote others. Then INSERT the new key.
    expect(dbCalls.updates.filter(u => u.table === 'company_api_keys')).toHaveLength(1);
    expect(dbCalls.updates[0].values.isDefault).toBe(false);
    expect(dbCalls.inserts.find(i => i.table === 'company_api_keys')!.values.isDefault).toBe(true);
  });
});

describe("settings.updateApiKey", () => {
  it("toggles isActive without touching isDefault", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.settings.updateApiKey({ id: 5, companyId: 7, isActive: false });
    const update = dbCalls.updates.find(u => u.table === 'company_api_keys')!;
    expect(update.values).toMatchObject({ isActive: false });
    expect(update.values).not.toHaveProperty('isDefault');
  });

  it("when isDefault=true, demotes others first", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.settings.updateApiKey({ id: 5, companyId: 7, isDefault: true });
    // Two UPDATEs: demote others, then promote this one.
    const apiKeyUpdates = dbCalls.updates.filter(u => u.table === 'company_api_keys');
    expect(apiKeyUpdates).toHaveLength(2);
    expect(apiKeyUpdates[0].values.isDefault).toBe(false); // demote
    expect(apiKeyUpdates[1].values.isDefault).toBe(true);  // promote
  });

  it("with no flags, only updatedAt is written", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.settings.updateApiKey({ id: 5, companyId: 7 });
    const update = dbCalls.updates.find(u => u.table === 'company_api_keys')!;
    expect(Object.keys(update.values)).toEqual(['updatedAt']);
  });
});

describe("settings.deleteApiKey", () => {
  it("issues a DELETE on company_api_keys (companyId in WHERE for tenant safety)", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.settings.deleteApiKey({ id: 5, companyId: 7 });
    expect(dbCalls.deletes).toEqual([{ table: 'company_api_keys' }]);
  });
});

describe("settings.setFeatureFlag — upsert", () => {
  it("inserts a new row when no existing flag matches", async () => {
    dbCalls.featureFlagSelectReturn = []; // no existing
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.settings.setFeatureFlag({ companyId: 7, feature: 'beta-feature', enabled: true });
    const ins = dbCalls.inserts.find(i => i.table === 'company_feature_flags')!;
    expect(ins.values).toMatchObject({ companyId: 7, feature: 'beta-feature', enabled: true });
    expect(dbCalls.updates.filter(u => u.table === 'company_feature_flags')).toHaveLength(0);
  });

  it("updates the existing row when one already exists for (companyId, feature)", async () => {
    dbCalls.featureFlagSelectReturn = [{ id: 42, companyId: 7, feature: 'beta-feature', enabled: false }];
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.settings.setFeatureFlag({ companyId: 7, feature: 'beta-feature', enabled: true });
    expect(dbCalls.inserts.filter(i => i.table === 'company_feature_flags')).toHaveLength(0);
    const update = dbCalls.updates.find(u => u.table === 'company_feature_flags')!;
    expect(update.values.enabled).toBe(true);
    expect(update.values.updatedAt).toBeInstanceOf(Date);
  });
});
