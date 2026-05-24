import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Coverage for `server/_core/dataApi.ts` — the wrapper around the
 * Manus Forge `CallApi` proxy. Was 0% covered. Mirrors the shape of
 * notification.test.ts (env gating + happy-path POST + error
 * propagation + response unwrap).
 */

async function importDataApi() {
  vi.resetModules();
  return await import("../server/_core/dataApi");
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

describe("callDataApi — env gating", () => {
  it("throws when forgeApiUrl is unset", async () => {
    process.env.BUILT_IN_FORGE_API_KEY = "k";
    const { callDataApi } = await importDataApi();
    await expect(callDataApi("Youtube/search")).rejects.toThrow(/BUILT_IN_FORGE_API_URL/);
  });

  it("throws when forgeApiKey is unset", async () => {
    process.env.BUILT_IN_FORGE_API_URL = "https://forge.example/";
    const { callDataApi } = await importDataApi();
    await expect(callDataApi("Youtube/search")).rejects.toThrow(/BUILT_IN_FORGE_API_KEY/);
  });
});

describe("callDataApi — happy path", () => {
  beforeEach(() => {
    process.env.BUILT_IN_FORGE_API_URL = "https://forge.example/";
    process.env.BUILT_IN_FORGE_API_KEY = "test-key";
  });

  it("POSTs to webdevtoken endpoint with bearer + JSON body shape", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;
    globalThis.fetch = vi.fn(async (url: any, init?: RequestInit) => {
      capturedUrl = String(url);
      capturedInit = init;
      return new Response(JSON.stringify({ result: "ok" }), { status: 200 });
    }) as unknown as typeof fetch;

    const { callDataApi } = await importDataApi();
    const result = await callDataApi("Youtube/search", {
      query: { gl: "US", q: "manus" },
      pathParams: { id: 5 },
      body: { extra: true },
      formData: { file: "x" },
    });

    expect(capturedUrl).toBe("https://forge.example/webdevtoken.v1.WebDevService/CallApi");
    expect(capturedInit?.method).toBe("POST");
    const headers = capturedInit?.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer test-key");
    expect(headers["content-type"]).toBe("application/json");
    expect(headers["connect-protocol-version"]).toBe("1");

    const body = JSON.parse(capturedInit?.body as string);
    expect(body).toEqual({
      apiId: "Youtube/search",
      query: { gl: "US", q: "manus" },
      body: { extra: true },
      path_params: { id: 5 },
      multipart_form_data: { file: "x" },
    });

    expect(result).toEqual({ result: "ok" });
  });

  it("normalises a base URL without a trailing slash", async () => {
    process.env.BUILT_IN_FORGE_API_URL = "https://forge.example"; // no trailing /
    let capturedUrl = "";
    globalThis.fetch = vi.fn(async (url: any) => {
      capturedUrl = String(url);
      return new Response(JSON.stringify({}), { status: 200 });
    }) as unknown as typeof fetch;

    const { callDataApi } = await importDataApi();
    await callDataApi("X/Y");
    expect(capturedUrl).toBe("https://forge.example/webdevtoken.v1.WebDevService/CallApi");
  });

  it("works with no options at all (omits all extra fields in body)", async () => {
    let capturedBody = "";
    globalThis.fetch = vi.fn(async (_url: any, init?: RequestInit) => {
      capturedBody = init?.body as string;
      return new Response(JSON.stringify({}), { status: 200 });
    }) as unknown as typeof fetch;

    const { callDataApi } = await importDataApi();
    await callDataApi("X/Y");
    const body = JSON.parse(capturedBody);
    expect(body.apiId).toBe("X/Y");
    expect(body.query).toBeUndefined();
    expect(body.body).toBeUndefined();
    expect(body.path_params).toBeUndefined();
    expect(body.multipart_form_data).toBeUndefined();
  });
});

describe("callDataApi — response unwrapping", () => {
  beforeEach(() => {
    process.env.BUILT_IN_FORGE_API_URL = "https://forge.example/";
    process.env.BUILT_IN_FORGE_API_KEY = "k";
  });

  it("parses jsonData when response wraps it as a JSON-encoded string", async () => {
    globalThis.fetch = vi.fn(async () => new Response(
      JSON.stringify({ jsonData: '{"items":[1,2,3]}' }),
      { status: 200 },
    )) as unknown as typeof fetch;

    const { callDataApi } = await importDataApi();
    const result = await callDataApi("X/Y");
    expect(result).toEqual({ items: [1, 2, 3] });
  });

  it("returns raw jsonData when it isn't valid JSON (graceful fallback)", async () => {
    globalThis.fetch = vi.fn(async () => new Response(
      JSON.stringify({ jsonData: "not-json{" }),
      { status: 200 },
    )) as unknown as typeof fetch;

    const { callDataApi } = await importDataApi();
    const result = await callDataApi("X/Y");
    expect(result).toBe("not-json{");
  });

  it("returns the response body as-is when there's no jsonData wrapper", async () => {
    globalThis.fetch = vi.fn(async () => new Response(
      JSON.stringify({ raw: { a: 1 } }),
      { status: 200 },
    )) as unknown as typeof fetch;

    const { callDataApi } = await importDataApi();
    const result = await callDataApi("X/Y");
    expect(result).toEqual({ raw: { a: 1 } });
  });
});

describe("callDataApi — error propagation", () => {
  beforeEach(() => {
    process.env.BUILT_IN_FORGE_API_URL = "https://forge.example/";
    process.env.BUILT_IN_FORGE_API_KEY = "k";
  });

  it("throws with status code and detail body when upstream returns non-2xx", async () => {
    globalThis.fetch = vi.fn(async () => new Response(
      "rate limited",
      { status: 429, statusText: "Too Many Requests" },
    )) as unknown as typeof fetch;

    const { callDataApi } = await importDataApi();
    await expect(callDataApi("X/Y")).rejects.toThrow(
      /Data API request failed \(429 Too Many Requests\): rate limited/,
    );
  });

  it("throws with just the status when reading the body fails", async () => {
    const fakeResp: any = {
      ok: false, status: 500, statusText: "Server Error",
      text: () => Promise.reject(new Error("body unreadable")),
      json: () => Promise.resolve({}),
    };
    globalThis.fetch = vi.fn(async () => fakeResp) as unknown as typeof fetch;

    const { callDataApi } = await importDataApi();
    await expect(callDataApi("X/Y")).rejects.toThrow(
      /Data API request failed \(500 Server Error\)$/,
    );
  });
});
