/**
 * auth.requestPasswordReset / auth.resetPasswordWithToken — email-link
 * reset flow.
 *
 * Properties exercised:
 *   1. requestPasswordReset is a constant-shape `{ success: true }` to
 *      prevent email-enumeration. The send-or-don't-send decision lives
 *      only in the audit log.
 *   2. OAuth-only users (passwordHash null) silently take the "no email"
 *      path — there's no password to rotate.
 *   3. resetPasswordWithToken verifies the JWT signature AND the
 *      per-user passwordHash prefix. A token minted against H1 stops
 *      verifying once the user's hash rotates to H2 — which is also how
 *      single-use is enforced (rotation invalidates outstanding tokens).
 *
 * Mock pattern mirrors tests/auth-change-password.test.ts: in-memory
 * `db` shape at module scope, vi.mock factory wires getDb() to it,
 * plus an explicit mock of getUserByEmail (the request side calls it
 * directly). sendEmail is mocked so the assertions can check call
 * counts without needing Brevo.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";

const db = {
  user: {
    id: 11,
    openId: "email:reset@test.com",
    email: "reset@test.com" as string | null,
    name: "Reset Tester" as string | null,
    role: "user" as "user" | "admin",
    passwordHash: null as string | null,
  },
  userByEmail: null as null | {
    id: number;
    openId: string;
    email: string | null;
    name: string | null;
    role: "user" | "admin";
    passwordHash: string | null;
  },
  userUpdates: [] as { values: any }[],
};

const sendEmailMock = vi.fn(async (_params: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}) => undefined);

function tableName(t: any): string {
  return getTableName(t);
}

vi.mock("../server/db", async () => {
  const actual = await vi.importActual<any>("../server/db");
  return {
    ...actual,
    getUserByEmail: vi.fn(async (_email: string) => db.userByEmail ?? undefined),
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

vi.mock("../server/_core/email", () => ({
  sendEmail: sendEmailMock,
}));

function makePublicCtx() {
  return {
    ctx: {
      user: null,
      req: { protocol: "https", hostname: "api.test", headers: {} } as any,
      res: {
        cookie: () => undefined,
        clearCookie: () => undefined,
      } as any,
    },
  };
}

const FAKE_HASH = "scrypt$N=16384,r=8,p=1$AAAABBBBCCCCDDDD$EEEEFFFF0000111122223333";
const ROTATED_HASH = "scrypt$N=16384,r=8,p=1$ZZZZYYYYXXXXWWWW$VVVVUUUUTTTTSSSSRRRRQQQQ";

describe("auth.requestPasswordReset / auth.resetPasswordWithToken", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-jwt-secret-for-password-reset-tests-32b";
    process.env.VITE_APP_ID = "test-app";
    // Ensure the email path doesn't try to talk to Brevo even if
    // sendEmail wasn't mocked — defence in depth.
    delete process.env.BREVO_API_KEY;
    process.env.NODE_ENV = "test";
    vi.resetModules();
    db.user = {
      id: 11,
      openId: "email:reset@test.com",
      email: "reset@test.com",
      name: "Reset Tester",
      role: "user",
      passwordHash: null,
    };
    db.userByEmail = null;
    db.userUpdates = [];
    sendEmailMock.mockClear();
  });

  afterEach(() => vi.restoreAllMocks());

  describe("requestPasswordReset", () => {
    it("known email with passwordHash triggers sendEmail and returns success", async () => {
      db.userByEmail = {
        id: 11,
        openId: "email:reset@test.com",
        email: "reset@test.com",
        name: "Reset Tester",
        role: "user",
        passwordHash: FAKE_HASH,
      };

      const { appRouter } = await import("../server/routers");
      const { ctx } = makePublicCtx();

      const result = await appRouter.createCaller(ctx).auth.requestPasswordReset({
        email: "reset@test.com",
      });

      expect(result).toEqual({ success: true });
      expect(sendEmailMock).toHaveBeenCalledTimes(1);
      const call = sendEmailMock.mock.calls[0]![0];
      expect(call.to).toBe("reset@test.com");
      expect(call.subject).toMatch(/reset/i);
      // The token-bearing CTA link is embedded in the body.
      expect(call.text).toMatch(/token=/);
    });

    it("unknown email returns success without sending email (anti-enumeration)", async () => {
      db.userByEmail = null;

      const { appRouter } = await import("../server/routers");
      const { ctx } = makePublicCtx();

      const result = await appRouter.createCaller(ctx).auth.requestPasswordReset({
        email: "ghost@test.com",
      });

      expect(result).toEqual({ success: true });
      expect(sendEmailMock).not.toHaveBeenCalled();
    });

    it("OAuth-only user (passwordHash null) returns success without sending email", async () => {
      db.userByEmail = {
        id: 11,
        openId: "email:reset@test.com",
        email: "reset@test.com",
        name: "Reset Tester",
        role: "user",
        passwordHash: null,
      };

      const { appRouter } = await import("../server/routers");
      const { ctx } = makePublicCtx();

      const result = await appRouter.createCaller(ctx).auth.requestPasswordReset({
        email: "reset@test.com",
      });

      expect(result).toEqual({ success: true });
      expect(sendEmailMock).not.toHaveBeenCalled();
    });
  });

  describe("resetPasswordWithToken", () => {
    it("valid token + new password updates the user's passwordHash", async () => {
      db.user.passwordHash = FAKE_HASH;

      const { mintResetToken } = await import("../server/_core/auth-tokens");
      const token = await mintResetToken({ userId: db.user.id, passwordHash: FAKE_HASH });

      const { appRouter } = await import("../server/routers");
      const { ctx } = makePublicCtx();

      const result = await appRouter.createCaller(ctx).auth.resetPasswordWithToken({
        token,
        newPassword: "fresh-strong-pw-12",
      });

      expect(result).toEqual({ success: true });
      expect(db.userUpdates).toHaveLength(1);
      // The persisted hash is no longer FAKE_HASH and verifies against the
      // new plaintext.
      expect(db.user.passwordHash).not.toBe(FAKE_HASH);
      expect(db.user.passwordHash).not.toBeNull();
      const { verifyPassword } = await import("../server/_core/passwords");
      const ok = await verifyPassword("fresh-strong-pw-12", db.user.passwordHash!);
      expect(ok).toBe(true);
    });

    it("malformed token throws BAD_REQUEST", async () => {
      db.user.passwordHash = FAKE_HASH;

      const { appRouter } = await import("../server/routers");
      const { ctx } = makePublicCtx();

      await expect(
        appRouter.createCaller(ctx).auth.resetPasswordWithToken({
          token: "not-a-real-token",
          newPassword: "fresh-strong-pw-12",
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });

      expect(db.userUpdates).toHaveLength(0);
    });

    it("token re-used after password rotation throws BAD_REQUEST (single-use)", async () => {
      // T1 minted while the user has H1.
      db.user.passwordHash = FAKE_HASH;
      const { mintResetToken } = await import("../server/_core/auth-tokens");
      const t1 = await mintResetToken({ userId: db.user.id, passwordHash: FAKE_HASH });

      // Simulate a rotation — the password has since changed (e.g. a
      // previous reset already redeemed, or the user logged in and used
      // changePassword). T1's embedded prefix no longer matches.
      db.user.passwordHash = ROTATED_HASH;

      const { appRouter } = await import("../server/routers");
      const { ctx } = makePublicCtx();

      await expect(
        appRouter.createCaller(ctx).auth.resetPasswordWithToken({
          token: t1,
          newPassword: "another-strong-pw-12",
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });

      // Crucially: the rotated hash stays untouched — a stale token must
      // not be able to overwrite a freshly-set password.
      expect(db.user.passwordHash).toBe(ROTATED_HASH);
      expect(db.userUpdates).toHaveLength(0);
    });
  });
});
