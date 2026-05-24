/**
 * WhatsApp Business Cloud API Client
 * Handles sending messages, downloading media, and interacting with the Meta API.
 */
import axios from "axios";

const WA_API_VERSION = "v21.0";

function getConfig() {
  return {
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN ?? "",
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? "",
    baseUrl: `https://graph.facebook.com/${WA_API_VERSION}`,
  };
}

/**
 * Send a text message to a WhatsApp number.
 */
export async function sendTextMessage(to: string, text: string): Promise<string | null> {
  const { accessToken, phoneNumberId, baseUrl } = getConfig();
  if (!accessToken || !phoneNumberId) {
    console.warn("[WhatsApp] Missing credentials — message not sent");
    return null;
  }

  try {
    const response = await axios.post(
      `${baseUrl}/${phoneNumberId}/messages`,
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { preview_url: false, body: text },
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data?.messages?.[0]?.id ?? null;
  } catch (err: any) {
    console.error("[WhatsApp] Failed to send text:", err?.response?.data ?? err.message);
    return null;
  }
}

/**
 * Send a document (PDF) to a WhatsApp number via URL.
 */
export async function sendDocumentMessage(to: string, documentUrl: string, filename: string, caption?: string): Promise<string | null> {
  const { accessToken, phoneNumberId, baseUrl } = getConfig();
  if (!accessToken || !phoneNumberId) return null;

  try {
    const response = await axios.post(
      `${baseUrl}/${phoneNumberId}/messages`,
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "document",
        document: { link: documentUrl, filename, caption: caption ?? "" },
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data?.messages?.[0]?.id ?? null;
  } catch (err: any) {
    console.error("[WhatsApp] Failed to send document:", err?.response?.data ?? err.message);
    return null;
  }
}

/**
 * Download media from WhatsApp servers using the media ID.
 * Returns the media as a Buffer.
 */
export async function downloadWhatsAppMedia(mediaId: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const { accessToken, baseUrl } = getConfig();
  if (!accessToken) return null;

  try {
    // Step 1: Get the media URL
    const metaResponse = await axios.get(`${baseUrl}/${mediaId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const mediaUrl: string = metaResponse.data?.url;
    const mimeType: string = metaResponse.data?.mime_type ?? "application/octet-stream";

    if (!mediaUrl) return null;

    // Step 2: Download the actual media bytes
    const mediaResponse = await axios.get(mediaUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
      responseType: "arraybuffer",
    });

    return {
      buffer: Buffer.from(mediaResponse.data),
      mimeType,
    };
  } catch (err: any) {
    console.error("[WhatsApp] Failed to download media:", err?.response?.data ?? err.message);
    return null;
  }
}

/**
 * Mark a message as read.
 */
export async function markMessageRead(messageId: string): Promise<void> {
  const { accessToken, phoneNumberId, baseUrl } = getConfig();
  if (!accessToken || !phoneNumberId) return;

  try {
    await axios.post(
      `${baseUrl}/${phoneNumberId}/messages`,
      {
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );
  } catch {
    // Non-critical — ignore read receipt failures
  }
}

/**
 * Parse incoming WhatsApp webhook payload into a normalized message object.
 */
export interface ParsedWhatsAppMessage {
  waMessageId: string;
  from: string; // phone number
  profileName?: string;
  messageType: "text" | "image" | "document" | "audio" | "video" | "location" | "sticker" | "reaction" | "system";
  body?: string;
  mediaId?: string;
  mimeType?: string;
  caption?: string;
  timestamp: Date;
  waConversationId?: string;
}

export function parseWebhookPayload(body: any): ParsedWhatsAppMessage[] {
  const messages: ParsedWhatsAppMessage[] = [];

  try {
    const entry = body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (!value?.messages) return [];

    for (const msg of value.messages) {
      const contact = value.contacts?.find((c: any) => c.wa_id === msg.from);
      const conversation = value.metadata?.conversation;

      const parsed: ParsedWhatsAppMessage = {
        waMessageId: msg.id,
        from: msg.from,
        profileName: contact?.profile?.name,
        messageType: msg.type,
        timestamp: new Date(parseInt(msg.timestamp) * 1000),
        waConversationId: conversation?.id,
      };

      switch (msg.type) {
        case "text":
          parsed.body = msg.text?.body;
          break;
        case "image":
          parsed.mediaId = msg.image?.id;
          parsed.mimeType = msg.image?.mime_type;
          parsed.caption = msg.image?.caption;
          break;
        case "document":
          parsed.mediaId = msg.document?.id;
          parsed.mimeType = msg.document?.mime_type;
          parsed.caption = msg.document?.caption;
          break;
        case "audio":
          parsed.mediaId = msg.audio?.id;
          parsed.mimeType = msg.audio?.mime_type;
          break;
        case "video":
          parsed.mediaId = msg.video?.id;
          parsed.mimeType = msg.video?.mime_type;
          parsed.caption = msg.video?.caption;
          break;
        case "location":
          parsed.body = `Location: ${msg.location?.latitude}, ${msg.location?.longitude}`;
          break;
        default:
          parsed.body = "[unsupported message type]";
      }

      messages.push(parsed);
    }
  } catch (err) {
    console.error("[WhatsApp] Failed to parse webhook payload:", err);
  }

  return messages;
}
