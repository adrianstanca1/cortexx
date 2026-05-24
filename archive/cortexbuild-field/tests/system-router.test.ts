import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../server/_core/context";

/**
 * Coverage for `server/_core/systemRouter.ts` — the public health
 * probe and the admin-only owner-notification dispatcher. Was 78%
 * covered (the .health input validation and .notifyOwner branches
 * were untested).
 */

const notifyMocks = {
  notifyOwner: vi.fn(),
};
vi.mock("../server/_core/notification", () => notifyMocks);

const { appRouter } = await import("../server/routers");

function ctx(
  role: "user" | "admin",
  opts: { userId?: number } = {},
): TrpcContext {
  const { userId = 1 } = opts;
  return {
    user: {
      id: userId, openId: `u-${userId}`, name: `User ${userId}`,
      email: `u${userId}@example.com`, loginMethod: "manus", role,
      passwordHash: null,
      pushPreferences: {},
      createdAt: new Date(), updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", hostname: "localhost", headers: {} } as any,
    res: { clearCookie: vi.fn() } as any,
  };
}

const UNAUTH_CTX = {
  user: null,
  req: { protocol: "https", hostname: "localhost", headers: {} },
  res: { clearCookie: vi.fn() },
} as unknown as TrpcContext;

beforeEach(() => {
  notifyMocks.notifyOwner.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("system.health (public)", () => {
  it("returns { ok: true } for any valid timestamp", async () => {
    const caller = appRouter.createCaller(UNAUTH_CTX);
    expect(await caller.system.health({ timestamp: Date.now() })).toEqual({ ok: true });
    expect(await caller.system.health({ timestamp: 0 })).toEqual({ ok: true });
  });

  it("rejects negative timestamps via input validation", async () => {
    const caller = appRouter.createCaller(UNAUTH_CTX);
    await expect(caller.system.health({ timestamp: -1 })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});

describe("system.notifyOwner (super-admin)", () => {
  it("dispatches and returns { success: true } when delivery confirms", async () => {
    notifyMocks.notifyOwner.mockResolvedValueOnce(true);
    const caller = appRouter.createCaller(ctx("admin"));
    const result = await caller.system.notifyOwner({ title: "Heads up", content: "Body" });
    expect(result).toEqual({ success: true });
    expect(notifyMocks.notifyOwner).toHaveBeenCalledWith({ title: "Heads up", content: "Body" });
  });

  it("returns { success: false } without throwing when delivery upstream fails", async () => {
    notifyMocks.notifyOwner.mockResolvedValueOnce(false);
    const caller = appRouter.createCaller(ctx("admin"));
    const result = await caller.system.notifyOwner({ title: "T", content: "C" });
    expect(result).toEqual({ success: false });
  });

  it("rejects empty title with BAD_REQUEST (no notify call)", async () => {
    const caller = appRouter.createCaller(ctx("admin"));
    await expect(
      caller.system.notifyOwner({ title: "", content: "C" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(notifyMocks.notifyOwner).not.toHaveBeenCalled();
  });

  it("rejects non-admin callers with FORBIDDEN — no notify call", async () => {
    const caller = appRouter.createCaller(ctx("user"));
    await expect(
      caller.system.notifyOwner({ title: "T", content: "C" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(notifyMocks.notifyOwner).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated callers (FORBIDDEN — uniform gate) — no notify call", async () => {
    const caller = appRouter.createCaller(UNAUTH_CTX);
    await expect(
      caller.system.notifyOwner({ title: "T", content: "C" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(notifyMocks.notifyOwner).not.toHaveBeenCalled();
  });
});
