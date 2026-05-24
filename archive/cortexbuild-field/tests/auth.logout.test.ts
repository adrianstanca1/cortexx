import { describe, expect, it } from "vitest";
import { appRouter } from "../server/routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "../server/_core/context";

type CookieCall = {
  name: string;
  options: Record<string, unknown>;
};

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext; clearedCookies: CookieCall[] } {
  const clearedCookies: CookieCall[] = [];
  
  const user: AuthenticatedUser = {
    id: 1,
    openId: "sample-user",
    email: "sample@example.com",
    name: "Sample User",
    loginMethod: "manus",
    role: "user",
    passwordHash: null, pushPreferences: {}, createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  
  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      hostname: "api.cortexbuildpro.com",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };
  
  return { ctx, clearedCookies };
}

describe("auth.logout", () => {
  it("clears the session cookie and reports success", async () => {
    const { ctx, clearedCookies } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.logout();

    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
    expect(clearedCookies[0]?.options).toMatchObject({
      maxAge: -1,
      secure: true,
      sameSite: "none",
      httpOnly: true,
      path: "/",
    });
  });
});

describe("auth.me", () => {
  it("returns null when there is no session", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", hostname: "api.cortexbuildpro.com", headers: {} } as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    expect(await caller.auth.me()).toBeNull();
  });

  it("never leaks passwordHash to the client", async () => {
    // Construct a context with a populated passwordHash — ctx.user is the
    // raw users row, so the procedure handler is the only thing that strips it.
    const userWithHash: AuthenticatedUser = {
      id: 7,
      openId: "email:test@example.com",
      email: "test@example.com",
      name: "Test",
      loginMethod: "password",
      role: "admin",
      passwordHash: "scrypt$N=16384,r=8,p=1$AAAA$BBBB",
 pushPreferences: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };
    const ctx: TrpcContext = {
      user: userWithHash,
      req: { protocol: "https", hostname: "api.cortexbuildpro.com", headers: {} } as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    // The hash must not be in the response.
    expect(result).not.toBeNull();
    expect(result).not.toHaveProperty("passwordHash");
    // ...and the rest of the user should still be present.
    expect(result).toMatchObject({
      id: 7,
      openId: "email:test@example.com",
      email: "test@example.com",
      role: "admin",
    });
  });
});
