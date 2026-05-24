import { GoogleGenAI, LiveServerMessage, Modality, Content, GenerateContentResponse, Type } from "@google/genai";
import { Message } from "../types";

const API_KEY = process.env.GEMINI_API_KEY || process.env.API_KEY || '';

function getAI(): GoogleGenAI {
  if (!API_KEY) throw new Error('Gemini API key not configured. AI features are unavailable.');
  return new GoogleGenAI({ apiKey: API_KEY });
}

// Type definitions for Gemini tools and tool config
export interface GeminiTool {
  googleSearch?: {};
  googleMaps?: {};
  googleSearchRetrieval?: {};
  codeExecution?: {};
  functionDeclarations?: Array<{ name: string; description: string; parameters: object }>;
}

export interface ToolConfig {
  retrievalConfig?: {
    latLng?: { latitude: number; longitude: number };
  };
}

export interface ChatConfig {
  model: string;
  systemInstruction?: string;
  thinkingBudget?: number;
  tools?: GeminiTool[];
  responseMimeType?: string;
  toolConfig?: ToolConfig;
}

/**
 * Generic configuration for prompt execution.
 */
export interface GenConfig {
  temperature?: number;
  topP?: number;
  responseMimeType?: string;
  systemInstruction?: string;
  thinkingConfig?: { thinkingBudget: number };
  model?: string;
  tools?: GeminiTool[];
  toolConfig?: ToolConfig;
  imageConfig?: {
      aspectRatio?: string;
      imageSize?: string;
  };
}

/**
 * Callback for streaming response chunks.
 */
export interface StreamChunkCallback {
  (text: string, metadata?: Record<string, unknown>): void;
}

/**
 * Sends a chat message and returns a streaming response.
 * Follows the direct sendMessageStream pattern.
 */
export const streamChatResponse = async (
  history: Message[],
  newMessage: string,
  imageData?: string,
  mimeType: string = 'image/jpeg',
  onChunk?: StreamChunkCallback,
  configOverride?: ChatConfig
): Promise<GenerateContentResponse> => {

  const model = configOverride?.model || "gemini-3-pro-preview";

  try {
    const apiHistory: Content[] = history
      .filter(msg => !msg.isThinking && msg.id !== 'intro')
      .map(msg => {
        const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];
        if (msg.text) parts.push({ text: msg.text });
        if (msg.image && msg.role === 'user') {
          const matches = msg.image.match(/^data:(.+);base64,(.+)$/);
          if (matches) {
            parts.push({ inlineData: { mimeType: matches[1], data: matches[2] } });
          }
        }
        return { role: msg.role, parts };
      });

    // Create a new instance right before call as per best practices
    const chatAi = getAI();

    const chatConfig: {
      systemInstruction: string;
      thinkingConfig?: { thinkingBudget: number };
      tools?: GeminiTool[];
      toolConfig?: ToolConfig;
      responseMimeType?: string;
    } = {
      systemInstruction: configOverride?.systemInstruction || "You are a helpful and precise AI assistant for the BuildPro construction platform.",
    };

    // Apply thinking budget only to Gemini 3 series
    if (model.includes('gemini-3') && configOverride?.thinkingBudget) {
      chatConfig.thinkingConfig = { thinkingBudget: configOverride.thinkingBudget };
    }

    if (configOverride?.tools) chatConfig.tools = configOverride.tools;
    if (configOverride?.toolConfig) chatConfig.toolConfig = configOverride.toolConfig;
    if (configOverride?.responseMimeType) chatConfig.responseMimeType = configOverride.responseMimeType;

    const chat = chatAi.chats.create({
      model: model,
      config: chatConfig,
      history: apiHistory
    });

    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
    if (newMessage.trim()) parts.push({ text: newMessage });
    if (imageData) {
        const base64Data = imageData.includes(',') ? imageData.split(',')[1] : imageData;
        parts.push({ inlineData: { mimeType, data: base64Data } });
    }

    const messageParts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = parts.length > 0 ? parts : [{ text: "Analyze current context." }];

    const result = await chat.sendMessageStream({ message: messageParts });
    
    let finalResponse: GenerateContentResponse | undefined;
    for await (const chunk of result) {
      finalResponse = chunk as GenerateContentResponse;
      if (onChunk && finalResponse.text) {
          const metadata = finalResponse.candidates?.[0]?.groundingMetadata;
          onChunk(finalResponse.text, metadata);
      }
    }
    
    return finalResponse!;

  } catch (error) {
    console.error("Neural link error:", error);
    throw error;
  }
};

