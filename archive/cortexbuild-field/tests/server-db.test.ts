import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Re-imported in beforeEach after vi.resetModules() so the spy attaches to the
// same logger instance the freshly-loaded server/db.ts will reference.
let log: typeof import("../server/_core/logger").log;

// We test server/db.ts in isolation by stubbing the two third-party deps it
// touches: `postgres` (the postgres-js client) and `drizzle-orm/postgres-js`
// (which wraps that client into a query builder). The module under test
// caches `_db` and `_client` at module scope, so each test that needs a
// fresh singleton calls `vi.resetModules()` before importing.

// Chainable fake matching drizzle's fluent API:
//   db.select().from(t).where(...).limit(n)        -> awaits to `result`
//   db.insert(t).values(v).onConflictDoUpdate(...) -> awaits to `result`
//   db.update(t).set(v).where(...)                 -> awaits to `result`
// Each step records its argument so tests can assert on what drizzle would
// have built. The chain is itself a thenable so `await` resolves to result.
function makeChainableQuery(result: any, calls?: Record<string, any[]>) {
  const record = (key: string, args: any[]) => {
    if (!calls) return;
    if (!calls[key]) calls[key] = [];
    calls[key].push(args);
  };
  const promise = Promise.resolve(result);
  const chain: any = {
    from: (...args: any[]) => {
      record("from", args);
      return chain;
    },
    where: (...args: any[]) => {
      record("where", args);
      return chain;
    },
    limit: (...args: any[]) => {
      record("limit", args);
      return chain;
    },
    values: (...args: any[]) => {
      record("values", args);
      return chain;
    },
    set: (...args: any[]) => {
      record("set", args);
      return chain;
    },
    onConflictDoUpdate: (...args: any[]) => {
      record("onConflictDoUpdate", args);
      return chain;
    },
    returning: (...args: any[]) => {
      record("returning", args);
      return Promise.resolve(result);
    },
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise),
  };
  return chain;
}

// Holds the per-test fakes so the mocked factory functions can read them
// without being re-defined every time. `vi.mock` is hoisted, so the factory
// closes over this object's identity, not its contents — we mutate fields.
const fakes: {
  postgresImpl: ((url: string, opts: any) => any) | null;
  drizzleImpl: ((client: any) => any) | null;
} = {
  postgresImpl: null,
  drizzleImpl: null,
};

vi.mock("postgres", () => ({
  default: (url: string, opts: any) => {
    if (!fakes.postgresImpl) throw new Error("postgres mock not configured");
    return fakes.postgresImpl(url, opts);
  },
}));

vi.mock("drizzle-orm/postgres-js", () => ({
  drizzle: (client: any) => {
    if (!fakes.drizzleImpl) throw new Error("drizzle mock not configured");
    return fakes.drizzleImpl(client);
  },
}));

// Walk a value recursively and collect every string/number/Date primitive
// into an array, with a seen-set to handle drizzle's PgTable<->PgColumn
// cycles. We use this in place of JSON.stringify when asserting on the
// arguments to where(...), which contain drizzle SQL fragments that point
// back to their parent column.
function collectPrimitives(value: unknown, depth = 0, seen = new WeakSet()): string[] {
  const out: string[] = [];
  if (depth > 10) return out;
  if (value === null || value === undefined) return out;
  if (typeof value === "string") {
    out.push(value);
    return out;
  }
  if (typeof value === "number" || typeof value === "bigint") {
    out.push(String(value));
    return out;
  }
  if (value instanceof Date) {
    out.push(value.toISOString());
    return out;
  }
  if (typeof value === "object") {
    if (seen.has(value as object)) return out;
    seen.add(value as object);
    if (Array.isArray(value)) {
      for (const item of value) out.push(...collectPrimitives(item, depth + 1, seen));
      return out;
    }
    for (const v of Object.values(value as Record<string, unknown>)) {
      out.push(...collectPrimitives(v, depth + 1, seen));
    }
  }
  return out;
}

const ORIGINAL_DATABASE_URL = process.env.DATABASE_URL;

