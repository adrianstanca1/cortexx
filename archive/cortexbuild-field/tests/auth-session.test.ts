import { beforeEach, describe, expect, it, vi } from "vitest";

describe("auth sessions", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-session-secret";
    process.env.VITE_APP_ID = "test-app";
    vi.resetModules();
  });

  it("creates a verifiable session when display name is empty", async () => {
    const { sdk } = await import("../server/_core/sdk");
    const token = await sdk.createSessionToken("openid-empty-name", { name: "" });

    const session = await sdk.verifySession(token);

    expect(session).toMatchObject({
      openId: "openid-empty-name",
      name: "openid-empty-name",
    });
  });
});
