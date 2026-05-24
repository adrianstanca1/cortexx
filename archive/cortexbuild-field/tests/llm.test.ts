/**
 * Tests for `server/_core/llm.ts` — the LLM invocation helper.
 *
 * llm.ts is the single chokepoint for every AI feature on the server:
 * the 8 document generators, photo analysis, agent chat, cost
 * estimation, risk analysis. Until this file existed the module was
 * 3.8% covered (just module load); this raises it considerably.
 *
 * Strategy: stub `fetch` and ENV, then assert on the request the
 * helper builds and the way it handles responses. Internal helpers
 * (normalizeMessage, normalizeToolChoice, normalizeResponseFormat) are
 * exercised through invokeLLM rather than imported directly — they
 * aren't exported and that's fine.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_FETCH = globalThis.fetch;
let fetchMock: ReturnType<typeof vi.fn> | null = null;

function installFetchMock(impl: (url: string, init?: RequestInit) => Promise<Response>) {
  fetchMock = vi.fn(impl);
  globalThis.fetch = fetchMock as unknown as typeof fetch;
}

function restoreFetch() {
  globalThis.fetch = ORIGINAL_FETCH;
  fetchMock = null;
}

/**
 * Re-import llm.ts after env mutation. ENV is captured once at module
 * load (server/_core/env.ts), so we have to vi.resetModules() between
 * tests that flip BUILT_IN_FORGE_API_KEY between set and unset.
 */
async function importLLM() {
  vi.resetModules();
  return await import("../server/_core/llm");
}

beforeEach(() => {
  delete process.env.BUILT_IN_FORGE_API_KEY;
  delete process.env.BUILT_IN_FORGE_API_URL;
  delete process.env.GEMINI_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
  // Baseline fetch mock: every provider request returns 500, so
  // unifiedInvoke exhausts the chain and invokeLLM falls back. Tests
  // that need a different fetch behaviour override this with their own
  // installFetchMock() call. Without this baseline, tests relied on
  // Ollama being unreachable at 127.0.0.1:11434 — which is fine on CI
  // runners but fails on dev boxes that have a local Ollama running
  // (e.g. the production VPS that doubles as a dev box).
  installFetchMock(async () => new Response("test default 500", { status: 500 }));
});

afterEach(() => {
  restoreFetch();
  vi.restoreAllMocks();
});

describe("invokeLLM — fallback mode (no API key)", () => {
  it("returns a text fallback when no LLM provider is configured", async () => {
    const { invokeLLM } = await importLLM();
    const result = await invokeLLM({
      messages: [{ role: "user", content: "What's the cost?" }],
    });

    expect(result.model).toBe("cortexbuild-fallback");
    expect(result.choices[0].finish_reason).toBe("stop");
    const content = result.choices[0].message.content;
    expect(typeof content).toBe("string");
    expect(content).toContain("AI fallback mode");
    expect(content).toContain("What's the cost?"); // echoes user prompt
  });

  it("returns JSON-shaped fallback when responseFormat=json_object", async () => {
    // The fallback respects the requested response shape so callers
    // that JSON.parse the content don't crash in fallback mode.
    const { invokeLLM } = await importLLM();
    const result = await invokeLLM({
      messages: [{ role: "user", content: "Anything" }],
      responseFormat: { type: "json_object" },
    });
    const parsed = JSON.parse(result.choices[0].message.content as string);
    expect(parsed).toMatchObject({
      summary: expect.any(String),
      recommendations: expect.any(Array),
    });
  });

  it("returns JSON-shaped fallback for json_schema variant too", async () => {
    const { invokeLLM } = await importLLM();
    const result = await invokeLLM({
      messages: [{ role: "user", content: "x" }],
      responseFormat: {
        type: "json_schema",
        json_schema: { name: "test", schema: { type: "object" } },
      },
    });
    expect(() => JSON.parse(result.choices[0].message.content as string)).not.toThrow();
  });

  it("renders image_url parts as '[image]' placeholder in echoed user prompt", async () => {
    // The fallback echoes the most recent user message back. Multimodal
    // parts (image_url / file_url) become placeholder text rather than
    // their raw URLs — protects against accidental URL leakage in error
    // logs, and keeps the fallback signature stable across modalities.
    const { invokeLLM } = await importLLM();
    const result = await invokeLLM({
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "What's wrong with this?" },
            { type: "image_url", image_url: { url: "https://example/secret-uri.jpg" } },
          ],
        },
      ],
    });
    const content = result.choices[0].message.content as string;
    expect(content).toContain("What's wrong with this?");
    expect(content).toContain("[image]");
    expect(content).not.toContain("secret-uri.jpg");
  });

  it("renders file_url parts as '[file]' placeholder in echoed user prompt", async () => {
    const { invokeLLM } = await importLLM();
    const result = await invokeLLM({
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Review this doc" },
            // file_url matches the Anthropic content-part shape
            { type: "file_url", file_url: { url: "https://example/contract.pdf" } } as any,
          ],
        },
      ],
    });
    const content = result.choices[0].message.content as string;
    expect(content).toContain("Review this doc");
    expect(content).toContain("[file]");
    expect(content).not.toContain("contract.pdf");
  });

  it("treats unknown multimodal part types as empty string (forward-compat for new modalities)", async () => {
    const { invokeLLM } = await importLLM();
    const result = await invokeLLM({
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Hello" },
            // A future part-type we don't yet recognise — must not crash
            // or echo arbitrary content; just becomes empty string.
            { type: "video_url", video_url: { url: "https://example/leaked.mp4" } } as any,
          ],
        },
      ],
    });
    const content = result.choices[0].message.content as string;
    expect(content).toContain("Hello");
    expect(content).not.toContain("leaked.mp4");
  });

  it("returns fallback when unifiedInvoke throws (no providers configured)", async () => {
    installFetchMock(async () => new Response("should not matter", { status: 500 }));
    const { invokeLLM } = await importLLM();
    const result = await invokeLLM({ messages: [{ role: "user", content: "hi" }] });
    // unifiedInvoke is always called first; if all providers fail, fallback kicks in
    expect(result.model).toBe("cortexbuild-fallback");
  });
});