/**
 * Grounding chunk types for search results.
 */
export interface GroundingChunk {
  web?: { uri?: string; title?: string };
  retrievedContext?: { uri?: string; title?: string };
}

/**
 * Search result with text and grounding links.
 */
export interface SearchResult {
  text: string;
  links: GroundingChunk[];
}

/**
 * Performs real-time web-grounded research search using Google Search tools.
 */
export const researchGroundingSearch = async (query: string): Promise<SearchResult> => {
    const researchAi = getAI();
    const response = await researchAi.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: query,
        config: {
            tools: [{ googleSearch: {} }],
            systemInstruction: "You are a forensic industry analyst. Extract real-time pricing, indices, and regulatory data."
        }
    });

    return {
        text: response.text || "",
        links: (response.candidates?.[0]?.groundingMetadata?.groundingChunks as GroundingChunk[]) || []
    };
};

/**
 * Performs specialized Google Maps grounding search.
 */
export const mapsGroundingSearch = async (query: string, lat: number, lng: number): Promise<SearchResult> => {
    const mapsAi = getAI();
    const response = await mapsAi.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: query,
        config: {
            tools: [{ googleMaps: {} }],
            toolConfig: {
                retrievalConfig: {
                    latLng: { latitude: lat, longitude: lng }
                }
            }
        }
    });

    return {
        text: response.text || "",
        links: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
    };
};

/**
 * Invoice analysis result structure.
 */
export interface InvoiceAnalysis {
  vendorDetails?: { name?: string; address?: string };
  totalAmount?: number;
  dueDate?: string;
  itemizedLineItems?: Array<{ description?: string; quantity?: number; unitPrice?: number }>;
}

/**
 * Forensicly analyzes an invoice image.
 */
export const analyzeInvoiceImage = async (base64Data: string, mimeType: string): Promise<InvoiceAnalysis> => {
    const invAi = getAI();
    const response = await invAi.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: {
            parts: [
                { inlineData: { mimeType, data: base64Data } },
                { text: `Analyze this construction invoice. Extract:
                        1. Vendor Details (Name, Address),
                        2. Total Amount,
                        3. Due Date,
                        4. Itemized Line Items (Description, Quantity, Unit Price).
                        Return JSON only.` }
            ]
        },
        config: {
            responseMimeType: "application/json",
            thinkingConfig: { thinkingBudget: 4096 }
        }
    });
    return JSON.parse(response.text || "{}") as InvoiceAnalysis;
};

/**
 * Audit result structure for deep registry audit.
 */
export interface AuditResult {
  healthScore: number;
  criticalGaps: string[];
  proposedFixes: string[];
}

/**
 * Dataset structure for deep registry audit.
 */
export interface AuditDatasets {
  projects: unknown[];
  ledger: unknown[];
  workforce: unknown[];
}

/**
 * Executes a deep audit of the entire company database shard.
 * Ingests multiple datasets for cross-entity logic verification.
 */
export const deepRegistryAudit = async (datasets: AuditDatasets): Promise<AuditResult> => {
    const auditAi = getAI();
    const prompt = `
        Act as a Sovereign AI Auditor for CortexBuildPro.
        Analyze the following cross-entity datasets for structural and financial drift:
        - PROJECTS: ${JSON.stringify(datasets.projects)}
        - LEDGER: ${JSON.stringify(datasets.ledger)}
        - WORKFORCE: ${JSON.stringify(datasets.workforce)}

        TASK:
        1. Identify "Silent Risks" where project delays correlate with workforce skill gaps or pending invoice settlements.
        2. Propose 3 "Genesis Optimizations" to restore operational baseline.

        Return valid JSON: { "healthScore": number, "criticalGaps": [], "proposedFixes": [] }
    `;

    const response = await auditAi.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            thinkingConfig: { thinkingBudget: 32768 }
        }
    });
    return JSON.parse(response.text || "{}") as AuditResult;
};

/**
 * Prebuilt voice configuration.
 */
export interface PrebuiltVoiceConfig {
  voiceName: 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Aoede' | string;
}

/**
 * Generates speech from text using Gemini 2.5 Flash TTS.
 */
