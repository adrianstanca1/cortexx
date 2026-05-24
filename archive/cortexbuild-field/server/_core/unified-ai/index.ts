import type { InvokeParams, InvokeResult } from "../llm";
import { CircuitBreaker } from "./circuit-breaker";
import { ollamaInvoke } from "./providers/ollama";
import { geminiInvoke } from "./providers/gemini";
import { openrouterInvoke } from "./providers/openrouter";

const ollamaBreaker = new CircuitBreaker("ollama");
const geminiBreaker = new CircuitBreaker("gemini");
const openrouterBreaker = new CircuitBreaker("openrouter");

type ProviderEntry = {
  name: string;
  fn: (p: InvokeParams) => Promise<InvokeResult>;
  cb: CircuitBreaker;
  available: boolean;
};

export async function unifiedInvoke(params: InvokeParams): Promise<InvokeResult> {
  const errors: string[] = [];

  // Ordered fallback: Ollama (local) → Gemini → OpenRouter.
  // Ollama is always "available" — its provider throws on connection refused,
  // which trips the breaker after `threshold` consecutive failures.
  const providers: ProviderEntry[] = [
    { name: "ollama", fn: ollamaInvoke, cb: ollamaBreaker, available: true },
    {
      name: "gemini",
      fn: geminiInvoke,
      cb: geminiBreaker,
      available: !!process.env.GEMINI_API_KEY,
    },
    {
      name: "openrouter",
      fn: openrouterInvoke,
      cb: openrouterBreaker,
      available: !!process.env.OPENROUTER_API_KEY,
    },
  ];

  for (const p of providers) {
    if (!p.available) continue;
    if (!p.cb.canAttempt()) {
      errors.push(`${p.name}: circuit open`);
      continue;
    }
    try {
      const result = await p.fn(params);
      p.cb.onSuccess();
      return result;
    } catch (e) {
      p.cb.onFailure();
      errors.push(`${p.name}: ${(e as Error).message}`);
    }
  }
  throw new Error(`unified-ai: all providers failed: ${errors.join(" | ")}`);
}

export function unifiedAiHealth() {
  return [ollamaBreaker, geminiBreaker, openrouterBreaker].map((cb) => cb.status());
}