describe.skip("invokeLLM — live mode (API key configured) [DEPRECATED: invokeLLM now uses unified-ai, not Forge]", () => {
  beforeEach(() => {
    process.env.BUILT_IN_FORGE_API_KEY = "test-forge-key";
  });

  it("POSTs to the default Forge URL when no override is set", async () => {
    installFetchMock(async () => new Response(
      JSON.stringify({ id: "x", created: 1, model: "gemini-2.5-flash", choices: [{ message: { role: "assistant", content: "ok" } }] }),
      { status: 200, headers: { "content-type": "application/json" } },
    ));
    const { invokeLLM } = await importLLM();
    await invokeLLM({ messages: [{ role: "user", content: "hi" }] });

    const [url, init] = fetchMock!.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://forge.manus.im/v1/chat/completions");
    expect((init.headers as any).authorization).toBe("Bearer test-forge-key");
  });

  it("POSTs to BUILT_IN_FORGE_API_URL when configured (trailing slash trimmed)", async () => {
    process.env.BUILT_IN_FORGE_API_URL = "https://internal.forge.example/";
    installFetchMock(async () => new Response(
      JSON.stringify({ id: "x", created: 1, model: "m", choices: [{ message: { role: "assistant", content: "ok" } }] }),
      { status: 200 },
    ));
    const { invokeLLM } = await importLLM();
    await invokeLLM({ messages: [{ role: "user", content: "hi" }] });

    const [url] = fetchMock!.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://internal.forge.example/v1/chat/completions");
  });

  it("collapses single-text-content message to a plain string (Gemini compatibility)", async () => {
    installFetchMock(async () => new Response(
      JSON.stringify({ id: "x", created: 1, model: "m", choices: [{ message: { role: "assistant", content: "ok" } }] }),
      { status: 200 },
    ));
    const { invokeLLM } = await importLLM();
    await invokeLLM({ messages: [{ role: "user", content: [{ type: "text", text: "wrapped" }] }] });

    const body = JSON.parse((fetchMock!.mock.calls[0][1] as RequestInit).body as string);
    // Single text part collapses to string content, not an array.
    expect(body.messages[0].content).toBe("wrapped");
  });

  it("preserves multi-modal content (text + image) as an array", async () => {
    installFetchMock(async () => new Response(
      JSON.stringify({ id: "x", created: 1, model: "m", choices: [{ message: { role: "assistant", content: "ok" } }] }),
      { status: 200 },
    ));
    const { invokeLLM } = await importLLM();
    await invokeLLM({
      messages: [{
        role: "user",
        content: [
          { type: "text", text: "Describe this defect" },
          { type: "image_url", image_url: { url: "https://example/photo.jpg" } },
        ],
      }],
    });

    const body = JSON.parse((fetchMock!.mock.calls[0][1] as RequestInit).body as string);
    expect(Array.isArray(body.messages[0].content)).toBe(true);
    expect(body.messages[0].content).toHaveLength(2);
    expect(body.messages[0].content[1]).toMatchObject({ type: "image_url" });
  });

  it("expands toolChoice='required' with one tool to an explicit function reference", async () => {
    installFetchMock(async () => new Response(
      JSON.stringify({ id: "x", created: 1, model: "m", choices: [{ message: { role: "assistant", content: "ok" } }] }),
      { status: 200 },
    ));
    const { invokeLLM } = await importLLM();
    await invokeLLM({
      messages: [{ role: "user", content: "x" }],
      tools: [{ type: "function", function: { name: "extractDefects" } }],
      toolChoice: "required",
    });

    const body = JSON.parse((fetchMock!.mock.calls[0][1] as RequestInit).body as string);
    expect(body.tool_choice).toEqual({ type: "function", function: { name: "extractDefects" } });
  });

  it("rejects toolChoice='required' with zero tools (configuration error)", async () => {
    const { invokeLLM } = await importLLM();
    await expect(
      invokeLLM({
        messages: [{ role: "user", content: "x" }],
        toolChoice: "required",
      }),
    ).rejects.toThrow(/no tools were configured/i);
  });

  it("rejects toolChoice='required' with multiple tools (ambiguous target)", async () => {
    const { invokeLLM } = await importLLM();
    await expect(
      invokeLLM({
        messages: [{ role: "user", content: "x" }],
        tools: [
          { type: "function", function: { name: "a" } },
          { type: "function", function: { name: "b" } },
        ],
        toolChoice: "required",
      }),
    ).rejects.toThrow(/single tool/i);
  });

  it("coerces outputSchema (camelCase shorthand) into a json_schema response_format", async () => {
    // Many callers in the codebase use the camelCase `outputSchema` field
    // because it's friendlier than the OpenAI-style nested shape. Make
    // sure that shorthand is correctly translated for the upstream API.
    installFetchMock(async () => new Response(
      JSON.stringify({ id: "x", created: 1, model: "m", choices: [{ message: { role: "assistant", content: "{}" } }] }),
      { status: 200 },
    ));
    const { invokeLLM } = await importLLM();
    await invokeLLM({
      messages: [{ role: "user", content: "x" }],
      outputSchema: {
        name: "DefectReport",
        schema: { type: "object", properties: { summary: { type: "string" } } },
        strict: true,
      },
    });

    const body = JSON.parse((fetchMock!.mock.calls[0][1] as RequestInit).body as string);
    expect(body.response_format).toMatchObject({
      type: "json_schema",
      json_schema: {
        name: "DefectReport",
        strict: true,
      },
    });
  });

  it("rejects outputSchema missing name or schema (cannot send a half-built schema)", async () => {
    const { invokeLLM } = await importLLM();
    await expect(
      invokeLLM({
        messages: [{ role: "user", content: "x" }],
        outputSchema: { name: "X" } as any,
      }),
    ).rejects.toThrow(/name and schema/i);
  });

  it("rejects responseFormat=json_schema without a schema object", async () => {
    const { invokeLLM } = await importLLM();
    await expect(
      invokeLLM({
        messages: [{ role: "user", content: "x" }],
        responseFormat: { type: "json_schema", json_schema: { name: "x" } as any },
      }),
    ).rejects.toThrow(/schema object/i);
  });

  it("passes through an explicit responseFormat verbatim (no outputSchema conversion)", async () => {
    // When the caller provides a complete responseFormat, the helper
    // must NOT mangle it via the outputSchema/output_schema fallback
    // path — otherwise an explicit json_object request would silently
    // become a json_schema with a synthesised schema.
    let capturedBody: any;
    installFetchMock(async (_url, init) => {
      capturedBody = JSON.parse((init as RequestInit).body as string);
      return new Response(
        JSON.stringify({ id: "x", created: 1, model: "m", choices: [{ message: { role: "assistant", content: "{}" } }] }),
        { status: 200 },
      );
    });
    const { invokeLLM } = await importLLM();
    await invokeLLM({
      messages: [{ role: "user", content: "x" }],
      responseFormat: { type: "json_object" },
    });
    expect(capturedBody.response_format).toEqual({ type: "json_object" });
  });

  it("propagates HTTP failures with status + body in the error message", async () => {
    installFetchMock(async () => new Response("Forge: rate-limited", { status: 429 }));
    const { invokeLLM } = await importLLM();
    await expect(
      invokeLLM({ messages: [{ role: "user", content: "x" }] }),
    ).rejects.toThrow(/429.*rate-limited/);
  });

  it("flattens tool/function role messages by stringifying non-text parts", async () => {
    installFetchMock(async () => new Response(
      JSON.stringify({ id: "x", created: 1, model: "m", choices: [{ message: { role: "assistant", content: "ok" } }] }),
      { status: 200 },
    ));
    const { invokeLLM } = await importLLM();
    await invokeLLM({
      messages: [{
        role: "tool",
        tool_call_id: "call-1",
        content: [{ type: "text", text: "result" }, { type: "image_url", image_url: { url: "x" } } as any],
      }],
    });

    const body = JSON.parse((fetchMock!.mock.calls[0][1] as RequestInit).body as string);
    // Tool messages collapse to a single string with non-text parts JSON-encoded.
    expect(body.messages[0].role).toBe("tool");
    expect(typeof body.messages[0].content).toBe("string");
  });
});
