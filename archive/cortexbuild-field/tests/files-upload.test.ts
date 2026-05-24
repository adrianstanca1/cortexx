import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
import type { TrpcContext } from "../server/_core/context";

/**
 * Coverage for the files.upload procedure in `server/routers/index.ts`.
 *
 * The list / delete halves are covered by
 * tests/files-permits-tasks-dailyreports-scoping.test.ts. This file
 * pins three behaviours specific to upload:
 *
 *   1. category='invoice' is folded to 'document' for the DB (the
 *      file_category enum has no 'invoice' value) but preserved in
 *      the storage key + tags so the vault can recover the
 *      original classification.
 *   2. Filename is sanitised to [a-zA-Z0-9._-] only — protects against
 *      path-traversal / shell-meta in the storage key (storage.ts has
 *      its own normalize, but defence in depth).
 *   3. When projectId is provided, the procedure verifies the project
 *      belongs to the caller's company BEFORE writing to storage —
 *      otherwise a member of company A could attach a file to
 *      company B's project.
 */

const storagePutMock = vi.fn();
vi.mock("../server/storage", () => ({
  storagePut: storagePutMock,
}));

interface DbCalls {
  selectFroms: { table: string }[];
  inserts: { table: string; values: any }[];
  projectsSelectReturn: any[];
}
const dbCalls: DbCalls = { selectFroms: [], inserts: [], projectsSelectReturn: [] };

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
          const returnRows = name === 'projects' ? dbCalls.projectsSelectReturn : [];
          const chain: any = {
            where(_c: unknown) { return chain; },
            limit(_n: number) { return Promise.resolve(returnRows); },
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

const helloBase64 = Buffer.from('hello').toString('base64');

beforeEach(() => {
  dbCalls.selectFroms.length = 0;
  dbCalls.inserts.length = 0;
  dbCalls.projectsSelectReturn = [{ id: 7, companyId: 7 }];
  storagePutMock.mockReset().mockResolvedValue({
    key: 'photo/123_x.jpg',
    url: '/storage/photo/123_x.jpg',
  } as any);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("files.upload — basic shape", () => {
  it("calls storagePut with the assembled key and decoded buffer", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.files.upload({
      companyId: 7,
      fileName: 'site.jpg', mimeType: 'image/jpeg',
      base64Data: helloBase64,
      category: 'photo',
    });
    expect(storagePutMock).toHaveBeenCalledTimes(1);
    const [key, body, mime] = storagePutMock.mock.calls[0];
    expect(key).toMatch(/^photo\/\d+_site\.jpg$/);
    expect(Buffer.isBuffer(body)).toBe(true);
    expect((body as Buffer).toString()).toBe('hello');
    expect(mime).toBe('image/jpeg');
  });

  it("inserts a row in files with sizeBytes computed from the decoded buffer", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.files.upload({
      companyId: 7,
      fileName: 'x.txt', mimeType: 'text/plain',
      base64Data: helloBase64, // "hello" → 5 bytes
      category: 'document',
    });
    const insert = dbCalls.inserts.find(i => i.table === 'files')!;
    expect(insert.values.sizeBytes).toBe(5);
    expect(insert.values.category).toBe('document');
    expect(insert.values.companyId).toBe(7);
    expect(insert.values.uploadedBy).toBe(1); // ctx.user.id
  });

  it("returns the public URL + decoded size + ISO uploadedAt", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    const result = await caller.files.upload({
      companyId: 7,
      fileName: 'x.txt', mimeType: 'text/plain',
      base64Data: helloBase64,
      category: 'document',
    });
    expect(result.url).toBe('/storage/photo/123_x.jpg');
    expect(result.size).toBe(5);
    expect(result.uploadedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result.id).toBe(999);
  });
});

