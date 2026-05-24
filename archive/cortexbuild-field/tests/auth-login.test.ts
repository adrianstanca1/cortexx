import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the DB layer used by auth.login. The login mutation calls
// getUserByEmail and recordLogin from server/db.ts; we stub both. No actual
// Postgres connection is created.
vi.mock("../server/db", () => ({
  getDb: vi.fn(async () => null),
  getUserByEmail: vi.fn(),
  recordLogin: vi.fn(async () => undefined),
}));

type CookieCall = { name: string; value: string; options: Record<string, unknown> };

// Build a minimal TrpcContext that captures any cookies the handler sets and
// optionally pre-populates ctx.user (auth.me's input).
function makeCtx(user: any) {
  const cookies: CookieCall[] = [];
  return {
    cookies,
    ctx: {
      user,
      req: {
        protocol: "https",
        hostname: "api.cortexbuildpro.com",
        headers: {},
      } as any,
      res: {
        cookie: (name: string, value: string, options: Record<string, unknown>) => {
          cookies.push({ name, value, options });
        },
        clearCookie: () => undefined,
      } as any,
    },
  };
}

// auth.login returns { sessionToken, user } on success. Narrow the
// shape once here so individual assertions don't each need a cast.
function assertIssuedSession(
  result: unknown,
): asserts result is { sessionToken: string; user: any } {
  if (
    !result || typeof result !== "object" ||
    typeof (result as any).sessionToken !== "string"
  ) {
    throw new Error(`expected an IssuedSession but got: ${JSON.stringify(result)}`);
  }
}

async function makeUserWithPassword(password: string, overrides: Record<string, unknown> = {}) {
  const { hashPassword } = await import("../server/_core/passwords");
  return {
    id: 7,
    openId: "email:adrian.stanca1@gmail.com",
    email: "adrian.stanca1@gmail.com",
    name: "Adrian Stanca",
    loginMethod: "password",
    role: "admin" as const,
    passwordHash: await hashPassword(password),
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };
}

