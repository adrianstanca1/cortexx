import type { InvokeParams, InvokeResult, Message } from "../../llm";

const DEFAULT_MODEL = process.env.OLLAMA_MODEL || "qwen2.5:7b";
const DEFAULT_BASE = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";

function toOllamaMessages(messages: Message[]) {
  return messages.map((m) => ({
    role: m.role === "tool" ? "user" : m.role,
    content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
  }));
}

export async function ollamaInvoke(params: InvokeParams): Promise<InvokeResult> {
  const url = `${DEFAULT_BASE.replace(/\/$/, "")}/api/chat`;
  const body = {
    model: DEFAULT_MODEL,
    messages: toOllamaMessages(params.messages),
    stream: false,
    options: { num_predict: params.max_tokens ?? params.maxTokens ?? 2048 },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`ollama: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { model?: string; message?: { content?: string }; done?: boolean };
  const now = Date.now();
  return {
    id: `ollama-${now}`,
    created: Math.floor(now / 1000),
    model: data.model ?? DEFAULT_MODEL,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: data.message?.content ?? "" },
        finish_reason: data.done ? "stop" : "length",
      },
    ],
  };
}
