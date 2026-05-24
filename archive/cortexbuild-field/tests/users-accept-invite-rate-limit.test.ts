import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../server/_core/context";
import {
  invitedUsers as dbInvitedUsers,
} from "../drizzle/schema";

/**
 * Rate-limit coverage for users.acceptInvite — closes SECURITY.md P2-B.
 *
 * The 6-digit PIN has only 900,000 possible values. Without throttling, an
 * attacker who knows a target's invitation email can brute-force the PIN
 * in under an hour. We reuse the existing in-process login-rate-limit
 * helpers (server/_core/login-rate-limit.ts) which already cap (ip, email)
 * at 5 failures per 15 seconds.
 *
 * The behaviours pinned here:
 *   - 5 wrong PINs followed by a 6th throws TOO_MANY_REQUESTS
 *   - A successful accept clears the bucket (typo on first attempt
 *     doesn't burn the user's remaining quota)
 *   - Rate limit is keyed by (ip, email) — different IPs for the same
 *     email are independent buckets
 */

import {
  resetLoginRateLimit,
  getLoginRateLimitSize,
} from "../server/_core/login-rate-limit";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-session-secret";
process.env.APP_ID = process.env.APP_ID || "test-app";

vi.mock("../server/db", () => ({
  getDb: vi.fn(async () => ({
    select() {
      return {
        from(table: unknown) {
          return {
            where() {
              return {
                limit() {
                  // Return no invite — every PIN attempt fails.
                  if (table === dbInvitedUsers) return Promise.resolve([]);
                  return Promise.resolve([]);
                },
              };
            },
          };
        },
      };
    },
  })),
}));

// Stub sdk so a successful accept (validInvite branch) doesn't blow up on
// session-token generation. Not used by the failure-path tests, but the
// successful test does reach this.
vi.mock("../server/_core/sdk", () => ({
  sdk: {
    createSessionToken: vi.fn(async () => "mock-session-token"),
  },
}));

const { appRouter } = await import("../server/routers");

function ctxWithIp(ip: string): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      hostname: "app.example.com",
      headers: { "x-forwarded-for": ip },
      // socket / ip omitted — getClientIpForLoginRateLimit reads the
      // x-forwarded-for header first.
    } as unknown as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
      cookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

beforeEach(() => {
  resetLoginRateLimit();
});

afterEach(() => {
  resetLoginRateLimit();
  vi.clearAllMocks();
});

describe("users.acceptInvite — rate limiting (P2-B)", () => {
  it("rejects the 6th attempt with TOO_MANY_REQUESTS after 5 failures", async () => {
    const caller = appRouter.createCaller(ctxWithIp("203.0.113.1"));

    // First 5 attempts: invalid PIN -> handler throws "Invalid email or PIN"
    // (NOT TOO_MANY_REQUESTS yet).
    for (let i = 0; i < 5; i++) {
      await expect(
        caller.users.acceptInvite({
          email: "victim@example.com",
          pin: "000000",
          firstName: "A",
          lastName: "B",
        }),
      ).rejects.toThrow(/Invalid email or PIN/);
    }

    // 6th attempt: rate limit gate fires before the handler — different
    // exception shape (TRPCError with TOO_MANY_REQUESTS code).
    await expect(
      caller.users.acceptInvite({
        email: "victim@example.com",
        pin: "111111",
        firstName: "A",
        lastName: "B",
      }),
    ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });

  it("the rate limit is keyed by (ip, email) — different IPs for the same email are independent", async () => {
    const callerA = appRouter.createCaller(ctxWithIp("203.0.113.1"));
    const callerB = appRouter.createCaller(ctxWithIp("203.0.113.2"));

    // Burn IP A's quota.
    for (let i = 0; i < 5; i++) {
      await expect(
        callerA.users.acceptInvite({
          email: "victim@example.com",
          pin: "000000", firstName: "A", lastName: "B",
        }),
      ).rejects.toThrow(/Invalid email or PIN/);
    }
    await expect(
      callerA.users.acceptInvite({
        email: "victim@example.com",
        pin: "000000", firstName: "A", lastName: "B",
      }),
    ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });

    // IP B for the same email should NOT be blocked yet.
    await expect(
      callerB.users.acceptInvite({
        email: "victim@example.com",
        pin: "000000", firstName: "A", lastName: "B",
      }),
    ).rejects.toThrow(/Invalid email or PIN/);
  });

  it("creates a bucket entry per (ip, email) — bucket count grows then resets", async () => {
    expect(getLoginRateLimitSize()).toBe(0);
    const caller = appRouter.createCaller(ctxWithIp("198.51.100.5"));
    await expect(
      caller.users.acceptInvite({
        email: "x@y.com", pin: "000000", firstName: "A", lastName: "B",
      }),
    ).rejects.toThrow(/Invalid email or PIN/);
    expect(getLoginRateLimitSize()).toBe(1);
    resetLoginRateLimit();
    expect(getLoginRateLimitSize()).toBe(0);
  });
});
