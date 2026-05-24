import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
import type { TrpcContext } from "../server/_core/context";

/**
 * Coverage for the teams sub-router in `server/routers/index.ts`.
 * Procedures: list, create, update, delete.
 *
 * Notable behaviours pinned here:
 *
 *   - All four procedures use `companyScopedProcedure` (post-2026-05-05) so
 *     a missing companyId is BAD_REQUEST and a non-member companyId is
 *     FORBIDDEN before any DB I/O. Closes SECURITY.md P1-E.
 *
 *   - `delete` is a SOFT delete (sets status='inactive') — never
 *     issues a SQL DELETE. Hard-deleting would orphan timesheet
 *     rows that FK to teamMembers, so the procedure flips status
 *     instead.
 *
 *   - `update` only writes fields that are explicitly present in
 *     input (manual `if (v !== undefined)` filter). Editing just
 *     the role doesn't clobber email / phone / cscsCardType.
 *
 *   - `list` always filters status='active' AND companyId — soft-deleted
 *     members and other tenants' members never surface.
 *
 *   - `create` persists companyId (used to silently strip it) and FK-guards
 *     projectId against the tenant: a project belonging to company B can't
 *     be referenced from a teams.create call scoped to company A.
 */

interface DbCalls {
  selectFroms: { table: string; whereArgs: any[] }[];
  inserts: { table: string; values: any }[];
  updates: { table: string; whereArgs: any[]; values: any }[];
}
const dbCalls: DbCalls = { selectFroms: [], inserts: [], updates: [] };

// Configurable: lets a test simulate "this projectId does NOT belong to
// the requested companyId" by setting projectLookupResult to [].
const state: { projectLookupResult: { id: number; companyId: number }[] } = {
  projectLookupResult: [{ id: 100, companyId: 7 }],
};

// Deep-walks whatever Drizzle passes to `.where(...)` (eq / and / SQL)
// and collects every primitive. Avoids picking fixed property names: if
// drizzle's AST shape changes, we still find `eq(..., 'active')`'s
// literal. WeakSet prevents infinite loops on cyclic refs.
function collectWherePrimitives(node: any, out: any[] = [], seen = new WeakSet<object>()): any[] {
  if (node == null) return out;
  const t = typeof node;
  if (t === 'string' || t === 'number' || t === 'boolean') {
    out.push(node);
    return out;
  }
  if (t !== 'object') return out;
  if (seen.has(node)) return out;
  seen.add(node);
  if (Array.isArray(node)) {
    for (const item of node) collectWherePrimitives(item, out, seen);
    return out;
  }
  for (const key of Object.keys(node)) {
    collectWherePrimitives(node[key], out, seen);
  }
  return out;
}

function tableName(table: any): string {
  return getTableName(table);
}

