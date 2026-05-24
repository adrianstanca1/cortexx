/**
 * Webhook Processor
 * Full pipeline for processing incoming WhatsApp messages:
 * 1. Parse & persist contact/conversation/message
 * 2. Download & store media to S3
 * 3. Run vision AI on images
 * 4. Detect issues from text
 * 5. Extract memory sections
 * 6. Generate AI response and send back
 */
import { nanoid } from "nanoid";
import { storagePut } from "../storage";
import { invokeLLM } from "../_core/llm";
import {
  upsertContact,
  getOrCreateConversation,
  insertMessage,
  insertMedia,
  incrementConversationCounts,
  markMessageProcessed,
} from "../db";
import {
  buildMemoryContext,
  extractAndStoreMemory,
  buildAgentSystemPrompt,
} from "./memoryEngine";
import { processMediaWithVision } from "./visionAI";
import { detectAndSaveIssues } from "./issueDetector";
import {
  downloadWhatsAppMedia,
  sendTextMessage,
  markMessageRead,
  type ParsedWhatsAppMessage,
} from "./whatsappClient";

function mimeToExtension(mimeType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "audio/ogg": "ogg",
    "audio/mpeg": "mp3",
    "video/mp4": "mp4",
    "application/pdf": "pdf",
  };
  return map[mimeType] ?? "bin";
}

/**
 * Process a single parsed WhatsApp message through the full pipeline.
 */
export async function processIncomingMessage(msg: ParsedWhatsAppMessage): Promise<void> {
  try {
    // 1. Upsert contact
    const contact = await upsertContact({
      waId: msg.from,
      phoneNumber: msg.from,
      displayName: msg.profileName,
      profileName: msg.profileName,
    });

    // 2. Get or create conversation
    const conversation = await getOrCreateConversation(contact.id, msg.waConversationId);

    // 3. Handle media download and S3 upload
    let mediaRecord = null;
    if (msg.mediaId && msg.messageType !== "text") {
      const downloaded = await downloadWhatsAppMedia(msg.mediaId);
      if (downloaded) {
        const ext = mimeToExtension(downloaded.mimeType);
        const s3Key = `whatsapp-media/${contact.waId}/${nanoid(10)}.${ext}`;
        const { url: s3Url } = await storagePut(s3Key, downloaded.buffer, downloaded.mimeType);

        mediaRecord = await insertMedia({
          conversationId: conversation.id,
          contactId: contact.id,
          waMediaId: msg.mediaId,
          mediaType: msg.messageType as any,
          mimeType: downloaded.mimeType,
          s3Key,
          s3Url,
          caption: msg.caption,
          projectTag: contact.projectTag ?? undefined,
          sentAt: msg.timestamp,
        });
      }
    }

    // 4. Save the message to DB
    const savedMessage = await insertMessage({
      conversationId: conversation.id,
      contactId: contact.id,
      waMessageId: msg.waMessageId,
      direction: "inbound",
      messageType: msg.messageType,
      body: msg.body ?? msg.caption,
      mediaId: mediaRecord?.id,
      sentAt: msg.timestamp,
      aiProcessed: false,
    });

    // 5. Update conversation counters
    await incrementConversationCounts(conversation.id, {
      messages: 1,
      images: mediaRecord?.mediaType === "image" ? 1 : 0,
    });

    // 6. Mark as read on WhatsApp
    await markMessageRead(msg.waMessageId);

    // 7. Run vision AI on images (async, non-blocking for response)
    if (mediaRecord?.mediaType === "image") {
      processMediaWithVision({
        mediaId: mediaRecord.id,
        contactId: contact.id,
        conversationId: conversation.id,
        projectTag: contact.projectTag ?? undefined,
      }).then(async (visionResult) => {
        if (visionResult?.shouldCreateIssue) {
          await incrementConversationCounts(conversation.id, { issues: 1 });
        }
      }).catch((err) => console.error("[Pipeline] Vision AI error:", err));
    }

    // 8. Detect issues from text messages
    const textContent = msg.body ?? msg.caption;
    if (textContent && msg.messageType === "text") {
      const detectedIssues = await detectAndSaveIssues({
        contactId: contact.id,
        conversationId: conversation.id,
        messageId: savedMessage.id,
        messageText: textContent,
        projectTag: contact.projectTag ?? undefined,
      });

      if (detectedIssues.length > 0) {
        await incrementConversationCounts(conversation.id, { issues: detectedIssues.length });
      }

      // 9. Extract memory sections from text
      await extractAndStoreMemory({
        contactId: contact.id,
        conversationId: conversation.id,
        messageId: savedMessage.id,
        messageText: textContent,
      });
    }

    // 10. Generate AI response
    const aiReply = await generateAIResponse({
      contactId: contact.id,
      contactName: msg.profileName,
      messageText: textContent,
      messageType: msg.messageType,
      hasMedia: !!mediaRecord,
    });

    // 11. Send AI response back to WhatsApp
    if (aiReply) {
      const sentId = await sendTextMessage(msg.from, aiReply);

      if (sentId) {
        // Save outbound message to DB
        await insertMessage({
          conversationId: conversation.id,
          contactId: contact.id,
          waMessageId: sentId,
          direction: "outbound",
          messageType: "text",
          body: aiReply,
          sentAt: new Date(),
          aiProcessed: true,
        });
        await incrementConversationCounts(conversation.id, { messages: 1 });
      }
    }

    // 12. Mark original message as processed
    await markMessageProcessed(savedMessage.id);
  } catch (err) {
    console.error("[WebhookProcessor] Failed to process message:", err);
  }
}

/**
 * Generate a context-aware AI response for an incoming message.
 */
async function generateAIResponse(opts: {
  contactId: number;
  contactName?: string;
  messageText?: string;
  messageType: string;
  hasMedia: boolean;
}): Promise<string | null> {
  const { contactId, contactName, messageText, messageType, hasMedia } = opts;

  try {
    const memoryContext = await buildMemoryContext(contactId);
    const systemPrompt = buildAgentSystemPrompt(memoryContext, contactName);

    let userMessage: string;
    if (messageType === "image" && hasMedia) {
      userMessage = messageText
        ? `[Sent an image with caption: "${messageText}"]`
        : "[Sent a construction site image — it is being analyzed by AI]";
    } else if (messageType === "document") {
      userMessage = "[Sent a document]";
    } else if (messageType === "audio") {
      userMessage = "[Sent a voice message]";
    } else {
      userMessage = messageText ?? "[empty message]";
    }

    const conversationHistory = memoryContext.recentMessages.slice(-8).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const response = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        ...conversationHistory,
        { role: "user", content: userMessage },
      ],
    });

    const content = response.choices?.[0]?.message?.content;
    return typeof content === "string" ? content.slice(0, 1000) : null;
  } catch (err) {
    console.error("[Pipeline] AI response generation failed:", err);
    return "I received your message and will process it shortly. 🏗️";
  }
}
