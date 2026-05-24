import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Coverage for `server/_core/notification.ts` — the owner-notification
 * helper. Previously at ~9% line coverage because every test path was
 * gated behind unset ENV vars. This file exercises:
 *   - validatePayload errors (empty title/content, length caps)
 *   - missing ENV config (forgeApiUrl / forgeApiKey)
 *   - successful fetch (200)
 *   - upstream failure (non-2xx)
 *   - fetch network error (rejected promise)
 *   - URL composition (trailing-slash variants)
 */

async function importNotification() {
  vi.resetModules();
  return await import("../server/_core/notification");
}

let originalFetch: typeof fetch;

beforeEach(() => {
  originalFetch = globalThis.fetch;
  delete process.env.BUILT_IN_FORGE_API_URL;
  delete process.env.BUILT_IN_FORGE_API_KEY;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("notifyOwner — payload validation (no fetch issued)", () => {
  it("rejects empty title with BAD_REQUEST", async () => {
    process.env.BUILT_IN_FORGE_API_URL = "https://forge.example/";
    process.env.BUILT_IN_FORGE_API_KEY = "k";
    const { notifyOwner } = await importNotification();
    await expect(notifyOwner({ title: "  ", content: "x" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringMatching(/title is required/),
    });
  });

  it("rejects empty content with BAD_REQUEST", async () => {
    process.env.BUILT_IN_FORGE_API_URL = "https://forge.example/";
    process.env.BUILT_IN_FORGE_API_KEY = "k";
    const { notifyOwner } = await importNotification();
    await expect(notifyOwner({ title: "x", content: "" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringMatching(/content is required/),
    });
  });

  it("rejects oversized title (>1200 chars)", async () => {
    process.env.BUILT_IN_FORGE_API_URL = "https://forge.example/";
    process.env.BUILT_IN_FORGE_API_KEY = "k";
    const { notifyOwner } = await importNotification();
    await expect(
      notifyOwner({ title: "a".repeat(1201), content: "ok" }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringMatching(/at most 1200/),
    });
  });

  it("rejects oversized content (>20000 chars)", async () => {
    process.env.BUILT_IN_FORGE_API_URL = "https://forge.example/";
    process.env.BUILT_IN_FORGE_API_KEY = "k";
    const { notifyOwner } = await importNotification();
    await expect(
      notifyOwner({ title: "ok", content: "a".repeat(20001) }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringMatching(/at most 20000/),
    });
  });
});

describe("notifyOwner — missing ENV config", () => {
  it("throws INTERNAL_SERVER_ERROR when forgeApiUrl is unset", async () => {
    process.env.BUILT_IN_FORGE_API_KEY = "k";
    const { notifyOwner } = await importNotification();
    await expect(notifyOwner({ title: "t", content: "c" })).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: expect.stringMatching(/URL is not configured/),
    });
  });

  it("throws INTERNAL_SERVER_ERROR when forgeApiKey is unset", async () => {
    process.env.BUILT_IN_FORGE_API_URL = "https://forge.example/";
    const { notifyOwner } = await importNotification();
    await expect(notifyOwner({ title: "t", content: "c" })).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: expect.stringMatching(/API key is not configured/),
    });
  });
});

describe("notifyOwner — happy path + upstream errors", () => {
  beforeEach(() => {
    process.env.BUILT_IN_FORGE_API_URL = "https://forge.example/";
    process.env.BUILT_IN_FORGE_API_KEY = "test-key";
  });

  it("POSTs to webdevtoken endpoint with bearer auth and JSON body", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    globalThis.fetch = vi.fn(async (url: any, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Response("", { status: 200 });
    }) as unknown as typeof fetch;

    const { notifyOwner } = await importNotification();
    const ok = await notifyOwner({ title: " hello ", content: " world " });

    expect(ok).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(
      "https://forge.example/webdevtoken.v1.WebDevService/SendNotification",
    );
    expect(calls[0].init?.method).toBe("POST");
    const headers = calls[0].init?.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer test-key");
    expect(headers["content-type"]).toBe("application/json");
    // Title and content should be trimmed before sending.
    expect(JSON.parse(calls[0].init?.body as string)).toEqual({
      title: "hello",
      content: "world",
    });
  });

  it("returns false (not throws) when upstream returns non-2xx", async () => {
    globalThis.fetch = vi.fn(
      async () => new Response("upstream busy", { status: 503 }),
    ) as unknown as typeof fetch;
    // Silence the warn logged on upstream failure so the test output stays clean.
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const { notifyOwner } = await importNotification();
    const ok = await notifyOwner({ title: "t", content: "c" });
    expect(ok).toBe(false);
  });

  it("returns false (not throws) when fetch rejects (network error)", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const { notifyOwner } = await importNotification();
    const ok = await notifyOwner({ title: "t", content: "c" });
    expect(ok).toBe(false);
  });

  it("base URL without trailing slash still composes a valid endpoint", async () => {
    process.env.BUILT_IN_FORGE_API_URL = "https://forge.example"; // no trailing /
    let capturedUrl = "";
    globalThis.fetch = vi.fn(async (url: any) => {
      capturedUrl = String(url);
      return new Response("", { status: 200 });
    }) as unknown as typeof fetch;

    const { notifyOwner } = await importNotification();
    await notifyOwner({ title: "t", content: "c" });
    expect(capturedUrl).toBe(
      "https://forge.example/webdevtoken.v1.WebDevService/SendNotification",
    );
  });
});
