import { eq, desc, and, gte, lte, sql, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  contacts,
  InsertContact,
  Contact,
  conversations,
  InsertConversation,
  Conversation,
  messages,
  InsertMessage,
  Message,
  media,
  InsertMedia,
  Media,
  memorySections,
  InsertMemorySection,
  MemorySection,
  issues,
  InsertIssue,
  Issue,
  reports,
  InsertReport,
  Report,
  scheduledReports,
  InsertScheduledReport,
  ScheduledReport,
  projects,
  InsertProject,
  Project,
  notifications,
  InsertNotification,
  Notification,
  agentConfig,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;
let _connectionAttempts = 0;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function getDb() {
  if (_db) return _db;
  if (!process.env.DATABASE_URL) {
    if (_connectionAttempts === 0) {
      console.warn(
        "[Database] DATABASE_URL not set — running without persistence"
      );
      _connectionAttempts = 1;
    }
    return null;
  }

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
      // Validate connection with a simple query
      await _db.execute(sql`SELECT 1`);
      if (_connectionAttempts > 0) {
        console.log("[Database] Connection established successfully");
      }
      _connectionAttempts = 0;
      return _db;
    } catch (error: any) {
      _db = null;
      _connectionAttempts++;
      const isLastAttempt = attempt === MAX_RETRIES;
      if (isLastAttempt) {
        console.error(
          `[Database] Failed to connect after ${MAX_RETRIES} attempts:`,
          error.message || error
        );
      } else {
        console.warn(
          `[Database] Connection attempt ${attempt}/${MAX_RETRIES} failed, retrying in ${RETRY_DELAY_MS}ms...`
        );
        await sleep(RETRY_DELAY_MS);
      }
    }
  }
  return null;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  textFields.forEach(field => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  });
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db
    .insert(users)
    .values(values)
    .onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function listUsers(limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(users)
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function updateUserRole(
  id: number,
  role: "user" | "admin"
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ role }).where(eq(users.id, id));
}

export async function deleteUser(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(users).where(eq(users.id, id));
}

// ─── Contacts ─────────────────────────────────────────────────────────────────

export async function upsertContact(data: {
  waId: string;
  phoneNumber: string;
  displayName?: string;
  profileName?: string;
}): Promise<Contact> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db
    .insert(contacts)
    .values({
      waId: data.waId,
      phoneNumber: data.phoneNumber,
      displayName: data.displayName,
      profileName: data.profileName,
      lastSeenAt: new Date(),
    })
    .onDuplicateKeyUpdate({
      set: {
        phoneNumber: data.phoneNumber,
        displayName: data.displayName ?? undefined,
        profileName: data.profileName ?? undefined,
        lastSeenAt: new Date(),
      },
    });
  const result = await db
    .select()
    .from(contacts)
    .where(eq(contacts.waId, data.waId))
    .limit(1);
  return result[0];
}

export async function getContactByWaId(
  waId: string
): Promise<Contact | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(contacts)
    .where(eq(contacts.waId, waId))
    .limit(1);
  return result[0];
}

export async function listContacts(limit = 50, offset = 0): Promise<Contact[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(contacts)
    .orderBy(desc(contacts.lastSeenAt))
    .limit(limit)
    .offset(offset);
}

export async function updateContact(
  id: number,
  data: Partial<InsertContact>
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(contacts).set(data).where(eq(contacts.id, id));
}

export async function getContactById(id: number): Promise<Contact | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(contacts)
    .where(eq(contacts.id, id))
    .limit(1);
  return rows[0] ?? null;
}

// ─── Conversations ────────────────────────────────────────────────────────────

export async function getOrCreateConversation(
  contactId: number,
  waConversationId?: string
): Promise<Conversation> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const existing = await db
    .select()
    .from(conversations)
    .where(eq(conversations.contactId, contactId))
    .orderBy(desc(conversations.updatedAt))
    .limit(1);
  if (existing[0]) return existing[0];
  await db
    .insert(conversations)
    .values({ contactId, waConversationId, lastMessageAt: new Date() });
  const created = await db
    .select()
    .from(conversations)
    .where(eq(conversations.contactId, contactId))
    .orderBy(desc(conversations.createdAt))
    .limit(1);
  return created[0];
}

export async function listConversations(
  limit = 50,
  offset = 0
): Promise<Conversation[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(conversations)
    .orderBy(desc(conversations.lastMessageAt))
    .limit(limit)
    .offset(offset);
}

