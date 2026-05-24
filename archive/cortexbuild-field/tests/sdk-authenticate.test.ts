import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SignJWT } from "jose";
import type { Request } from "express";

/**
 * Coverage for the SDK's authenticateRequest path and the related
 * getUserInfoWithJwt helper. Companion to sdk-jwt.test.ts, which
 * pinned signSession / verifySession / createSessionToken. The flow
 * here is:
 *   - extract bearer token or session cookie
 *   - verifySession (already tested elsewhere)
 *   - DB lookup by openId; if missing, sync from OAuth and upsert
 *   - record lastSignedIn
 *
 * Critical because EVERY protected/admin tRPC procedure routes
 * through this method. Was previously around 49% covered because
 * the unit tests stopped at signSession/verifySession.
 */

// JWT_SECRET set BEFORE the SDK module loads so signSession + verifySession
// agree on the same HMAC.
process.env.JWT_SECRET = "sdk-auth-test-secret";
process.env.VITE_APP_ID = "cortexbuild-field";

// Mock the db module so we can drive getUserByOpenId / upsertUser
// behaviour from inside each test. Module factory runs once per
// vi.resetModules cycle.
const dbMocks = {
  getUserByOpenId: vi.fn(),
  upsertUser: vi.fn(),
};
vi.mock("../server/db", () => dbMocks);

// Pull the SDK after the mock is registered.
const { sdk } = await import("../server/_core/sdk");

function reqWith(headers: Record<string, string | undefined>): Request {
  return { headers } as unknown as Request;
}

beforeEach(() => {
  dbMocks.getUserByOpenId.mockReset();
  dbMocks.upsertUser.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Post-P1.A, sdk.authenticateRequest dispatches on the JWT alg header:
//   - RS256 → verifySupabaseJwt (covered by tests/auth-supabase.test.ts)
//   - HS256 → this.verifySession (the local JWT_SECRET path used by auth.login)
// The HS256 fallback was dropped wholesale in 5ec81d7, breaking the local-
// password login flow that mints HS256 cookies via sdk.createSessionToken;
// these tests pin the dual-path dispatcher so that mistake doesn't recur.

describe("sdk.authenticateRequest — HS256 (local) cookie path", () => {
  const baseUser = {
    id: 42,
    openId: "local-user-1",
    name: "Locally Authed",
    email: "local@example.com",
    loginMethod: "password",
    role: "user" as const,
    passwordHash: "scrypt$..",
    pushPreferences: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  it("authenticates a request bearing a cookie minted by sdk.createSessionToken", async () => {
    // The cookie auth.login sets is exactly what sdk.createSessionToken returns.
    const sessionToken = await sdk.createSessionToken("local-user-1", { name: "Locally Authed" });
    dbMocks.getUserByOpenId.mockResolvedValueOnce(baseUser);
    dbMocks.upsertUser.mockResolvedValueOnce(undefined);

    const req = reqWith({ cookie: `app_session_id=${sessionToken}` });
    const user = await sdk.authenticateRequest(req);

    expect(user.openId).toBe("local-user-1");
    expect(dbMocks.getUserByOpenId).toHaveBeenCalledWith("local-user-1");
    // lastSignedIn is bumped on every authed request
    expect(dbMocks.upsertUser).toHaveBeenCalledWith(
      expect.objectContaining({ openId: "local-user-1" }),
    );
  });

  it("rejects an HS256 cookie with the wrong signature", async () => {
    // Sign directly with a foreign secret so verifySession's HMAC check fails.
    const foreignKey = new TextEncoder().encode("a-different-secret");
    const badToken = await new SignJWT({ openId: "user-x", appId: "cortexbuild-field" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("1h")
      .sign(foreignKey);

    const req = reqWith({ cookie: `app_session_id=${badToken}` });
    await expect(sdk.authenticateRequest(req)).rejects.toThrow(/Invalid session cookie/);
  });

  it("rejects when no bearer token and no session cookie are present", async () => {
    const req = reqWith({});
    await expect(sdk.authenticateRequest(req)).rejects.toThrow(/No bearer token or session cookie/);
  });
});

describe("sdk.getUserInfoWithJwt", () => {
  it("POSTs the jwt + appId payload and folds platforms into loginMethod", async () => {
    // Reach into the SDK's private axios client to mock the upstream call.
    const mockPost = vi.fn().mockResolvedValue({
      data: {
        openId: "user-1", name: "Alice", email: "a@x.com",
        platforms: ["REGISTERED_PLATFORM_GOOGLE"],
        platform: null,
      },
    });
    // @ts-expect-error — reach into the private client for stubbing
    sdk.client = { post: mockPost };

    const info = await sdk.getUserInfoWithJwt("token-abc");
    expect(mockPost).toHaveBeenCalledWith(
      "/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt",
      expect.objectContaining({ jwtToken: "token-abc" }),
    );
    expect(info.loginMethod).toBe("google");
    expect(info.platform).toBe("google");
  });

  it("derives 'email' / 'apple' / 'microsoft' / 'github' from platforms", async () => {
    const cases: [string, string][] = [
      ["REGISTERED_PLATFORM_EMAIL", "email"],
      ["REGISTERED_PLATFORM_APPLE", "apple"],
      ["REGISTERED_PLATFORM_MICROSOFT", "microsoft"],
      ["REGISTERED_PLATFORM_AZURE", "microsoft"],
      ["REGISTERED_PLATFORM_GITHUB", "github"],
    ];
    for (const [platformConst, expected] of cases) {
      const mockPost = vi.fn().mockResolvedValue({
        data: { openId: "u", name: "X", email: null, platforms: [platformConst], platform: null },
      });
      // @ts-expect-error
      sdk.client = { post: mockPost };
      const info = await sdk.getUserInfoWithJwt("t");
      expect(info.loginMethod).toBe(expected);
    }
  });

  it("falls back to `platform` field when no platforms array is provided", async () => {
    const mockPost = vi.fn().mockResolvedValue({
      data: { openId: "u", name: "X", email: null, platform: "manus" },
    });
    // @ts-expect-error
    sdk.client = { post: mockPost };
    const info = await sdk.getUserInfoWithJwt("t");
    expect(info.loginMethod).toBe("manus");
  });

  it("returns null loginMethod when neither field is populated", async () => {
    const mockPost = vi.fn().mockResolvedValue({
      data: { openId: "u", name: "X", email: null, platforms: [], platform: null },
    });
    // @ts-expect-error
    sdk.client = { post: mockPost };
    const info = await sdk.getUserInfoWithJwt("t");
    expect(info.loginMethod).toBeNull();
  });
});
