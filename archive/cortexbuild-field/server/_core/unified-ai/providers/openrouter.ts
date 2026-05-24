import type { InvokeParams, InvokeResult, Message } from "../../llm";

const DEFAULT_MODEL =
  process.env.OPENROUTER_MODEL || "anthropic/claude-sonnet-4";

function toOpenAiMessages(messages: Message[]) {
  return messages.map((m) => ({
    role: m.role === "tool" ? "user" : m.role,
    content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
  }));
}

export async function openrouterInvoke(params: InvokeParams): Promise<InvokeResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("openrouter: OPENROUTER_API_KEY not configured");

  const url = "https://openrouter.ai/api/v1/chat/completions";
  const body = {
    model: DEFAULT_MODEL,
    messages: toOpenAiMessages(params.messages),
    max_tokens: params.max_tokens ?? params.maxTokens ?? 4000,
  };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://cortexbuild-field",
      "X-Title": "CortexBuild Field",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`openrouter: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as {
    id?: string;
    created?: number;
    model?: string;
    choices?: {
      index?: number;
      message?: { role?: string; content?: string };
      finish_reason?: string | null;
    }[];
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  };
  const now = Date.now();
  return {
    id: data.id ?? `openrouter-${now}`,
    created: data.created ?? Math.floor(now / 1000),
    model: data.model ?? DEFAULT_MODEL,
    choices: (data.choices ?? []).map((c, i) => ({
      index: c.index ?? i,
      message: {
        role: "assistant",
        content: c.message?.content ?? "",
      },
      finish_reason: c.finish_reason ?? "stop",
    })),
    usage: data.usage,
  };
}
