import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";

import {
  LOGIN_RATE_LIMIT,
  consumeLoginAttempt,
  getLoginRateLimitSize,
  resetLoginRateLimit,
} from "../server/_core/login-rate-limit";

// The login rate-limit module owns a process-wide Map. Wipe it before each
// test so case order doesn't matter.
beforeEach(() => {
  resetLoginRateLimit();
});

describe("login-rate-limit (unit)", () => {
  it("allows up to LOGIN_RATE_LIMIT.limit calls within the window", () => {
    for (let i = 0; i < LOGIN_RATE_LIMIT.limit; i++) {
      const result = consumeLoginAttempt("1.2.3.4", "user@example.com");
      expect(result.allowed).toBe(true);
    }
  });

  it("the (limit+1)th call within the window is blocked", () => {
    for (let i = 0; i < LOGIN_RATE_LIMIT.limit; i++) {
      consumeLoginAttempt("1.2.3.4", "user@example.com");
    }
    const blocked = consumeLoginAttempt("1.2.3.4", "user@example.com");
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) {
      // retryAfterMs should be positive and bounded by the window length.
      expect(blocked.retryAfterMs).toBeGreaterThan(0);
      expect(blocked.retryAfterMs).toBeLessThanOrEqual(LOGIN_RATE_LIMIT.windowMs);
    }
  });

  it("after the window expires, the counter resets and calls succeed again", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < LOGIN_RATE_LIMIT.limit; i++) {
      consumeLoginAttempt("1.2.3.4", "user@example.com", t0);
    }
    // Still inside window: blocked.
    expect(consumeLoginAttempt("1.2.3.4", "user@example.com", t0 + 1).allowed).toBe(false);

    // After the window: allowed again.
    const past = t0 + LOGIN_RATE_LIMIT.windowMs + 1;
    const result = consumeLoginAttempt("1.2.3.4", "user@example.com", past);
    expect(result.allowed).toBe(true);

    // And we should once again get the full quota in the new window.
    for (let i = 1; i < LOGIN_RATE_LIMIT.limit; i++) {
      expect(consumeLoginAttempt("1.2.3.4", "user@example.com", past + i).allowed).toBe(true);
    }
    expect(consumeLoginAttempt("1.2.3.4", "user@example.com", past + 100).allowed).toBe(false);
  });

  it("counts (ip, email) tuples independently", () => {
    // Burn the budget for one tuple…
    for (let i = 0; i < LOGIN_RATE_LIMIT.limit; i++) {
      consumeLoginAttempt("1.2.3.4", "alice@example.com");
    }
    expect(consumeLoginAttempt("1.2.3.4", "alice@example.com").allowed).toBe(false);

    // …a different email from the same IP must still have its full budget.
    expect(consumeLoginAttempt("1.2.3.4", "bob@example.com").allowed).toBe(true);

    // …and the same email from a different IP also has its full budget.
    expect(consumeLoginAttempt("9.9.9.9", "alice@example.com").allowed).toBe(true);
  });

  it("treats email comparison as case-insensitive (Login@x.com == login@x.com)", () => {
    for (let i = 0; i < LOGIN_RATE_LIMIT.limit; i++) {
      consumeLoginAttempt("1.2.3.4", "User@Example.com");
    }
    // Different casing must still hit the same bucket.
    expect(consumeLoginAttempt("1.2.3.4", "user@example.com").allowed).toBe(false);
  });

  it("uses fake timers to advance through the window cleanly", () => {
    // Demonstrate the same reset behaviour using vi.useFakeTimers() — the
    // production helper accepts an injectable `now`, but the default path
    // (Date.now()) must also work as expected when time really advances.
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
      for (let i = 0; i < LOGIN_RATE_LIMIT.limit; i++) {
        expect(consumeLoginAttempt("1.2.3.4", "ft@example.com").allowed).toBe(true);
      }
      expect(consumeLoginAttempt("1.2.3.4", "ft@example.com").allowed).toBe(false);

      // Advance past the window — bucket must reset.
      vi.advanceTimersByTime(LOGIN_RATE_LIMIT.windowMs + 1);
      expect(consumeLoginAttempt("1.2.3.4", "ft@example.com").allowed).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("caps the bucket store at LOGIN_RATE_LIMIT.maxBuckets to defend against email-flood DoS", () => {
    // Simulate an attacker varying the email to mint unique keys forever.
    // Without eviction the store would grow without bound; with the cap +
    // expired-sweep + LRU fallback, size must stay <= maxBuckets.
    const cap = LOGIN_RATE_LIMIT.maxBuckets;

    // Phase 1: fill the store with `cap` "expired" entries (resetAt in the past).
    // We do this by stamping each call at t=0 with a tiny windowMs so they're
    // already past their resetAt by the time we cross the cap.
    const baseNow = 1_000_000;
    for (let i = 0; i < cap; i++) {
      // Different email per iteration → unique keys.
      consumeLoginAttempt("1.2.3.4", `flood-${i}@example.com`, baseNow);
    }
    expect(getLoginRateLimitSize()).toBe(cap);

    // Phase 2: cross the cap. The first new insert must trigger eviction.
    // We pass `now` past every existing bucket's resetAt → expired sweep
    // should reclaim them, and the size after must be 1 (just the new entry).
    const future = baseNow + LOGIN_RATE_LIMIT.windowMs + 1;
    consumeLoginAttempt("1.2.3.4", "fresh@example.com", future);
    expect(getLoginRateLimitSize()).toBe(1);
  });

  it("falls back to LRU eviction when no buckets are expired and the cap is hit", () => {
    const cap = LOGIN_RATE_LIMIT.maxBuckets;
    const baseNow = 2_000_000;

    // Fill the store with `cap` LIVE buckets (all resetAt in the future).
    for (let i = 0; i < cap; i++) {
      consumeLoginAttempt("9.9.9.9", `live-${i}@example.com`, baseNow);
    }
    expect(getLoginRateLimitSize()).toBe(cap);

    // One more insert at the SAME `now` → no buckets are expired, so the
    // expired-sweep reclaims 0. The LRU fallback must drop one entry,
    // leaving the size at exactly the cap.
    consumeLoginAttempt("9.9.9.9", "overflow@example.com", baseNow);
    expect(getLoginRateLimitSize()).toBe(cap);
  });
});

