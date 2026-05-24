import type { InvokeParams, InvokeResult, Message } from "../../llm";

const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

function toGeminiText(messages: Message[]): string {
  return messages
    .map((m) => {
      const text =
        typeof m.content === "string" ? m.content : JSON.stringify(m.content);
      return `${m.role}: ${text}`;
    })
    .join("\n\n");
}

export async function geminiInvoke(params: InvokeParams): Promise<InvokeResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("gemini: GEMINI_API_KEY not configured");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_MODEL}:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ parts: [{ text: toGeminiText(params.messages) }] }],
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`gemini: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const now = Date.now();
  return {
    id: `gemini-${now}`,
    created: Math.floor(now / 1000),
    model: DEFAULT_MODEL,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: text },
        finish_reason: "stop",
      },
    ],
  };
}
