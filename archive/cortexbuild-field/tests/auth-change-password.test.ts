/**
 * auth.changePassword — proof-of-current password rotation.
 *
 * Behaviour gated:
 *   1. Must verify the supplied currentPassword against the stored hash.
 *      Wrong → UNAUTHORIZED, NO write. (Defends against session-hijack:
 *      attacker has the cookie but not the password.)
 *   2. OAuth-only users (passwordHash null) → BAD_REQUEST. There's no
 *      password to rotate; silently succeeding would mask misconfig.
 *   3. zod input gate: newPassword min 8 — short passwords reject before
 *      any DB read, so a flood of tiny-password attempts is cheap.
 *   4. Happy path: new hash persists, old hash no longer verifies, new
 *      hash verifies the new plaintext.
 *
 * Mock pattern: in-memory `db` shape at module scope, vi.mock factory
 * returns getDb() with select + update wired to the same shape. Audit
 * log inserts are no-op by design.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";

const db = {
  user: {
    id: 7,
    openId: "email:test@test.com",
    email: "test@test.com" as string | null,
    name: "Test" as string | null,
    role: "user" as "user" | "admin",
    passwordHash: null as string | null,
  },
  userUpdates: [] as { values: any }[],
};

function tableName(t: any): string {
  return getTableName(t);
}

vi.mock("../server/db", async () => {
  const actual = await vi.importActual<any>("../server/db");
  return {
    ...actual,
    getDb: vi.fn(async () => ({
      select(_cols?: any) {
        return {
          from(table: any) {
            const name = tableName(table);
            return {
              where(_cond: unknown) {
                return {
                  limit(_n: number) {
                    if (name === "users") {
                      return Promise.resolve([{ passwordHash: db.user.passwordHash }]);
                    }
                    return Promise.resolve([]);
                  },
                };
              },
              limit(_n: number) {
                if (name === "users") {
                  return Promise.resolve([{ passwordHash: db.user.passwordHash }]);
                }
                return Promise.resolve([]);
              },
            };
          },
        };
      },
      update(table: any) {
        const name = tableName(table);
        return {
          set(values: any) {
            return {
              where(_cond: unknown) {
                if (name === "users") {
                  if (Object.prototype.hasOwnProperty.call(values, "passwordHash")) {
                    db.user.passwordHash = values.passwordHash;
                  }
                  db.userUpdates.push({ values });
                }
                return Promise.resolve();
              },
            };
          },
        };
      },
      insert(_table: any) {
        // Audit log inserts — no-op by design.
        return {
          values(_values: any) {
            return Promise.resolve();
          },
        };
      },
    })),
  };
});

function makeProtectedCtx(user: typeof callerUser) {
  return {
    ctx: {
      user,
      req: { protocol: "https", hostname: "api.test", headers: {} } as any,
      res: {
        cookie: () => undefined,
        clearCookie: () => undefined,
      } as any,
    },
  };
}

// Full TrpcContext.user shape — changePassword reads ctx.user.id, but the
// createCaller signature requires the full shape.
const callerUser = {
  id: 7,
  role: "user" as const,
  openId: "email:test@test.com",
  email: "test@test.com" as string | null,
  name: "Test" as string | null,
  loginMethod: "password" as string | null,
  passwordHash: null as string | null,
  pushPreferences: {},
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  lastSignedIn: new Date("2026-01-01"),
};

describe("auth.changePassword (proof-of-current rotation)", () => {
  beforeEach(async () => {
    process.env.JWT_SECRET = "test-jwt-secret-for-change-password-tests-32b";
    process.env.VITE_APP_ID = "test-app";
    vi.resetModules();
    db.user = {
      id: 7,
      openId: "email:test@test.com",
      email: "test@test.com",
      name: "Test",
      role: "user",
      passwordHash: null,
    };
    db.userUpdates = [];
  });

  afterEach(() => vi.restoreAllMocks());

  it("happy path: verifies current password, updates to new hash, returns success", async () => {
    const { hashPassword, verifyPassword } = await import("../server/_core/passwords");
    const oldHash = await hashPassword("correct-old");
    db.user.passwordHash = oldHash;

    const { appRouter } = await import("../server/routers");
    const { ctx } = makeProtectedCtx(callerUser);

    const result = await appRouter.createCaller(ctx).auth.changePassword({
      currentPassword: "correct-old",
      newPassword: "new-strong-pw-12",
    });

    expect(result).toEqual({ success: true });
    expect(db.userUpdates).toHaveLength(1);
    // The persisted hash is no longer the old one...
    expect(db.user.passwordHash).not.toBe(oldHash);
    // ...and it verifies against the new plaintext.
    expect(db.user.passwordHash).not.toBeNull();
    const ok = await verifyPassword("new-strong-pw-12", db.user.passwordHash!);
    expect(ok).toBe(true);
  });

  it("rejects when currentPassword is wrong (UNAUTHORIZED)", async () => {
    const { hashPassword } = await import("../server/_core/passwords");
    db.user.passwordHash = await hashPassword("correct-old");

    const { appRouter } = await import("../server/routers");
    const { ctx } = makeProtectedCtx(callerUser);

    await expect(
      appRouter.createCaller(ctx).auth.changePassword({
        currentPassword: "wrong",
        newPassword: "new-strong-pw-12",
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    expect(db.userUpdates).toHaveLength(0);
  });

  it("rejects when newPassword is too short (zod)", async () => {
    const { hashPassword } = await import("../server/_core/passwords");
    db.user.passwordHash = await hashPassword("correct-old");

    const { appRouter } = await import("../server/routers");
    const { ctx } = makeProtectedCtx(callerUser);

    await expect(
      appRouter.createCaller(ctx).auth.changePassword({
        currentPassword: "correct-old",
        newPassword: "short",
      }),
    ).rejects.toThrow();

    expect(db.userUpdates).toHaveLength(0);
  });

  it("rejects when user has no passwordHash (BAD_REQUEST for OAuth-only users)", async () => {
    db.user.passwordHash = null;

    const { appRouter } = await import("../server/routers");
    const { ctx } = makeProtectedCtx(callerUser);

    await expect(
      appRouter.createCaller(ctx).auth.changePassword({
        currentPassword: "anything",
        newPassword: "new-strong-pw-12",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(db.userUpdates).toHaveLength(0);
  });
});