export const generateSpeech = async (text: string, voice: string = 'Kore'): Promise<string> => {
    const ttsAi = getAI();
    const response = await ttsAi.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: voice as PrebuiltVoiceConfig['voiceName'] },
                },
            },
        },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || "";
};

export const runRawPrompt = async (prompt: string, config?: GenConfig, mediaData?: string, mimeType: string = 'image/jpeg'): Promise<string> => {
    const model = config?.model || 'gemini-3-flash-preview';
    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [{ text: prompt }];
    if (mediaData) parts.push({ inlineData: { mimeType, data: mediaData } });

    const promptAi = getAI();
    const result = await promptAi.models.generateContent({
      model,
      contents: { parts },
      config
    });
    return result.text || "";
};

export const parseAIJSON = <T = Record<string, unknown>>(text: string): T => {
  try {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    return JSON.parse(match ? match[1] : text.trim()) as T;
  } catch (e) {
    throw new Error("Invalid JSON format from logic core.");
  }
};

export const getLiveClient = () => {
    const liveAi = getAI();
    return liveAi.live;
};

export const transcribeAudio = async (base64Audio: string, mimeType: string): Promise<string> => {
    const transcribeAi = getAI();
    const response = await transcribeAi.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
            parts: [
                { inlineData: { mimeType, data: base64Audio } },
                { text: "Transcribe exactly. Return only the transcription." }
            ]
        }
    });
    return response.text || "";
};

/**
 * Aspect ratio options for image generation.
 */
export type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | string;

/**
 * Generates an image using Gemini 2.5 Flash Image.
 */
export const generateImage = async (prompt: string, aspectRatio: string = "1:1"): Promise<string> => {
    const imgAi = getAI();
    const response = await imgAi.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: prompt }] },
        config: {
            imageConfig: {
                aspectRatio: aspectRatio as AspectRatio
            }
        }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
            return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
    }
    throw new Error("Sovereign Forge failed to synthesize the request. Ensure proper API key clearance.");
};

/**
 * Drawing analysis result structure.
 */
export interface DrawingAnalysis {
  technicalSummary?: string;
  significantElements?: Array<{ element?: string; dimension?: string }>;
  estimatedMaterialQuantities?: Array<{ material?: string; quantity?: number; unit?: string }>;
  potentialStructuralRisks?: string[];
}

/**
 * Analyzes a technical drawing using Gemini 3 Pro.
 */
export const analyzeDrawing = async (base64Data: string, mimeType: string): Promise<DrawingAnalysis> => {
    const drawingAi = getAI();
    const response = await drawingAi.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: {
            parts: [
                { inlineData: { mimeType, data: base64Data } },
                { text: `Act as a professional structural engineer. Analyze this technical drawing.
                        Extract:
                        1. A high-level technical summary,
                        2. Significant Elements and Dimensions,
                        3. Estimated Material Quantities (Steel, Concrete, etc.),
                        4. Potential Structural Risks.
                        Return the analysis in a structured JSON format.` }
            ]
        },
        config: {
            responseMimeType: "application/json",
            thinkingConfig: { thinkingBudget: 8192 }
        }
    });
    return JSON.parse(response.text || "{}") as DrawingAnalysis;
};

/**
 * Pricing variance node structure.
 */
export interface PricingVarianceNode {
  item?: string;
  currentPrice?: number;
  marketPrice?: number;
  variance?: number;
}

/**
 * Market pricing check result structure.
 */
export interface MarketPricingResult {
  analysis: string;
  varianceNodes: PricingVarianceNode[];
}

/**
 * Verifies market pricing for construction materials using web grounding.
 */
export const checkMarketPricing = async (items: { description: string, price: number }[], location: string): Promise<MarketPricingResult> => {
    const priceAi = getAI();
    const prompt = `Perform a real-time market pricing audit for these construction items in ${location}: ${JSON.stringify(items)}.
                   Reconcile these prices with current 2025 global and local indices.
                   Identify any items that are significantly above or below market nominals.
                   Return a concise variance report in JSON format: { "analysis": "string", "varianceNodes": [] }.`;
    const response = await priceAi.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: {
            tools: [{ googleSearch: {} }],
            responseMimeType: "application/json",
            thinkingConfig: { thinkingBudget: 4096 }
        }
    });
    return JSON.parse(response.text || "{}") as MarketPricingResult;
};
