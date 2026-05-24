// ═══════════════════════════════════════════════════════════════════════════════
// Unified Database Schema — CortexBuild Platform v2
// Merged from: BuildTrack, CortexBuild Field, CortexBuild Ultimate, CortexBuild Web
// PostgreSQL via Drizzle ORM
// ═══════════════════════════════════════════════════════════════════════════════

import {
  boolean, index, integer, jsonb, pgEnum, pgTable, decimal,
  serial, text, timestamp, varchar, uniqueIndex, primaryKey, vector
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ─── ENUMS ────────────────────────────────────────────────────────────────────
export const userRoleEnum       = pgEnum('user_role',       ['viewer','worker','field_worker','supervisor','manager','project_manager','company_admin','company_owner','admin','super_admin']);
export const projectStatusEnum  = pgEnum('project_status',   ['planning','active','on_hold','completed','cancelled']);
export const taskStatusEnum     = pgEnum('task_status',      ['not_started','in_progress','completed','on_hold','blocked']);
export const taskPriorityEnum   = pgEnum('task_priority',    ['low','medium','high','critical']);
export const phaseEnum          = pgEnum('phase_enum',       ['pre_construction','groundworks','structure','mep','fit_out','completion','defects']);
export const safetySeverityEnum = pgEnum('safety_severity',  ['near_miss','low','medium','high','critical']);
export const safetyStatusEnum   = pgEnum('safety_status',    ['open','under_investigation','action_required','resolved','closed']);
export const inspectionStatusEnum = pgEnum('inspection_status', ['pending','passed','failed','in_progress']);
export const defectPriorityEnum = pgEnum('defect_priority',  ['low','medium','high','critical']);
export const defectStatusEnum   = pgEnum('defect_status',    ['open','in_progress','resolved','closed','disputed']);
export const permitTypeEnum     = pgEnum('permit_type',      ['hot_work','confined_space','excavation','working_at_height','electrical','general']);
export const permitStatusEnum   = pgEnum('permit_status',      ['draft','pending','active','expired','cancelled']);
export const permitRiskEnum     = pgEnum('permit_risk',      ['low','medium','high','critical']);
export const dailyReportStatusEnum = pgEnum('daily_report_status', ['draft','submitted','approved']);
export const invoiceStatusEnum  = pgEnum('invoice_status',   ['draft','sent','paid','overdue','disputed']);
export const timesheetStatusEnum = pgEnum('timesheet_status', ['draft','submitted','approved','rejected']);
export const rfiStatusEnum      = pgEnum('rfi_status',       ['draft','pending','responded','closed']);
export const equipmentStatusEnum = pgEnum('equipment_status', ['available','in_use','under_repair','retired']);
export const notificationTypeEnum = pgEnum('notification_type', ['task','safety','project','defect','inspection','rfi','document','mention','general']);
export const platformEnum       = pgEnum('platform',         ['ios','android','web']);
export const planEnum           = pgEnum('plan_enum',        ['free','starter','growth','enterprise']);
export const subscriptionStatusEnum = pgEnum('subscription_status', ['active','trialing','past_due','cancelled']);
export const drawingPinTypeEnum = pgEnum('drawing_pin_type', ['defect','rfi','note']);
export const drawingPinStatusEnum = pgEnum('drawing_pin_status', ['open','in_progress','resolved']);
export const documentCategoryEnum = pgEnum('document_category', ['drawing','certificate','report','rams','insurance','contract','photo','other']);
export const chatTypeEnum       = pgEnum('chat_type',        ['direct','group','project']);
export const messageTypeEnum    = pgEnum('message_type',     ['text','image','file','voice','drawing_pin']);
export const bimFormatEnum      = pgEnum('bim_format',         ['ifc','rvt','nwd','dwg','pdf']);
export const bimStatusEnum      = pgEnum('bim_status',         ['uploading','processing','ready','failed','deprecated']);
export const activitySeverityEnum = pgEnum('activity_severity', ['info','warning','error','critical']);
export const confidenceEnum     = pgEnum('confidence',         ['low','medium','high']);
export const aiAgentEnum        = pgEnum('ai_agent',           ['construction','safety','cost','project','contracts','defects','valuations','team','carbon','bim','whatsapp']);
export const aiModelEnum        = pgEnum('ai_model',           ['gpt-4o','gpt-4o-mini','claude-sonnet-4','gemini-2.5-pro','ollama']);

// ─── COMPANIES ──────────────────────────────────────────────────────────────
export const companies = pgTable('companies', {
  id:            serial('id').primaryKey(),
  name:          varchar('name', { length: 255 }).notNull(),
  slug:          varchar('slug', { length: 255 }).notNull().unique(),
  logo:          text('logo'),
  plan:          planEnum('plan').default('free').notNull(),
  maxUsers:      integer('max_users').default(3).notNull(),
  maxProjects:   integer('max_projects').default(2).notNull(),
  billingEmail:  varchar('billing_email', { length: 320 }),
  stripeCustomerId:     varchar('stripe_customer_id', { length: 100 }),
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 100 }),
  subscriptionStatus:   subscriptionStatusEnum('subscription_status').default('active'),
  metadata:      jsonb('metadata').$type<Record<string,any>>().default({}),
  createdAt:     timestamp('created_at').defaultNow().notNull(),
  updatedAt:     timestamp('updated_at').defaultNow().notNull(),
}, t => [uniqueIndex('companies_slug_idx').on(t.slug)]);

