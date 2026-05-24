import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { companyScopedProcedure, router } from "../server/_core/trpc";
import type { TrpcContext } from "../server/_core/context";
import { companyUsers as dbCompanyUsers } from "../drizzle/schema";

import * as serverDb from "../server/db";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-session-secret";

type ContextUser = NonNullable<TrpcContext["user"]>;

function makeUser(overrides: Partial<ContextUser> = {}): ContextUser {
  return {
    id: 11,
    openId: "user-11",
    name: "Test User",
    email: "test@example.com",
    loginMethod: "manus",
    role: "user",
    passwordHash: null, pushPreferences: {}, createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };
}

function makeCtx(user: ContextUser | null = makeUser()): TrpcContext {
  return {
    user,
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

const membershipRows: { companyRole: string; isActive: boolean | null }[] = [];

function makeDb(returnRows = membershipRows) {
  return {
    select() {
      return {
        from(table: unknown) {
          expect(table).toBe(dbCompanyUsers);
          return {
            where() {
              return {
                limit() {
                  return Promise.resolve(returnRows);
                },
              };
            },
          };
        },
      };
    },
  };
}

vi.mock("../server/db", async () => {
  const actual = await vi.importActual<typeof import("../server/db")>("../server/db");
  return {
    ...actual,
    getDb: vi.fn(() => Promise.resolve(null)),
  };
});

const testRouter = router({
  ping: companyScopedProcedure
    .input(z.object({ companyId: z.number() }))
    .query(({ ctx, input }) => ({
      companyId: input.companyId,
      companyRole: ctx.companyMembership?.companyRole ?? null,
    })),
});

describe("companyScopedProcedure", () => {
  beforeEach(() => {
    membershipRows.length = 0;
    vi.mocked(serverDb.getDb).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects unauthenticated callers with UNAUTHORIZED", async () => {
    const caller = testRouter.createCaller(makeCtx(null));
    await expect(caller.ping({ companyId: 1 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects calls missing a companyId with BAD_REQUEST", async () => {
    const caller = testRouter.createCaller(makeCtx());
    // @ts-expect-error — deliberately omitting companyId
    await expect(caller.ping({})).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects non-positive companyIds with BAD_REQUEST", async () => {
    const caller = testRouter.createCaller(makeCtx());
    await expect(caller.ping({ companyId: 0 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.ping({ companyId: -3 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects users without an active membership for the requested company with FORBIDDEN", async () => {
    vi.mocked(serverDb.getDb).mockResolvedValue(makeDb([]) as unknown as Awaited<ReturnType<typeof serverDb.getDb>>);
    const caller = testRouter.createCaller(makeCtx());
    await expect(caller.ping({ companyId: 99 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects users with an inactive membership with FORBIDDEN", async () => {
    vi.mocked(serverDb.getDb).mockResolvedValue(
      makeDb([{ companyRole: "worker", isActive: false }]) as unknown as Awaited<ReturnType<typeof serverDb.getDb>>,
    );
    const caller = testRouter.createCaller(makeCtx());
    await expect(caller.ping({ companyId: 5 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects users whose membership has isActive=null with FORBIDDEN (null is not active)", async () => {
    // companyUsers.isActive allows null (no .notNull() in the schema). The
    // middleware must treat null as inactive, otherwise null grants access.
    vi.mocked(serverDb.getDb).mockResolvedValue(
      makeDb([{ companyRole: "worker", isActive: null }]) as unknown as Awaited<ReturnType<typeof serverDb.getDb>>,
    );
    const caller = testRouter.createCaller(makeCtx());
    await expect(caller.ping({ companyId: 5 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows users with an active membership and exposes companyMembership on ctx", async () => {
    vi.mocked(serverDb.getDb).mockResolvedValue(
      makeDb([{ companyRole: "manager", isActive: true }]) as unknown as Awaited<ReturnType<typeof serverDb.getDb>>,
    );
    const caller = testRouter.createCaller(makeCtx());
    const result = await caller.ping({ companyId: 5 });
    expect(result).toEqual({ companyId: 5, companyRole: "manager" });
  });

  it("lets platform admins (ctx.user.role === 'admin') bypass the membership check", async () => {
    // No DB mock set up — the platform-admin path must not hit the DB at all.
    vi.mocked(serverDb.getDb).mockImplementation(() => {
      throw new Error("getDb should not be called for platform admins");
    });
    const caller = testRouter.createCaller(makeCtx(makeUser({ role: "admin" })));
    const result = await caller.ping({ companyId: 999 });
    expect(result).toEqual({ companyId: 999, companyRole: null });
  });

  it("returns INTERNAL_SERVER_ERROR if the DB is unavailable for non-admins", async () => {
    vi.mocked(serverDb.getDb).mockResolvedValue(null);
    const caller = testRouter.createCaller(makeCtx());
    await expect(caller.ping({ companyId: 5 })).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
});
