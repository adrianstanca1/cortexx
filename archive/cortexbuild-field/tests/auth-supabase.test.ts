import { describe, expect, it, beforeAll, vi } from "vitest";
import { SignJWT, generateKeyPair, exportJWK } from "jose";
import type { Request } from "express";

let verifySupabaseJwt: typeof import("../server/_core/supabase-auth").verifySupabaseJwt;

const SUPABASE_URL = "https://test.supabase.test";

describe("verifySupabaseJwt", () => {
  let privateKey: CryptoKey;
  let publicJwk: any;

  beforeAll(async () => {
    const kp = await generateKeyPair("RS256", { extractable: true });
    privateKey = kp.privateKey;
    publicJwk = await exportJWK(kp.publicKey);
    publicJwk.kid = "test-key";
    publicJwk.alg = "RS256";
    publicJwk.use = "sig";

    vi.stubGlobal("fetch", async (url: string) => {
      if (url.endsWith("/.well-known/jwks.json")) {
        return new Response(JSON.stringify({ keys: [publicJwk] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    process.env.SUPABASE_URL = SUPABASE_URL;
    ({ verifySupabaseJwt } = await import("../server/_core/supabase-auth"));
  });

  async function makeJwt(claims: Record<string, unknown>) {
    return new SignJWT(claims)
      .setProtectedHeader({ alg: "RS256", kid: "test-key" })
      .setIssuer(`${SUPABASE_URL}/auth/v1`)
      .setAudience("authenticated")
      .setExpirationTime("1h")
      .sign(privateKey);
  }

  it("accepts a valid token and returns the sub + email", async () => {
    const token = await makeJwt({ sub: "uuid-1", email: "ada@example.com", role: "authenticated" });
    const req = { headers: { authorization: `Bearer ${token}` } } as unknown as Request;
    const result = await verifySupabaseJwt(req);
    expect(result).toEqual({ sub: "uuid-1", email: "ada@example.com", role: "authenticated" });
  });

  it("rejects a token with wrong issuer", async () => {
    const token = await new SignJWT({ sub: "uuid-1" })
      .setProtectedHeader({ alg: "RS256", kid: "test-key" })
      .setIssuer("https://evil.example/auth/v1")
      .setAudience("authenticated")
      .setExpirationTime("1h")
      .sign(privateKey);
    const req = { headers: { authorization: `Bearer ${token}` } } as unknown as Request;
    await expect(verifySupabaseJwt(req)).rejects.toThrow();
  });

  it("rejects when no Authorization header and no cookie", async () => {
    const req = { headers: {} } as unknown as Request;
    await expect(verifySupabaseJwt(req)).rejects.toThrow();
  });
});