export async function getConversation(
  id: number
): Promise<Conversation | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, id))
    .limit(1);
  return result[0];
}

export async function updateConversation(
  id: number,
  data: Partial<InsertConversation>
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(conversations).set(data).where(eq(conversations.id, id));
}

export async function incrementConversationCounts(
  conversationId: number,
  opts: { messages?: number; images?: number; issues?: number }
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const updates: Record<string, unknown> = { lastMessageAt: new Date() };
  if (opts.messages)
    updates.messageCount = sql`messageCount + ${opts.messages}`;
  if (opts.images) updates.imageCount = sql`imageCount + ${opts.images}`;
  if (opts.issues) updates.issueCount = sql`issueCount + ${opts.issues}`;
  await db
    .update(conversations)
    .set(updates as any)
    .where(eq(conversations.id, conversationId));
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export async function insertMessage(data: InsertMessage): Promise<Message> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(messages).values(data);
  const result = await db
    .select()
    .from(messages)
    .where(eq(messages.waMessageId, data.waMessageId!))
    .limit(1);
  return result[0];
}

export async function getMessagesByConversation(
  conversationId: number,
  limit = 100
): Promise<Message[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.sentAt))
    .limit(limit);
}

export async function getRecentMessages(
  contactId: number,
  limit = 20
): Promise<Message[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(messages)
    .where(eq(messages.contactId, contactId))
    .orderBy(desc(messages.sentAt))
    .limit(limit);
}

export async function markMessageProcessed(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(messages)
    .set({ aiProcessed: true })
    .where(eq(messages.id, id));
}

export async function flagKeySection(id: number, label: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(messages)
    .set({ isKeySection: true, keyLabel: label })
    .where(eq(messages.id, id));
}

// ─── Media ────────────────────────────────────────────────────────────────────

export async function insertMedia(data: InsertMedia): Promise<Media> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(media).values(data);
  const inserted = await db
    .select()
    .from(media)
    .where(eq(media.s3Key, data.s3Key))
    .limit(1);
  return inserted[0];
}

export async function updateMediaVision(
  id: number,
  visionData: {
    visionDescription: string;
    visionTags: string[];
    visionIssuesDetected: string[];
    visionSafetyHazards: string[];
    visionProgressNotes: string;
    visionConfidence: number;
  }
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(media)
    .set({
      ...visionData,
      visionAnalyzed: true,
      visionAnalyzedAt: new Date(),
    })
    .where(eq(media.id, id));
}

export async function listMedia(
  opts: {
    conversationId?: number;
    contactId?: number;
    limit?: number;
    offset?: number;
  } = {}
): Promise<Media[]> {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (opts.conversationId)
    conditions.push(eq(media.conversationId, opts.conversationId));
  if (opts.contactId) conditions.push(eq(media.contactId, opts.contactId));
  const query = db.select().from(media);
  if (conditions.length > 0) query.where(and(...conditions) as any);
  return (query as any)
    .orderBy(desc(media.sentAt))
    .limit(opts.limit ?? 50)
    .offset(opts.offset ?? 0);
}

export async function getMediaById(id: number): Promise<Media | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(media).where(eq(media.id, id)).limit(1);
  return result[0];
}

// ─── Memory Sections ──────────────────────────────────────────────────────────

export async function insertMemorySection(
  data: InsertMemorySection
): Promise<MemorySection> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(memorySections).values(data);
  const result = await db
    .select()
    .from(memorySections)
    .where(eq(memorySections.contactId, data.contactId))
    .orderBy(desc(memorySections.createdAt))
    .limit(1);
  return result[0];
}

export async function getMemorySections(
  contactId: number,
  limit = 50
): Promise<MemorySection[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(memorySections)
    .where(
      and(
        eq(memorySections.contactId, contactId),
        eq(memorySections.isActive, true)
      )
    )
    .orderBy(desc(memorySections.createdAt))
    .limit(limit);
}

export async function listAllMemorySections(
  limit = 100,
  offset = 0
): Promise<MemorySection[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(memorySections)
    .orderBy(desc(memorySections.createdAt))
    .limit(limit)
    .offset(offset);
}

// ─── Issues ───────────────────────────────────────────────────────────────────

