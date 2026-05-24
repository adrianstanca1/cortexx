import { describe, expect, it } from "vitest";
import { CircuitBreaker } from "../server/_core/unified-ai/circuit-breaker";
import { invokeLLM } from "../server/_core/llm";

describe("CircuitBreaker", () => {
  it("opens after threshold failures", () => {
    const cb = new CircuitBreaker("test", 3, 1000);
    expect(cb.canAttempt(0)).toBe(true);
    cb.onFailure(0);
    cb.onFailure(0);
    cb.onFailure(0);
    expect(cb.canAttempt(500)).toBe(false);
    expect(cb.canAttempt(1500)).toBe(true); // half-open after cooldown
  });

  it("recovers on success", () => {
    const cb = new CircuitBreaker("test", 2, 1000);
    cb.onFailure(0);
    cb.onFailure(0);
    expect(cb.canAttempt(0)).toBe(false);
    expect(cb.canAttempt(2000)).toBe(true);
    cb.onSuccess();
    cb.onFailure(2000);
    expect(cb.canAttempt(2000)).toBe(true);
  });
});

describe.skipIf(
  !process.env.OLLAMA_BASE_URL &&
    !process.env.GEMINI_API_KEY &&
    !process.env.OPENROUTER_API_KEY,
)("invokeLLM (integration)", () => {
  it("returns text from at least one provider", async () => {
    const r = await invokeLLM({
      messages: [{ role: "user", content: "Reply with the single word 'pong'." }],
      max_tokens: 10,
    });
    expect(r.choices[0].message.content).toBeTruthy();
  });
});