vi.mock("../server/db", () => ({
  getDb: vi.fn(async () => ({
    select() {
      return {
        from(table: any) {
          const name = tableName(table);
          const recorded: { table: string; whereArgs: any[] } = { table: name, whereArgs: [] };
          dbCalls.selectFroms.push(recorded);
          const chain: any = {
            where(clause: unknown) {
              recorded.whereArgs.push(clause);
              return chain;
            },
            orderBy(_o: unknown) { return Promise.resolve([]); },
            limit(_n: number) {
              if (name === 'projects') return Promise.resolve(state.projectLookupResult);
              // companyUsers (membership lookup) — return empty by default;
              // tests that exercise the handler use ctxFor(_, "admin") so
              // the middleware bypasses the lookup entirely.
              return Promise.resolve([]);
            },
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
          const rec = { table: name, whereArgs: [] as any[], values };
          dbCalls.updates.push(rec);
          return {
            where(clause: unknown) {
              rec.whereArgs.push(clause);
              return Promise.resolve();
            },
          };
        },
      };
    },
  })),
}));

const { appRouter } = await import("../server/routers");

function ctxFor(userId: number | null = 1, role: "user" | "admin" = "user"): TrpcContext {
  return {
    user: userId === null ? null : {
      id: userId, openId: `user-${userId}`, name: `User ${userId}`,
      email: `u${userId}@example.com`, loginMethod: "manus", role,
      passwordHash: null, pushPreferences: {}, createdAt: new Date(), updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as any,
    req: { protocol: "https", hostname: "localhost", headers: {} } as any,
    res: { clearCookie: vi.fn() } as any,
  };
}

beforeEach(() => {
  dbCalls.selectFroms.length = 0;
  dbCalls.inserts.length = 0;
  dbCalls.updates.length = 0;
  state.projectLookupResult = [{ id: 100, companyId: 7 }];
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("teams.list", () => {
  it("WHERE filters status='active' AND companyId (multi-tenant + soft-delete)", async () => {
    const caller = appRouter.createCaller(ctxFor(1, "admin"));
    await caller.teams.list({ companyId: 7 });
    const sel = dbCalls.selectFroms.find(s => s.table === 'team_members')!;
    expect(sel).toBeTruthy();
    expect(sel.whereArgs).toHaveLength(1);
    const literals = collectWherePrimitives(sel.whereArgs[0]);
    expect(literals).toContain('active');
    expect(literals).toContain(7); // companyId
  });

  it("WHERE adds projectId predicate when provided (alongside companyId+active)", async () => {
    const caller = appRouter.createCaller(ctxFor(1, "admin"));
    await caller.teams.list({ companyId: 7, projectId: 42 });
    const sel = dbCalls.selectFroms.find(s => s.table === 'team_members')!;
    const literals = collectWherePrimitives(sel.whereArgs[0]);
    expect(literals).toContain('active');
    expect(literals).toContain(7);
    expect(literals).toContain(42);
  });

  it("rejects unauthenticated callers (UNAUTHORIZED)", async () => {
    const caller = appRouter.createCaller(ctxFor(null));
    await expect(caller.teams.list({ companyId: 7 })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it("rejects calls without companyId (BAD_REQUEST — closes IDOR P1-E)", async () => {
    const caller = appRouter.createCaller(ctxFor(1, "admin"));
    // @ts-expect-error — deliberately omitting companyId
    await expect(caller.teams.list({})).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(dbCalls.selectFroms.filter(s => s.table === 'team_members')).toHaveLength(0);
  });

  it("non-admin without membership in companyId gets FORBIDDEN (cross-tenant list blocked)", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await expect(caller.teams.list({ companyId: 99 })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(dbCalls.selectFroms.filter(s => s.table === 'team_members')).toHaveLength(0);
  });
});

describe("teams.create", () => {
  it("PERSISTS companyId on insert (was previously stripped — closes P1-E)", async () => {
    const caller = appRouter.createCaller(ctxFor(1, "admin"));
    await caller.teams.create({
      companyId: 7,
      name: 'Alice', role: 'foreman', trade: 'concrete',
      email: 'a@x.y', phone: '07700', cscsCardType: 'gold',
      projectId: 100, hourlyRate: '25.00',
    });
    const insert = dbCalls.inserts.find(i => i.table === 'team_members')!;
    expect(insert.values).toMatchObject({
      companyId: 7,
      name: 'Alice', role: 'foreman', trade: 'concrete', email: 'a@x.y',
      phone: '07700', cscsCardType: 'gold', projectId: 100, hourlyRate: '25.00',
    });
  });

  it("blocks projectId belonging to a different company with FORBIDDEN (FK guard)", async () => {
    state.projectLookupResult = []; // simulate "project not in this company"
    const caller = appRouter.createCaller(ctxFor(1, "admin"));
    await expect(
      caller.teams.create({
        companyId: 7,
        name: 'Mallory', role: 'foreman', projectId: 100,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(dbCalls.inserts.filter(i => i.table === 'team_members')).toHaveLength(0);
  });

  it("rejects calls without companyId (BAD_REQUEST)", async () => {
    const caller = appRouter.createCaller(ctxFor(1, "admin"));
    await expect(
      // @ts-expect-error — deliberately omitting companyId
      caller.teams.create({ name: 'X', role: 'Y' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(dbCalls.inserts).toHaveLength(0);
  });

  it("non-admin without membership in companyId gets FORBIDDEN (no INSERT)", async () => {
    const caller = appRouter.createCaller(ctxFor(1));
    await expect(
      caller.teams.create({ companyId: 99, name: 'X', role: 'Y' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(dbCalls.inserts).toHaveLength(0);
  });
});

describe("teams.update", () => {
  it("only writes fields present in input (skips undefined, scopes by companyId)", async () => {
    const caller = appRouter.createCaller(ctxFor(1, "admin"));
    await caller.teams.update({ id: 5, companyId: 7, role: 'site manager' });
    const upd = dbCalls.updates.find(u => u.table === 'team_members')!;
    expect(upd.values.role).toBe('site manager');
    expect(upd.values.updatedAt).toBeInstanceOf(Date);
    for (const k of ['name', 'trade', 'email', 'phone', 'status', 'hourlyRate']) {
      expect(upd.values, `should not write ${k}`).not.toHaveProperty(k);
    }
    // WHERE includes both id and companyId — cross-tenant updates blocked at SQL level.
    const literals = collectWherePrimitives(upd.whereArgs[0]);
    expect(literals).toContain(5);
    expect(literals).toContain(7);
  });

  it("status enum accepts active / inactive / on_leave", async () => {
    const caller = appRouter.createCaller(ctxFor(1, "admin"));
    await caller.teams.update({ id: 5, companyId: 7, status: 'on_leave' });
    const upd = dbCalls.updates.find(u => u.table === 'team_members')!;
    expect(upd.values.status).toBe('on_leave');
  });

  it("rejects calls without companyId (BAD_REQUEST)", async () => {
    const caller = appRouter.createCaller(ctxFor(1, "admin"));
    await expect(
      // @ts-expect-error — deliberately omitting companyId
      caller.teams.update({ id: 5, role: 'X' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(dbCalls.updates).toHaveLength(0);
  });
});

describe("teams.delete (soft delete)", () => {
  it("issues an UPDATE setting status='inactive' scoped by id AND companyId", async () => {
    const caller = appRouter.createCaller(ctxFor(1, "admin"));
    await caller.teams.delete({ id: 5, companyId: 7 });
    const upd = dbCalls.updates.find(u => u.table === 'team_members')!;
    expect(upd.values.status).toBe('inactive');
    expect(upd.values.updatedAt).toBeInstanceOf(Date);
    const literals = collectWherePrimitives(upd.whereArgs[0]);
    expect(literals).toContain(5);
    expect(literals).toContain(7);
  });

  it("rejects unauthenticated callers (UNAUTHORIZED) — no UPDATE", async () => {
    const caller = appRouter.createCaller(ctxFor(null));
    await expect(caller.teams.delete({ id: 5, companyId: 7 })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
    expect(dbCalls.updates).toHaveLength(0);
  });

  it("rejects calls without companyId (BAD_REQUEST — closes cross-tenant delete)", async () => {
    const caller = appRouter.createCaller(ctxFor(1, "admin"));
    await expect(
      // @ts-expect-error — deliberately omitting companyId
      caller.teams.delete({ id: 5 }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(dbCalls.updates).toHaveLength(0);
  });
});