// ---------------------------------------------------------------------------
// Integration: the auth.login mutation actually throws TOO_MANY_REQUESTS once
// the limit is exceeded. We mock the DB so the password verifier path is
// reached, then call the mutation limit+1 times with the same (ip, email).
// ---------------------------------------------------------------------------

vi.mock("../server/db", () => ({
  getDb: vi.fn(async () => null),
  getUserByEmail: vi.fn(),
  recordLogin: vi.fn(async () => undefined),
}));

function makeCtx(ip: string) {
  return {
    user: null,
    req: {
      protocol: "https",
      hostname: "api.cortexbuildpro.com",
      ip,
      headers: {} as Record<string, string | string[] | undefined>,
    } as any,
    res: {
      cookie: () => undefined,
      clearCookie: () => undefined,
    } as any,
  };
}

describe("auth.login → rate limiter integration", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-session-secret";
    process.env.VITE_APP_ID = "test-app";
    vi.resetModules();
    resetLoginRateLimit();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns UNAUTHORIZED for the first `limit` failed logins, then TOO_MANY_REQUESTS", async () => {
    const serverDb = await import("../server/db");
    // No such user → password check fails uniformly.
    vi.mocked(serverDb.getUserByEmail).mockResolvedValue(undefined as any);

    const { appRouter } = await import("../server/routers");
    // resetModules above swapped the module instance — wipe again so the
    // freshly-loaded module's bucket Map starts empty.
    const { resetLoginRateLimit: resetFresh } = await import("../server/_core/login-rate-limit");
    resetFresh();

    const caller = appRouter.createCaller(makeCtx("203.0.113.5"));

    // First `limit` attempts each fail with UNAUTHORIZED.
    for (let i = 0; i < LOGIN_RATE_LIMIT.limit; i++) {
      await expect(
        caller.auth.login({ email: "victim@example.com", password: "wrong-fixture" }),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    }

    // The next attempt is rejected by the limiter BEFORE the password check.
    let captured: unknown = null;
    try {
      await caller.auth.login({ email: "victim@example.com", password: "wrong-fixture" });
    } catch (err) {
      captured = err;
    }
    expect(captured).toBeInstanceOf(TRPCError);
    expect(captured).toMatchObject({
      code: "TOO_MANY_REQUESTS",
      message: "Too many login attempts. Please try again shortly.",
    });
  });

  it("uses x-forwarded-for when present, so attempts from the same upstream IP share a bucket", async () => {
    const serverDb = await import("../server/db");
    vi.mocked(serverDb.getUserByEmail).mockResolvedValue(undefined as any);

    const { appRouter } = await import("../server/routers");
    const { resetLoginRateLimit: resetFresh } = await import("../server/_core/login-rate-limit");
    resetFresh();

    // Simulate two requests with different `req.ip` but the same forwarded
    // client IP — they MUST share a bucket.
    function ctxWithFwd(reqIp: string, fwd: string) {
      return {
        user: null,
        req: {
          protocol: "https",
          hostname: "api.cortexbuildpro.com",
          ip: reqIp,
          headers: { "x-forwarded-for": fwd },
        } as any,
        res: { cookie: () => undefined, clearCookie: () => undefined } as any,
      };
    }

    for (let i = 0; i < LOGIN_RATE_LIMIT.limit; i++) {
      const caller = appRouter.createCaller(ctxWithFwd(`10.0.0.${i}`, "198.51.100.42"));
      await expect(
        caller.auth.login({ email: "shared@example.com", password: "wrong-fixture" }),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    }

    const finalCaller = appRouter.createCaller(ctxWithFwd("10.0.0.99", "198.51.100.42"));
    await expect(
      finalCaller.auth.login({ email: "shared@example.com", password: "wrong-fixture" }),
    ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });
});
