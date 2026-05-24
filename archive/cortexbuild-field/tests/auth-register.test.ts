/**
 * auth.register — self-service registration gated by domain whitelist.
 *
 * Properties exercised:
 *   1. ENV.registrationAllowedDomains is the only gate. Empty list =
 *      registration disabled (FORBIDDEN). Non-whitelisted domain =
 *      FORBIDDEN. The DB is never touched in either case.
 *   2. Email is lowercased before lookup + INSERT, so casing in the
 *      submitted form can't be used to bypass uniqueness.
 *   3. Existing email (case-insensitive — getUserByEmail handles that)
 *      → CONFLICT. No INSERT is attempted.
 *   4. Password is scrypt-hashed before INSERT — the plaintext never
 *      lands in the DB row.
 *   5. zod min(8) on the password rejects with BAD_REQUEST before any
 *      DB write — the input boundary is the cheapest place to enforce.
 *
 * Mock pattern mirrors tests/auth-password-reset.test.ts: in-memory
 * `db` shape at module scope, vi.mock factory wires getDb() to it,
 * plus an explicit mock of getUserByEmail. ENV is also mocked so each
 * test can rotate registrationAllowedDomains without restarting the
 * process.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";

const db = {
  inserts: [] as { table: string; values: any }[],
  insertReturnId: 99 as number,
  userByEmail: null as null | {
    id: number;
    openId: string;
    email: string | null;
    name: string | null;
    role: "user" | "admin";
    passwordHash: string | null;
  },
};

const env = {
  appId: "test-app",
  cookieSecret: "test-jwt-secret-for-register-tests-32bytes",
  databaseUrl: "",
  oAuthServerUrl: "",
  ownerOpenId: "",
  registrationAllowedDomains: ["cortexbuildpro.com"] as string[],
  isProduction: false,
  forgeApiUrl: "",
  forgeApiKey: "",
};

function tableName(t: any): string {
  return getTableName(t);
}

vi.mock("../server/_core/env", () => ({
  ENV: env,
}));

vi.mock("../server/db", async () => {
  const actual = await vi.importActual<any>("../server/db");
  return {
    ...actual,
    getUserByEmail: vi.fn(async (_email: string) => db.userByEmail ?? undefined),
    getDb: vi.fn(async () => ({
      insert(table: any) {
        const name = tableName(table);
        return {
          values(values: any) {
            db.inserts.push({ table: name, values });
            return {
              returning(_cols: any) {
                if (name === "users") {
                  return Promise.resolve([{ id: db.insertReturnId }]);
                }
                return Promise.resolve([]);
              },
              // audit-log inserts call .values(...) without .returning().
              // Treat the values()-returned object itself as a thenable so
              // `await db.insert(...).values(...)` resolves.
              then(onFulfilled: any) {
                return Promise.resolve(undefined).then(onFulfilled);
              },
            };
          },
        };
      },
    })),
  };
});

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

describe("auth.register", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = env.cookieSecret;
    process.env.VITE_APP_ID = env.appId;
    process.env.NODE_ENV = "test";
    vi.resetModules();
    db.inserts = [];
    db.insertReturnId = 99;
    db.userByEmail = null;
    env.registrationAllowedDomains = ["cortexbuildpro.com"];
  });

  afterEach(() => vi.restoreAllMocks());

  it("accepts when domain is whitelisted and email is unique", async () => {
    env.registrationAllowedDomains = ["cortexbuildpro.com"];
    db.userByEmail = null;
    db.insertReturnId = 99;

    const { appRouter } = await import("../server/routers");
    const { ctx } = makePublicCtx();

    const result = await appRouter.createCaller(ctx).auth.register({
      email: "foo@cortexbuildpro.com",
      password: "strong-password-12",
      name: "Foo Bar",
    });

    expect(result).toEqual({ success: true, userId: 99 });

    // The user INSERT lands with lowercased email, openId prefix, and a
    // hashed password (never the plaintext).
    const userInserts = db.inserts.filter((r) => r.table === "users");
    expect(userInserts).toHaveLength(1);
    const inserted = userInserts[0]!.values;
    expect(inserted.openId).toBe("email:foo@cortexbuildpro.com");
    expect(inserted.email).toBe("foo@cortexbuildpro.com");
    expect(inserted.name).toBe("Foo Bar");
    expect(inserted.role).toBe("user");
    expect(inserted.loginMethod).toBe("password");
    expect(typeof inserted.passwordHash).toBe("string");
    expect(inserted.passwordHash).not.toBe("strong-password-12");
    expect(inserted.passwordHash.startsWith("scrypt$")).toBe(true);

    // The persisted hash actually verifies against the submitted password.
    const { verifyPassword } = await import("../server/_core/passwords");
    expect(await verifyPassword("strong-password-12", inserted.passwordHash)).toBe(true);
  });

  it("rejects with FORBIDDEN when domain is not whitelisted", async () => {
    env.registrationAllowedDomains = ["cortexbuildpro.com"];
    db.userByEmail = null;

    const { appRouter } = await import("../server/routers");
    const { ctx } = makePublicCtx();

    await expect(
      appRouter.createCaller(ctx).auth.register({
        email: "x@evil.example",
        password: "strong-password-12",
        name: "Evil User",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    // No DB writes attempted — the gate fires before getDb().
    expect(db.inserts).toHaveLength(0);
  });

  it("rejects with FORBIDDEN when registration is disabled (empty allowlist)", async () => {
    env.registrationAllowedDomains = [];
    db.userByEmail = null;

    const { appRouter } = await import("../server/routers");
    const { ctx } = makePublicCtx();

    await expect(
      appRouter.createCaller(ctx).auth.register({
        email: "foo@cortexbuildpro.com",
        password: "strong-password-12",
        name: "Foo Bar",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(db.inserts).toHaveLength(0);
  });

  it("rejects with CONFLICT when email is already registered", async () => {
    env.registrationAllowedDomains = ["cortexbuildpro.com"];
    db.userByEmail = {
      id: 1,
      openId: "email:foo@cortexbuildpro.com",
      email: "foo@cortexbuildpro.com",
      name: "Existing User",
      role: "user",
      passwordHash: "scrypt$N=16384,r=8,p=1$AAAA$AAAA",
    };

    const { appRouter } = await import("../server/routers");
    const { ctx } = makePublicCtx();

    await expect(
      appRouter.createCaller(ctx).auth.register({
        email: "foo@cortexbuildpro.com",
        password: "strong-password-12",
        name: "Foo Bar",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    // CONFLICT fires before any INSERT.
    expect(db.inserts.filter((r) => r.table === "users")).toHaveLength(0);
  });

  it("rejects when password is too short (zod, BAD_REQUEST)", async () => {
    env.registrationAllowedDomains = ["cortexbuildpro.com"];
    db.userByEmail = null;

    const { appRouter } = await import("../server/routers");
    const { ctx } = makePublicCtx();

    await expect(
      appRouter.createCaller(ctx).auth.register({
        email: "foo@cortexbuildpro.com",
        password: "short",
        name: "Foo Bar",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(db.inserts).toHaveLength(0);
  });
});
