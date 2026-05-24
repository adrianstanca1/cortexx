/**
 * Memory Engine
 * Stores and retrieves persistent conversation context per contact.
 * Used by the AI agent to build context-aware responses.
 */
import { invokeLLM } from "../_core/llm";
import {
  getMemorySections,
  getRecentMessages,
  insertMemorySection,
  flagKeySection,
} from "../db";

export interface MemoryContext {
  recentMessages: Array<{ role: "user" | "assistant"; content: string; sentAt: Date }>;
  memorySections: Array<{
    sectionType: string;
    title: string;
    content: string;
    importance: string;
    createdAt: Date;
  }>;
  summary: string;
}

/**
 * Build a full memory context for a contact to inject into AI prompts.
 */
export async function buildMemoryContext(contactId: number): Promise<MemoryContext> {
  const [recentMsgs, sections] = await Promise.all([
    getRecentMessages(contactId, 20),
    getMemorySections(contactId, 30),
  ]);

  const recentMessages = recentMsgs
    .reverse()
    .map((m) => ({
      role: (m.direction === "inbound" ? "user" : "assistant") as "user" | "assistant",
      content: m.body ?? "[media]",
      sentAt: m.sentAt,
    }));

  const memorySectionsMapped = sections.map((s) => ({
    sectionType: s.sectionType,
    title: s.title,
    content: s.content,
    importance: s.importance,
    createdAt: s.createdAt,
  }));

  const summary =
    sections.length > 0
      ? `Key context: ${sections
          .filter((s) => s.importance === "high" || s.importance === "critical")
          .slice(0, 5)
          .map((s) => `[${s.sectionType}] ${s.title}: ${s.content.slice(0, 100)}`)
          .join("; ")}`
      : "No prior context stored.";

  return { recentMessages, memorySections: memorySectionsMapped, summary };
}

/**
 * Analyse a message and extract memory-worthy sections using AI.
 * Saves them to the database and flags the source message.
 */
export async function extractAndStoreMemory(opts: {
  contactId: number;
  conversationId: number;
  messageId: number;
  messageText: string;
}): Promise<void> {
  const { contactId, conversationId, messageId, messageText } = opts;

  if (!messageText || messageText.trim().length < 10) return;

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are a construction site assistant memory extractor. 
Analyse the following message from a construction site worker or manager.
Extract any important information worth remembering: decisions made, instructions given, project updates, issues mentioned, or key contact info.
Return a JSON array of memory items. Each item has:
- sectionType: one of "key_decision", "instruction", "project_update", "issue_mention", "contact_info", "general"
- title: short title (max 80 chars)
- content: the extracted content (max 300 chars)
- importance: "low", "medium", "high", or "critical"
If nothing is worth remembering, return an empty array [].`,
        },
        { role: "user", content: messageText },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "memory_items",
          strict: true,
          schema: {
            type: "object",
            properties: {
              items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    sectionType: { type: "string" },
                    title: { type: "string" },
                    content: { type: "string" },
                    importance: { type: "string" },
                  },
                  required: ["sectionType", "title", "content", "importance"],
                  additionalProperties: false,
                },
              },
            },
            required: ["items"],
            additionalProperties: false,
          },
        },
      },
    });

    const raw = response.choices?.[0]?.message?.content;
    if (!raw || typeof raw !== 'string') return;

    const parsed = JSON.parse(raw) as { items: Array<{ sectionType: string; title: string; content: string; importance: string }> };
    if (!parsed.items?.length) return;

    for (const item of parsed.items) {
      await insertMemorySection({
        contactId,
        conversationId,
        sectionType: item.sectionType as any,
        title: item.title,
        content: item.content,
        importance: item.importance as any,
        sourceMessageId: messageId,
        isActive: true,
      });
    }

    // Flag the message as a key section if high/critical items were found
    const highImportance = parsed.items.find((i) => i.importance === "high" || i.importance === "critical");
    if (highImportance) {
      await flagKeySection(messageId, highImportance.title);
    }
  } catch (err) {
    console.error("[MemoryEngine] Failed to extract memory:", err);
  }
}

/**
 * Build the system prompt for the AI agent, incorporating memory context.
 */
export function buildAgentSystemPrompt(context: MemoryContext, contactName?: string): string {
  const memoryBlock =
    context.memorySections.length > 0
      ? context.memorySections
          .slice(0, 15)
          .map((s) => `[${s.sectionType.toUpperCase()} | ${s.importance}] ${s.title}: ${s.content}`)
          .join("\n")
      : "No stored memory yet.";

  return `You are CortexBuild AI — an intelligent personal assistant for construction site management.
You are communicating via WhatsApp with ${contactName ?? "a team member"}.

YOUR ROLE:
- Act as a knowledgeable construction site assistant
- Help track issues, progress, safety, and decisions
- Remember and reference past conversations
- Be concise and practical (WhatsApp messages should be short)
- Detect and flag safety hazards or critical issues immediately
- Respond in the same language the user writes in

STORED MEMORY ABOUT THIS CONTACT:
${memoryBlock}

RECENT CONVERSATION SUMMARY:
${context.summary}

GUIDELINES:
- Keep responses under 300 characters when possible (WhatsApp-friendly)
- Use bullet points sparingly — prefer short paragraphs
- If an issue is detected, acknowledge it and ask for more details or a photo
- Never make up facts about the project — only reference what you know
- If asked for a report, tell them it will be generated and sent shortly`;
}
