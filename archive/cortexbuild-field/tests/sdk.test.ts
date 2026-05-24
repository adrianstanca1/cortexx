import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SignJWT } from "jose";
import type { Request } from "express";

// `sdk.ts` reads ENV at module load and constructs a single `axios.create()`
// client at import time. We mock both `axios` and `server/db` BEFORE
// `vi.resetModules()` + dynamic import so the SDK uses our fakes. The pattern
// mirrors `tests/auth-session.test.ts` (sets env, then `vi.resetModules()`,
// then `await import("../server/_core/sdk")`).

type MockAxiosClient = {
  post: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
};

const axiosClient: MockAxiosClient = {
  post: vi.fn(),
  get: vi.fn(),
};

vi.mock("axios", () => {
  const create = vi.fn(() => axiosClient);
  return {
    default: { create },
    create,
  };
});

const dbMocks = {
  getUserByOpenId: vi.fn(),
  upsertUser: vi.fn(),
};

vi.mock("../server/db", () => ({
  getUserByOpenId: (...args: unknown[]) => dbMocks.getUserByOpenId(...args),
  upsertUser: (...args: unknown[]) => dbMocks.upsertUser(...args),
}));

const SECRET = "sdk-coverage-test-secret";
const APP_ID = "cortexbuild-field";

async function loadSdk() {
  process.env.JWT_SECRET = SECRET;
  process.env.VITE_APP_ID = APP_ID;
  process.env.OAUTH_SERVER_URL = "https://oauth.example.test";
  vi.resetModules();
  const mod = await import("../server/_core/sdk");
  return mod.sdk;
}

