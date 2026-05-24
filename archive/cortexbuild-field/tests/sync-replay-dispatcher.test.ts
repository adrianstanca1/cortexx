/**
 * Tests for the sync.replay dispatcher.
 *
 * Before this dispatcher existed, sync.replay was a no-op that returned
 * { success: true } for any input — so offline-queued mutations were
 * silently dropped on reconnect. These tests pin the dispatcher's
 * contract:
 *
 *  1. It refuses to dispatch types that aren't on the REPLAYABLE_TYPES
 *     allow-list (so a malicious client can't use sync.replay as a
 *     general RPC back door).
 *  2. It actually invokes the underlying procedure (verified by checking
 *     a side-effect on the mocked DB).
 *  3. The dispatched call goes through the underlying procedure's own
 *     middleware — so e.g. companyScopedProcedure still enforces tenant
 *     membership; sync.replay can't be used to bypass it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";
import {
  defects as dbDefects,
  projects as dbProjects,
  companyUsers as dbCompanyUsers,
} from "../drizzle/schema";

const calls = {
  insertedDefect: null as any,
  projectLookups: 0,
};

function makeDb() {
  return {
    select() {
      return {
        from(table: unknown) {
          return {
            where() {
              return {
                limit() {
                  if (table === dbProjects) { calls.projectLookups++; return Promise.resolve([{ id: 100, companyId: 7 }]); }
                  if (table === dbCompanyUsers) return Promise.resolve([{ companyRole: "manager", isActive: true }]);
                  return Promise.resolve([]);
                },
                orderBy() {
                  return Object.assign(Promise.resolve([]), { limit: () => Promise.resolve([]) });
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
          if (table === dbDefects) calls.insertedDefect = values;
          return { returning() { return Promise.resolve([{ id: 999, ...values }]); } };
        },
      };
    },
  };
}

vi.mock("../server/db", () => ({
  getDb: vi.fn(async () => makeDb()),
}));

function ctxWithUser(role: "user" | "admin" = "user"): TrpcContext {
  return {
    user: {
      id: 11,
      openId: "user-11",
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

beforeEach(() => {
  calls.insertedDefect = null;
  calls.projectLookups = 0;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("sync.replay dispatcher", () => {
  it("refuses unknown types with BAD_REQUEST (allow-list enforced)", async () => {
    const caller = appRouter.createCaller(ctxWithUser());
    await expect(
      caller.sync.replay({ type: "users.delete", payload: { id: 1 } }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("refuses internal procedures even if they exist on the router", async () => {
    // auth.login is a real procedure but is NOT in REPLAYABLE_TYPES.
    // The dispatcher must treat it as forbidden.
    const caller = appRouter.createCaller(ctxWithUser());
    await expect(
      caller.sync.replay({
        type: "auth.login",
        payload: { email: "a@b.com", password: "x" },
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("dispatches an allow-listed mutation and the underlying procedure ACTUALLY runs", async () => {
    // The replay must result in the same DB write a direct call would.
    // Without this, sync.replay is decorative and the offline queue
    // silently drops user data — the bug this dispatcher exists to fix.
    const caller = appRouter.createCaller(ctxWithUser());
    const result = await caller.sync.replay({
      type: "defects.create",
      payload: {
        companyId: 7,
        projectId: 100,
        title: "Crack in basement wall",
        reportedBy: "Field worker",
      },
    });

    // The dispatched defects.create wrote to the mocked DB.
    expect(calls.insertedDefect).toMatchObject({
      companyId: 7,
      projectId: 100,
      title: "Crack in basement wall",
    });

    // The replay envelope is preserved.
    expect(result).toMatchObject({
      success: true,
      type: "defects.create",
    });
    expect(result.replayedAt).toBeTypeOf("string");
  });

  it("preserves the underlying procedure's middleware: tenant FK still enforced via replay", async () => {
    // If the queued payload has a foreign companyId, the underlying
    // companyScopedProcedure middleware must still FORBID — sync.replay
    // is not a way to bypass tenant scoping. Build a one-off DB mock
    // where the projects lookup returns no rows; defects.create then
    // throws FORBIDDEN because "project doesn't belong to this company".
    const original = await import("../server/db");
    const dbMockNoProject = {
      select() {
        return {
          from(table: unknown) {
            return {
              where() {
                return {
                  limit() {
                    if (table === dbProjects) return Promise.resolve([]); // not found
                    if (table === dbCompanyUsers) return Promise.resolve([{ companyRole: "manager", isActive: true }]);
                    return Promise.resolve([]);
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
            if (table === dbDefects) calls.insertedDefect = values;
            return { returning() { return Promise.resolve([{ id: 999, ...values }]); } };
          },
        };
      },
    };
    vi.mocked(original.getDb).mockResolvedValue(dbMockNoProject as any);

    const caller = appRouter.createCaller(ctxWithUser());
    await expect(
      caller.sync.replay({
        type: "defects.create",
        payload: {
          companyId: 7,
          projectId: 999, // a project that doesn't belong to company 7
          title: "Cross-tenant attempt via replay",
          reportedBy: "Attacker",
        },
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(calls.insertedDefect).toBeNull();
  });
});