describe("files.upload — invoice category folding", () => {
  it("folds category='invoice' to 'document' for the DB enum", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.files.upload({
      companyId: 7,
      fileName: 'inv.pdf', mimeType: 'application/pdf',
      base64Data: helloBase64,
      category: 'invoice',
    });
    const insert = dbCalls.inserts.find(i => i.table === 'files')!;
    expect(insert.values.category).toBe('document');
  });

  it("preserves 'invoice' in the storage key prefix (so the vault can recover classification)", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.files.upload({
      companyId: 7,
      fileName: 'inv.pdf', mimeType: 'application/pdf',
      base64Data: helloBase64,
      category: 'invoice',
    });
    const [key] = storagePutMock.mock.calls[0];
    expect(key).toMatch(/^invoice\/\d+_inv\.pdf$/);
  });

  it("force-adds 'invoice' tag when category='invoice', dedup'd via Set", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.files.upload({
      companyId: 7,
      fileName: 'inv.pdf', mimeType: 'application/pdf',
      base64Data: helloBase64,
      category: 'invoice',
      tags: ['invoice', 'q4'], // already includes 'invoice'
    });
    const insert = dbCalls.inserts.find(i => i.table === 'files')!;
    const tags = JSON.parse(insert.values.tags);
    expect(tags).toContain('invoice');
    expect(tags).toContain('q4');
    // Set dedup means 'invoice' appears exactly once.
    expect(tags.filter((t: string) => t === 'invoice')).toHaveLength(1);
  });

  it("auto-adds 'invoice' tag when caller didn't include it", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.files.upload({
      companyId: 7,
      fileName: 'x.pdf', mimeType: 'application/pdf',
      base64Data: helloBase64,
      category: 'invoice',
      tags: ['q4'],
    });
    const insert = dbCalls.inserts.find(i => i.table === 'files')!;
    const tags = JSON.parse(insert.values.tags);
    expect(tags).toContain('invoice');
  });

  it("non-invoice categories don't get an 'invoice' tag injected", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.files.upload({
      companyId: 7,
      fileName: 'x.jpg', mimeType: 'image/jpeg',
      base64Data: helloBase64,
      category: 'photo',
      tags: ['site-tour'],
    });
    const insert = dbCalls.inserts.find(i => i.table === 'files')!;
    const tags = JSON.parse(insert.values.tags);
    expect(tags).not.toContain('invoice');
    expect(tags).toEqual(['site-tour']);
  });
});

describe("files.upload — filename sanitisation", () => {
  it("replaces unsafe characters with underscores in the storage key", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.files.upload({
      companyId: 7,
      fileName: '../../../../etc/passwd; rm -rf /', mimeType: 'text/plain',
      base64Data: helloBase64,
      category: 'document',
    });
    const [key] = storagePutMock.mock.calls[0];
    // Only [a-zA-Z0-9._-] survives. Slashes, semicolons, spaces all become underscores.
    expect(key).not.toContain('/etc/');
    expect(key).not.toContain(';');
    expect(key).not.toContain(' ');
  });

  it("preserves the original fileName for display (only the storage key is sanitised)", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    const result = await caller.files.upload({
      companyId: 7,
      fileName: 'My Document (final).pdf',
      mimeType: 'application/pdf',
      base64Data: helloBase64,
      category: 'document',
    });
    expect(result.fileName).toBe('My Document (final).pdf');
    const insert = dbCalls.inserts.find(i => i.table === 'files')!;
    expect(insert.values.name).toBe('My Document (final).pdf');
  });
});

describe("files.upload — projectId tenant guard", () => {
  it("verifies projectId belongs to the company BEFORE writing to storage", async () => {
    dbCalls.projectsSelectReturn = []; // project not found for this company
    const caller = appRouter.createCaller(ctxFor(1));
    await expect(caller.files.upload({
      companyId: 7, projectId: '999',
      fileName: 'x.jpg', mimeType: 'image/jpeg',
      base64Data: helloBase64, category: 'photo',
    })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    // CRITICAL: storage was NOT touched — bytes never persisted.
    expect(storagePutMock).not.toHaveBeenCalled();
    expect(dbCalls.inserts).toHaveLength(0);
  });

  it("succeeds when the project belongs to the same company", async () => {
    dbCalls.projectsSelectReturn = [{ id: 7, companyId: 7 }];
    const caller = appRouter.createCaller(ctxFor(1));
    const result = await caller.files.upload({
      companyId: 7, projectId: '7',
      fileName: 'x.jpg', mimeType: 'image/jpeg',
      base64Data: helloBase64, category: 'photo',
    });
    expect(result.id).toBe(999);
    expect(storagePutMock).toHaveBeenCalledTimes(1);
  });

  it("skips the FK check when projectId is not provided (e.g. profile avatars)", async () => {
    dbCalls.projectsSelectReturn = []; // doesn't matter, FK check is skipped
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.files.upload({
      companyId: 7,
      fileName: 'avatar.jpg', mimeType: 'image/jpeg',
      base64Data: helloBase64, category: 'photo',
    });
    expect(storagePutMock).toHaveBeenCalledTimes(1);
    expect(dbCalls.selectFroms.filter(s => s.table === 'projects')).toHaveLength(0);
  });
});