beforeEach(() => {
  axiosClient.post.mockReset();
  axiosClient.get.mockReset();
  dbMocks.getUserByOpenId.mockReset();
  dbMocks.upsertUser.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("sdk.parseCookies (via authenticateRequest cookie path)", () => {
  it("returns an empty session map when no Cookie header is set", async () => {
    const sdk = await loadSdk();
    // No cookie + no bearer -> verifySession sees undefined -> ForbiddenError.
    await expect(
      sdk.authenticateRequest({ headers: {} } as unknown as Request),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("ignores malformed cookie entries and only returns parseable ones", async () => {
    const sdk = await loadSdk();
    // Cookie with garbage entries plus a malformed app_session_id (not a JWT).
    // The malformed value reaches verifySession which then returns null and
    // authenticateRequest throws.
    await expect(
      sdk.authenticateRequest({
        headers: { cookie: "garbage; =empty; app_session_id=not.a.jwt" },
      } as unknown as Request),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe("sdk.getSessionSecret + signSession + verifySession round-trip", () => {
  it("derives a usable HS256 secret from ENV.cookieSecret", async () => {
    const sdk = await loadSdk();
    const token = await sdk.signSession({
      openId: "u-1",
      appId: APP_ID,
      name: "Alice",
    });
    expect(token.split(".")).toHaveLength(3);

    const decoded = await sdk.verifySession(token);
    expect(decoded).toEqual({
      openId: "u-1",
      appId: APP_ID,
      name: "Alice",
    });
  });

  it("rejects tokens signed with a different secret", async () => {
    const sdk = await loadSdk();
    const forged = await new SignJWT({
      openId: "attacker",
      appId: APP_ID,
      name: "Mallory",
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(Math.floor(Date.now() / 1000) + 60)
      .sign(new TextEncoder().encode("a-different-secret"));
    expect(await sdk.verifySession(forged)).toBeNull();
  });

  it("returns null for an expired token", async () => {
    const sdk = await loadSdk();
    const expired = await sdk.signSession(
      { openId: "u-2", appId: APP_ID, name: "Bob" },
      { expiresInMs: -1000 },
    );
    expect(await sdk.verifySession(expired)).toBeNull();
  });

  it("returns null when openId or appId is missing in payload", async () => {
    const sdk = await loadSdk();
    const noOpenId = await new SignJWT({ appId: APP_ID, name: "x" })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(Math.floor(Date.now() / 1000) + 60)
      .sign(new TextEncoder().encode(SECRET));
    expect(await sdk.verifySession(noOpenId)).toBeNull();

    const noAppId = await new SignJWT({ openId: "u-3", name: "x" })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(Math.floor(Date.now() / 1000) + 60)
      .sign(new TextEncoder().encode(SECRET));
    expect(await sdk.verifySession(noAppId)).toBeNull();
  });

  it("returns null with a warning for null/undefined cookie value", async () => {
    const sdk = await loadSdk();
    // loadSdk calls vi.resetModules() so we must import log AFTER it to spy on
    // the same instance the freshly-loaded sdk.ts references.
    const { log: freshLog } = await import("../server/_core/logger");
    const warn = vi.spyOn(freshLog, "warn").mockImplementation(() => {});
    expect(await sdk.verifySession(undefined)).toBeNull();
    expect(await sdk.verifySession(null)).toBeNull();
    expect(warn).toHaveBeenCalled();
  });
});

describe("sdk.createSessionToken", () => {
  it("uses safeName from `options.name`", async () => {
    const sdk = await loadSdk();
    const token = await sdk.createSessionToken("u-4", { name: "Charlie" });
    const decoded = await sdk.verifySession(token);
    expect(decoded).toEqual({
      openId: "u-4",
      appId: APP_ID,
      name: "Charlie",
    });
  });

  it("falls back to openId when name is empty/whitespace", async () => {
    const sdk = await loadSdk();
    const a = await sdk.createSessionToken("u-5");
    const b = await sdk.createSessionToken("u-6", { name: "   " });
    expect((await sdk.verifySession(a))!.name).toBe("u-5");
    expect((await sdk.verifySession(b))!.name).toBe("u-6");
  });

  it("encodes ENV.appId so cross-app tokens won't validate as ours", async () => {
    const sdk = await loadSdk();
    const token = await sdk.createSessionToken("u-7", { name: "Dana" });
    const decoded = await sdk.verifySession(token);
    expect(decoded!.appId).toBe(APP_ID);
  });
});

describe("sdk.getUserInfoWithJwt", () => {
  it("posts to the JWT user-info endpoint with ENV.appId as projectId", async () => {
    const sdk = await loadSdk();
    axiosClient.post.mockResolvedValueOnce({
      data: {
        openId: "u-8",
        projectId: APP_ID,
        name: "Eve",
        email: "eve@example.test",
        platform: "REGISTERED_PLATFORM_GOOGLE",
      },
    });

    const result = await sdk.getUserInfoWithJwt("the-jwt");
    expect(axiosClient.post).toHaveBeenCalledWith(
      "/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt",
      { jwtToken: "the-jwt", projectId: APP_ID },
    );
    expect(result).toMatchObject({
      openId: "u-8",
      name: "Eve",
      email: "eve@example.test",
      // platform was already set, so loginMethod uses that fallback verbatim.
      platform: "REGISTERED_PLATFORM_GOOGLE",
      loginMethod: "REGISTERED_PLATFORM_GOOGLE",
    });
  });

  it("derives loginMethod from `platforms` array when no explicit platform", async () => {
    const sdk = await loadSdk();
    axiosClient.post.mockResolvedValueOnce({
      data: {
        openId: "u-9",
        projectId: APP_ID,
        name: "Frank",
        platform: null,
        platforms: ["REGISTERED_PLATFORM_GOOGLE", "REGISTERED_PLATFORM_EMAIL"],
      },
    });

    const result = await sdk.getUserInfoWithJwt("jwt-x");
    // EMAIL takes precedence over GOOGLE per the deriveLoginMethod chain.
    expect(result.loginMethod).toBe("email");
    expect(result.platform).toBe("email");
  });

  it("bubbles errors from the underlying client", async () => {
    const sdk = await loadSdk();
    axiosClient.post.mockRejectedValueOnce(new Error("network down"));
    await expect(sdk.getUserInfoWithJwt("jwt-y")).rejects.toThrow("network down");
  });
});

describe("sdk.exchangeCodeForToken / sdk.getUserInfo", () => {
  it("exchangeCodeForToken posts the OAuth payload (state base64-decoded into redirectUri)", async () => {
    const sdk = await loadSdk();
    const redirectUri = "https://app.example.test/oauth/callback";
    const state = Buffer.from(redirectUri).toString("base64");
    axiosClient.post.mockResolvedValueOnce({
      data: {
        accessToken: "atoken",
        tokenType: "Bearer",
        expiresIn: 3600,
        scope: "openid",
        idToken: "idtoken",
      },
    });

    const result = await sdk.exchangeCodeForToken("the-code", state);
    expect(axiosClient.post).toHaveBeenCalledWith(
      "/webdev.v1.WebDevAuthPublicService/ExchangeToken",
      {
        clientId: APP_ID,
        grantType: "authorization_code",
        code: "the-code",
        redirectUri,
      },
    );
    expect(result.accessToken).toBe("atoken");
  });

  it("getUserInfo posts accessToken and merges loginMethod onto the response", async () => {
    const sdk = await loadSdk();
    axiosClient.post.mockResolvedValueOnce({
      data: {
        openId: "u-10",
        projectId: APP_ID,
        name: "Gina",
        platforms: ["REGISTERED_PLATFORM_APPLE"],
        platform: null,
      },
    });

    const result = await sdk.getUserInfo("the-access-token");
    expect(axiosClient.post).toHaveBeenCalledWith(
      "/webdev.v1.WebDevAuthPublicService/GetUserInfo",
      { accessToken: "the-access-token" },
    );
    expect(result.loginMethod).toBe("apple");
    expect(result.platform).toBe("apple");
  });

  it("bubbles errors from getUserInfo", async () => {
    const sdk = await loadSdk();
    axiosClient.post.mockRejectedValueOnce(new Error("oauth 500"));
    await expect(sdk.getUserInfo("bad-token")).rejects.toThrow("oauth 500");
  });
});

// Removed in P1.A: sdk.authenticateRequest no longer verifies HS256
// session cookies or syncs users from Manus OAuth. It now delegates to
// verifySupabaseJwt (covered by tests/auth-supabase.test.ts) and just
// upserts on first sight. The remaining sdk-level helpers exercised
// above (parseCookies, signSession/verifySession round-trip,
// createSessionToken, getUserInfoWithJwt, exchangeCodeForToken/getUserInfo)
// stay because they're used by the password-login flow and as
// (currently unused) Manus client surface kept for reference.
