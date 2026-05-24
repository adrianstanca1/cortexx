import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

/**
 * Coverage for `server/_core/context.ts` — the per-request tRPC
 * context factory. Public procedures expect `ctx.user === null` for
 * unauthenticated callers (auth is optional). Protected procedures
 * branch on the same field. So:
 *
 *   - if sdk.authenticateRequest succeeds, ctx.user is the User row
 *   - if it throws (no/invalid session), ctx.user is null — NOT a
 *     re-thrown error, otherwise public procedures would 500
 */

const sdkMocks = {
  authenticateRequest: vi.fn(),
};
vi.mock("../server/_core/sdk", () => ({ sdk: sdkMocks }));

const { createContext } = await import("../server/_core/context");

beforeEach(() => {
  sdkMocks.authenticateRequest.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const fakeReq = { headers: {} } as unknown as Request;
const fakeRes = {} as unknown as Response;

describe("createContext", () => {
  it("returns ctx.user populated when authenticateRequest succeeds", async () => {
    const user = {
      id: 1, openId: "u-1", name: "Alice", email: "alice@x.y",
      loginMethod: "manus", role: "user" as const, passwordHash: null, pushPreferences: {}, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
    };
    sdkMocks.authenticateRequest.mockResolvedValueOnce(user);

    const ctx = await createContext({ req: fakeReq, res: fakeRes } as any);
    expect(ctx.user).toEqual(user);
    expect(ctx.req).toBe(fakeReq);
    expect(ctx.res).toBe(fakeRes);
  });

  it("returns ctx.user=null when authenticateRequest throws (graceful for public procedures)", async () => {
    sdkMocks.authenticateRequest.mockRejectedValueOnce(new Error("no session"));

    const ctx = await createContext({ req: fakeReq, res: fakeRes } as any);
    expect(ctx.user).toBeNull();
    expect(ctx.req).toBe(fakeReq);
    expect(ctx.res).toBe(fakeRes);
  });

  it("never re-throws — even on totally unrelated SDK failures", async () => {
    // This is load-bearing: every tRPC call goes through createContext.
    // If a transient SDK fault threw here, EVERY request would 500
    // (including /api/health-style public procedures).
    sdkMocks.authenticateRequest.mockRejectedValueOnce(new TypeError("boom"));
    await expect(createContext({ req: fakeReq, res: fakeRes } as any)).resolves.toBeTruthy();
  });
});