describe("auth.login → auth.me end-to-end (no DB)", () => {
  beforeEach(async () => {
    // ENV is captured at module load — set the JWT secret BEFORE the routers
    // module is imported by resetting the module cache and re-importing inside
    // each test. Mirrors the pattern in tests/auth-session.test.ts.
    process.env.JWT_SECRET = "test-session-secret";
    process.env.VITE_APP_ID = "test-app";
    vi.resetModules();
    // The login rate-limit module owns a process-wide counter Map. Wipe it
    // so a previous test's failed-login attempts don't bleed over and trip
    // the limiter here. We import dynamically to respect the resetModules()
    // call above.
    const { resetLoginRateLimit } = await import("../server/_core/login-rate-limit");
    resetLoginRateLimit();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("happy path: correct password mints a JWT, sets a cookie, and auth.me returns the user without passwordHash", async () => {
    const password = "test-password-fixture";
    const seedUser = await makeUserWithPassword(password);

    const serverDb = await import("../server/db");
    vi.mocked(serverDb.getUserByEmail).mockResolvedValue(seedUser as any);

    const { appRouter } = await import("../server/routers");
    const { ctx, cookies } = makeCtx(null);
    const caller = appRouter.createCaller(ctx);

    const loginResult = await caller.auth.login({
      email: "adrian.stanca1@gmail.com",
      password,
    });
    assertIssuedSession(loginResult);

    // 1) Login response shape
    expect(loginResult.sessionToken).toBeTypeOf("string");
    expect(loginResult.sessionToken.length).toBeGreaterThan(20);
    expect(loginResult.user).toMatchObject({
      id: 7,
      openId: "email:adrian.stanca1@gmail.com",
      email: "adrian.stanca1@gmail.com",
      role: "admin",
    });
    // The login response surface MUST NOT include passwordHash.
    expect(loginResult.user).not.toHaveProperty("passwordHash");

    // 2) The session cookie was set on the response
    expect(cookies).toHaveLength(1);
    expect(cookies[0]).toMatchObject({ name: expect.any(String), value: loginResult.sessionToken });

    // 3) recordLogin was called for the seeded user
    expect(serverDb.recordLogin).toHaveBeenCalledWith(seedUser.id);

    // 4) Now exercise auth.me with the user populated on ctx (this is what
    //    sdk.authenticateRequest would do for an authenticated request).
    //    It must return a user object without passwordHash.
    const meCaller = appRouter.createCaller(makeCtx(seedUser).ctx);
    const meResult = await meCaller.auth.me();
    expect(meResult).not.toBeNull();
    expect(meResult).not.toHaveProperty("passwordHash");
    expect(meResult).toMatchObject({
      id: 7,
      openId: "email:adrian.stanca1@gmail.com",
      role: "admin",
    });
  }, 15_000);

  it("rejects a wrong password with UNAUTHORIZED and uniform message", async () => {
    const seedUser = await makeUserWithPassword("the-real-input-fixture");

    const serverDb = await import("../server/db");
    vi.mocked(serverDb.getUserByEmail).mockResolvedValue(seedUser as any);

    const { appRouter } = await import("../server/routers");
    const caller = appRouter.createCaller(makeCtx(null).ctx);

    await expect(
      caller.auth.login({ email: "adrian.stanca1@gmail.com", password: "definitely-wrong" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED", message: "Invalid email or password." });

    // No login was recorded for a failed attempt.
    expect(serverDb.recordLogin).not.toHaveBeenCalled();
  });

  it("rejects an unknown email with the SAME message — no enumeration", async () => {
    const serverDb = await import("../server/db");
    vi.mocked(serverDb.getUserByEmail).mockResolvedValue(undefined as any);

    const { appRouter } = await import("../server/routers");
    const caller = appRouter.createCaller(makeCtx(null).ctx);

    await expect(
      caller.auth.login({ email: "ghost@example.com", password: "anything-fixture" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED", message: "Invalid email or password." });
  });

  it("rejects a user whose passwordHash is null (account disabled / OAuth-only)", async () => {
    const seedUser = await makeUserWithPassword("ignored-fixture");
    seedUser.passwordHash = null as any;

    const serverDb = await import("../server/db");
    vi.mocked(serverDb.getUserByEmail).mockResolvedValue(seedUser as any);

    const { appRouter } = await import("../server/routers");
    const caller = appRouter.createCaller(makeCtx(null).ctx);

    await expect(
      caller.auth.login({ email: "adrian.stanca1@gmail.com", password: "anything-fixture" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED", message: "Invalid email or password." });
  });

  it("a single failed login does NOT immediately trip the rate limiter (limit > 1)", async () => {
    // Sanity: with limit=5 and windowMs=15s, one bad password must still
    // surface as UNAUTHORIZED, NOT TOO_MANY_REQUESTS. This guards against a
    // mis-configuration that sets the limit to 1 (or 0) and locks every
    // user out on their first typo.
    const seedUser = await makeUserWithPassword("the-real-input-fixture");

    const serverDb = await import("../server/db");
    vi.mocked(serverDb.getUserByEmail).mockResolvedValue(seedUser as any);

    const { appRouter } = await import("../server/routers");
    const caller = appRouter.createCaller(makeCtx(null).ctx);

    await expect(
      caller.auth.login({ email: "adrian.stanca1@gmail.com", password: "definitely-wrong" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED", message: "Invalid email or password." });

    // The very next attempt with the correct password must still succeed —
    // a single failure should not have burned the entire budget.
    const ok = await caller.auth.login({
      email: "adrian.stanca1@gmail.com",
      password: "the-real-input-fixture",
    });
    assertIssuedSession(ok);
    expect(ok.sessionToken).toBeTypeOf("string");
  });

  it("login succeeds even if the lastSignedIn UPDATE (recordLogin) throws transiently", async () => {
    // Regression: recordLogin used to be awaited before returning, so a
    // transient DB write failure (replica lag, write conflict, brief outage)
    // would surface as a 500 to the client even though the cookie was already
    // set. Now it's fire-and-forget — the response must succeed regardless.
    const password = "test-password-fixture";
    const seedUser = await makeUserWithPassword(password);

    const serverDb = await import("../server/db");
    vi.mocked(serverDb.getUserByEmail).mockResolvedValue(seedUser as any);
    vi.mocked(serverDb.recordLogin).mockRejectedValue(new Error("simulated transient DB failure"));

    const { appRouter } = await import("../server/routers");
    const { ctx, cookies } = makeCtx(null);
    const caller = appRouter.createCaller(ctx);

    // Login MUST succeed despite recordLogin throwing.
    const result = await caller.auth.login({
      email: "adrian.stanca1@gmail.com",
      password,
    });
    assertIssuedSession(result);

    expect(result.sessionToken).toBeTypeOf("string");
    expect(result.user.role).toBe("admin");
    // Cookie was set before the failure point.
    expect(cookies).toHaveLength(1);
    // recordLogin was attempted even though it failed.
    expect(serverDb.recordLogin).toHaveBeenCalledWith(seedUser.id);
  });
});
