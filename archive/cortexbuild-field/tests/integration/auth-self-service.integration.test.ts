/**
 * Integration test: end-to-end auth self-service flows on real Postgres.
 *
 * Exercises the full lifecycle of the procedures landed in tasks 1-6:
 *   - register → login → sessionToken issued
 *   - register → requestPasswordReset → resetPasswordWithToken → login
 *   - resetPasswordWithToken: token issued before rotation is rejected
 *     after another rotation (single-use enforced via passwordHash prefix)
 *   - register → changePassword → login with new password
 *   - register: rejects domain outside REGISTRATION_ALLOWED_DOMAINS
 *
 * Goal: pin that the procedures compose correctly against a real DB +
 * jose JWT crypto + scrypt password hashing, not just mocked unit-level
 * surfaces. The single-use-after-rotation case in particular cannot be
 * verified by unit tests because it depends on the actual passwordHash
 * value being read back from Postgres.
 *
 * Token capture for the reset flow uses option (b): mint the reset
 * token directly via auth-tokens.mintResetToken after fetching the
 * passwordHash from the DB. This simulates exactly what the
 * requestPasswordReset procedure does internally without coupling
 * the test to email-template body parsing or sendEmail mock internals.
 *
 * sendEmail in dev (no BREVO_API_KEY) warn-and-no-ops, so we don't
 * mock it here — see server/_core/email.ts:32-46.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import {
  setupTestPostgres,
  teardownTestPostgres,
  truncate,
  getTestDb,
} from "./setup";
import { users as dbUsers } from "../../drizzle/schema";

// ENV captures registrationAllowedDomains at module load. The env-var
// MUST be set BEFORE the dynamic import of `../../server/routers` (which
// transitively pulls in `server/_core/env`). Mirror the JWT_SECRET
// pattern from finance-invoice.integration.test.ts.
let appRouter: typeof import("../../server/routers")["appRouter"];
let mintResetToken: typeof import("../../server/_core/auth-tokens")["mintResetToken"];

beforeAll(async () => {
  await setupTestPostgres();
  process.env.JWT_SECRET = process.env.JWT_SECRET ?? "integration-test-secret";
  process.env.REGISTRATION_ALLOWED_DOMAINS = "test.example";
  ({ appRouter } = await import("../../server/routers"));
  ({ mintResetToken } = await import("../../server/_core/auth-tokens"));
}, 120_000);

afterAll(async () => {
  await teardownTestPostgres();
}, 30_000);

beforeEach(async () => {
  // Only touch tables this test populates. login attempts are an
  // in-memory bucket in server/_core/login-rate-limit.ts (no DB).
  await truncate(["users"]);
});

// publicProcedure ctx: no user, just enough Express req/res shape for
// cookie operations + req.protocol/hostname/headers reads. Mirrors the
// "minimal ctx" pattern documented in finance-invoice.integration.test.ts.
function publicCtx() {
  return {
    user: null,
    companyMembership: null,
    req: {
      protocol: "https",
      hostname: "localhost",
      headers: {},
      ip: "127.0.0.1",
    } as any,
    res: { clearCookie: vi.fn(), cookie: vi.fn() } as any,
  } as any;
}

// protectedProcedure ctx: a fully-populated user shape so changePassword
// (which only reads ctx.user.id) is happy. Mirrors the User shape from
// finance-invoice.integration.test.ts:ctx().
function userCtx(userId: number, email: string) {
  return {
    user: {
      id: userId,
      openId: "email:" + email,
      name: email,
      email,
      loginMethod: "password",
      role: "user" as const,
      passwordHash: null,
      pushPreferences: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    companyMembership: null,
    req: {
      protocol: "https",
      hostname: "localhost",
      headers: {},
      ip: "127.0.0.1",
    } as any,
    res: { clearCookie: vi.fn(), cookie: vi.fn() } as any,
  } as any;
}

describe("auth self-service E2E on real PG", () => {
  it("register → login → returns sessionToken", async () => {
    const caller = appRouter.createCaller(publicCtx());

    const reg = await caller.auth.register({
      email: "alice@test.example",
      password: "first-pw-12chars",
      name: "Alice",
    });
    expect(reg).toMatchObject({ success: true });
    expect(typeof reg.userId).toBe("number");

    const login = await caller.auth.login({
      email: "alice@test.example",
      password: "first-pw-12chars",
    });
    expect(login).toHaveProperty("sessionToken");
    expect(typeof (login as any).sessionToken).toBe("string");
    expect((login as any).user.email).toBe("alice@test.example");
  });

  it("register → requestPasswordReset → resetPasswordWithToken → login with new password", async () => {
    const caller = appRouter.createCaller(publicCtx());
    const db = getTestDb();

    const reg = await caller.auth.register({
      email: "bob@test.example",
      password: "old-pw-12chars",
      name: "Bob",
    });

    // The procedure runs, audits, and (in dev w/o BREVO_API_KEY) the
    // sendEmail call warn-and-no-ops. Asserts the public contract.
    const reqResult = await caller.auth.requestPasswordReset({
      email: "bob@test.example",
    });
    expect(reqResult).toEqual({ success: true });

    // Capture-via-mint: read the passwordHash that's actually persisted
    // and mint the token the same way requestPasswordReset would. This
    // proves resetPasswordWithToken composes against a real-DB hash
    // without coupling to email-template internals.
    const [row] = await db
      .select({ passwordHash: dbUsers.passwordHash })
      .from(dbUsers)
      .where(eq(dbUsers.id, reg.userId))
      .limit(1);
    expect(row?.passwordHash).toBeTruthy();

    const token = await mintResetToken({
      userId: reg.userId,
      passwordHash: row!.passwordHash!,
    });

    const reset = await caller.auth.resetPasswordWithToken({
      token,
      newPassword: "new-pw-12chars",
    });
    expect(reset).toEqual({ success: true });

    const login = await caller.auth.login({
      email: "bob@test.example",
      password: "new-pw-12chars",
    });
    expect(login).toHaveProperty("sessionToken");

    // Old password must no longer authenticate — the rotation rotated.
    await expect(
      caller.auth.login({
        email: "bob@test.example",
        password: "old-pw-12chars",
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("resetPasswordWithToken: token issued before rotation is rejected after another rotation (single-use)", async () => {
    const caller = appRouter.createCaller(publicCtx());
    const db = getTestDb();

    const reg = await caller.auth.register({
      email: "carol@test.example",
      password: "first-pw-12chars",
      name: "Carol",
    });

    const [row1] = await db
      .select({ passwordHash: dbUsers.passwordHash })
      .from(dbUsers)
      .where(eq(dbUsers.id, reg.userId))
      .limit(1);
    expect(row1?.passwordHash).toBeTruthy();

    // T1 is minted against the FIRST passwordHash prefix.
    const t1 = await mintResetToken({
      userId: reg.userId,
      passwordHash: row1!.passwordHash!,
    });

    // First use rotates the hash → its prefix changes → T1's
    // pwHashPrefix claim no longer matches the persisted hash.
    const first = await caller.auth.resetPasswordWithToken({
      token: t1,
      newPassword: "rotated-12char",
    });
    expect(first).toEqual({ success: true });

    // Re-using T1 must now fail because the prefix-baked-into-the-claim
    // was minted from the OLD hash. This is the single-use property we
    // get without a tokens table.
    await expect(
      caller.auth.resetPasswordWithToken({
        token: t1,
        newPassword: "another-pw-12c",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("register → changePassword → login with new password", async () => {
    const publicCaller = appRouter.createCaller(publicCtx());

    const reg = await publicCaller.auth.register({
      email: "dave@test.example",
      password: "first-pw-12chars",
      name: "Dave",
    });

    // changePassword is a protectedProcedure — supply a ctx whose
    // user.id points at the freshly-registered row.
    const userCaller = appRouter.createCaller(
      userCtx(reg.userId, "dave@test.example"),
    );
    const change = await userCaller.auth.changePassword({
      currentPassword: "first-pw-12chars",
      newPassword: "second-pw-12chars",
    });
    expect(change).toEqual({ success: true });

    const login = await publicCaller.auth.login({
      email: "dave@test.example",
      password: "second-pw-12chars",
    });
    expect(login).toHaveProperty("sessionToken");

    await expect(
      publicCaller.auth.login({
        email: "dave@test.example",
        password: "first-pw-12chars",
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("register: rejects domain outside REGISTRATION_ALLOWED_DOMAINS", async () => {
    const caller = appRouter.createCaller(publicCtx());

    await expect(
      caller.auth.register({
        email: "eve@evil.example",
        password: "first-pw-12chars",
        name: "Eve",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