describe("server/db.ts", () => {
  beforeEach(async () => {
    // Fresh singleton state per test.
    vi.resetModules();
    fakes.postgresImpl = null;
    fakes.drizzleImpl = null;
    delete process.env.DATABASE_URL;
    // Import logger AFTER resetModules so it's the same fresh instance that
    // server/db.ts will pick up on its own dynamic import.
    ({ log } = await import("../server/_core/logger"));
    vi.spyOn(log, "warn").mockImplementation(() => undefined);
    vi.spyOn(log, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (ORIGINAL_DATABASE_URL === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = ORIGINAL_DATABASE_URL;
    }
  });

  describe("getDb()", () => {
    it("returns null when DATABASE_URL is unset", async () => {
      const { getDb } = await import("../server/db");
      await expect(getDb()).resolves.toBeNull();
    });

    it("returns the same singleton instance on repeated calls", async () => {
      process.env.DATABASE_URL = "postgres://fake/db";
      const fakeClient = { __id: "client-1" };
      const fakeDb = { __id: "db-1" };
      let postgresCallCount = 0;
      let drizzleCallCount = 0;
      fakes.postgresImpl = () => {
        postgresCallCount += 1;
        return fakeClient;
      };
      fakes.drizzleImpl = () => {
        drizzleCallCount += 1;
        return fakeDb;
      };

      const { getDb } = await import("../server/db");
      const a = await getDb();
      const b = await getDb();

      expect(a).toBe(fakeDb);
      expect(b).toBe(fakeDb);
      // The pool is created exactly once, even across multiple getDb() calls.
      expect(postgresCallCount).toBe(1);
      expect(drizzleCallCount).toBe(1);
    });

    it("returns null and warns when postgres() throws during init", async () => {
      process.env.DATABASE_URL = "postgres://fake/db";
      fakes.postgresImpl = () => {
        throw new Error("connection refused");
      };
      fakes.drizzleImpl = () => ({});

      const { getDb } = await import("../server/db");
      const result = await getDb();
      expect(result).toBeNull();
      expect(log.warn).toHaveBeenCalledWith(
        "[Database] Failed to connect:",
        expect.any(Error),
      );
    });

    it("passes max:10 pool-size option to the postgres client", async () => {
      process.env.DATABASE_URL = "postgres://fake/db";
      const seenOpts: any[] = [];
      fakes.postgresImpl = (_url, opts) => {
        seenOpts.push(opts);
        return { __id: "c" };
      };
      fakes.drizzleImpl = () => ({ __id: "d" });

      const { getDb } = await import("../server/db");
      await getDb();

      expect(seenOpts).toHaveLength(1);
      expect(seenOpts[0]).toEqual({ max: 10 });
    });
  });

  describe("checkDatabaseReady()", () => {
    it("returns missing_database_url when DATABASE_URL is unset", async () => {
      const { checkDatabaseReady } = await import("../server/db");
      const result = await checkDatabaseReady();
      expect(result).toEqual({ ok: false, reason: "missing_database_url" });
    });

    it("returns ok:true on a successful select 1 round-trip", async () => {
      process.env.DATABASE_URL = "postgres://fake/db";
      const execute = vi.fn(async () => [{ "?column?": 1 }]);
      fakes.postgresImpl = () => ({});
      fakes.drizzleImpl = () => ({ execute });

      const { checkDatabaseReady } = await import("../server/db");
      const result = await checkDatabaseReady();

      expect(result).toEqual({ ok: true });
      expect(execute).toHaveBeenCalledTimes(1);
    });

    it("returns database_query_failed when the round-trip throws", async () => {
      process.env.DATABASE_URL = "postgres://fake/db";
      const execute = vi.fn(async () => {
        throw new Error("query timeout");
      });
      fakes.postgresImpl = () => ({});
      fakes.drizzleImpl = () => ({ execute });

      const { checkDatabaseReady } = await import("../server/db");
      const result = await checkDatabaseReady();

      expect(result).toEqual({ ok: false, reason: "database_query_failed" });
      expect(log.error).toHaveBeenCalledWith(
        "[Database] Readiness check failed:",
        expect.any(Error),
      );
    });

    it("returns database_client_unavailable when getDb() yields null", async () => {
      // Set DATABASE_URL so we get past the first guard, but make postgres()
      // throw so getDb() returns null — that's the path that surfaces the
      // 'database_client_unavailable' reason.
      process.env.DATABASE_URL = "postgres://fake/db";
      fakes.postgresImpl = () => {
        throw new Error("boom");
      };
      fakes.drizzleImpl = () => ({});

      const { checkDatabaseReady } = await import("../server/db");
      const result = await checkDatabaseReady();
      expect(result).toEqual({ ok: false, reason: "database_client_unavailable" });
    });
  });

  describe("upsertUser()", () => {
    it("throws when openId is missing", async () => {
      const { upsertUser } = await import("../server/db");
      await expect(upsertUser({} as any)).rejects.toThrow(/openId is required/);
    });

    it("returns silently with a warning when DATABASE_URL is missing", async () => {
      const { upsertUser } = await import("../server/db");
      await expect(upsertUser({ openId: "u-1" } as any)).resolves.toBeUndefined();
      expect(log.warn).toHaveBeenCalledWith(
        "[Database] Cannot upsert user: database not available",
      );
    });

    it("INSERTs full user fields and updates the same fields on conflict", async () => {
      process.env.DATABASE_URL = "postgres://fake/db";
      const calls: Record<string, any[]> = {};
      const insertChain = makeChainableQuery(undefined, calls);
      const insert = vi.fn(() => insertChain);
      fakes.postgresImpl = () => ({});
      fakes.drizzleImpl = () => ({ insert });

      const { upsertUser } = await import("../server/db");
      const lastSignedIn = new Date("2025-01-01T00:00:00Z");
      await upsertUser({
        openId: "u-full",
        name: "Alice",
        email: "alice@example.com",
        loginMethod: "password",
        lastSignedIn,
        role: "admin",
      } as any);

      expect(insert).toHaveBeenCalledTimes(1);
      const valuesArg = calls.values[0][0];
      expect(valuesArg).toMatchObject({
        openId: "u-full",
        name: "Alice",
        email: "alice@example.com",
        loginMethod: "password",
        lastSignedIn,
        role: "admin",
      });
      const conflictArg = calls.onConflictDoUpdate[0][0];
      expect(conflictArg.set).toMatchObject({
        name: "Alice",
        email: "alice@example.com",
        loginMethod: "password",
        lastSignedIn,
        role: "admin",
      });
    });

    it("with only openId provided, defaults lastSignedIn and updateSet contains a single lastSignedIn", async () => {
      process.env.DATABASE_URL = "postgres://fake/db";
      const calls: Record<string, any[]> = {};
      const insertChain = makeChainableQuery(undefined, calls);
      const insert = vi.fn(() => insertChain);
      fakes.postgresImpl = () => ({});
      fakes.drizzleImpl = () => ({ insert });

      const { upsertUser } = await import("../server/db");
      await upsertUser({ openId: "u-min" } as any);

      const valuesArg = calls.values[0][0];
      expect(valuesArg.openId).toBe("u-min");
      // lastSignedIn was auto-defaulted to a Date instance.
      expect(valuesArg.lastSignedIn).toBeInstanceOf(Date);
      // No nullable text fields should have been set.
      expect(valuesArg.name).toBeUndefined();
      expect(valuesArg.email).toBeUndefined();
      expect(valuesArg.loginMethod).toBeUndefined();

      const setArg = calls.onConflictDoUpdate[0][0].set;
      // The minimal-update path: only lastSignedIn is bumped.
      expect(Object.keys(setArg)).toEqual(["lastSignedIn"]);
      expect(setArg.lastSignedIn).toBeInstanceOf(Date);
    });

    it("auto-promotes the OWNER_OPEN_ID to admin when role is unspecified", async () => {
      // ENV.ownerOpenId is captured at module load — set it before importing.
      process.env.OWNER_OPEN_ID = "owner-open-id-fixture";
      process.env.DATABASE_URL = "postgres://fake/db";
      const calls: Record<string, any[]> = {};
      const insertChain = makeChainableQuery(undefined, calls);
      const insert = vi.fn(() => insertChain);
      fakes.postgresImpl = () => ({});
      fakes.drizzleImpl = () => ({ insert });

      const { upsertUser } = await import("../server/db");
      await upsertUser({ openId: "owner-open-id-fixture" } as any);

      const valuesArg = calls.values[0][0];
      const setArg = calls.onConflictDoUpdate[0][0].set;
      expect(valuesArg.role).toBe("admin");
      expect(setArg.role).toBe("admin");
    });

    it("logs and rethrows when the underlying INSERT fails", async () => {
      process.env.DATABASE_URL = "postgres://fake/db";
      const insert = vi.fn(() => {
        throw new Error("constraint violation");
      });
      fakes.postgresImpl = () => ({});
      fakes.drizzleImpl = () => ({ insert });

      const { upsertUser } = await import("../server/db");
      await expect(upsertUser({ openId: "u-fail" } as any)).rejects.toThrow(
        /constraint violation/,
      );
      expect(log.error).toHaveBeenCalledWith(
        "[Database] Failed to upsert user:",
        expect.any(Error),
      );
    });
  });

  describe("getUserByOpenId()", () => {
    it("returns the row when found", async () => {
      process.env.DATABASE_URL = "postgres://fake/db";
      const row = { id: 1, openId: "u-1", role: "user" };
      const select = vi.fn(() => makeChainableQuery([row]));
      fakes.postgresImpl = () => ({});
      fakes.drizzleImpl = () => ({ select });

      const { getUserByOpenId } = await import("../server/db");
      const result = await getUserByOpenId("u-1");
      expect(result).toEqual(row);
    });

    it("returns undefined when no row matches", async () => {
      process.env.DATABASE_URL = "postgres://fake/db";
      const select = vi.fn(() => makeChainableQuery([]));
      fakes.postgresImpl = () => ({});
      fakes.drizzleImpl = () => ({ select });

      const { getUserByOpenId } = await import("../server/db");
      const result = await getUserByOpenId("u-missing");
      expect(result).toBeUndefined();
    });

    it("returns undefined and warns when DB is unavailable", async () => {
      // No DATABASE_URL set -> getDb() resolves to null.
      const { getUserByOpenId } = await import("../server/db");
      const result = await getUserByOpenId("u-1");
      expect(result).toBeUndefined();
      expect(log.warn).toHaveBeenCalledWith(
        "[Database] Cannot get user: database not available",
      );
    });
  });

  describe("getUserByEmail()", () => {
    it("lowercases the input email before passing it to the WHERE clause", async () => {
      process.env.DATABASE_URL = "postgres://fake/db";
      const calls: Record<string, any[]> = {};
      const chain = makeChainableQuery([{ id: 9, email: "mixed@example.com" }], calls);
      const select = vi.fn(() => chain);
      fakes.postgresImpl = () => ({});
      fakes.drizzleImpl = () => ({ select });

      const { getUserByEmail } = await import("../server/db");
      const result = await getUserByEmail("MIXED@Example.COM");

      expect(result).toEqual({ id: 9, email: "mixed@example.com" });
      // The where() arg is drizzle's eq(users.email, lowered). We can't
      // introspect the SQL fragment cleanly without a real driver, so
      // walk the captured arg collecting every primitive and assert the
      // lowercased literal is present and the original-case input is not.
      const primitives = collectPrimitives(calls.where[0]);
      expect(primitives).toContain("mixed@example.com");
      expect(primitives).not.toContain("MIXED@Example.COM");
    });

    it("returns undefined when no row matches", async () => {
      process.env.DATABASE_URL = "postgres://fake/db";
      const select = vi.fn(() => makeChainableQuery([]));
      fakes.postgresImpl = () => ({});
      fakes.drizzleImpl = () => ({ select });

      const { getUserByEmail } = await import("../server/db");
      const result = await getUserByEmail("noone@example.com");
      expect(result).toBeUndefined();
    });

    it("returns undefined and warns when DB is unavailable", async () => {
      const { getUserByEmail } = await import("../server/db");
      const result = await getUserByEmail("anyone@example.com");
      expect(result).toBeUndefined();
      expect(log.warn).toHaveBeenCalledWith(
        "[Database] Cannot get user by email: database not available",
      );
    });
  });

  describe("recordLogin()", () => {
    it("issues an UPDATE that sets lastSignedIn to a Date for the given userId", async () => {
      process.env.DATABASE_URL = "postgres://fake/db";
      const calls: Record<string, any[]> = {};
      const chain = makeChainableQuery(undefined, calls);
      const update = vi.fn(() => chain);
      fakes.postgresImpl = () => ({});
      fakes.drizzleImpl = () => ({ update });

      const { recordLogin } = await import("../server/db");
      await recordLogin(42);

      expect(update).toHaveBeenCalledTimes(1);
      const setArg = calls.set[0][0];
      expect(setArg.lastSignedIn).toBeInstanceOf(Date);
      // The where(...) arg should reference the id we passed in. As with
      // getUserByEmail, we collect primitives instead of JSON.stringify
      // because drizzle SQL fragments hold cyclic table references.
      const primitives = collectPrimitives(calls.where[0]);
      expect(primitives).toContain("42");
    });

    it("resolves silently when DB is unavailable", async () => {
      const { recordLogin } = await import("../server/db");
      await expect(recordLogin(1)).resolves.toBeUndefined();
    });
  });
});
