import { afterEach, beforeEach, describe, expect, it } from "vitest";

const frontendEnvKeys = [
  "EXPO_WEB_PREVIEW_URL",
  "EXPO_PACKAGER_PROXY_URL",
  "PUBLIC_WEB_URL",
  "WEB_URL",
  "APP_URL",
] as const;

describe("OAuth frontend redirects", () => {
  beforeEach(() => {
    for (const key of frontendEnvKeys) {
      delete process.env[key];
    }
    process.env.JWT_SECRET = "test-session-secret";
  });

  afterEach(() => {
    for (const key of frontendEnvKeys) {
      delete process.env[key];
    }
  });

  // Removed in P1.A: `/api/oauth/callback` was the Manus token-exchange
  // route that this test exercised end-to-end. With Supabase Auth the
  // callback happens in the client (Supabase JS) and the server only
  // validates the resulting JWT — so there's no per-request redirect to
  // smuggle headers into. The header-tampering concern is now Supabase's.

  it("returns canonical URL href so validation matches emitted redirect (tab/newline smuggling)", async () => {
    // WHATWG URL strips ASCII tab/newline before parsing; raw strings can disagree with parsed host.
    process.env.PUBLIC_WEB_URL = "https://good.com\t@evil.com/";
    const { getFrontendRedirectUrl } = await import("../server/_core/oauth");

    expect(getFrontendRedirectUrl()).toBe("https://good.com@evil.com/");
  });

  it("falls back to localhost when configured frontend URLs are unsafe", async () => {
    process.env.PUBLIC_WEB_URL = "javascript:alert(1)";
    process.env.WEB_URL = "https://safe.example.com";
    const { getFrontendRedirectUrl } = await import("../server/_core/oauth");

    expect(getFrontendRedirectUrl()).toBe("https://safe.example.com/");

    delete process.env.WEB_URL;
    expect(getFrontendRedirectUrl()).toBe("http://localhost:8081");
  });
});
