import { describe, expect, it } from "vitest";
import type { Request } from "express";
import { getSessionCookieOptions } from "../server/_core/cookies";

function makeReq(overrides: Partial<{
  protocol: "http" | "https";
  hostname: string;
  headers: Record<string, string | string[] | undefined>;
}> = {}): Request {
  return {
    protocol: overrides.protocol ?? "http",
    hostname: overrides.hostname ?? "localhost",
    headers: overrides.headers ?? {},
  } as unknown as Request;
}

describe("getSessionCookieOptions", () => {
  it("uses sameSite='none' + secure=true for HTTPS requests (cross-site cookie)", () => {
    const opts = getSessionCookieOptions(makeReq({
      protocol: "https",
      hostname: "field.cortexbuildpro.com",
    }));
    expect(opts.sameSite).toBe("none");
    expect(opts.secure).toBe(true);
    expect(opts.httpOnly).toBe(true);
    expect(opts.path).toBe("/");
  });

  it("falls back to sameSite='lax' on plain HTTP — browsers reject SameSite=None without Secure", () => {
    // This is the local-dev case. Without this fallback, the cookie returned
    // by auth.login would be silently dropped by Chrome/Firefox/Safari and
    // the user would appear to log in but get a logged-out session on the
    // very next request.
    const opts = getSessionCookieOptions(makeReq({
      protocol: "http",
      hostname: "localhost",
    }));
    expect(opts.sameSite).toBe("lax");
    expect(opts.secure).toBe(false);
  });

  it("treats x-forwarded-proto=https as secure (behind HTTPS reverse proxy)", () => {
    const opts = getSessionCookieOptions(makeReq({
      protocol: "http",
      hostname: "field.cortexbuildpro.com",
      headers: { "x-forwarded-proto": "https" },
    }));
    expect(opts.sameSite).toBe("none");
    expect(opts.secure).toBe(true);
  });

  it("does not set a domain for localhost", () => {
    const opts = getSessionCookieOptions(makeReq({ hostname: "localhost" }));
    expect(opts.domain).toBeUndefined();
  });

  it("does not set a domain for IP addresses", () => {
    const opts = getSessionCookieOptions(makeReq({ hostname: "127.0.0.1" }));
    expect(opts.domain).toBeUndefined();
  });

  it("sets a parent domain for multi-level subdomains so cookies are shared across them", () => {
    const opts = getSessionCookieOptions(makeReq({
      protocol: "https",
      hostname: "3000-xxx.manuspre.computer",
    }));
    expect(opts.domain).toBe(".manuspre.computer");
  });

  it("does not set a domain for two-level apex hostnames", () => {
    // 'manuspre.computer' has only two parts — there's no parent to share to.
    const opts = getSessionCookieOptions(makeReq({
      protocol: "https",
      hostname: "manuspre.computer",
    }));
    expect(opts.domain).toBeUndefined();
  });
});