// ─── USERS ──────────────────────────────────────────────────────────────────
export const users = pgTable('users', {
  id:              serial('id').primaryKey(),
  openId:          varchar('open_id', { length: 64 }).unique(),
  name:            text('name'),
  email:           varchar('email', { length: 320 }).notNull().unique(),
  loginMethod:     varchar('login_method', { length: 64 }),
  role:            userRoleEnum('role').default('field_worker').notNull(),
  phone:           varchar('phone', { length: 50 }),
  avatar:          text('avatar'),
  companyId:       integer('company_id').references(() => companies.id),
  passwordHash:    text('password_hash'),
  totpSecret:      text('totp_secret'),
  pushPreferences: jsonb('push_preferences').$type<Record<string,boolean>>().default({}),
  lastSignedIn:    timestamp('last_signed_in').defaultNow().notNull(),
  createdAt:       timestamp('created_at').defaultNow().notNull(),
  updatedAt:       timestamp('updated_at').defaultNow().notNull(),
}, t => [
  uniqueIndex('users_email_idx').on(t.email),
  uniqueIndex('users_openid_idx').on(t.openId),
  index('users_company_idx').on(t.companyId),
]);

// ─── COMPANY MEMBERS ────────────────────────────────────────────────────────
export const companyMembers = pgTable('company_members', {
  id:          serial('id').primaryKey(),
  companyId:   integer('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  userId:      integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role:        userRoleEnum('role').default('viewer').notNull(),
  joinedAt:    timestamp('joined_at').defaultNow().notNull(),
}, t => [uniqueIndex('members_company_user_idx').on(t.companyId, t.userId)]);

// ─── PROJECTS ─────────────────────────────────────────────────────────────────
export const projects = pgTable('projects', {
  id:                serial('id').primaryKey(),
  companyId:         integer('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name:              varchar('name', { length: 255 }).notNull(),
  description:       text('description'),
  clientName:        varchar('client_name', { length: 255 }),
  contractType:      varchar('contract_type', { length: 100 }),
  contractValue:     decimal('contract_value', { precision: 14, scale: 2 }),
  status:            projectStatusEnum('status').default('planning').notNull(),
  phase:             phaseEnum('phase').default('pre_construction'),
  startDate:         timestamp('start_date'),
  endDate:           timestamp('end_date'),
  actualCompletion:  timestamp('actual_completion_date'),
  budget:            decimal('budget', { precision: 14, scale: 2 }),
  spent:             decimal('spent', { precision: 14, scale: 2 }).default('0'),
  progress:          integer('progress').default(0),
  siteAddress:       text('site_address'),
  siteLat:           decimal('site_lat', { precision: 10, scale: 7 }),
  siteLng:           decimal('site_lng', { precision: 11, scale: 7 }),
  geofenceRadius:    integer('geofence_radius').default(200),
  projectManager:    varchar('project_manager', { length: 255 }),
  siteManager:       varchar('site_manager', { length: 255 }),
  supervisor:        varchar('supervisor', { length: 255 }),
  teamSize:          integer('team_size').default(0),
  health:            varchar('health', { length: 10 }).default('green'),
  wtg:               integer('wtg'),
  createdBy:         integer('created_by').references(() => users.id),
  createdAt:         timestamp('created_at').defaultNow().notNull(),
  updatedAt:         timestamp('updated_at').defaultNow().notNull(),
}, t => [
  index('projects_company_idx').on(t.companyId),
  index('projects_status_idx').on(t.status),
  index('projects_created_idx').on(t.createdAt),
]);

// ─── PROJECT IMAGES ───────────────────────────────────────────────────────────
export const projectImages = pgTable('project_images', {
  id:          serial('id').primaryKey(),
  projectId:   integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  url:         text('url').notNull(),
  caption:     text('caption'),
  category:    varchar('category', { length: 50 }).default('general'),
  uploadedBy:  integer('uploaded_by').references(() => users.id),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
});

// ─── TASKS ──────────────────────────────────────────────────────────────────
export const tasks = pgTable('tasks', {
  id:           serial('id').primaryKey(),
  companyId:    integer('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  projectId:    integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  title:        varchar('title', { length: 255 }).notNull(),
  description:  text('description'),
  status:       taskStatusEnum('status').default('not_started').notNull(),
  priority:     taskPriorityEnum('priority').default('medium').notNull(),
  phase:        phaseEnum('phase'),
  assigneeId:   integer('assignee_id').references(() => users.id),
  plannedStart: timestamp('planned_start'),
  plannedEnd:   timestamp('planned_end'),
  actualStart:  timestamp('actual_start'),
  actualEnd:    timestamp('actual_end'),
  durationHours: integer('duration_hours'),
  cost:         decimal('cost', { precision: 12, scale: 2 }),
  wbsId:        varchar('wbs_id', { length: 50 }),
  wbsPath:      text('wbs_path'),
  parentId:     integer('parent_id'),
  createdBy:    integer('created_by').references(() => users.id),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
  updatedAt:    timestamp('updated_at').defaultNow().notNull(),
}, t => [
  index('tasks_project_idx').on(t.projectId),
  index('tasks_status_idx').on(t.status),
  index('tasks_assignee_idx').on(t.assigneeId),
  index('tasks_priority_idx').on(t.priority),
]);

// ─── SAFETY INCIDENTS ───────────────────────────────────────────────────────
export const safetyIncidents = pgTable('safety_incidents', {
  id:               serial('id').primaryKey(),
  companyId:        integer('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  projectId:        integer('project_id').references(() => projects.id, { onDelete: 'set null' }),
  title:            varchar('title', { length: 255 }).notNull(),
  description:      text('description'),
  severity:         safetySeverityEnum('severity').default('low').notNull(),
  status:           safetyStatusEnum('status').default('open').notNull(),
  type:             varchar('type', { length: 100 }),
  incidentDate:     timestamp('incident_date'),
  location:         text('location'),
  immediateAction:  text('immediate_action'),
  correctiveAction: text('corrective_action'),
  followUpDate:     timestamp('follow_up_date'),
  injuries:         integer('injuries').default(0),
  witnesses:        jsonb('witnesses').$type<string[]>(),
  reportedBy:       integer('reported_by').references(() => users.id),
  photos:           jsonb('photos').$type<string[]>(),
  attachments:      jsonb('attachments').$type<string[]>(),
  ramsId:           integer('rams_id'),
  createdAt:        timestamp('created_at').defaultNow().notNull(),
  updatedAt:        timestamp('updated_at').defaultNow().notNull(),
}, t => [
  index('safety_company_idx').on(t.companyId),
  index('safety_project_idx').on(t.projectId),
  index('safety_status_idx').on(t.status),
]);

// ─── INSPECTIONS ──────────────────────────────────────────────────────────────
export const inspections = pgTable('inspections', {
  id:             serial('id').primaryKey(),
  companyId:      integer('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  projectId:      integer('project_id').references(() => projects.id, { onDelete: 'set null' }),
  title:          varchar('title', { length: 255 }).notNull(),
  description:    text('description'),
  type:           varchar('type', { length: 100 }).notNull(),
  status:         inspectionStatusEnum('status').default('pending').notNull(),
  inspectionDate: timestamp('inspection_date'),
  dueDate:        timestamp('due_date'),
  inspector:      varchar('inspector', { length: 255 }),
  findings:       jsonb('findings').$type<string[]>(),
  photos:         jsonb('photos').$type<string[]>(),
  score:          integer('score'),
  ramsId:         integer('rams_id'),
  createdAt:      timestamp('created_at').defaultNow().notNull(),
  updatedAt:      timestamp('updated_at').defaultNow().notNull(),
}, t => [
  index('inspections_company_idx').on(t.companyId),
  index('inspections_project_idx').on(t.projectId),
  index('inspections_status_idx').on(t.status),
]);

// ─── DEFECTS ────────────────────────────────────────────────────────────────
export const defects = pgTable('defects', {
  id:              serial('id').primaryKey(),
  companyId:       integer('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  projectId:       integer('project_id').references(() => projects.id, { onDelete: 'set null' }),
  title:           varchar('title', { length: 255 }).notNull(),
  description:     text('description'),
  priority:        defectPriorityEnum('priority').default('medium').notNull(),
  status:          defectStatusEnum('status').default('open').notNull(),
  location:        text('location'),
  trade:           varchar('trade', { length: 100 }),
  assigneeId:      integer('assignee_id').references(() => users.id),
  photos:          jsonb('photos').$type<string[]>(),
  estimatedCost:   decimal('estimated_cost', { precision: 12, scale: 2 }),
  actualCost:      decimal('actual_cost', { precision: 12, scale: 2 }),
  dueDate:         timestamp('due_date'),
  completedAt:     timestamp('completed_at'),
  createdBy:       integer('created_by').references(() => users.id),
  createdAt:       timestamp('created_at').defaultNow().notNull(),
  updatedAt:       timestamp('updated_at').defaultNow().notNull(),
}, t => [
  index('defects_company_idx').on(t.companyId),
  index('defects_project_idx').on(t.projectId),
  index('defects_status_idx').on(t.status),
  index('defects_priority_idx').on(t.priority),
]);

// ─── PERMITS ──────────────────────────────────────────────────────────────────
export const permits = pgTable('permits', {
  id:               serial('id').primaryKey(),
  companyId:        integer('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  projectId:        integer('project_id').references(() => projects.id, { onDelete: 'set null' }),
  title:            varchar('title', { length: 255 }).notNull(),
  type:             permitTypeEnum('type').default('general').notNull(),
  status:           permitStatusEnum('status').default('draft').notNull(),
  riskLevel:        permitRiskEnum('risk_level').default('low').notNull(),
  validFrom:        timestamp('valid_from'),
  validUntil:       timestamp('valid_until'),
  holderName:       varchar('holder_name', { length: 255 }),
  holderId:         integer('holder_id').references(() => users.id),
  supervisorId:     integer('supervisor_id').references(() => users.id),
  workDescription:  text('work_description'),
  controlMeasures:  text('control_measures'),
  emergencyProcedure: text('emergency_procedure'),
  location:         text('location'),
  createdBy:        integer('created_by').references(() => users.id),
  createdAt:        timestamp('created_at').defaultNow().notNull(),
  updatedAt:        timestamp('updated_at').defaultNow().notNull(),
});

// ─── WORKERS ──────────────────────────────────────────────────────────────────
export const workers = pgTable('workers', {
  id:              serial('id').primaryKey(),
  companyId:       integer('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name:            varchar('name', { length: 255 }).notNull(),
  email:           varchar('email', { length: 320 }),
  phone:           varchar('phone', { length: 50 }),
  role:            varchar('role', { length: 100 }).notNull().default('labourer'),
  trade:           varchar('trade', { length: 100 }),
  hourlyRate:      decimal('hourly_rate', { precision: 10, scale: 2 }),
  status:          varchar('status', { length: 30 }).default('active').notNull(),
  certifications:    jsonb('certifications').$type<string[]>(),
  skills:          jsonb('skills').$type<string[]>(),
  inductionDate:   timestamp('induction_date'),
  inductionExpiry: timestamp('induction_expiry'),
  cscsNumber:      varchar('cscs_number', { length: 50 }),
  photoUrl:        text('photo_url'),
  createdAt:       timestamp('created_at').defaultNow().notNull(),
  updatedAt:       timestamp('updated_at').defaultNow().notNull(),
}, t => [
  index('workers_company_idx').on(t.companyId),
  index('workers_status_idx').on(t.status),
]);

// ─── PROJECT WORKERS ──────────────────────────────────────────────────────────
export const projectWorkers = pgTable('project_workers', {
  id:          serial('id').primaryKey(),
  projectId:   integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  workerId:    integer('worker_id').notNull().references(() => workers.id, { onDelete: 'cascade' }),
  roleOnSite:  varchar('role_on_site', { length: 100 }),
  startDate:   timestamp('start_date'),
  endDate:     timestamp('end_date'),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
}, t => [uniqueIndex('project_worker_idx').on(t.projectId, t.workerId)]);

// ─── TEAM MEMBERS ─────────────────────────────────────────────────────────────
export const teamMembers = pgTable('team_members', {
  id:          serial('id').primaryKey(),
  companyId:   integer('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  userId:      integer('user_id').notNull().references(() => users.id),
  role:        varchar('role', { length: 100 }).default('worker').notNull(),
  trade:       varchar('trade', { length: 100 }),
  hourlyRate:  decimal('hourly_rate', { precision: 10, scale: 2 }),
  status:      varchar('status', { length: 30 }).default('active').notNull(),
  joinDate:    timestamp('join_date'),
  leaveDate:   timestamp('leave_date'),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
  updatedAt:   timestamp('updated_at').defaultNow().notNull(),
}, t => [uniqueIndex('team_member_user_idx').on(t.companyId, t.userId)]);

// ─── TIMESHEETS ───────────────────────────────────────────────────────────────
export const timesheets = pgTable('timesheets', {
  id:           serial('id').primaryKey(),
  companyId:    integer('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  workerId:     integer('worker_id').notNull().references(() => workers.id),
  projectId:    integer('project_id').notNull().references(() => projects.id),
  date:         timestamp('date').notNull(),
  hours:        decimal('hours', { precision: 4, scale: 2 }).notNull(),
  overtime:      decimal('overtime', { precision: 4, scale: 2 }).default('0'),
  costCode:      varchar('cost_code', { length: 50 }),
  notes:         text('notes'),
  photos:        jsonb('photos').$type<string[]>(),
  status:        timesheetStatusEnum('status').default('draft').notNull(),
  approvedBy:    integer('approved_by').references(() => users.id),
  approvedAt:    timestamp('approved_at'),
  createdAt:     timestamp('created_at').defaultNow().notNull(),
  updatedAt:     timestamp('updated_at').defaultNow().notNull(),
}, t => [
  index('timesheets_worker_idx').on(t.workerId),
  index('timesheets_project_idx').on(t.projectId),
  index('timesheets_date_idx').on(t.date),
]);

// ─── DAILY REPORTS ────────────────────────────────────────────────────────────
export const dailyReports = pgTable('daily_reports', {
  id:                 serial('id').primaryKey(),
  companyId:          integer('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  projectId:          integer('project_id').notNull().references(() => projects.id),
  reportDate:         timestamp('report_date').notNull(),
  status:             dailyReportStatusEnum('status').default('draft').notNull(),
  weather:            varchar('weather', { length: 100 }),
  temperature:        decimal('temperature', { precision: 4, scale: 1 }),
  windSpeed:          decimal('wind_speed', { precision: 4, scale: 1 }),
  precipitation:      decimal('precipitation', { precision: 4, scale: 2 }),
  siteConditions:     text('site_conditions'),
  manpowerTotal:      integer('manpower_total').default(0),
  manpowerBreakdown:  jsonb('manpower_breakdown').$type<Record<string,number>>(),
  progressSummary:    text('progress_summary'),
  issues:             text('issues'),
  materialsDelivered: jsonb('materials_delivered').$type<string[]>(),
  equipmentUsed:      jsonb('equipment_used').$type<string[]>(),
  visitors:           jsonb('visitors').$type<string[]>(),
  photoUrls:          jsonb('photo_urls').$type<string[]>(),
  signedBy:           varchar('signed_by', { length: 255 }),
  approvedBy:         integer('approved_by').references(() => users.id),
  createdBy:          integer('created_by').references(() => users.id),
  createdAt:          timestamp('created_at').defaultNow().notNull(),
  updatedAt:          timestamp('updated_at').defaultNow().notNull(),
});

// ─── RFI (Request for Information) ──────────────────────────────────────────
export const rfis = pgTable('rfis', {
  id:             serial('id').primaryKey(),
  companyId:      integer('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  projectId:      integer('project_id').references(() => projects.id, { onDelete: 'set null' }),
  number:         varchar('number', { length: 50 }).notNull(),
  subject:        varchar('subject', { length: 500 }).notNull(),
  description:    text('description'),
  status:         rfiStatusEnum('status').default('draft').notNull(),
  requestedBy:    integer('requested_by').references(() => users.id),
  assignedTo:     integer('assigned_to').references(() => users.id),
  dueDate:        timestamp('due_date'),
  response:       text('response'),
  respondedBy:      integer('responded_by').references(() => users.id),
  respondedAt:    timestamp('responded_at'),
  attachments:    jsonb('attachments').$type<string[]>(),
  createdAt:      timestamp('created_at').defaultNow().notNull(),
  updatedAt:      timestamp('updated_at').defaultNow().notNull(),
}, t => [
  index('rfis_company_idx').on(t.companyId),
  index('rfis_project_idx').on(t.projectId),
  index('rfis_status_idx').on(t.status),
]);

// ─── INVOICES ─────────────────────────────────────────────────────────────────
export const invoices = pgTable('invoices', {
  id:            serial('id').primaryKey(),
  companyId:     integer('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  projectId:     integer('project_id').references(() => projects.id, { onDelete: 'set null' }),
  number:        varchar('number', { length: 100 }).notNull(),
  status:        invoiceStatusEnum('status').default('draft').notNull(),
  amount:        decimal('amount', { precision: 14, scale: 2 }).notNull(),
  taxAmount:     decimal('tax_amount', { precision: 14, scale: 2 }),
  totalAmount:    decimal('total_amount', { precision: 14, scale: 2 }).notNull(),
  paidAmount:     decimal('paid_amount', { precision: 14, scale: 2 }).default('0'),
  issueDate:      timestamp('issue_date'),
  dueDate:        timestamp('due_date'),
  paidDate:       timestamp('paid_date'),
  description:    text('description'),
  lineItems:      jsonb('line_items').$type<any[]>(),
  pdfUrl:         text('pdf_url'),
  createdBy:      integer('created_by').references(() => users.id),
  createdAt:      timestamp('created_at').defaultNow().notNull(),
  updatedAt:      timestamp('updated_at').defaultNow().notNull(),
});

// ─── EQUIPMENT ────────────────────────────────────────────────────────────────
export const equipment = pgTable('equipment', {
  id:              serial('id').primaryKey(),
  companyId:       integer('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name:            varchar('name', { length: 255 }).notNull(),
  type:            varchar('type', { length: 100 }).notNull(),
  status:          equipmentStatusEnum('status').default('available').notNull(),
  serialNumber:    varchar('serial_number', { length: 100 }),
  manufacturer:    varchar('manufacturer', { length: 255 }),
  yearPurchased:   integer('year_purchased'),
  projectId:       integer('project_id').references(() => projects.id),
  operatorId:      integer('operator_id').references(() => users.id),
  dailyRate:       decimal('daily_rate', { precision: 10, scale: 2 }),
  gpsDeviceId:     varchar('gps_device_id', { length: 100 }),
  telemetryData:   jsonb('telemetry_data'),
  lastServiceDate: timestamp('last_service_date'),
  nextServiceDate: timestamp('next_service_date'),
  photoUrl:        text('photo_url'),
  createdAt:       timestamp('created_at').defaultNow().notNull(),
  updatedAt:       timestamp('updated_at').defaultNow().notNull(),
}, t => [index('equipment_company_idx').on(t.companyId)]);

// ─── DOCUMENTS ────────────────────────────────────────────────────────────────
export const documents = pgTable('documents', {
  id:              serial('id').primaryKey(),
  companyId:       integer('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  projectId:       integer('project_id').references(() => projects.id, { onDelete: 'set null' }),
  name:            varchar('name', { length: 500 }).notNull(),
  type:            varchar('type', { length: 100 }).notNull(),
  category:        documentCategoryEnum('category').default('other').notNull(),
  fileUrl:         text('file_url').notNull(),
  fileSize:        integer('file_size'),
  mimeType:        varchar('mime_type', { length: 200 }),
  version:         integer('version').default(1).notNull(),
  previousVersionId: integer('previous_version_id'),
  uploadedBy:      integer('uploaded_by').references(() => users.id),
  reviewedBy:      integer('reviewed_by').references(() => users.id),
  reviewedAt:      timestamp('reviewed_at'),
  status:          varchar('status', { length: 50 }),
  embedding:       jsonb('embedding'), // Vector stored as JSONB for pgvector compatibility
  metadata:        jsonb('metadata').$type<Record<string,any>>(),
  createdAt:       timestamp('created_at').defaultNow().notNull(),
  updatedAt:       timestamp('updated_at').defaultNow().notNull(),
});

// ─── DRAWINGS ─────────────────────────────────────────────────────────────────
export const drawings = pgTable('drawings', {
  id:              serial('id').primaryKey(),
  companyId:       integer('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  projectId:       integer('project_id').references(() => projects.id, { onDelete: 'set null' }),
  title:           varchar('title', { length: 255 }).notNull(),
  discipline:      varchar('discipline', { length: 100 }),
  revision:        varchar('revision', { length: 20 }).default('A'),
  status:          varchar('status', { length: 50 }).default('latest'),
  fileUrl:         text('file_url'),
  thumbnailUrl:    text('thumbnail_url'),
  sheetNumber:     varchar('sheet_number', { length: 50 }),
  scale:           varchar('scale', { length: 20 }),
  uploadedBy:      integer('uploaded_by').references(() => users.id),
  transmittalDate: timestamp('transmittal_date'),
  createdAt:       timestamp('created_at').defaultNow().notNull(),
  updatedAt:       timestamp('updated_at').defaultNow().notNull(),
});

// ─── DRAWING PINS ─────────────────────────────────────────────────────────────
export const drawingPins = pgTable('drawing_pins', {
  id:          serial('id').primaryKey(),
  drawingId:   integer('drawing_id').notNull().references(() => drawings.id, { onDelete: 'cascade' }),
  x:           decimal('x', { precision: 10, scale: 2 }).notNull(),
  y:           decimal('y', { precision: 10, scale: 2 }).notNull(),
  type:        drawingPinTypeEnum('type').default('note').notNull(),
  status:      drawingPinStatusEnum('status').default('open').notNull(),
  relatedId:   integer('related_id'),
  note:        text('note'),
  createdBy:   integer('created_by').references(() => users.id),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
  updatedAt:   timestamp('updated_at').defaultNow().notNull(),
});

// ─── CHAT CHANNELS ────────────────────────────────────────────────────────────
export const chatChannels = pgTable('chat_channels', {
  id:          serial('id').primaryKey(),
  companyId:   integer('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  projectId:   integer('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  type:        chatTypeEnum('type').default('group').notNull(),
  name:        varchar('name', { length: 255 }),
  createdBy:   integer('created_by').references(() => users.id),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
  updatedAt:   timestamp('updated_at').defaultNow().notNull(),
});

// ─── CHAT MESSAGES ────────────────────────────────────────────────────────────
export const chatMessages = pgTable('chat_messages', {
  id:          serial('id').primaryKey(),
  channelId:   integer('channel_id').notNull().references(() => chatChannels.id, { onDelete: 'cascade' }),
  senderId:    integer('sender_id').notNull().references(() => users.id),
  content:     text('content'),
  messageType: messageTypeEnum('message_type').default('text').notNull(),
  fileId:      integer('file_id'),
  replyTo:     integer('reply_to'),
  mentions:    jsonb('mentions').$type<number[]>(),
  readBy:      jsonb('read_by').$type<number[]>(),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
  updatedAt:   timestamp('updated_at').defaultNow().notNull(),
}, t => [index('messages_channel_idx').on(t.channelId)]);

// ─── CHAT CHANNEL MEMBERS ─────────────────────────────────────────────────────
export const chatChannelMembers = pgTable('chat_channel_members', {
  id:          serial('id').primaryKey(),
  channelId:   integer('channel_id').notNull().references(() => chatChannels.id, { onDelete: 'cascade' }),
  userId:      integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  joinedAt:    timestamp('joined_at').defaultNow().notNull(),
  lastReadAt:  timestamp('last_read_at'),
}, t => [uniqueIndex('channel_member_idx').on(t.channelId, t.userId)]);

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────
export const notifications = pgTable('notifications', {
  id:            serial('id').primaryKey(),
  userId:        integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title:         varchar('title', { length: 255 }).notNull(),
  body:          text('body'),
  type:          notificationTypeEnum('type').default('general').notNull(),
  relatedTable:  varchar('related_table', { length: 50 }),
  relatedId:     integer('related_id'),
  read:          boolean('read').default(false).notNull(),
  actioned:      boolean('actioned').default(false).notNull(),
  imageUrl:      text('image_url'),
  icon:          varchar('icon', { length: 50 }),
  sentViaPush:   boolean('sent_via_push').default(false),
  sentViaEmail:  boolean('sent_via_email').default(false),
  sentViaSlack:  boolean('sent_via_slack').default(false),
  createdAt:     timestamp('created_at').defaultNow().notNull(),
}, t => [
  index('notifications_user_idx').on(t.userId),
  index('notifications_read_idx').on(t.read),
]);

// ─── NOTIFICATION PREFERENCES ─────────────────────────────────────────────────
export const notificationPreferences = pgTable('notification_preferences', {
  id:          serial('id').primaryKey(),
  userId:      integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  emailOn:     boolean('email_on').default(true).notNull(),
  pushOn:      boolean('push_on').default(true).notNull(),
  slackOn:     boolean('slack_on').default(false).notNull(),
  types:       jsonb('types').$type<Record<string,boolean>>().default({}),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
  updatedAt:   timestamp('updated_at').defaultNow().notNull(),
});

// ─── PUSH TOKENS ──────────────────────────────────────────────────────────────
export const pushTokens = pgTable('push_tokens', {
  id:        serial('id').primaryKey(),
  userId:    integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token:     text('token').notNull().unique(),
  platform:  platformEnum('platform').notNull(),
  deviceInfo: jsonb('device_info'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, t => [index('push_tokens_user_idx').on(t.userId)]);

// ─── PUSH SUBSCRIPTIONS (Web Push) ──────────────────────────────────────────────
export const pushSubscriptions = pgTable('push_subscriptions', {
  id:         serial('id').primaryKey(),
  userId:     integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  endpoint:   text('endpoint').notNull().unique(),
  p256dh:     text('p256dh').notNull(),
  auth:       text('auth').notNull(),
  platform:   platformEnum('platform').default('web').notNull(),
  createdAt:  timestamp('created_at').defaultNow().notNull(),
}, t => [index('push_subs_user_idx').on(t.userId)]);

// ─── COST CODES ───────────────────────────────────────────────────────────────
export const costCodes = pgTable('cost_codes', {
  id:           serial('id').primaryKey(),
  companyId:    integer('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  code:         varchar('code', { length: 50 }).notNull(),
  description:  varchar('description', { length: 500 }).notNull(),
  parentCodeId: integer('parent_code_id'),
  budget:       decimal('budget', { precision: 14, scale: 2 }),
  spent:        decimal('spent', { precision: 14, scale: 2 }).default('0'),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
  updatedAt:    timestamp('updated_at').defaultNow().notNull(),
}, t => [uniqueIndex('cost_code_company_code_idx').on(t.companyId, t.code)]);

// ─── BIM MODELS ─────────────────────────────────────────────────────────────────
export const bimModels = pgTable('bim_models', {
  id:           serial('id').primaryKey(),
  companyId:      integer('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  projectId:      integer('project_id').references(() => projects.id, { onDelete: 'set null' }),
  name:           varchar('name', { length: 255 }).notNull(),
  fileUrl:        text('file_url'),
  fileSize:       integer('file_size'),
  format:         bimFormatEnum('format').default('ifc').notNull(),
  version:        varchar('version', { length: 50 }).default('1.0'),
  status:         bimStatusEnum('status').default('uploading').notNull(),
  metadata:       jsonb('metadata'),
  clashCount:     integer('clash_count').default(0),
  createdBy:      integer('created_by').references(() => users.id),
  createdAt:      timestamp('created_at').defaultNow().notNull(),
  updatedAt:      timestamp('updated_at').defaultNow().notNull(),
}, t => [index('bim_company_idx').on(t.companyId)]);

// ─── CARBON ESTIMATES ────────────────────────────────────────────────────────
export const carbonEstimates = pgTable('carbon_estimates', {
  id:                  serial('id').primaryKey(),
  companyId:           integer('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  projectId:           integer('project_id').references(() => projects.id, { onDelete: 'set null' }),
  element:             varchar('element', { length: 255 }).notNull(),
  material:            varchar('material', { length: 255 }).notNull(),
  volume:              decimal('volume', { precision: 14, scale: 4 }),
  mass:                decimal('mass', { precision: 14, scale: 4 }),
  embodiedCarbonKg:    decimal('embodied_carbon_kg', { precision: 14, scale: 4 }),
  sequesteredCarbonKg: decimal('sequestered_carbon_kg', { precision: 14, scale: 4 }),
  totalA1A3:           decimal('total_a1_a3', { precision: 14, scale: 4 }),
  epdReference:        varchar('epd_reference', { length: 255 }),
  source:              varchar('source', { length: 255 }),
  confidence:          confidenceEnum('confidence').default('medium'),
  createdAt:           timestamp('created_at').defaultNow().notNull(),
});

// ─── ACTIVITY LOG ────────────────────────────────────────────────────────────
export const activityLog = pgTable('activity_log', {
  id:            serial('id').primaryKey(),
  companyId:     integer('company_id').notNull(),
  userId:        integer('user_id').references(() => users.id),
  action:        varchar('action', { length: 100 }).notNull(),
  entityType:    varchar('entity_type', { length: 50 }).notNull(),
  entityId:      integer('entity_id'),
  metadata:      jsonb('metadata'),
  severity:      activitySeverityEnum('severity').default('info').notNull(),
  ipAddress:     varchar('ip_address', { length: 45 }),
  userAgent:     text('user_agent'),
  createdAt:     timestamp('created_at').defaultNow().notNull(),
}, t => [
  index('activity_company_idx').on(t.companyId),
  index('activity_entity_idx').on(t.entityType, t.entityId),
]);

// ─── AI CONVERSATIONS ───────────────────────────────────────────────────────────
export const aiConversations = pgTable('ai_conversations', {
  id:          serial('id').primaryKey(),
  companyId:   integer('company_id').notNull(),
  projectId:   integer('project_id').references(() => projects.id),
  userId:      integer('user_id').notNull().references(() => users.id),
  title:       varchar('title', { length: 255 }),
  agent:       aiAgentEnum('agent').default('construction').notNull(),
  modelUsed:   aiModelEnum('model_used').default('gpt-4o'),
  tokensUsed:  integer('tokens_used').default(0),
  feedback:    varchar('feedback', { length: 20 }),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
  updatedAt:   timestamp('updated_at').defaultNow().notNull(),
}, t => [index('ai_conv_user_idx').on(t.userId)]);

// ─── AI MESSAGES ─────────────────────────────────────────────────────────────
export const aiMessages = pgTable('ai_messages', {
  id:           serial('id').primaryKey(),
  conversationId: integer('conversation_id').notNull().references(() => aiConversations.id, { onDelete: 'cascade' }),
  role:           varchar('role', { length: 20 }).notNull(),
  content:        text('content').notNull(),
  toolCalls:      jsonb('tool_calls'),
  toolResults:    jsonb('tool_results'),
  tokens:         integer('tokens'),
  latencyMs:      integer('latency_ms'),
  model:          varchar('model', { length: 50 }),
  createdAt:      timestamp('created_at').defaultNow().notNull(),
});

// ─── RAG EMBEDDINGS ───────────────────────────────────────────────────────────
export const ragEmbeddings = pgTable('rag_embeddings', {
  id:            serial('id').primaryKey(),
  documentId:    integer('document_id').references(() => documents.id),
  chunkText:     text('chunk_text').notNull(),
  chunkIndex:    integer('chunk_index').default(0),
  embedding:     jsonb('embedding'), // If pgvector installed, use: vector('embedding', { dimensions: 1536 })
  metadata:      jsonb('metadata'),
  createdAt:     timestamp('created_at').defaultNow().notNull(),
});

// ─── SESSIONS ─────────────────────────────────────────────────────────────────
export const sessions = pgTable('sessions', {
  id:          varchar('id', { length: 128 }).primaryKey(),
  userId:      integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  companyId:   integer('company_id').references(() => companies.id),
  ipAddress:   varchar('ip_address', { length: 45 }),
  userAgent:   text('user_agent'),
  deviceType:  varchar('device_type', { length: 20 }),
  platform:    platformEnum('platform'),
  lastActive:  timestamp('last_active').defaultNow().notNull(),
  expiresAt:   timestamp('expires_at').notNull(),
  revokedAt:   timestamp('revoked_at'),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
}, t => [index('sessions_user_idx').on(t.userId)]);

// ─── INVITATIONS ──────────────────────────────────────────────────────────────
export const invitations = pgTable('invitations', {
  id:         serial('id').primaryKey(),
  companyId:  integer('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  email:      varchar('email', { length: 320 }).notNull(),
  role:       userRoleEnum('role').default('viewer').notNull(),
  token:      varchar('token', { length: 255 }).notNull().unique(),
  invitedBy:  integer('invited_by').references(() => users.id),
  expiresAt:  timestamp('expires_at').notNull(),
  acceptedAt: timestamp('accepted_at'),
  createdAt:  timestamp('created_at').defaultNow().notNull(),
}, t => [index('invitations_token_idx').on(t.token)]);

// ─── WHATSAPP CONTACTS ────────────────────────────────────────────────────────
export const whatsappContacts = pgTable('whatsapp_contacts', {
  id:            serial('id').primaryKey(),
  waId:          varchar('wa_id', { length: 64 }).notNull().unique(),
  phoneNumber:   varchar('phone_number', { length: 32 }).notNull(),
  displayName:   varchar('display_name', { length: 255 }),
  profileName:   varchar('profile_name', { length: 255 }),
  projectTag:    varchar('project_tag', { length: 255 }),
  notes:         text('notes'),
  isActive:      boolean('is_active').default(true).notNull(),
  lastSeenAt:    timestamp('last_seen_at'),
  createdAt:     timestamp('created_at').defaultNow().notNull(),
  updatedAt:     timestamp('updated_at').defaultNow().notNull(),
});

// ─── WHATSAPP CONVERSATIONS ───────────────────────────────────────────────────
export const whatsappConversations = pgTable('whatsapp_conversations', {
  id:             serial('id').primaryKey(),
  contactId:      integer('contact_id').notNull().references(() => whatsappContacts.id),
  waConversationId: varchar('wa_conversation_id', { length: 128 }),
  title:          varchar('title', { length: 255 }),
  projectTag:     varchar('project_tag', { length: 255 }),
  summary:        text('summary'),
  messageCount:   integer('message_count').default(0),
  imageCount:     integer('image_count').default(0),
  issueCount:     integer('issue_count').default(0),
  lastMessageAt:  timestamp('last_message_at'),
  createdAt:      timestamp('created_at').defaultNow().notNull(),
  updatedAt:      timestamp('updated_at').defaultNow().notNull(),
});

// ─── WHATSAPP MESSAGES ────────────────────────────────────────────────────────
export const whatsappMessages = pgTable('whatsapp_messages', {
  id:              serial('id').primaryKey(),
  conversationId:  integer('conversation_id').notNull().references(() => whatsappConversations.id),
  contactId:       integer('contact_id').notNull().references(() => whatsappContacts.id),
  waMessageId:     varchar('wa_message_id', { length: 128 }).unique(),
  direction:       varchar('direction', { length: 20 }).notNull(),
  messageType:     varchar('message_type', { length: 20 }).notNull(),
  content:         text('content'),
  mediaUrl:        text('media_url'),
  mimeType:        varchar('mime_type', { length: 100 }),
  caption:         text('caption'),
  status:          varchar('status', { length: 20 }).default('received'),
  aiProcessed:     boolean('ai_processed').default(false),
  createdAt:       timestamp('created_at').defaultNow().notNull(),
});

// ─── WEBHOOKS ─────────────────────────────────────────────────────────────────
export const webhooks = pgTable('webhooks', {
  id:          serial('id').primaryKey(),
  companyId:   integer('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name:        varchar('name', { length: 255 }).notNull(),
  url:         text('url').notNull(),
  events:      jsonb('events').$type<string[]>(),
  secret:      text('secret'),
  active:      boolean('active').default(true).notNull(),
  lastSentAt:  timestamp('last_sent_at'),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
});

// ─── SUBSCRIPTIONS / BILLING ──────────────────────────────────────────────────
export const subscriptions = pgTable('subscriptions', {
  id:           serial('id').primaryKey(),
  companyId:    integer('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }).unique(),
  stripeCustomerId:    varchar('stripe_customer_id', { length: 100 }),
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 100 }),
  stripePriceId:       varchar('stripe_price_id', { length: 100 }),
  plan:         planEnum('plan').default('free').notNull(),
  status:       subscriptionStatusEnum('status').default('active').notNull(),
  currentPeriodStart: timestamp('current_period_start'),
  currentPeriodEnd:   timestamp('current_period_end'),
  cancelAtPeriodEnd:  boolean('cancel_at_period_end').default(false),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
  updatedAt:    timestamp('updated_at').defaultNow().notNull(),
});

// ─── SETTINGS ────────────────────────────────────────────────────────────────
export const settings = pgTable('settings', {
  id:          serial('id').primaryKey(),
  companyId:   integer('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }).unique(),
  key:         varchar('key', { length: 100 }).notNull(),
  value:       jsonb('value').notNull(),
  updatedBy:   integer('updated_by').references(() => users.id),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
  updatedAt:   timestamp('updated_at').defaultNow().notNull(),
}, t => [uniqueIndex('settings_company_key_idx').on(t.companyId, t.key)]);

// ─── AUTOIMPROVE / AUTOREPAIR ─────────────────────────────────────────────────
export const autoimproveSchedules = pgTable('autoimprove_schedules', {
  id:            serial('id').primaryKey(),
  companyId:     integer('company_id').notNull(),
  agent:           varchar('agent', { length: 50 }).notNull(),
  enabled:         boolean('enabled').default(true).notNull(),
  frequencyHours:  integer('frequency_hours').default(24),
  promptTemplate:  text('prompt_template'),
  lastRunAt:       timestamp('last_run_at'),
  nextRunAt:       timestamp('next_run_at'),
  createdAt:       timestamp('created_at').defaultNow().notNull(),
  updatedAt:       timestamp('updated_at').defaultNow().notNull(),
});

export const autoimproveRecommendations = pgTable('autoimprove_recommendations', {
  id:          serial('id').primaryKey(),
  companyId:     integer('company_id').notNull(),
  scheduleId:    integer('schedule_id'),
  agent:         varchar('agent', { length: 50 }),
  summary:       text('summary'),
  details:       jsonb('details'),
  applied:       boolean('applied').default(false),
  appliedBy:     integer('applied_by').references(() => users.id),
  appliedAt:     timestamp('applied_at'),
  createdAt:     timestamp('created_at').defaultNow().notNull(),
});

// ─── MIGRATION LOG ─────────────────────────────────────────────────────────────
export const migrationLog = pgTable('migration_log', {
  id:          serial('id').primaryKey(),
  name:        varchar('name', { length: 255 }).notNull(),
  appliedAt:   timestamp('applied_at').defaultNow().notNull(),
});

// ─── Type exports ─────────────────────────────────────────────────────────────
export type Company   = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;
export type User      = typeof users.$inferSelect;
export type NewUser   = typeof users.$inferInsert;
export type Project   = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Task      = typeof tasks.$inferSelect;
export type NewTask   = typeof tasks.$inferInsert;
export type SafetyIncident = typeof safetyIncidents.$inferSelect;
export type NewSafetyIncident = typeof safetyIncidents.$inferInsert;
export type Inspection = typeof inspections.$inferSelect;
export type Defect    = typeof defects.$inferSelect;
export type Permit    = typeof permits.$inferSelect;
export type Worker    = typeof workers.$inferSelect;
export type TeamMember = typeof teamMembers.$inferSelect;
export type Timesheet = typeof timesheets.$inferSelect;
export type DailyReport = typeof dailyReports.$inferSelect;
export type RFI       = typeof rfis.$inferSelect;
export type Invoice   = typeof invoices.$inferSelect;
export type Equipment = typeof equipment.$inferSelect;
export type Document  = typeof documents.$inferSelect;
export type Drawing   = typeof drawings.$inferSelect;
export type DrawingPin = typeof drawingPins.$inferSelect;
export type ChatChannel = typeof chatChannels.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type ActivityLog   = typeof activityLog.$inferSelect;
export type AIConversation = typeof aiConversations.$inferSelect;
export type AIMessage    = typeof aiMessages.$inferSelect;
export type Session      = typeof sessions.$inferSelect;
export type CarbonEstimate = typeof carbonEstimates.$inferSelect;
export type BIMModel     = typeof bimModels.$inferSelect;
export type WhatsappContact = typeof whatsappContacts.$inferSelect;
export type WhatsappConversation = typeof whatsappConversations.$inferSelect;
export type WhatsappMessage = typeof whatsappMessages.$inferSelect;
export type Subscription  = typeof subscriptions.$inferSelect;
export type Setting       = typeof settings.$inferSelect;
export type CostCode      = typeof costCodes.$inferSelect;
