/**
 * Vision AI Service
 * Analyzes construction site images using multimodal LLM.
 * Detects issues, safety hazards, and progress updates.
 */
import { invokeLLM } from "../_core/llm";
import { updateMediaVision, getMediaById, insertIssue } from "../db";

export interface VisionAnalysisResult {
  description: string;
  tags: string[];
  issuesDetected: string[];
  safetyHazards: string[];
  progressNotes: string;
  confidence: number;
  shouldCreateIssue: boolean;
  issueSeverity?: "low" | "medium" | "high" | "critical";
  issueCategory?: string;
  issueTitle?: string;
}

/**
 * Analyze a construction site image using vision AI.
 */
export async function analyzeConstructionImage(imageUrl: string): Promise<VisionAnalysisResult> {
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are an expert construction site inspector AI. 
Analyze the provided image and return a structured JSON assessment.
Focus on: safety hazards, structural issues, material quality, progress status, equipment condition, and any visible problems.
Be specific and technical in your descriptions.`,
      },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: imageUrl, detail: "high" },
          },
          {
            type: "text",
            text: "Analyze this construction site image. Identify any issues, safety hazards, or progress updates.",
          },
        ],
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "vision_analysis",
        strict: true,
        schema: {
          type: "object",
          properties: {
            description: { type: "string", description: "Detailed description of what is visible in the image" },
            tags: { type: "array", items: { type: "string" }, description: "Keywords describing the image content" },
            issuesDetected: { type: "array", items: { type: "string" }, description: "List of construction issues found" },
            safetyHazards: { type: "array", items: { type: "string" }, description: "Safety hazards visible in the image" },
            progressNotes: { type: "string", description: "Notes about construction progress visible" },
            confidence: { type: "number", description: "Confidence score 0-1 for the analysis" },
            shouldCreateIssue: { type: "boolean", description: "Whether a formal issue should be created" },
            issueSeverity: { type: "string", description: "Severity if issue: low, medium, high, or critical" },
            issueCategory: { type: "string", description: "Category: safety_hazard, structural, electrical, plumbing, material, quality, equipment, other" },
            issueTitle: { type: "string", description: "Short title for the issue if one should be created" },
          },
          required: ["description", "tags", "issuesDetected", "safetyHazards", "progressNotes", "confidence", "shouldCreateIssue"],
          additionalProperties: false,
        },
      },
    },
  });

  const raw = response.choices?.[0]?.message?.content;
  if (!raw || typeof raw !== "string") {
    return {
      description: "Analysis unavailable",
      tags: [],
      issuesDetected: [],
      safetyHazards: [],
      progressNotes: "",
      confidence: 0,
      shouldCreateIssue: false,
    };
  }

  return JSON.parse(raw) as VisionAnalysisResult;
}

/**
 * Process a media record: run vision AI analysis and optionally create an issue.
 */
export async function processMediaWithVision(opts: {
  mediaId: number;
  contactId: number;
  conversationId: number;
  projectTag?: string;
}): Promise<VisionAnalysisResult | null> {
  const { mediaId, contactId, conversationId, projectTag } = opts;

  try {
    const mediaRecord = await getMediaById(mediaId);
    if (!mediaRecord || mediaRecord.mediaType !== "image") return null;
    if (mediaRecord.visionAnalyzed) return null;

    const result = await analyzeConstructionImage(mediaRecord.s3Url);

    // Store vision results on the media record
    await updateMediaVision(mediaId, {
      visionDescription: result.description,
      visionTags: result.tags,
      visionIssuesDetected: result.issuesDetected,
      visionSafetyHazards: result.safetyHazards,
      visionProgressNotes: result.progressNotes,
      visionConfidence: result.confidence,
    });

    // Auto-create issue if vision AI detected a significant problem
    if (result.shouldCreateIssue && result.issueTitle) {
      const allProblems = [...result.issuesDetected, ...result.safetyHazards];
      await insertIssue({
        contactId,
        conversationId,
        title: result.issueTitle,
        description: allProblems.join(". ") || result.description,
        category: (result.issueCategory as any) ?? "other",
        severity: (result.issueSeverity as any) ?? "medium",
        status: "open",
        detectedFrom: "image",
        relatedMediaIds: [mediaId],
        projectTag,
        aiDetected: true,
        aiConfidence: result.confidence,
      });
    }

    return result;
  } catch (err) {
    console.error("[VisionAI] Failed to process media:", err);
    return null;
  }
}
