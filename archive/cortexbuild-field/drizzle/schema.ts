import {
  boolean, index, integer, jsonb, pgEnum, pgTable, text,
  timestamp, varchar, decimal, serial, uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { InvoiceLineItem } from '../shared/cis';

// ─────────────────────────────────────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────────────────────────────────────
export const userRoleEnum = pgEnum('user_role', ['user', 'admin']);
export const projectStatusEnum = pgEnum('project_status', ['planning', 'active', 'on_hold', 'completed', 'cancelled']);
export const taskStatusEnum = pgEnum('task_status', ['not_started', 'in_progress', 'completed', 'blocked', 'on_hold']);
export const taskPriorityEnum = pgEnum('task_priority', ['low', 'medium', 'high', 'critical']);
export const teamMemberStatusEnum = pgEnum('team_member_status', ['active', 'inactive', 'on_leave']);
export const timesheetStatusEnum = pgEnum('timesheet_status', ['draft', 'submitted', 'approved', 'rejected']);
export const incidentTypeEnum = pgEnum('incident_type', ['near_miss', 'first_aid', 'accident', 'dangerous_occurrence', 'environmental', 'security']);
export const incidentSeverityEnum = pgEnum('incident_severity', ['near_miss', 'low', 'medium', 'high', 'critical']);
export const incidentStatusEnum = pgEnum('incident_status', ['open', 'under_investigation', 'action_required', 'resolved', 'closed']);
export const defectPriorityEnum = pgEnum('defect_priority', ['low', 'medium', 'high', 'critical']);
export const defectStatusEnum = pgEnum('defect_status', ['open', 'in_progress', 'resolved', 'closed', 'disputed']);
export const permitTypeEnum = pgEnum('permit_type', ['hot_work', 'confined_space', 'excavation', 'working_at_height', 'electrical', 'general']);
export const permitStatusEnum = pgEnum('permit_status', ['draft', 'pending', 'active', 'expired', 'cancelled']);
export const permitRiskLevelEnum = pgEnum('permit_risk_level', ['low', 'medium', 'high', 'critical']);
export const dailyReportStatusEnum = pgEnum('daily_report_status', ['draft', 'submitted', 'approved']);
export const fileCategoryEnum = pgEnum('file_category', ['photo', 'certificate', 'payslip', 'drawing', 'report', 'document', 'other']);
export const documentTypeEnum = pgEnum('document_type', ['rams', 'toolbox_talk', 'daily_report', 'invoice', 'timesheet', 'other']);
export const documentStatusEnum = pgEnum('document_status', ['draft', 'final', 'sent']);
export const platformEnum = pgEnum('platform', ['ios', 'android', 'web']);
export const pinTypeEnum = pgEnum('pin_type', ['defect', 'rfi', 'note']);
export const pinStatusEnum = pgEnum('pin_status', ['open', 'in_progress', 'resolved']);
export const inviteStatusEnum = pgEnum('invite_status', ['pending', 'accepted', 'expired']);

// ─────────────────────────────────────────────────────────────────────────────
// USERS (auth)
// ─────────────────────────────────────────────────────────────────────────────
export const users = pgTable('users', {
  id:           serial('id').primaryKey(),
  openId:       varchar('openId', { length: 64 }).notNull().unique(),
  name:         text('name'),
  email:        varchar('email', { length: 320 }),
  loginMethod:  varchar('loginMethod', { length: 64 }),
  role:         userRoleEnum('role').default('user').notNull(),
  // PHC-style scrypt hash, populated for users who authenticate with email +
  // password (loginMethod === 'password'). Null for OAuth users.
  passwordHash: text('passwordHash'),
  // Sparse JSONB map of event-type → enabled. Missing keys default to
  // enabled (opt-out). Opt-out is the right default here because
  // every event in the registry is operationally relevant to its
  // recipient (defect assigned to me, my defect resolved); opt-in
  // would require explicit consent capture for existing users and
  // silently swallow assignment notifications until they granted it.
  // See shared/notification-events.ts for the canonical convention;
  // the gate in server/_core/pushNotifications.ts is the only consumer.
  pushPreferences: jsonb('pushPreferences').$type<import('../shared/notification-events').UserPushPreferences>().notNull().default({}),
  createdAt:    timestamp('createdAt').defaultNow().notNull(),
  updatedAt:    timestamp('updatedAt').defaultNow().notNull(),
  lastSignedIn: timestamp('lastSignedIn').defaultNow().notNull(),
});
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// PROJECTS
// ─────────────────────────────────────────────────────────────────────────────
export const projects = pgTable('projects', {
  id:              serial('id').primaryKey(),
  companyId:       integer('companyId').notNull().default(1),
  name:            varchar('name', { length: 255 }).notNull(),
  description:     text('description'),
  clientName:      varchar('clientName', { length: 255 }),
  status:          projectStatusEnum('status').default('planning').notNull(),
  startDate:       timestamp('startDate'),
  endDate:         timestamp('endDate'),
  budget:          decimal('budget', { precision: 12, scale: 2 }),
  spent:           decimal('spent', { precision: 12, scale: 2 }).default('0'),
  progress:        integer('progress').default(0),
  siteAddress:     text('siteAddress'),
  siteLat:         decimal('siteLat', { precision: 10, scale: 7 }),
  siteLng:         decimal('siteLng', { precision: 10, scale: 7 }),
  geofenceRadius:  integer('geofenceRadius').default(200),
  projectManager:  varchar('projectManager', { length: 255 }),
  contractType:    varchar('contractType', { length: 100 }),
  createdBy:       integer('createdBy'),
  createdAt:       timestamp('createdAt').defaultNow().notNull(),
  updatedAt:       timestamp('updatedAt').defaultNow().notNull(),
});
export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// TASKS
// ─────────────────────────────────────────────────────────────────────────────
export const tasks = pgTable('tasks', {
  id:          serial('id').primaryKey(),
  companyId:   integer('companyId').notNull().default(1),
  projectId:   integer('projectId').notNull(),
  title:       varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  status:      taskStatusEnum('status').default('not_started').notNull(),
  priority:    taskPriorityEnum('priority').default('medium').notNull(),
  assignedTo:  varchar('assignedTo', { length: 255 }),
  dueDate:     timestamp('dueDate'),
  completedAt: timestamp('completedAt'),
  progress:    integer('progress').default(0),
  trade:       varchar('trade', { length: 100 }),
  createdBy:   integer('createdBy'),
  createdAt:   timestamp('createdAt').defaultNow().notNull(),
  updatedAt:   timestamp('updatedAt').defaultNow().notNull(),
});
export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// TEAM MEMBERS
// ─────────────────────────────────────────────────────────────────────────────
export const teamMembers = pgTable('team_members', {
  id:           serial('id').primaryKey(),
  companyId:    integer('companyId').notNull().default(1),
  name:         varchar('name', { length: 255 }).notNull(),
  role:         varchar('role', { length: 100 }).notNull(),
  trade:        varchar('trade', { length: 100 }),
  email:        varchar('email', { length: 320 }),
  phone:        varchar('phone', { length: 30 }),
  cscsCardType: varchar('cscsCardType', { length: 100 }),
  cscsExpiry:   timestamp('cscsExpiry'),
  status:       teamMemberStatusEnum('status').default('active').notNull(),
  projectId:    integer('projectId'),
  hourlyRate:   decimal('hourlyRate', { precision: 8, scale: 2 }),
  avatarUrl:    text('avatarUrl'),
  createdAt:    timestamp('createdAt').defaultNow().notNull(),
  updatedAt:    timestamp('updatedAt').defaultNow().notNull(),
});
export type TeamMember = typeof teamMembers.$inferSelect;
export type InsertTeamMember = typeof teamMembers.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// AUDIT LOG (multi-tenant, one row per administrative-class mutation)
// Phase 2.5 of docs/ROADMAP.md.
// Migration: drizzle/0009_audit_log.sql.
// ─────────────────────────────────────────────────────────────────────────────
export const auditLog = pgTable('audit_log', {
  id:            serial('id').primaryKey(),
  companyId:     integer('companyId').notNull(),
  userId:        integer('userId'),                          // null for system events
  action:        varchar('action', { length: 96 }).notNull(),
  entityType:    varchar('entityType', { length: 64 }),
  entityId:      integer('entityId'),
  ip:            varchar('ip', { length: 45 }),
  userAgent:     text('userAgent'),
  inputJson:     text('inputJson'),
  resultJson:    text('resultJson'),
  errorCode:     varchar('errorCode', { length: 64 }),
  errorMessage:  text('errorMessage'),
  createdAt:     timestamp('createdAt').defaultNow().notNull(),
});
export type AuditLog = typeof auditLog.$inferSelect;
export type InsertAuditLog = typeof auditLog.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// SITE CHECK-INS (HORUS tracking)
// ─────────────────────────────────────────────────────────────────────────────
export const checkIns = pgTable('check_ins', {
  id:               serial('id').primaryKey(),
  userId:           integer('userId'),
  workerName:       varchar('workerName', { length: 255 }),
  projectId:        integer('projectId').notNull(),
  checkInTime:      timestamp('checkInTime').defaultNow().notNull(),
  checkOutTime:     timestamp('checkOutTime'),
  checkInLat:       decimal('checkInLat', { precision: 10, scale: 7 }),
  checkInLng:       decimal('checkInLng', { precision: 10, scale: 7 }),
  checkOutLat:      decimal('checkOutLat', { precision: 10, scale: 7 }),
  checkOutLng:      decimal('checkOutLng', { precision: 10, scale: 7 }),
  gpsVerified:      boolean('gpsVerified').default(false),
  distanceFromSite: integer('distanceFromSite'),
  durationMinutes:  integer('durationMinutes'),
  createdAt:        timestamp('createdAt').defaultNow().notNull(),
});
export type CheckIn = typeof checkIns.$inferSelect;
export type InsertCheckIn = typeof checkIns.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// TIMESHEETS (with approval workflow)
// ─────────────────────────────────────────────────────────────────────────────
export const timesheets = pgTable('timesheets', {
  id:             serial('id').primaryKey(),
  companyId:      integer('companyId').notNull().default(1),
  projectId:      integer('projectId'),
  projectName:    varchar('projectName', { length: 255 }),
  workerId:       integer('workerId'),
  workerName:     varchar('workerName', { length: 255 }).notNull(),
  weekStarting:   varchar('weekStarting', { length: 20 }).notNull(), // YYYY-MM-DD
  mondayHours:    decimal('mondayHours', { precision: 5, scale: 2 }).default('0'),
  tuesdayHours:   decimal('tuesdayHours', { precision: 5, scale: 2 }).default('0'),
  wednesdayHours: decimal('wednesdayHours', { precision: 5, scale: 2 }).default('0'),
  thursdayHours:  decimal('thursdayHours', { precision: 5, scale: 2 }).default('0'),
  fridayHours:    decimal('fridayHours', { precision: 5, scale: 2 }).default('0'),
  saturdayHours:  decimal('saturdayHours', { precision: 5, scale: 2 }).default('0'),
  sundayHours:    decimal('sundayHours', { precision: 5, scale: 2 }).default('0'),
  totalHours:     decimal('totalHours', { precision: 6, scale: 2 }).default('0'),
  overtimeHours:  decimal('overtimeHours', { precision: 6, scale: 2 }).default('0'),
  status:         timesheetStatusEnum('status').default('draft').notNull(),
  submittedAt:    timestamp('submittedAt'),
  approvedBy:     varchar('approvedBy', { length: 255 }),
  approvedAt:     timestamp('approvedAt'),
  notes:          text('notes'),
  createdAt:      timestamp('createdAt').defaultNow().notNull(),
  updatedAt:      timestamp('updatedAt').defaultNow().notNull(),
});
export type Timesheet = typeof timesheets.$inferSelect;
export type InsertTimesheet = typeof timesheets.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// SAFETY INCIDENTS
// ─────────────────────────────────────────────────────────────────────────────
export const incidents = pgTable('incidents', {
  id:               serial('id').primaryKey(),
  companyId:        integer('companyId').notNull().default(1),
  projectId:        integer('projectId').notNull(),
  title:            varchar('title', { length: 255 }).notNull(),
  description:      text('description'),
  type:             incidentTypeEnum('type').notNull(),
  severity:         incidentSeverityEnum('severity').notNull(),
  status:           incidentStatusEnum('status').default('open').notNull(),
  location:         varchar('location', { length: 255 }),
  reportedBy:       varchar('reportedBy', { length: 255 }).notNull(),
  injuredPerson:    varchar('injuredPerson', { length: 255 }),
  witnesses:        text('witnesses'),
  immediateAction:  text('immediateAction'),
  rootCause:        text('rootCause'),
  correctiveAction: text('correctiveAction'),
  photoUrls:        text('photoUrls').default('[]'),
  riddorRequired:   boolean('riddorRequired').default(false),
  createdAt:        timestamp('createdAt').defaultNow().notNull(),
  updatedAt:        timestamp('updatedAt').defaultNow().notNull(),
});
export type Incident = typeof incidents.$inferSelect;
export type InsertIncident = typeof incidents.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// DEFECTS / SNAG LIST
// ─────────────────────────────────────────────────────────────────────────────
export const defects = pgTable('defects', {
  id:          serial('id').primaryKey(),
  companyId:   integer('companyId').notNull().default(1),
  projectId:   integer('projectId').notNull(),
  title:       varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  location:    varchar('location', { length: 255 }),
  trade:       varchar('trade', { length: 100 }),
  priority:    defectPriorityEnum('priority').default('medium').notNull(),
  status:      defectStatusEnum('status').default('open').notNull(),
  assignedTo:  varchar('assignedTo', { length: 255 }),
  reportedBy:  varchar('reportedBy', { length: 255 }).notNull(),
  dueDate:     timestamp('dueDate'),
  resolvedAt:  timestamp('resolvedAt'),
  photoUrls:   text('photoUrls').default('[]'),
  aiAnalysis:  text('aiAnalysis'),
  createdAt:   timestamp('createdAt').defaultNow().notNull(),
  updatedAt:   timestamp('updatedAt').defaultNow().notNull(),
});
export type Defect = typeof defects.$inferSelect;
export type InsertDefect = typeof defects.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// PERMITS TO WORK
// ─────────────────────────────────────────────────────────────────────────────
export const permits = pgTable('permits', {
  id:          serial('id').primaryKey(),
  companyId:   integer('companyId').notNull().default(1),
  projectId:   integer('projectId').notNull(),
  title:       varchar('title', { length: 255 }).notNull(),
  type:        permitTypeEnum('type').notNull(),
  status:      permitStatusEnum('status').default('draft').notNull(),
  location:    varchar('location', { length: 255 }),
  issuedBy:    varchar('issuedBy', { length: 255 }),
  issuedTo:    varchar('issuedTo', { length: 255 }),
  validFrom:   timestamp('validFrom'),
  validTo:     timestamp('validTo'),
  conditions:  text('conditions'),
  riskLevel:   permitRiskLevelEnum('riskLevel').default('medium').notNull(),
  createdAt:   timestamp('createdAt').defaultNow().notNull(),
  updatedAt:   timestamp('updatedAt').defaultNow().notNull(),
});
export type Permit = typeof permits.$inferSelect;
export type InsertPermit = typeof permits.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// DAILY REPORTS
// ─────────────────────────────────────────────────────────────────────────────
export const dailyReports = pgTable('daily_reports', {
  id:                  serial('id').primaryKey(),
  companyId:           integer('companyId').notNull().default(1),
  projectId:           integer('projectId').notNull(),
  reportDate:          timestamp('reportDate').notNull(),
  weather:             varchar('weather', { length: 100 }),
  temperature:         integer('temperature'),
  workersOnSite:       integer('workersOnSite').default(0),
  workCompleted:       text('workCompleted'),
  materialsUsed:       text('materialsUsed'),
  equipmentUsed:       text('equipmentUsed'),
  issuesDelays:        text('issuesDelays'),
  safetyObservations:  text('safetyObservations'),
  nextDayPlan:         text('nextDayPlan'),
  photoUrls:           text('photoUrls').default('[]'),
  submittedBy:         varchar('submittedBy', { length: 255 }).notNull(),
  status:              dailyReportStatusEnum('status').default('draft').notNull(),
  createdAt:           timestamp('createdAt').defaultNow().notNull(),
  updatedAt:           timestamp('updatedAt').defaultNow().notNull(),
});
export type DailyReport = typeof dailyReports.$inferSelect;
export type InsertDailyReport = typeof dailyReports.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// FILE VAULT
// ─────────────────────────────────────────────────────────────────────────────
export const files = pgTable('files', {
  id:          serial('id').primaryKey(),
  companyId:   integer('companyId').notNull().default(1),
  projectId:   integer('projectId'),
  uploadedBy:  integer('uploadedBy'),
  name:        varchar('name', { length: 255 }).notNull(),
  category:    fileCategoryEnum('category').default('document').notNull(),
  mimeType:    varchar('mimeType', { length: 100 }),
  sizeBytes:   integer('sizeBytes'),
  storageKey:  varchar('storageKey', { length: 500 }).notNull(),
  storageUrl:  text('storageUrl'),
  description: text('description'),
  tags:        text('tags').default('[]'),
  aiAnalysis:  text('aiAnalysis'),
  createdAt:   timestamp('createdAt').defaultNow().notNull(),
});
export type File = typeof files.$inferSelect;
export type InsertFile = typeof files.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// GENERATED DOCUMENTS
// ─────────────────────────────────────────────────────────────────────────────
export const documents = pgTable('documents', {
  id:          serial('id').primaryKey(),
  companyId:   integer('companyId').notNull().default(1),
  projectId:   integer('projectId'),
  type:        documentTypeEnum('type').notNull(),
  title:       varchar('title', { length: 255 }).notNull(),
  content:     text('content'),
  storageKey:  varchar('storageKey', { length: 500 }),
  storageUrl:  text('storageUrl'),
  generatedBy: varchar('generatedBy', { length: 255 }),
  status:      documentStatusEnum('status').default('draft').notNull(),
  createdAt:   timestamp('createdAt').defaultNow().notNull(),
  updatedAt:   timestamp('updatedAt').defaultNow().notNull(),
});
export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// PUSH NOTIFICATION TOKENS
// ─────────────────────────────────────────────────────────────────────────────
export const pushTokens = pgTable('push_tokens', {
  id:        serial('id').primaryKey(),
  userId:    integer('userId').notNull(),
  token:     varchar('token', { length: 500 }).notNull(),
  platform:  platformEnum('platform').notNull(),
  active:    boolean('active').default(true).notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
}, (t) => ({
  // Each Expo push token uniquely identifies a device. Pair with
  // INSERT…ON CONFLICT DO UPDATE in pushTokens.register so concurrent
  // registrations for the same device are serialised by Postgres rather
  // than racing past a delete-then-insert window. The `0006_push_tokens
  // _token_unique` migration dedupes existing rows before adding the
  // constraint.
  tokenUnique: uniqueIndex('push_tokens_token_unique').on(t.token),
}));
export type PushToken = typeof pushTokens.$inferSelect;
export type InsertPushToken = typeof pushTokens.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// COMPANIES (multi-tenant root)
// ─────────────────────────────────────────────────────────────────────────────
export const companies = pgTable('companies', {
  id:               serial('id').primaryKey(),
  name:             varchar('name', { length: 255 }).notNull(),
  slug:             varchar('slug', { length: 100 }).notNull().unique(),
  plan:             varchar('plan', { length: 20 }).notNull().default('free'),
  logoUrl:          text('logoUrl'),
  primaryColor:     varchar('primaryColor', { length: 7 }).default('#1E3A5F'),
  // CIS / Tax
  utr:              varchar('utr', { length: 20 }),
  cisStatus:        varchar('cisStatus', { length: 20 }).default('not_registered'),
  vatNumber:        varchar('vatNumber', { length: 20 }),
  companyNumber:    varchar('companyNumber', { length: 20 }),
  address:          text('address'),
  phone:            varchar('phone', { length: 30 }),
  email:            varchar('email', { length: 255 }),
  payrollEmail:     varchar('payrollEmail', { length: 255 }),
  website:          varchar('website', { length: 255 }),
  // AI configuration
  activeAiProvider: varchar('activeAiProvider', { length: 50 }).default('forge'),
  activeAiModel:    varchar('activeAiModel', { length: 100 }).default('default'),
  // Limits
  maxProjects:      integer('maxProjects').default(5),
  maxUsers:         integer('maxUsers').default(10),
  maxPipelines:     integer('maxPipelines').default(1),
  isActive:         boolean('isActive').default(true),
  createdAt:        timestamp('createdAt').defaultNow().notNull(),
  updatedAt:        timestamp('updatedAt').defaultNow().notNull(),
});
export type Company = typeof companies.$inferSelect;
export type InsertCompany = typeof companies.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// COMPANY API KEYS (per-company LLM/AI key management)
// ─────────────────────────────────────────────────────────────────────────────
export const companyApiKeys = pgTable('company_api_keys', {
  id:           serial('id').primaryKey(),
  companyId:    integer('companyId').notNull(),
  provider:     varchar('provider', { length: 50 }).notNull(),
  keyName:      varchar('keyName', { length: 100 }).notNull(),
  maskedKey:    varchar('maskedKey', { length: 50 }).notNull(),
  encryptedKey: text('encryptedKey').notNull(),
  model:        varchar('model', { length: 100 }),
  isActive:     boolean('isActive').default(true),
  isDefault:    boolean('isDefault').default(false),
  lastUsedAt:   timestamp('lastUsedAt'),
  totalCalls:   integer('totalCalls').default(0),
  createdAt:    timestamp('createdAt').defaultNow().notNull(),
  updatedAt:    timestamp('updatedAt').defaultNow().notNull(),
});
export type CompanyApiKey = typeof companyApiKeys.$inferSelect;
export type InsertCompanyApiKey = typeof companyApiKeys.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// COMPANY FEATURE FLAGS
// ─────────────────────────────────────────────────────────────────────────────
export const companyFeatureFlags = pgTable('company_feature_flags', {
  id:        serial('id').primaryKey(),
  companyId: integer('companyId').notNull(),
  feature:   varchar('feature', { length: 100 }).notNull(),
  enabled:   boolean('enabled').default(false),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});
export type CompanyFeatureFlag = typeof companyFeatureFlags.$inferSelect;

// ─────────────────────────────────────────────────────────────────────────────
// COMPANY USERS (role-based membership)
// ─────────────────────────────────────────────────────────────────────────────
export const companyUsers = pgTable('company_users', {
  id:          serial('id').primaryKey(),
  companyId:   integer('companyId').notNull(),
  userId:      integer('userId').notNull(),
  companyRole: varchar('companyRole', { length: 30 }).notNull().default('worker'),
  jobTitle:    varchar('jobTitle', { length: 100 }),
  department:  varchar('department', { length: 100 }),
  isActive:    boolean('isActive').default(true),
  joinedAt:    timestamp('joinedAt').defaultNow(),
  createdAt:   timestamp('createdAt').defaultNow().notNull(),
});
export type CompanyUser = typeof companyUsers.$inferSelect;
export type InsertCompanyUser = typeof companyUsers.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// INSPECTIONS
// ─────────────────────────────────────────────────────────────────────────────
export const inspections = pgTable('inspections', {
  id:              serial('id').primaryKey(),
  companyId:       integer('companyId').notNull(),
  projectId:       integer('projectId').notNull(),
  conductedById:   integer('conductedById').notNull(),
  title:           varchar('title', { length: 255 }).notNull(),
  type:            varchar('type', { length: 100 }).default('general'),
  status:          varchar('status', { length: 20 }).default('draft'),
  checklistItems:  text('checklistItems'),
  overallResult:   varchar('overallResult', { length: 20 }),
  notes:           text('notes'),
  photoUrls:       text('photoUrls').default('[]'),
  scheduledAt:     varchar('scheduledAt', { length: 20 }),
  completedAt:     timestamp('completedAt'),
  createdAt:       timestamp('createdAt').defaultNow().notNull(),
  updatedAt:       timestamp('updatedAt').defaultNow().notNull(),
});
export type Inspection = typeof inspections.$inferSelect;
export type InsertInspection = typeof inspections.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// RFIs (Requests for Information)
// ─────────────────────────────────────────────────────────────────────────────
export const rfis = pgTable('rfis', {
  id:              serial('id').primaryKey(),
  companyId:       integer('companyId').notNull(),
  projectId:       integer('projectId').notNull(),
  raisedById:      integer('raisedById').notNull(),
  number:          varchar('number', { length: 50 }),
  subject:         varchar('subject', { length: 255 }).notNull(),
  question:        text('question').notNull(),
  response:        text('response'),
  status:          varchar('status', { length: 20 }).default('submitted'),
  priority:        varchar('priority', { length: 20 }).default('normal'),
  dueDate:         varchar('dueDate', { length: 20 }),
  attachmentUrls:  text('attachmentUrls').default('[]'),
  // Phase 3.4 — workflow tracking (raisedById covers the originator)
  answeredById:    integer('answeredById'),
  respondedAt:     timestamp('respondedAt'),
  approvedById:    integer('approvedById'),
  approvedAt:      timestamp('approvedAt'),
  rejectedById:    integer('rejectedById'),
  rejectedAt:      timestamp('rejectedAt'),
  rejectedReason:  text('rejectedReason'),
  createdAt:       timestamp('createdAt').defaultNow().notNull(),
  updatedAt:       timestamp('updatedAt').defaultNow().notNull(),
});
export type Rfi = typeof rfis.$inferSelect;
export type InsertRfi = typeof rfis.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// OBSERVATIONS
// ─────────────────────────────────────────────────────────────────────────────
export const observations = pgTable('observations', {
  id:           serial('id').primaryKey(),
  companyId:    integer('companyId').notNull(),
  projectId:    integer('projectId').notNull(),
  observedById: integer('observedById').notNull(),
  type:         varchar('type', { length: 30 }).default('positive'),
  title:        varchar('title', { length: 255 }).notNull(),
  description:  text('description'),
  location:     varchar('location', { length: 255 }),
  photoUrls:    text('photoUrls').default('[]'),
  status:       varchar('status', { length: 20 }).default('open'),
  createdAt:    timestamp('createdAt').defaultNow().notNull(),
  updatedAt:    timestamp('updatedAt').defaultNow().notNull(),
});
export type Observation = typeof observations.$inferSelect;
export type InsertObservation = typeof observations.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// DRAWINGS
// ─────────────────────────────────────────────────────────────────────────────
export const drawings = pgTable('drawings', {
  id:            serial('id').primaryKey(),
  companyId:     integer('companyId').notNull(),
  projectId:     integer('projectId').notNull(),
  uploadedById:  integer('uploadedById').notNull(),
  title:         varchar('title', { length: 255 }).notNull(),
  drawingNumber: varchar('drawingNumber', { length: 100 }),
  revision:      varchar('revision', { length: 20 }),
  discipline:    varchar('discipline', { length: 100 }),
  fileUrl:       text('fileUrl').notNull(),
  thumbnailUrl:  text('thumbnailUrl'),
  fileSize:      integer('fileSize'),
  status:        varchar('status', { length: 20 }).default('current'),
  createdAt:     timestamp('createdAt').defaultNow().notNull(),
  updatedAt:     timestamp('updatedAt').defaultNow().notNull(),
});
export type Drawing = typeof drawings.$inferSelect;
export type InsertDrawing = typeof drawings.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// ANNOUNCEMENTS
// ─────────────────────────────────────────────────────────────────────────────
export const announcements = pgTable('announcements', {
  id:          serial('id').primaryKey(),
  companyId:   integer('companyId').notNull(),
  projectId:   integer('projectId'),
  createdById: integer('createdById').notNull(),
  title:       varchar('title', { length: 255 }).notNull(),
  body:        text('body').notNull(),
  priority:    varchar('priority', { length: 20 }).default('normal'),
  isPinned:    boolean('isPinned').default(false),
  expiresAt:   timestamp('expiresAt'),
  createdAt:   timestamp('createdAt').defaultNow().notNull(),
  updatedAt:   timestamp('updatedAt').defaultNow().notNull(),
});
export type Announcement = typeof announcements.$inferSelect;
export type InsertAnnouncement = typeof announcements.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// ACTION PLANS
// ─────────────────────────────────────────────────────────────────────────────
export const actionPlans = pgTable('action_plans', {
  id:           serial('id').primaryKey(),
  companyId:    integer('companyId').notNull(),
  projectId:    integer('projectId').notNull(),
  createdById:  integer('createdById').notNull(),
  assignedToId: integer('assignedToId'),
  title:        varchar('title', { length: 255 }).notNull(),
  description:  text('description'),
  linkedTo:     varchar('linkedTo', { length: 50 }),
  linkedId:     integer('linkedId'),
  status:       varchar('status', { length: 20 }).default('open'),
  priority:     varchar('priority', { length: 20 }).default('medium'),
  dueDate:      varchar('dueDate', { length: 20 }),
  completedAt:  timestamp('completedAt'),
  createdAt:    timestamp('createdAt').defaultNow().notNull(),
  updatedAt:    timestamp('updatedAt').defaultNow().notNull(),
});
export type ActionPlan = typeof actionPlans.$inferSelect;
export type InsertActionPlan = typeof actionPlans.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// ENQUIRY PIPELINES
// ─────────────────────────────────────────────────────────────────────────────
export const enquiryPipelines = pgTable('enquiry_pipelines', {
  id:        serial('id').primaryKey(),
  companyId: integer('companyId').notNull(),
  name:      varchar('name', { length: 100 }).notNull(),
  stages:    text('stages').notNull(),
  isDefault: boolean('isDefault').default(false),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});
export type EnquiryPipeline = typeof enquiryPipelines.$inferSelect;
export type InsertEnquiryPipeline = typeof enquiryPipelines.$inferInsert;

export const enquiries = pgTable('enquiries', {
  id:           serial('id').primaryKey(),
  companyId:    integer('companyId').notNull(),
  pipelineId:   integer('pipelineId').notNull(),
  assignedToId: integer('assignedToId'),
  clientName:   varchar('clientName', { length: 255 }).notNull(),
  clientEmail:  varchar('clientEmail', { length: 255 }),
  clientPhone:  varchar('clientPhone', { length: 30 }),
  title:        varchar('title', { length: 255 }).notNull(),
  description:  text('description'),
  value:        decimal('value', { precision: 12, scale: 2 }),
  stage:        varchar('stage', { length: 100 }).notNull(),
  source:       varchar('source', { length: 50 }).default('manual'),
  status:       varchar('status', { length: 20 }).default('active'),
  notes:        text('notes'),
  createdAt:    timestamp('createdAt').defaultNow().notNull(),
  updatedAt:    timestamp('updatedAt').defaultNow().notNull(),
});
export type Enquiry = typeof enquiries.$inferSelect;
export type InsertEnquiry = typeof enquiries.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// TENDERS
// ─────────────────────────────────────────────────────────────────────────────
export const tenders = pgTable('tenders', {
  id:           serial('id').primaryKey(),
  companyId:    integer('companyId').notNull(),
  projectId:    integer('projectId'),
  createdById:  integer('createdById').notNull(),
  title:        varchar('title', { length: 255 }).notNull(),
  clientName:   varchar('clientName', { length: 255 }),
  status:       varchar('status', { length: 20 }).default('draft'),
  totalValue:   decimal('totalValue', { precision: 14, scale: 2 }),
  lineItems:    text('lineItems'),
  importSource: varchar('importSource', { length: 20 }),
  notes:        text('notes'),
  submittedAt:  timestamp('submittedAt'),
  createdAt:    timestamp('createdAt').defaultNow().notNull(),
  updatedAt:    timestamp('updatedAt').defaultNow().notNull(),
});
export type Tender = typeof tenders.$inferSelect;
export type InsertTender = typeof tenders.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// INVOICES (with CIS + VAT support)
// ─────────────────────────────────────────────────────────────────────────────
export const invoices = pgTable('invoices', {
  id:                  serial('id').primaryKey(),
  companyId:           integer('companyId').notNull(),
  projectId:           integer('projectId'),
  createdById:         integer('createdById').notNull(),
  invoiceNumber:       varchar('invoiceNumber', { length: 50 }).notNull(),
  type:                varchar('type', { length: 30 }).default('invoice'),
  status:              varchar('status', { length: 20 }).default('draft'),
  clientName:          varchar('clientName', { length: 255 }),
  clientEmail:         varchar('clientEmail', { length: 255 }),
  issueDate:           varchar('issueDate', { length: 20 }),
  dueDate:             varchar('dueDate', { length: 20 }),
  vatRate:             varchar('vatRate', { length: 30 }).default('standard_20'),
  isCisJob:            boolean('isCisJob').default(false),
  cisDeductionRate:    integer('cisDeductionRate').default(0),
  grossLabourOnSite:   decimal('grossLabourOnSite', { precision: 12, scale: 2 }).default('0'),
  grossLabourOffSite:  decimal('grossLabourOffSite', { precision: 12, scale: 2 }).default('0'),
  cisDeductionAmount:  decimal('cisDeductionAmount', { precision: 12, scale: 2 }).default('0'),
  subtotal:            decimal('subtotal', { precision: 12, scale: 2 }).default('0'),
  vatAmount:           decimal('vatAmount', { precision: 12, scale: 2 }).default('0'),
  total:               decimal('total', { precision: 12, scale: 2 }).default('0'),
  netPayable:          decimal('netPayable', { precision: 12, scale: 2 }).default('0'),
  // jsonb post-migration 0015. Shape sourced from shared/cis.ts so the
  // server zod input, the drizzle column type, and the UI form all agree
  // on a single InvoiceLineItem definition.
  lineItems:           jsonb('lineItems').$type<InvoiceLineItem[]>(),
  notes:               text('notes'),
  photoUrl:            text('photoUrl'),
  aiExtracted:         boolean('aiExtracted').default(false),
  approvedById:        integer('approvedById'),
  approvedAt:          timestamp('approvedAt'),
  paidAt:              timestamp('paidAt'),
  createdAt:           timestamp('createdAt').defaultNow().notNull(),
  updatedAt:           timestamp('updatedAt').defaultNow().notNull(),
});
export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = typeof invoices.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// PROJECT BOOKMARKS
// ─────────────────────────────────────────────────────────────────────────────
export const projectBookmarks = pgTable('project_bookmarks', {
  id:         serial('id').primaryKey(),
  companyId:  integer('companyId').notNull(),
  userId:     integer('userId').notNull(),
  projectId:  integer('projectId').notNull(),
  itemType:   varchar('itemType', { length: 50 }).notNull(),
  itemId:     varchar('itemId', { length: 100 }).notNull(),
  itemTitle:  varchar('itemTitle', { length: 255 }).notNull(),
  createdAt:  timestamp('createdAt').defaultNow().notNull(),
});
export type ProjectBookmark = typeof projectBookmarks.$inferSelect;

// ─────────────────────────────────────────────────────────────────────────────
// DRAWING PINS (annotation persistence — shared across devices)
// ─────────────────────────────────────────────────────────────────────────────
export const drawingPins = pgTable('drawing_pins', {
  id:            serial('id').primaryKey(),
  companyId:     integer('companyId').notNull().default(1),
  drawingId:     varchar('drawingId', { length: 100 }).notNull(),
  drawingNumber: varchar('drawingNumber', { length: 255 }),
  pinType:       pinTypeEnum('pinType').notNull().default('note'),
  xPct:          decimal('xPct', { precision: 6, scale: 4 }).notNull(),
  yPct:          decimal('yPct', { precision: 6, scale: 4 }).notNull(),
  title:         varchar('title', { length: 255 }).notNull(),
  description:   text('description'),
  assignedTo:    varchar('assignedTo', { length: 255 }),
  photoUrl:      varchar('photoUrl', { length: 1024 }),
  status:        pinStatusEnum('status').notNull().default('open'),
  createdBy:     varchar('createdBy', { length: 255 }),
  createdAt:     timestamp('createdAt').defaultNow().notNull(),
  updatedAt:     timestamp('updatedAt').defaultNow().notNull(),
});
export type DrawingPin = typeof drawingPins.$inferSelect;
export type InsertDrawingPin = typeof drawingPins.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// INVITED USERS (pending onboarding invitations with temporary PIN)
// ─────────────────────────────────────────────────────────────────────────────
export const invitedUsers = pgTable('invited_users', {
  id:            serial('id').primaryKey(),
  companyId:     integer('companyId').notNull().default(1),
  email:         varchar('email', { length: 320 }).notNull(),
  name:          varchar('name', { length: 255 }).notNull(),
  role:          varchar('role', { length: 64 }).notNull().default('field_worker'),
  employeeClass: varchar('employeeClass', { length: 64 }).notNull().default('Operative'),
  projectId:     varchar('projectId', { length: 100 }),
  projectName:   varchar('projectName', { length: 255 }),
  pin:           varchar('pin', { length: 8 }).notNull(),
  status:        inviteStatusEnum('status').notNull().default('pending'),
  invitedBy:     varchar('invitedBy', { length: 255 }).notNull(),
  expiresAt:     timestamp('expiresAt').notNull(),
  acceptedAt:    timestamp('acceptedAt'),
  createdAt:     timestamp('createdAt').defaultNow().notNull(),
});
export type InvitedUser = typeof invitedUsers.$inferSelect;
export type InsertInvitedUser = typeof invitedUsers.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// EMPLOYEE CREDENTIALS (CSCS, certs, IDs — expiry tracking & push alerts)
// ─────────────────────────────────────────────────────────────────────────────
export const employeeCredentials = pgTable('employee_credentials', {
  id:           serial('id').primaryKey(),
  companyId:    integer('companyId').notNull().default(1),
  employeeId:   varchar('employeeId', { length: 100 }).notNull(),
  employeeName: varchar('employeeName', { length: 255 }).notNull(),
  credType:     varchar('credType', { length: 64 }).notNull(),
  credNumber:   varchar('credNumber', { length: 100 }),
  issueDate:    varchar('issueDate', { length: 20 }),
  expiryDate:   varchar('expiryDate', { length: 20 }),
  alertSent:    integer('alertSent').notNull().default(0),
  notes:        text('notes'),
  createdAt:    timestamp('createdAt').defaultNow().notNull(),
  updatedAt:    timestamp('updatedAt').defaultNow().notNull(),
});
export type EmployeeCredential = typeof employeeCredentials.$inferSelect;
export type InsertEmployeeCredential = typeof employeeCredentials.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// CONFLICT PENDING (offline sync conflict sidecar)
// Phase 3.7 — docs/superpowers/specs/2026-05-06-offline-sync-conflicts-design.md § 4
// Migration: drizzle/0013_conflict_pending.sql.
// When the sync-queue replayer detects a write-write conflict it parks a row
// here instead of clobbering either version. resolvedAt = NULL means unresolved.
// Indexed on (companyId, userId, resolvedAt) for the hot "what's mine + open?" query.
// ─────────────────────────────────────────────────────────────────────────────
export const conflictPending = pgTable('conflict_pending', {
  id:             serial('id').primaryKey(),
  companyId:      integer('companyId').notNull().references(() => companies.id),
  userId:         integer('userId').notNull().references(() => users.id),
  tableName:      varchar('tableName', { length: 64 }).notNull(),
  rowId:          integer('rowId').notNull(),
  conflictFields: jsonb('conflictFields').$type<string[]>().notNull(),
  mineValues:     jsonb('mineValues').$type<Record<string, unknown>>().notNull(),
  theirsValues:   jsonb('theirsValues').$type<Record<string, unknown>>().notNull(),
  baseUpdatedAt:  timestamp('baseUpdatedAt').notNull(),
  resolvedAt:     timestamp('resolvedAt'),
  createdAt:      timestamp('createdAt').defaultNow().notNull(),
}, (t) => ({
  byUserUnresolved: index('conflict_pending_user_unresolved_idx').on(t.companyId, t.userId, t.resolvedAt),
}));

export type ConflictPending = typeof conflictPending.$inferSelect;
export type InsertConflictPending = typeof conflictPending.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// MATERIAL DELIVERIES (Phase 3.2)
// ─────────────────────────────────────────────────────────────────────────────
export const materialDeliveries = pgTable('material_deliveries', {
  id:                  serial('id').primaryKey(),
  companyId:           integer('companyId').notNull(),
  projectId:           integer('projectId').notNull(),
  supplierName:        varchar('supplierName', { length: 255 }).notNull(),
  materialDescription: text('materialDescription').notNull(),
  expectedAt:          timestamp('expectedAt').notNull(),
  deliveredAt:         timestamp('deliveredAt'),
  status:              varchar('status', { length: 20 }).notNull().default('expected'),
  rejectionReason:     text('rejectionReason'),
  cancellationReason:  text('cancellationReason'),
  notes:               text('notes'),
  gpsLat:              decimal('gpsLat',  { precision: 9, scale: 6 }),
  gpsLng:              decimal('gpsLng',  { precision: 9, scale: 6 }),
  photoStorageKeys:    text('photoStorageKeys').array().notNull().default(sql`'{}'`),
  createdById:         integer('createdById').notNull(),
  receivedById:        integer('receivedById'),
  createdAt:           timestamp('createdAt').defaultNow().notNull(),
  updatedAt:           timestamp('updatedAt').defaultNow().notNull(),
});
export type MaterialDelivery       = typeof materialDeliveries.$inferSelect;
export type InsertMaterialDelivery = typeof materialDeliveries.$inferInsert;
export type MaterialDeliveryStatus = 'expected' | 'delivered' | 'rejected' | 'cancelled';

// ─────────────────────────────────────────────────────────────────────────────
// EQUIPMENT
// ─────────────────────────────────────────────────────────────────────────────
export const equipmentStatusEnum = pgEnum('equipment_status_enum', ['available','rented','in_use','maintenance','retired']);
export const equipmentCategoryEnum = pgEnum('equipment_category_enum', ['plant','tool','vehicle','ppe','scaffold','other']);

export const equipment = pgTable('equipment', {
  id:            serial('id').primaryKey(),
  companyId:     integer('companyId').notNull(),
  name:          varchar('name', { length: 255 }).notNull(),
  category:      equipmentCategoryEnum('category').default('tool').notNull(),
  status:        equipmentStatusEnum('status').default('available').notNull(),
  serialNumber:  varchar('serialNumber', { length: 255 }),
  manufacturer:  varchar('manufacturer', { length: 255 }),
  model:         varchar('model', { length: 255 }),
  purchaseDate:  timestamp('purchaseDate'),
  rentalRate:    decimal('rentalRate', { precision: 10, scale: 2 }),
  dailyRate:     decimal('dailyRate', { precision: 10, scale: 2 }),
  location:      varchar('location', { length: 255 }),
  projectId:     integer('projectId'),
  description:   text('description'),
  qrCode:        varchar('qrCode', { length: 255 }),
  gpsLat:        decimal('gpsLat', { precision: 10, scale: 7 }),
  gpsLng:        decimal('gpsLng', { precision: 10, scale: 7 }),
  createdAt:     timestamp('createdAt').defaultNow().notNull(),
  updatedAt:     timestamp('updatedAt').defaultNow().notNull(),
});

export type Equipment       = typeof equipment.$inferSelect;
export type InsertEquipment = typeof equipment.$inferInsert;

export const equipmentAssignments = pgTable('equipment_assignments', {
  id:              serial('id').primaryKey(),
  equipmentId:     integer('equipmentId').notNull(),
  projectId:       integer('projectId').notNull(),
  assignedTo:      integer('assignedTo'),
  assignedBy:      integer('assignedBy').notNull(),
  checkedOut:      timestamp('checkedOut').defaultNow().notNull(),
  checkedIn:       timestamp('checkedIn'),
  expectedReturn:  timestamp('expectedReturn'),
  notes:           text('notes'),
  createdAt:       timestamp('createdAt').defaultNow().notNull(),
});

export type EquipmentAssignment       = typeof equipmentAssignments.$inferSelect;
export type InsertEquipmentAssignment = typeof equipmentAssignments.$inferInsert;

export const equipmentServiceLogs = pgTable('equipment_service_logs', {
  id:               serial('id').primaryKey(),
  equipmentId:      integer('equipmentId').notNull(),
  serviceType:      varchar('serviceType', { length: 50 }).notNull(),
  description:      text('description'),
  cost:             decimal('cost', { precision: 10, scale: 2 }),
  serviceDate:      timestamp('serviceDate').defaultNow().notNull(),
  nextServiceDate:  timestamp('nextServiceDate'),
  performedBy:      varchar('performedBy', { length: 255 }),
  status:           varchar('status', { length: 20 }).default('completed').notNull(),
  documentId:       integer('documentId'),
  createdAt:        timestamp('createdAt').defaultNow().notNull(),
});

export type EquipmentServiceLog       = typeof equipmentServiceLogs.$inferSelect;
export type InsertEquipmentServiceLog = typeof equipmentServiceLogs.$inferInsert;
