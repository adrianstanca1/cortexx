import { afterEach, describe, expect, it, vi } from "vitest";
import { SignJWT } from "jose";

// JWT_SECRET is captured by ENV at module-load time. Set it BEFORE we
// import the SDK so the in-process secret matches what we use to mint
// adversarial tokens below.
process.env.JWT_SECRET = "sdk-test-secret-please-do-not-reuse";
process.env.VITE_APP_ID = "cortexbuild-field";

const { sdk } = await import("../server/_core/sdk");

const ENCODER = new TextEncoder();

afterEach(() => {
  vi.restoreAllMocks();
});

describe("sdk.signSession + verifySession round-trip", () => {
  it("a freshly minted token verifies to the same payload", async () => {
    const token = await sdk.signSession({
      openId: "user-1",
      appId: "cortexbuild-field",
      name: "Alice",
    });
    expect(token).toBeTypeOf("string");
    expect(token.split(".").length).toBe(3); // header.payload.signature

    const result = await sdk.verifySession(token);
    expect(result).toEqual({
      openId: "user-1",
      appId: "cortexbuild-field",
      name: "Alice",
    });
  });

  it("falls back to openId when name is empty (matches recordLogin's getSessionName fallback)", async () => {
    // The session-name fallback is a public contract: callers count on
    // verifySession returning a non-empty name even when the JWT carries an
    // empty string. If this regresses, every UI that displays ctx.user.name
    // will render an empty heading.
    const token = await sdk.signSession({
      openId: "user-2",
      appId: "cortexbuild-field",
      name: "",
    });
    const result = await sdk.verifySession(token);
    expect(result).not.toBeNull();
    expect(result!.name).toBe("user-2");
  });
});

describe("sdk.verifySession — rejection cases", () => {
  it("returns null for missing/empty cookie value", async () => {
    expect(await sdk.verifySession(undefined)).toBeNull();
    expect(await sdk.verifySession(null)).toBeNull();
    expect(await sdk.verifySession("")).toBeNull();
  });

  it("returns null for a syntactically invalid token", async () => {
    expect(await sdk.verifySession("not.a.jwt")).toBeNull();
    expect(await sdk.verifySession("garbage")).toBeNull();
    expect(await sdk.verifySession("a.b")).toBeNull(); // wrong segment count
  });

  it("returns null for a token signed with a different secret (forged)", async () => {
    // An attacker who guesses or replays an old JWT_SECRET must not be able
    // to authenticate against the current process. This pins the HMAC check.
    const forged = await new SignJWT({
      openId: "attacker",
      appId: "cortexbuild-field",
      name: "Attacker",
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(Math.floor(Date.now() / 1000) + 60)
      .sign(ENCODER.encode("a-different-secret"));

    expect(await sdk.verifySession(forged)).toBeNull();
  });

  it("returns null for an expired token", async () => {
    const expired = await sdk.signSession(
      { openId: "user-3", appId: "cortexbuild-field", name: "Bob" },
      { expiresInMs: -1000 }, // already expired
    );
    expect(await sdk.verifySession(expired)).toBeNull();
  });

  it("returns null when the payload is missing openId", async () => {
    // jose accepts any JSON in the payload; verifySession adds the explicit
    // openId/appId-presence check. This catches a regression where someone
    // 'simplifies' that check away.
    const malformed = await new SignJWT({ appId: "cortexbuild-field", name: "X" })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(Math.floor(Date.now() / 1000) + 60)
      .sign(ENCODER.encode("sdk-test-secret-please-do-not-reuse"));

    expect(await sdk.verifySession(malformed)).toBeNull();
  });

  it("returns null when the payload is missing appId", async () => {
    const malformed = await new SignJWT({ openId: "user-4", name: "X" })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(Math.floor(Date.now() / 1000) + 60)
      .sign(ENCODER.encode("sdk-test-secret-please-do-not-reuse"));

    expect(await sdk.verifySession(malformed)).toBeNull();
  });

  it("rejects tokens that use a non-HS256 algorithm (alg confusion)", async () => {
    // The classic JWT pitfall: tokens that claim alg=none or alg=RS256 with
    // the public key as the HMAC secret. verifySession passes
    // `algorithms: ['HS256']`, so jose will reject any other alg before
    // checking the signature.
    const noneAlg = "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0." +
      Buffer.from(JSON.stringify({ openId: "x", appId: "y", name: "z" })).toString("base64url") +
      ".";
    expect(await sdk.verifySession(noneAlg)).toBeNull();
  });
});

describe("sdk.createSessionToken", () => {
  it("uses openId as the name fallback when none provided", async () => {
    const token = await sdk.createSessionToken("user-5");
    const result = await sdk.verifySession(token);
    expect(result).not.toBeNull();
    expect(result!.openId).toBe("user-5");
    expect(result!.name).toBe("user-5");
  });

  it("trims display name and falls back when only whitespace given", async () => {
    const token = await sdk.createSessionToken("user-6", { name: "   " });
    const result = await sdk.verifySession(token);
    expect(result).not.toBeNull();
    expect(result!.name).toBe("user-6");
  });

  it("preserves the appId from ENV (so cross-app tokens won't accidentally validate)", async () => {
    const token = await sdk.createSessionToken("user-7", { name: "Alice" });
    const result = await sdk.verifySession(token);
    expect(result!.appId).toBe("cortexbuild-field");
  });
});