export async function insertIssue(data: InsertIssue): Promise<Issue> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(issues).values(data);
  const result = await db
    .select()
    .from(issues)
    .where(eq(issues.contactId, data.contactId))
    .orderBy(desc(issues.createdAt))
    .limit(1);
  return result[0];
}

export async function listIssues(
  opts: {
    status?: string;
    severity?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<Issue[]> {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (opts.status) conditions.push(eq(issues.status, opts.status as any));
  if (opts.severity) conditions.push(eq(issues.severity, opts.severity as any));
  const query = db.select().from(issues);
  if (conditions.length > 0) (query as any).where(and(...conditions));
  return (query as any)
    .orderBy(desc(issues.createdAt))
    .limit(opts.limit ?? 50)
    .offset(opts.offset ?? 0);
}

export async function updateIssue(
  id: number,
  data: Partial<InsertIssue>
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(issues).set(data).where(eq(issues.id, id));
}

export async function getIssueById(id: number): Promise<Issue | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(issues).where(eq(issues.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function deleteIssue(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(issues).where(eq(issues.id, id));
}

export async function getIssuesByDateRange(
  from: Date,
  to: Date
): Promise<Issue[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(issues)
    .where(and(gte(issues.createdAt, from), lte(issues.createdAt, to)))
    .orderBy(desc(issues.createdAt));
}

// ─── Reports ──────────────────────────────────────────────────────────────────

export async function insertReport(data: InsertReport): Promise<Report> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(reports).values(data);
  const result = await db
    .select()
    .from(reports)
    .orderBy(desc(reports.createdAt))
    .limit(1);
  return result[0];
}

export async function listReports(limit = 20, offset = 0): Promise<Report[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(reports)
    .orderBy(desc(reports.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function updateReport(
  id: number,
  data: Partial<InsertReport>
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(reports).set(data).where(eq(reports.id, id));
}

// ─── Scheduled Reports ────────────────────────────────────────────────────────

export async function listScheduledReports(): Promise<ScheduledReport[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(scheduledReports)
    .orderBy(desc(scheduledReports.createdAt));
}

export async function upsertScheduledReport(
  data: InsertScheduledReport
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(scheduledReports).values(data);
}

export async function updateScheduledReport(
  id: number,
  data: Partial<InsertScheduledReport>
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(scheduledReports)
    .set(data)
    .where(eq(scheduledReports.id, id));
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export async function insertProject(data: InsertProject): Promise<Project> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(projects).values(data);
  const result = await db
    .select()
    .from(projects)
    .orderBy(desc(projects.createdAt))
    .limit(1);
  return result[0];
}

export async function listProjects(limit = 50, offset = 0): Promise<Project[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(projects)
    .orderBy(desc(projects.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function getProjectById(id: number): Promise<Project | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);
  return result[0];
}

export async function updateProject(
  id: number,
  data: Partial<InsertProject>
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(projects).set(data).where(eq(projects.id, id));
}

export async function deleteProject(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(projects).where(eq(projects.id, id));
}

// ─── Notifications ──────────────────────────────────────────────────────────────

export async function insertNotification(
  data: InsertNotification
): Promise<Notification> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(notifications).values(data);
  const result = await db
    .select()
    .from(notifications)
    .orderBy(desc(notifications.createdAt))
    .limit(1);
  return result[0];
}

export async function listNotifications(
  userId: number,
  limit = 50,
  offset = 0
): Promise<Notification[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function markNotificationRead(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(notifications)
    .set({ read: true })
    .where(eq(notifications.id, id));
}

export async function markAllNotificationsRead(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(notifications)
    .set({ read: true })
    .where(eq(notifications.userId, userId));
}

export async function deleteNotification(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(notifications).where(eq(notifications.id, id));
}

// ─── Agent Config ─────────────────────────────────────────────────────────────

export async function getAgentConfig(key: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select()
    .from(agentConfig)
    .where(eq(agentConfig.key, key))
    .limit(1);
  return result[0]?.value ?? null;
}

export async function setAgentConfig(
  key: string,
  value: string,
  description?: string
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .insert(agentConfig)
    .values({ key, value, description })
    .onDuplicateKeyUpdate({ set: { value, description } });
}

export async function getAllAgentConfig(): Promise<Record<string, string>> {
  const db = await getDb();
  if (!db) return {};
  const rows = await db.select().from(agentConfig);
  return Object.fromEntries(rows.map(r => [r.key, r.value ?? ""]));
}
