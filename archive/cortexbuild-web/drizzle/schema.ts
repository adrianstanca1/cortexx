import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  boolean,
  json,
  bigint,
  float,
} from "drizzle-orm/mysql-core";

// ─── Core Auth ────────────────────────────────────────────────────────────────

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── WhatsApp Contacts ────────────────────────────────────────────────────────

export const contacts = mysqlTable("contacts", {
  id: int("id").autoincrement().primaryKey(),
  waId: varchar("waId", { length: 64 }).notNull().unique(), // WhatsApp phone number ID
  phoneNumber: varchar("phoneNumber", { length: 32 }).notNull(),
  displayName: varchar("displayName", { length: 255 }),
  profileName: varchar("profileName", { length: 255 }),
  projectTag: varchar("projectTag", { length: 255 }), // manually assigned project label
  notes: text("notes"),
  isActive: boolean("isActive").default(true).notNull(),
  lastSeenAt: timestamp("lastSeenAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Contact = typeof contacts.$inferSelect;
export type InsertContact = typeof contacts.$inferInsert;

// ─── Conversations ────────────────────────────────────────────────────────────

export const conversations = mysqlTable("conversations", {
  id: int("id").autoincrement().primaryKey(),
  contactId: int("contactId").notNull(),
  waConversationId: varchar("waConversationId", { length: 128 }),
  title: varchar("title", { length: 255 }),
  projectTag: varchar("projectTag", { length: 255 }),
  summary: text("summary"), // AI-generated conversation summary
  messageCount: int("messageCount").default(0).notNull(),
  imageCount: int("imageCount").default(0).notNull(),
  issueCount: int("issueCount").default(0).notNull(),
  lastMessageAt: timestamp("lastMessageAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = typeof conversations.$inferInsert;

// ─── Messages ─────────────────────────────────────────────────────────────────

export const messages = mysqlTable("messages", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull(),
  contactId: int("contactId").notNull(),
  waMessageId: varchar("waMessageId", { length: 128 }).unique(),
  direction: mysqlEnum("direction", ["inbound", "outbound"]).notNull(),
  messageType: mysqlEnum("messageType", [
    "text",
    "image",
    "document",
    "audio",
    "video",
    "location",
    "sticker",
    "reaction",
    "system",
  ]).notNull(),
  body: text("body"), // text content
  mediaId: int("mediaId"), // FK to media table
  isKeySection: boolean("isKeySection").default(false).notNull(), // flagged as important
  keyLabel: varchar("keyLabel", { length: 255 }), // label if flagged
  aiProcessed: boolean("aiProcessed").default(false).notNull(),
  sentAt: timestamp("sentAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;

// ─── Media / Images ───────────────────────────────────────────────────────────

export const media = mysqlTable("media", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull(),
  contactId: int("contactId").notNull(),
  messageId: int("messageId"), // back-reference after message is saved
  waMediaId: varchar("waMediaId", { length: 128 }), // WhatsApp media ID
  mediaType: mysqlEnum("mediaType", ["image", "document", "audio", "video"]).notNull(),
  mimeType: varchar("mimeType", { length: 128 }),
  fileName: varchar("fileName", { length: 255 }),
  fileSize: bigint("fileSize", { mode: "number" }),
  s3Key: varchar("s3Key", { length: 512 }).notNull(),
  s3Url: text("s3Url").notNull(),
  // Vision AI analysis fields
  visionAnalyzed: boolean("visionAnalyzed").default(false).notNull(),
  visionDescription: text("visionDescription"),
  visionTags: json("visionTags").$type<string[]>(),
  visionIssuesDetected: json("visionIssuesDetected").$type<string[]>(),
  visionSafetyHazards: json("visionSafetyHazards").$type<string[]>(),
  visionProgressNotes: text("visionProgressNotes"),
  visionConfidence: float("visionConfidence"),
  visionAnalyzedAt: timestamp("visionAnalyzedAt"),
  caption: text("caption"), // original caption from sender
  projectTag: varchar("projectTag", { length: 255 }),
  sentAt: timestamp("sentAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Media = typeof media.$inferSelect;
export type InsertMedia = typeof media.$inferInsert;

// ─── Memory Sections ──────────────────────────────────────────────────────────

export const memorySections = mysqlTable("memory_sections", {
  id: int("id").autoincrement().primaryKey(),
  contactId: int("contactId").notNull(),
  conversationId: int("conversationId"),
  sectionType: mysqlEnum("sectionType", [
    "key_decision",
    "instruction",
    "project_update",
    "issue_mention",
    "contact_info",
    "general",
  ]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  sourceMessageId: int("sourceMessageId"), // which message triggered this memory
  relatedMediaIds: json("relatedMediaIds").$type<number[]>(), // associated images
  projectTag: varchar("projectTag", { length: 255 }),
  importance: mysqlEnum("importance", ["low", "medium", "high", "critical"]).default("medium").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MemorySection = typeof memorySections.$inferSelect;
export type InsertMemorySection = typeof memorySections.$inferInsert;

// ─── Issues ───────────────────────────────────────────────────────────────────

export const issues = mysqlTable("issues", {
  id: int("id").autoincrement().primaryKey(),
  contactId: int("contactId").notNull(),
  conversationId: int("conversationId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  category: mysqlEnum("category", [
    "safety_hazard",
    "structural",
    "electrical",
    "plumbing",
    "material",
    "schedule_delay",
    "quality",
    "equipment",
    "weather",
    "other",
  ]).notNull(),
  severity: mysqlEnum("severity", ["low", "medium", "high", "critical"]).default("medium").notNull(),
  status: mysqlEnum("status", ["open", "in_progress", "resolved", "closed"]).default("open").notNull(),
  detectedFrom: mysqlEnum("detectedFrom", ["text", "image", "both"]).default("text").notNull(),
  sourceMessageId: int("sourceMessageId"),
  relatedMediaIds: json("relatedMediaIds").$type<number[]>(),
  projectTag: varchar("projectTag", { length: 255 }),
  location: varchar("location", { length: 255 }),
  assignedTo: varchar("assignedTo", { length: 255 }),
  resolvedAt: timestamp("resolvedAt"),
  aiDetected: boolean("aiDetected").default(true).notNull(),
  aiConfidence: float("aiConfidence"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Issue = typeof issues.$inferSelect;
export type InsertIssue = typeof issues.$inferInsert;

// ─── Reports ──────────────────────────────────────────────────────────────────

export const reports = mysqlTable("reports", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  reportType: mysqlEnum("reportType", ["daily_summary", "weekly_summary", "issue_report", "custom"]).notNull(),
  format: mysqlEnum("format", ["pdf", "html", "both"]).default("both").notNull(),
  contactId: int("contactId"), // null = all contacts
  projectTag: varchar("projectTag", { length: 255 }),
  dateFrom: timestamp("dateFrom").notNull(),
  dateTo: timestamp("dateTo").notNull(),
  // Content summary stored as JSON
  stats: json("stats").$type<{
    totalMessages: number;
    totalImages: number;
    totalIssues: number;
    openIssues: number;
    resolvedIssues: number;
    criticalIssues: number;
  }>(),
  pdfS3Key: varchar("pdfS3Key", { length: 512 }),
  pdfS3Url: text("pdfS3Url"),
  htmlS3Key: varchar("htmlS3Key", { length: 512 }),
  htmlS3Url: text("htmlS3Url"),
  // Delivery tracking
  sentToWhatsapp: boolean("sentToWhatsapp").default(false).notNull(),
  sentToEmail: boolean("sentToEmail").default(false).notNull(),
  sentAt: timestamp("sentAt"),
  generatedAt: timestamp("generatedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Report = typeof reports.$inferSelect;
export type InsertReport = typeof reports.$inferInsert;

// ─── Scheduled Reports ────────────────────────────────────────────────────────

export const scheduledReports = mysqlTable("scheduled_reports", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  frequency: mysqlEnum("frequency", ["daily", "weekly"]).notNull(),
  reportType: mysqlEnum("reportType", ["daily_summary", "weekly_summary", "issue_report"]).notNull(),
  format: mysqlEnum("format", ["pdf", "html", "both"]).default("both").notNull(),
  projectTag: varchar("projectTag", { length: 255 }),
  sendToWhatsapp: boolean("sendToWhatsapp").default(true).notNull(),
  whatsappRecipient: varchar("whatsappRecipient", { length: 64 }), // phone number to send to
  sendToEmail: boolean("sendToEmail").default(false).notNull(),
  emailRecipient: varchar("emailRecipient", { length: 320 }),
  isActive: boolean("isActive").default(true).notNull(),
  lastRunAt: timestamp("lastRunAt"),
  nextRunAt: timestamp("nextRunAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ScheduledReport = typeof scheduledReports.$inferSelect;
export type InsertScheduledReport = typeof scheduledReports.$inferInsert;

// ─── Projects ─────────────────────────────────────────────────────────────────

export const projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  client: varchar("client", { length: 255 }),
  budget: bigint("budget", { mode: "number" }),
  spent: bigint("spent", { mode: "number" }).default(0).notNull(),
  startDate: timestamp("startDate"),
  endDate: timestamp("endDate"),
  status: mysqlEnum("status", ["active", "planning", "on-hold", "completed"]).default("planning").notNull(),
  location: varchar("location", { length: 255 }),
  manager: varchar("manager", { length: 255 }),
  progress: int("progress").default(0).notNull(),
  createdById: int("createdById"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

// ─── Notifications ──────────────────────────────────────────────────────────────

export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  type: mysqlEnum("type", ["info", "warning", "success", "error"]).default("info").notNull(),
  read: boolean("read").default(false).notNull(),
  link: varchar("link", { length: 512 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

// ─── Agent Config ─────────────────────────────────────────────────────────────

export const agentConfig = mysqlTable("agent_config", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 128 }).notNull().unique(),
  value: text("value"),
  description: text("description"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AgentConfig = typeof agentConfig.$inferSelect;
