import { unifiedInvoke } from "./unified-ai";
import { log } from "./logger";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?: "audio/mpeg" | "audio/wav" | "application/pdf" | "audio/mp4" | "video/mp4";
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = {
  type: "function";
  function: {
    name: string;
  };
};

export type ToolChoice = ToolChoicePrimitive | ToolChoiceByName | ToolChoiceExplicit;

export type InvokeParams = {
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: {
      role: Role;
      content: string | (TextContent | ImageContent | FileContent)[];
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type OutputSchema = JsonSchema;

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

const ensureArray = (value: MessageContent | MessageContent[]): MessageContent[] =>
  Array.isArray(value) ? value : [value];

const latestUserText = (messages: Message[]) => {
  const user = [...messages].reverse().find((message) => message.role === "user");
  if (!user) return "";
  return ensureArray(user.content)
    .map((part) => {
      if (typeof part === "string") return part;
      if (part.type === "text") return part.text;
      if (part.type === "image_url") return "[image]";
      if (part.type === "file_url") return "[file]";
      return "";
    })
    .join("\n");
};

const fallbackResult = (params: InvokeParams): InvokeResult => {
  const now = Date.now();
  const userText = latestUserText(params.messages);
  const wantsJson =
    params.responseFormat?.type === "json_object" ||
    params.response_format?.type === "json_object" ||
    params.responseFormat?.type === "json_schema" ||
    params.response_format?.type === "json_schema";
  const content = wantsJson
    ? JSON.stringify({
        summary: "AI service is running in fallback mode because no LLM provider key is configured.",
        context: userText || "No prompt provided",
        recommendations: [
          "Core database-backed app features remain available.",
          "Configure BUILT_IN_FORGE_API_KEY to enable full AI analysis.",
        ],
        overallRating: "Service configuration required",
      })
    : [
        "AI fallback mode is active.",
        "",
        "The production app can still save and retrieve your projects, files, reports, timesheets, and approvals. Full AI responses require a configured LLM provider key.",
        userText ? `\nYour request: ${userText}` : "",
      ].join("\n");
  return {
    id: `fallback-${now}`,
    created: Math.floor(now / 1000),
    model: "cortexbuild-fallback",
    choices: [
      {
        index: 0,
        message: { role: "assistant", content },
        finish_reason: "stop",
      },
    ],
  };
};

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  try {
    return await unifiedInvoke(params);
  } catch (e) {
    log.error("[llm] all providers failed:", e);
    return fallbackResult(params);
  }
}
