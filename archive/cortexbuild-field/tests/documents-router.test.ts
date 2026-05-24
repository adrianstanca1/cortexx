import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../server/_core/context";
import {
  collectBindings,
  collectColumns,
  tableName,
} from "./_helpers/drizzle-mock";
import { expectTenantWhere } from "./_helpers/expect-tenant-where";

/**
 * Coverage for documents.listGenerated and documents.saveGenerated.
 * The other AI-generation procedures inside the documents sub-router
 * (chat, analysePhoto, etc.) are LLM-heavy and live in the ai router
 * — they belong in their own test file. This file pins the
 * persistence side.
 *
 * Notable behaviours:
 *   - listGenerated: companyId always in WHERE; optional projectId
 *     predicate; respects `limit` (1-100, default 50).
 *   - saveGenerated: when projectId is provided, FK-checks that the
 *     project belongs to the company BEFORE inserting. A member of
 *     company A can NOT attach a document to company B's project.
 *   - status defaults to 'draft' (matches doc lifecycle: draft →
 *     final → sent).
 */

interface DbCalls {
  selectFroms: {
    table: string;
    whereCols: string[];
    whereBindings: Record<string, unknown>;
  }[];
  inserts: { table: string; values: any }[];
  projectsSelectReturn: any[];
}
const dbCalls: DbCalls = {
  selectFroms: [],
  inserts: [],
  projectsSelectReturn: [],
};

vi.mock("../server/db", () => ({
  getDb: vi.fn(async () => ({
    select() {
      return {
        from(table: any) {
          const name = tableName(table);
          if (name.includes("company_users")) {
            return {
              where(_c: unknown) {
                return {
                  limit() {
                    return Promise.resolve([
                      { companyRole: "manager", isActive: true },
                    ]);
                  },
                };
              },
            };
          }
          const record = {
            table: name,
            whereCols: [] as string[],
            whereBindings: {} as Record<string, unknown>,
          };
          dbCalls.selectFroms.push(record);
          const returnRows =
            name === "projects" ? dbCalls.projectsSelectReturn : [];
          const chain: any = {
            where(predicate: unknown) {
              record.whereCols.push(...collectColumns(predicate));
              Object.assign(record.whereBindings, collectBindings(predicate));
              return chain;
            },
            orderBy(_o: unknown) {
              return chain;
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
  dbCalls.projectsSelectReturn = [{ id: 7, companyId: 7 }];
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("documents.listGenerated", () => {
  it("scoped to companyId; absent projectId means projectId NOT in WHERE", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.documents.listGenerated({ companyId: 7 });
    const selects = dbCalls.selectFroms.filter((s) => s.table === "documents");
    expect(selects).toHaveLength(1);
    // Bound value: companyId predicate uses input.companyId, not a literal
    // or some other source.
    expectTenantWhere(selects[0], { companyId: 7 });
    // Absence assertions stay inline.
    expect(selects[0].whereCols).not.toContain("projectId");
    expect(selects[0].whereBindings).not.toHaveProperty("projectId");
  });

  it("with projectId filter, WHERE binds both companyId AND projectId from input", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.documents.listGenerated({ companyId: 7, projectId: 3 });
    const selects = dbCalls.selectFroms.filter((s) => s.table === "documents");
    expect(selects).toHaveLength(1);
    expectTenantWhere(selects[0], { companyId: 7, projectId: 3 });
  });

  it("rejects limit > 100 (zod gate)", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await expect(
      caller.documents.listGenerated({
        companyId: 7,
        limit: 1000,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(
      dbCalls.selectFroms.filter((s) => s.table === "documents"),
    ).toHaveLength(0);
  });

  it("rejects limit < 1 (zod gate)", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await expect(
      caller.documents.listGenerated({
        companyId: 7,
        limit: 0,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("documents.saveGenerated", () => {
  it("inserts a document with status='draft' default", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.documents.saveGenerated({
      companyId: 7,
      type: "rams",
      title: "RAMS — concrete pour",
      content: "risk and method statement body",
    });
    const insert = dbCalls.inserts.find((i) => i.table === "documents")!;
    expect(insert.values).toMatchObject({
      companyId: 7,
      type: "rams",
      title: "RAMS — concrete pour",
      status: "draft",
    });
  });

  it("respects explicit status='final'", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.documents.saveGenerated({
      companyId: 7,
      type: "invoice",
      title: "Invoice 0001",
      content: "...",
      status: "final",
    });
    const insert = dbCalls.inserts.find((i) => i.table === "documents")!;
    expect(insert.values.status).toBe("final");
  });

  it("FK-checks projectId belongs to company before inserting", async () => {
    dbCalls.projectsSelectReturn = []; // project NOT in this company
    const caller = appRouter.createCaller(ctxFor(1));
    await expect(
      caller.documents.saveGenerated({
        companyId: 7,
        projectId: 999,
        type: "toolbox_talk",
        title: "X",
        content: "Y",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    // CRITICAL: no INSERT happens if FK check fails
    expect(dbCalls.inserts.filter((i) => i.table === "documents")).toHaveLength(
      0,
    );
  });

  it("succeeds when projectId belongs to the same company; FK select binds id AND companyId from input", async () => {
    // Use a clearly distinct projectId vs companyId so a bug like
    // `eq(projects.companyId, input.projectId)` would surface.
    dbCalls.projectsSelectReturn = [{ id: 42, companyId: 7 }];
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.documents.saveGenerated({
      companyId: 7,
      projectId: 42,
      type: "daily_report",
      title: "Daily Report",
      content: "body",
    });
    expect(dbCalls.inserts.filter((i) => i.table === "documents")).toHaveLength(
      1,
    );
    // The FK guard query must check BOTH project id and project companyId,
    // each bound to the corresponding input value. A swap (or hard-coding
    // either side) now fails this test.
    const fkSelect = dbCalls.selectFroms.find((s) => s.table === "projects");
    expect(fkSelect).toBeDefined();
    expectTenantWhere(fkSelect!, { id: 42, companyId: 7 });
  });

  it("skips the FK check entirely when projectId is omitted", async () => {
    dbCalls.projectsSelectReturn = []; // doesn't matter, FK check skipped
    const caller = appRouter.createCaller(ctxFor(1));
    await caller.documents.saveGenerated({
      companyId: 7,
      type: "other",
      title: "Company-wide doc",
      content: "body",
    });
    expect(dbCalls.inserts.filter((i) => i.table === "documents")).toHaveLength(
      1,
    );
    expect(
      dbCalls.selectFroms.filter((s) => s.table === "projects"),
    ).toHaveLength(0);
  });

  it("rejects unknown type via zod enum gate", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await expect(
      caller.documents.saveGenerated({
        companyId: 7,
        // @ts-expect-error — exercising zod enum
        type: "made-up-type",
        title: "X",
        content: "Y",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
