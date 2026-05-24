/**
 * Inbox Processor
 * Processes messages and images sent directly from the admin dashboard inbox.
 * Runs the exact same AI pipeline as the WhatsApp webhook processor:
 *   1. Persist contact / conversation / message
 *   2. If image: store to S3, run vision AI, detect issues from image
 *   3. If text: detect construction issues, extract memory sections
 *   4. Generate AI reply and store as outbound message
 *
 * This makes the system fully operational without WhatsApp API credentials.
 * When WhatsApp is connected later, real messages flow through the same DB.
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
import { emitNewMessage } from "../_core/messageBus";
import {
  buildMemoryContext,
  extractAndStoreMemory,
  buildAgentSystemPrompt,
} from "./memoryEngine";
import { processMediaWithVision } from "./visionAI";
import { detectAndSaveIssues } from "./issueDetector";

export interface InboxMessageInput {
  /** Contact identifier — phone number or any unique ID */
  contactIdentifier: string;
  /** Human-readable display name for the contact */
  contactName: string;
  /** Text body of the message (optional if image-only) */
  text?: string;
  /** S3 URL of an already-uploaded image (optional) */
  imageUrl?: string;
  /** S3 key of the image (required if imageUrl is set) */
  imageS3Key?: string;
  /** MIME type of the image */
  imageMimeType?: string;
  /** Optional project tag for grouping */
  projectTag?: string;
}

export interface InboxMessageResult {
  messageId: number;
  conversationId: number;
  aiReply: string | null;
  issuesDetected: number;
  memoryExtracted: boolean;
  visionTriggered: boolean;
}

/**
 * Process a message sent from the admin dashboard inbox.
 * Runs the full AI pipeline and returns the AI reply.
 */
export async function processInboxMessage(input: InboxMessageInput): Promise<InboxMessageResult> {
  const {
    contactIdentifier,
    contactName,
    text,
    imageUrl,
    imageS3Key,
    imageMimeType,
    projectTag,
  } = input;

  // 1. Upsert contact
  const contact = await upsertContact({
    waId: contactIdentifier,
    phoneNumber: contactIdentifier,
    displayName: contactName,
    profileName: contactName,
  });

  // Attach project tag if provided
  if (projectTag && !contact.projectTag) {
    const { updateContact } = await import("../db");
    await updateContact(contact.id, { projectTag });
    contact.projectTag = projectTag;
  }

  // 2. Get or create conversation
  const conversation = await getOrCreateConversation(contact.id);

  // 3. Handle image if provided
  let mediaRecord = null;
  let visionTriggered = false;

  if (imageUrl && imageS3Key) {
    const mimeType = imageMimeType ?? "image/jpeg";
    mediaRecord = await insertMedia({
      conversationId: conversation.id,
      contactId: contact.id,
      waMediaId: `inbox-${nanoid(8)}`,
      mediaType: "image",
      mimeType,
      s3Key: imageS3Key,
      s3Url: imageUrl,
      caption: text,
      projectTag: contact.projectTag ?? projectTag,
      sentAt: new Date(),
    });

    await incrementConversationCounts(conversation.id, { images: 1 });
    visionTriggered = true;

    // Run vision AI asynchronously (non-blocking)
    processMediaWithVision({
      mediaId: mediaRecord.id,
      contactId: contact.id,
      conversationId: conversation.id,
      projectTag: contact.projectTag ?? projectTag,
    }).then(async (visionResult) => {
      if (visionResult?.shouldCreateIssue) {
        await incrementConversationCounts(conversation.id, { issues: 1 });
      }
    }).catch((err) => console.error("[InboxProcessor] Vision AI error:", err));
  }

  // 4. Save inbound message
  const messageType = imageUrl ? "image" : "text";
  const savedMessage = await insertMessage({
    conversationId: conversation.id,
    contactId: contact.id,
    waMessageId: `inbox-${nanoid(10)}`,
    direction: "inbound",
    messageType,
    body: text ?? (imageUrl ? "[Image]" : "[empty]"),
    mediaId: mediaRecord?.id,
    sentAt: new Date(),
    aiProcessed: false,
  });

  emitNewMessage(savedMessage);

  await incrementConversationCounts(conversation.id, { messages: 1 });

  // 5. Detect issues from text
  let issuesDetected = 0;
  let memoryExtracted = false;
  const textContent = text;

  if (textContent) {
    const detectedIssues = await detectAndSaveIssues({
      contactId: contact.id,
      conversationId: conversation.id,
      messageId: savedMessage.id,
      messageText: textContent,
      projectTag: contact.projectTag ?? projectTag,
    });

    issuesDetected = detectedIssues.length;
    if (issuesDetected > 0) {
      await incrementConversationCounts(conversation.id, { issues: issuesDetected });
    }

    // 6. Extract memory sections
    await extractAndStoreMemory({
      contactId: contact.id,
      conversationId: conversation.id,
      messageId: savedMessage.id,
      messageText: textContent,
    });
    memoryExtracted = true;
  }

  // 7. Generate AI reply
  const aiReply = await generateAIReply({
    contactId: contact.id,
    contactName,
    text,
    hasImage: !!imageUrl,
  });

  // 8. Save AI reply as outbound message
  if (aiReply) {
    const outboundMsg = await insertMessage({
      conversationId: conversation.id,
      contactId: contact.id,
      waMessageId: `ai-reply-${nanoid(10)}`,
      direction: "outbound",
      messageType: "text",
      body: aiReply,
      sentAt: new Date(),
      aiProcessed: true,
    });
    await incrementConversationCounts(conversation.id, { messages: 1 });
    await markMessageProcessed(outboundMsg.id);
    emitNewMessage(outboundMsg);
  }

  await markMessageProcessed(savedMessage.id);

  return {
    messageId: savedMessage.id,
    conversationId: conversation.id,
    aiReply,
    issuesDetected,
    memoryExtracted,
    visionTriggered,
  };
}

async function generateAIReply(opts: {
  contactId: number;
  contactName: string;
  text?: string;
  hasImage: boolean;
}): Promise<string | null> {
  try {
    const memoryContext = await buildMemoryContext(opts.contactId);
    const systemPrompt = buildAgentSystemPrompt(memoryContext, opts.contactName);

    let userMessage: string;
    if (opts.hasImage && opts.text) {
      userMessage = `[Sent a construction site image with caption: "${opts.text}"] — I'm analyzing it now.`;
    } else if (opts.hasImage) {
      userMessage = "[Sent a construction site image — analyzing it with vision AI now.]";
    } else {
      userMessage = opts.text ?? "[empty message]";
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
    return typeof content === "string" ? content.slice(0, 1200) : null;
  } catch (err) {
    console.error("[InboxProcessor] AI reply error:", err);
    return "Message received and logged. 🏗️ I'll process this and update the project records.";
  }
}
