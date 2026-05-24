import express from "express";
import type { AddressInfo, Server } from "net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Coverage for the auth-session routes that survive in server/_core/oauth.ts
 * after P1.A. The Manus token-exchange routes (/api/oauth/callback and
 * /api/oauth/mobile) were deleted — clients now obtain JWTs directly from
 * Supabase Auth and just present them as bearers. Targets here:
 *   - /api/auth/logout: clears cookie
 *   - /api/auth/me: success returns user; auth failure → 401
 *   - /api/auth/session: requires Bearer; success sets cookie; auth
 *     failure → 401
 */

vi.mock("../server/db", () => ({
  getDb: vi.fn(async () => null),
  getUserByOpenId: vi.fn(async () => ({
    id: 7,
    openId: "oauth-user",
    name: "OAuth User",
    email: "oauth@example.com",
    loginMethod: "google",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  })),
  upsertUser: vi.fn(async () => undefined),
}));

const sdkMocks = {
  authenticateRequest: vi.fn(),
};
vi.mock("../server/_core/sdk", () => ({ sdk: sdkMocks }));

const frontendEnvKeys = [
  "EXPO_WEB_PREVIEW_URL",
  "EXPO_PACKAGER_PROXY_URL",
  "PUBLIC_WEB_URL",
  "WEB_URL",
  "APP_URL",
] as const;

let server: Server | null = null;
let baseUrl = "";

async function bootApp() {
  const { registerOAuthRoutes } = await import("../server/_core/oauth");
  const app = express();
  app.use(express.json());
  registerOAuthRoutes(app);
  server = app.listen(0) as Server;
  const port = (server.address() as AddressInfo).port;
  baseUrl = `http://127.0.0.1:${port}`;
}

beforeEach(() => {
  for (const key of frontendEnvKeys) delete process.env[key];
  process.env.PUBLIC_WEB_URL = "https://app.example.com/";
  process.env.JWT_SECRET = "test-session-secret";
  sdkMocks.authenticateRequest.mockReset();
});

afterEach(async () => {
  if (server) {
    await new Promise<void>(resolve => server!.close(() => resolve()));
    server = null;
    baseUrl = "";
  }
  for (const key of frontendEnvKeys) delete process.env[key];
  vi.restoreAllMocks();
});

describe("/api/auth/logout", () => {
  it("clears the session cookie and returns success", async () => {
    await bootApp();
    const resp = await fetch(`${baseUrl}/api/auth/logout`, { method: "POST" });
    expect(resp.status).toBe(200);
    expect(await resp.json()).toMatchObject({ success: true });
    const setCookie = resp.headers.get("set-cookie");
    expect(setCookie).toMatch(/app_session_id=;/);
  });
});

describe("/api/auth/me", () => {
  it("returns the buildUserResponse-shaped user when authenticated", async () => {
    sdkMocks.authenticateRequest.mockResolvedValueOnce({
      id: 7, openId: "oauth-user", name: "OAuth User", email: "oauth@example.com",
      loginMethod: "google", role: "user", passwordHash: null, pushPreferences: {}, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
    });
    await bootApp();
    const resp = await fetch(`${baseUrl}/api/auth/me`);
    expect(resp.status).toBe(200);
    const body = await resp.json();
    expect(body.user).toBeTruthy();
    expect(body.user.openId).toBe("oauth-user");
  });

  it("returns 401 when authenticateRequest throws (no session)", async () => {
    sdkMocks.authenticateRequest.mockRejectedValueOnce(new Error("no session"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await bootApp();
    const resp = await fetch(`${baseUrl}/api/auth/me`);
    expect(resp.status).toBe(401);
    expect(await resp.json()).toMatchObject({ user: null, error: expect.stringMatching(/Not authenticated/) });
  });
});

describe("/api/auth/session", () => {
  it("returns 400 when Authorization header isn't a Bearer token", async () => {
    sdkMocks.authenticateRequest.mockResolvedValueOnce({
      id: 7, openId: "oauth-user", name: "OAuth User", email: "x@y.z",
      loginMethod: "google", role: "user", passwordHash: null, pushPreferences: {}, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
    });
    await bootApp();
    const resp = await fetch(`${baseUrl}/api/auth/session`, {
      method: "POST",
      // Missing Bearer prefix.
      headers: { authorization: "session-token" },
    });
    expect(resp.status).toBe(400);
    expect(await resp.json()).toMatchObject({ error: expect.stringMatching(/Bearer token required/) });
  });

  it("sets cookie + returns user on success", async () => {
    sdkMocks.authenticateRequest.mockResolvedValueOnce({
      id: 7, openId: "oauth-user", name: "OAuth User", email: "x@y.z",
      loginMethod: "google", role: "user", passwordHash: null, pushPreferences: {}, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
    });
    await bootApp();
    const resp = await fetch(`${baseUrl}/api/auth/session`, {
      method: "POST",
      headers: { authorization: "Bearer session-token" },
    });
    expect(resp.status).toBe(200);
    const body = await resp.json();
    expect(body.success).toBe(true);
    expect(body.user.openId).toBe("oauth-user");
    expect(resp.headers.get("set-cookie")).toMatch(/app_session_id=session-token/);
  });

  it("returns 401 when authenticateRequest throws (invalid bearer)", async () => {
    sdkMocks.authenticateRequest.mockRejectedValueOnce(new Error("bad token"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await bootApp();
    const resp = await fetch(`${baseUrl}/api/auth/session`, {
      method: "POST",
      headers: { authorization: "Bearer garbage" },
    });
    expect(resp.status).toBe(401);
    expect(await resp.json()).toMatchObject({ error: expect.stringMatching(/Invalid token/) });
  });
});
