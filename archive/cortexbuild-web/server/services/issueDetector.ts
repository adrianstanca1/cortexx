/**
 * Issue Detector Service
 * Uses AI to detect construction issues from text messages.
 */
import { invokeLLM } from "../_core/llm";
import { insertIssue } from "../db";

export interface DetectedIssue {
  title: string;
  description: string;
  category: string;
  severity: "low" | "medium" | "high" | "critical";
  location?: string;
  confidence: number;
}

/**
 * Analyse a text message and detect any construction issues.
 */
export async function detectIssuesFromText(text: string): Promise<DetectedIssue[]> {
  if (!text || text.trim().length < 5) return [];

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are a construction site issue detection AI.
Analyse the following message from a construction site worker or manager.
Identify any construction issues, problems, defects, safety hazards, or concerns mentioned.
Return a JSON array of issues found. If no issues are mentioned, return an empty array.
Each issue must have:
- title: short descriptive title (max 80 chars)
- description: detailed description of the issue
- category: one of "safety_hazard", "structural", "electrical", "plumbing", "material", "schedule_delay", "quality", "equipment", "weather", "other"
- severity: "low", "medium", "high", or "critical"
- location: location on site if mentioned (optional)
- confidence: 0.0 to 1.0 confidence score`,
        },
        { role: "user", content: text },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "detected_issues",
          strict: true,
          schema: {
            type: "object",
            properties: {
              issues: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    description: { type: "string" },
                    category: { type: "string" },
                    severity: { type: "string" },
                    location: { type: "string" },
                    confidence: { type: "number" },
                  },
                  required: ["title", "description", "category", "severity", "confidence"],
                  additionalProperties: false,
                },
              },
            },
            required: ["issues"],
            additionalProperties: false,
          },
        },
      },
    });

    const raw = response.choices?.[0]?.message?.content;
    if (!raw || typeof raw !== "string") return [];

    const parsed = JSON.parse(raw) as { issues: DetectedIssue[] };
    return parsed.issues.filter((i) => i.confidence >= 0.5);
  } catch (err) {
    console.error("[IssueDetector] Failed to detect issues:", err);
    return [];
  }
}

/**
 * Detect issues from a message and save them to the database.
 */
export async function detectAndSaveIssues(opts: {
  contactId: number;
  conversationId: number;
  messageId: number;
  messageText: string;
  projectTag?: string;
}): Promise<DetectedIssue[]> {
  const { contactId, conversationId, messageId, messageText, projectTag } = opts;

  const detected = await detectIssuesFromText(messageText);

  for (const issue of detected) {
    await insertIssue({
      contactId,
      conversationId,
      title: issue.title,
      description: issue.description,
      category: issue.category as any,
      severity: issue.severity,
      status: "open",
      detectedFrom: "text",
      sourceMessageId: messageId,
      projectTag,
      location: issue.location,
      aiDetected: true,
      aiConfidence: issue.confidence,
    });
  }

  return detected;
}
