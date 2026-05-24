// ============================================================================
// Shared types and Zod schemas for CortexBuild Unified
// Used by web, mobile, and server packages
// ============================================================================
import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// COMMON HELPERS
// ─────────────────────────────────────────────────────────────────────────────
export const IdSchema = z.number().int().positive();
export const UuidSchema = z.string().uuid();
export const EmailSchema = z.string().email().max(320);
export const DateSchema = z.coerce.date();
export const OptionalDate = z.coerce.date().optional().nullable();
export const JsonbSchema = z.record(z.unknown()).default({});

// ─────────────────────────────────────────────────────────────────────────────
// USER SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────
export const UserRoleSchema = z.enum([
  "super_admin", "company_owner", "admin", "project_manager",
  "field_worker", "client", "manager", "supervisor", "worker", "viewer",
]);

export const UserSchema = z.object({
  id: IdSchema,
  email: EmailSchema,
  name: z.string().max(255).nullable(),
  role: UserRoleSchema,
  avatarUrl: z.string().nullable(),
  phone: z.string().max(30).nullable(),
  jobTitle: z.string().max(100).nullable(),
  department: z.string().max(100).nullable(),
  trade: z.string().max(100).nullable(),
  companyId: IdSchema.nullable(),
  organizationId: UuidSchema.nullable(),
  permissions: z.record(z.boolean()).default({}),
  isActive: z.boolean().default(true),
  pushEnabled: z.boolean().default(true),
  emailEnabled: z.boolean().default(true),
  lastSignedIn: OptionalDate,
  createdAt: DateSchema,
});

export const CreateUserSchema = z.object({
  email: EmailSchema,
  name: z.string().max(255).optional(),
  password: z.string().min(8).max(128),
  role: UserRoleSchema.default("worker"),
  companyId: IdSchema.optional(),
  jobTitle: z.string().max(100).optional(),
  department: z.string().max(100).optional(),
  trade: z.string().max(100).optional(),
});

export const UpdateUserSchema = z.object({
  name: z.string().max(255).optional(),
  phone: z.string().max(30).optional(),
  jobTitle: z.string().max(100).optional(),
  department: z.string().max(100).optional(),
  trade: z.string().max(100).optional(),
  avatarUrl: z.string().optional(),
  role: UserRoleSchema.optional(),
  permissions: z.record(z.boolean()).optional(),
  isActive: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
  emailEnabled: z.boolean().optional(),
});

export const LoginSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1),
});

export const InviteUserSchema = z.object({
  email: EmailSchema,
  role: UserRoleSchema.default("worker"),
  companyId: IdSchema.optional(),
  projectIds: z.array(IdSchema).optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// COMPANY SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────
export const CompanySchema = z.object({
  id: IdSchema,
  name: z.string().max(255),
  slug: z.string().max(100),
  plan: z.enum(["free", "starter", "professional", "enterprise", "custom"]).default("free"),
  logoUrl: z.string().nullable(),
  primaryColor: z.string().max(7).default("#1E3A5F"),
  address: z.string().nullable(),
  phone: z.string().max(30).nullable(),
  email: z.string().max(255).nullable(),
  vatNumber: z.string().max(20).nullable(),
  utr: z.string().max(20).nullable(),
  maxProjects: z.number().default(5),
  maxUsers: z.number().default(10),
  isActive: z.boolean().default(true),
  createdAt: DateSchema,
});

export const CreateCompanySchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100),
  primaryColor: z.string().max(7).optional(),
  address: z.string().optional(),
  phone: z.string().max(30).optional(),
  email: z.string().max(255).optional(),
  vatNumber: z.string().max(20).optional(),
  utr: z.string().max(20).optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// PROJECT SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────
export const ProjectStatusSchema = z.enum([
  "planning", "active", "on_hold", "completed", "cancelled", "archived",
]);

export const ProjectSchema = z.object({
  id: IdSchema,
  companyId: IdSchema,
  name: z.string().max(255),
  description: z.string().nullable(),
  clientName: z.string().max(255).nullable(),
  clientEmail: EmailSchema.nullable(),
  status: ProjectStatusSchema.default("planning"),
  budget: z.string().or(z.number()).nullable(),
  spent: z.string().or(z.number()).default(0),
  progress: z.number().min(0).max(100).default(0),
  siteAddress: z.string().nullable(),
  siteLat: z.number().nullable(),
  siteLng: z.number().nullable(),
  geofenceRadius: z.number().default(200),
  projectManagerId: IdSchema.nullable(),
  projectManager: z.string().max(255).nullable(),
  contractType: z.string().max(100).nullable(),
  bimModelUrl: z.string().nullable(),
  startDate: OptionalDate,
  endDate: OptionalDate,
  createdAt: DateSchema,
});

export const CreateProjectSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  clientName: z.string().max(255).optional(),
  clientEmail: EmailSchema.optional(),
  status: ProjectStatusSchema.default("planning"),
  budget: z.number().nonnegative().optional(),
  siteAddress: z.string().optional(),
  siteLat: z.number().optional(),
  siteLng: z.number().optional(),
  geofenceRadius: z.number().default(200),
  contractType: z.string().max(100).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export const UpdateProjectSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  clientName: z.string().max(255).optional(),
  status: ProjectStatusSchema.optional(),
  budget: z.number().nonnegative().optional(),
  siteAddress: z.string().optional(),
  siteLat: z.number().optional(),
  siteLng: z.number().optional(),
  progress: z.number().min(0).max(100).optional(),
  contractType: z.string().max(100).optional(),
  endDate: z.coerce.date().optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// TASK SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────
export const TaskStatusSchema = z.enum(["not_started", "in_progress", "completed", "blocked", "on_hold"]);
export const TaskPrioritySchema = z.enum(["low", "medium", "high", "critical"]);

export const TaskSchema = z.object({
  id: IdSchema,
  companyId: IdSchema,
  projectId: IdSchema,
  title: z.string().max(255),
  description: z.string().nullable(),
  status: TaskStatusSchema.default("not_started"),
  priority: TaskPrioritySchema.default("medium"),
  assignedToId: IdSchema.nullable(),
  assignedTo: z.string().max(255).nullable(),
  dueDate: OptionalDate,
  completedAt: OptionalDate,
  progress: z.number().min(0).max(100).default(0),
  trade: z.string().max(100).nullable(),
  estimatedHours: z.number().nullable(),
  actualHours: z.number().nullable(),
  parentTaskId: IdSchema.nullable(),
  createdAt: DateSchema,
});

export const CreateTaskSchema = z.object({
  projectId: IdSchema,
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  status: TaskStatusSchema.default("not_started"),
  priority: TaskPrioritySchema.default("medium"),
  assignedToId: IdSchema.optional(),
  dueDate: z.coerce.date().optional(),
  trade: z.string().max(100).optional(),
  estimatedHours: z.number().optional(),
  parentTaskId: IdSchema.optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// DEFECT SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────
export const DefectStatusSchema = z.enum(["open", "in_progress", "resolved", "closed", "disputed"]);
export const DefectPrioritySchema = z.enum(["low", "medium", "high", "critical"]);

export const DefectSchema = z.object({
  id: IdSchema,
  companyId: IdSchema,
  projectId: IdSchema,
  title: z.string().max(255),
  description: z.string().nullable(),
  location: z.string().max(255).nullable(),
  trade: z.string().max(100).nullable(),
  priority: DefectPrioritySchema.default("medium"),
  status: DefectStatusSchema.default("open"),
  assignedToId: IdSchema.nullable(),
  assignedTo: z.string().max(255).nullable(),
  reportedBy: z.string().max(255),
  dueDate: OptionalDate,
  resolvedAt: OptionalDate,
  closedAt: OptionalDate,
  photoUrls: z.string().nullable(),
  createdAt: DateSchema,
});

export const CreateDefectSchema = z.object({
  projectId: IdSchema,
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  location: z.string().max(255).optional(),
  trade: z.string().max(100).optional(),
  priority: DefectPrioritySchema.default("medium"),
  assignedToId: IdSchema.optional(),
  dueDate: z.coerce.date().optional(),
  reportedBy: z.string().min(1),
  photoUrls: z.string().optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// INSPECTION SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────
export const InspectionSchema = z.object({
  id: IdSchema,
  companyId: IdSchema,
  projectId: IdSchema,
  conductedById: IdSchema,
  title: z.string().max(255),
  type: z.string().max(100).default("general"),
  status: z.string().max(20).default("draft"),
  checklistItems: z.string().nullable(),
  overallResult: z.string().max(20).nullable(),
  notes: z.string().nullable(),
  photoUrls: z.string().nullable(),
  scheduledAt: OptionalDate,
  completedAt: OptionalDate,
  createdAt: DateSchema,
});

export const CreateInspectionSchema = z.object({
  projectId: IdSchema,
  title: z.string().min(1).max(255),
  type: z.string().max(100).default("general"),
  checklistItems: z.string().optional(),
  notes: z.string().optional(),
  scheduledAt: z.coerce.date().optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// RFI SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────
export const RfiStatusSchema = z.enum(["draft", "submitted", "in_review", "answered", "closed"]);

export const RfiSchema = z.object({
  id: IdSchema,
  companyId: IdSchema,
  projectId: IdSchema,
  raisedById: IdSchema,
  number: z.string().max(50).nullable(),
  subject: z.string().max(255),
  question: z.string(),
  response: z.string().nullable(),
  status: RfiStatusSchema.default("submitted"),
  priority: z.string().max(20).default("normal"),
  dueDate: OptionalDate,
  respondedById: IdSchema.nullable(),
  respondedAt: OptionalDate,
  createdAt: DateSchema,
});

export const CreateRfiSchema = z.object({
  projectId: IdSchema,
  number: z.string().max(50).optional(),
  subject: z.string().min(1).max(255),
  question: z.string().min(1),
  priority: z.string().max(20).default("normal"),
  dueDate: z.coerce.date().optional(),
});

export const AnswerRfiSchema = z.object({
  response: z.string().min(1),
})

// ─────────────────────────────────────────────────────────────────────────────
// INCIDENT SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────
export const IncidentTypeSchema = z.enum([
  "near_miss", "first_aid", "accident", "dangerous_occurrence",
  "environmental", "security",
]);
export const IncidentSeveritySchema = z.enum(["near_miss", "low", "medium", "high", "critical"]);

export const IncidentSchema = z.object({
  id: IdSchema,
  companyId: IdSchema,
  projectId: IdSchema,
  title: z.string().max(255),
  description: z.string().nullable(),
  type: IncidentTypeSchema,
  severity: IncidentSeveritySchema,
  status: z.string().max(20).default("open"),
  location: z.string().max(255).nullable(),
  reportedBy: z.string().max(255),
  injuredPerson: z.string().max(255).nullable(),
  witnesses: z.string().nullable(),
  immediateAction: z.string().nullable(),
  rootCause: z.string().nullable(),
  correctiveAction: z.string().nullable(),
  photoUrls: z.string().nullable(),
  riddorRequired: z.boolean().default(false),
  riddorReportedAt: OptionalDate,
  createdAt: DateSchema,
});

export const CreateIncidentSchema = z.object({
  projectId: IdSchema,
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  type: IncidentTypeSchema,
  severity: IncidentSeveritySchema.default("low"),
  location: z.string().max(255).optional(),
  reportedBy: z.string().min(1),
  injuredPerson: z.string().max(255).optional(),
  witnesses: z.string().optional(),
  immediateAction: z.string().optional(),
  rootCause: z.string().optional(),
  correctiveAction: z.string().optional(),
  photoUrls: z.string().optional(),
  riddorRequired: z.boolean().default(false),
});

// ─────────────────────────────────────────────────────────────────────────────
// DAILY REPORT SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────
export const DailyReportStatusSchema = z.enum(["draft", "submitted", "approved"]);

export const DailyReportSchema = z.object({
  id: IdSchema,
  companyId: IdSchema,
  projectId: IdSchema,
  reportDate: DateSchema,
  weather: z.string().max(100).nullable(),
  temperature: z.number().nullable(),
  workersOnSite: z.number().default(0),
  workCompleted: z.string().nullable(),
  materialsUsed: z.string().nullable(),
  equipmentUsed: z.string().nullable(),
  issuesDelays: z.string().nullable(),
  safetyObservations: z.string().nullable(),
  nextDayPlan: z.string().nullable(),
  photoUrls: z.string().nullable(),
  submittedBy: z.string().max(255),
  status: DailyReportStatusSchema.default("draft"),
  createdAt: DateSchema,
});

export const CreateDailyReportSchema = z.object({
  projectId: IdSchema,
  reportDate: z.coerce.date(),
  weather: z.string().max(100).optional(),
  temperature: z.number().optional(),
  workersOnSite: z.number().default(0),
  workCompleted: z.string().optional(),
  materialsUsed: z.string().optional(),
  equipmentUsed: z.string().optional(),
  issuesDelays: z.string().optional(),
  safetyObservations: z.string().optional(),
  nextDayPlan: z.string().optional(),
  submittedBy: z.string().min(1),
});

// ─────────────────────────────────────────────────────────────────────────────
// TIMESHEET SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────
export const TimesheetStatusSchema = z.enum(["draft", "submitted", "approved", "rejected"]);

export const TimesheetSchema = z.object({
  id: IdSchema,
  companyId: IdSchema,
  projectId: IdSchema.nullable(),
  projectName: z.string().max(255).nullable(),
  workerName: z.string().max(255),
  weekStarting: z.string().max(20),
  mondayHours: z.number().default(0),
  tuesdayHours: z.number().default(0),
  wednesdayHours: z.number().default(0),
  thursdayHours: z.number().default(0),
  fridayHours: z.number().default(0),
  saturdayHours: z.number().default(0),
  sundayHours: z.number().default(0),
  totalHours: z.number().default(0),
  overtimeHours: z.number().default(0),
  status: TimesheetStatusSchema.default("draft"),
  notes: z.string().nullable(),
  submittedAt: OptionalDate,
  approvedAt: OptionalDate,
  createdAt: DateSchema,
});

export const CreateTimesheetSchema = z.object({
  projectId: IdSchema.optional(),
  projectName: z.string().max(255).optional(),
  workerName: z.string().min(1).max(255),
  weekStarting: z.string().max(20),
  mondayHours: z.number().min(0).max(24).default(0),
  tuesdayHours: z.number().min(0).max(24).default(0),
  wednesdayHours: z.number().min(0).max(24).default(0),
  thursdayHours: z.number().min(0).max(24).default(0),
  fridayHours: z.number().min(0).max(24).default(0),
  saturdayHours: z.number().min(0).max(24).default(0),
  sundayHours: z.number().min(0).max(24).default(0),
  notes: z.string().optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// INVOICE SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────
export const InvoiceStatusSchema = z.enum(["draft", "sent", "paid", "overdue", "disputed"]);
export const InvoiceLineItemSchema = z.object({
  description: z.string(),
  quantity: z.number().default(1),
  unitPrice: z.number().default(0),
  total: z.number().default(0),
});

export const InvoiceSchema = z.object({
  id: IdSchema,
  companyId: IdSchema,
  projectId: IdSchema.nullable(),
  invoiceNumber: z.string().max(50),
  description: z.string().nullable(),
  lineItems: z.array(InvoiceLineItemSchema).nullable(),
  subtotal: z.number().default(0),
  vatRate: z.number().default(20),
  vatAmount: z.number().default(0),
  total: z.number().default(0),
  cisDeduction: z.number().default(0),
  status: InvoiceStatusSchema.default("draft"),
  issueDate: OptionalDate,
  dueDate: OptionalDate,
  paidAt: OptionalDate,
  createdAt: DateSchema,
});

export const CreateInvoiceSchema = z.object({
  projectId: IdSchema.optional(),
  invoiceNumber: z.string().min(1).max(50),
  description: z.string().optional(),
  lineItems: z.array(InvoiceLineItemSchema).optional(),
  subtotal: z.number().default(0),
  vatRate: z.number().default(20),
  status: InvoiceStatusSchema.default("draft"),
  issueDate: z.coerce.date().optional(),
  dueDate: z.coerce.date().optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// EQUIPMENT SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────
export const EquipmentStatusSchema = z.enum(["available", "in_use", "maintenance", "retired"]);

export const EquipmentSchema = z.object({
  id: IdSchema,
  companyId: IdSchema,
  projectId: IdSchema.nullable(),
  name: z.string().max(255),
  type: z.string().max(100).nullable(),
  make: z.string().max(100).nullable(),
  model: z.string().max(100).nullable(),
  serialNumber: z.string().max(100).nullable(),
  status: EquipmentStatusSchema.default("available"),
  location: z.string().max(255).nullable(),
  hourlyRate: z.number().nullable(),
  dailyRate: z.number().nullable(),
  nextMaintenanceDate: OptionalDate,
  photoUrls: z.string().nullable(),
  createdAt: DateSchema,
});

export const CreateEquipmentSchema = z.object({
  projectId: IdSchema.optional(),
  name: z.string().min(1).max(255),
  type: z.string().max(100).optional(),
  make: z.string().max(100).optional(),
  model: z.string().max(100).optional(),
  serialNumber: z.string().max(100).optional(),
  status: EquipmentStatusSchema.default("available"),
  location: z.string().max(255).optional(),
  hourlyRate: z.number().optional(),
  dailyRate: z.number().optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// MATERIAL SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────
export const MaterialStatusSchema = z.enum([
  "requested", "ordered", "delivered", "installed", "rejected",
]);

export const MaterialSchema = z.object({
  id: IdSchema,
  companyId: IdSchema,
  projectId: IdSchema,
  name: z.string().max(255),
  description: z.string().nullable(),
  supplier: z.string().max(255).nullable(),
  quantity: z.number().nullable(),
  unit: z.string().max(50).nullable(),
  unitCost: z.number().nullable(),
  totalCost: z.number().nullable(),
  status: MaterialStatusSchema.default("requested"),
  photoUrls: z.string().nullable(),
  createdAt: DateSchema,
});

export const CreateMaterialSchema = z.object({
  projectId: IdSchema,
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  supplier: z.string().max(255).optional(),
  quantity: z.number().optional(),
  unit: z.string().max(50).optional(),
  unitCost: z.number().optional(),
  status: MaterialStatusSchema.default("requested"),
});

// ─────────────────────────────────────────────────────────────────────────────
// DRAWING SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────
export const DrawingStatusSchema = z.enum(["draft", "approved", "as_built", "superseded"]);

export const DrawingSchema = z.object({
  id: IdSchema,
  companyId: IdSchema,
  projectId: IdSchema,
  title: z.string().max(255),
  drawingNumber: z.string().max(50).nullable(),
  revision: z.string().max(20).nullable(),
  status: DrawingStatusSchema.default("draft"),
  discipline: z.string().max(50).nullable(),
  storageUrl: z.string().nullable(),
  thumbnailUrl: z.string().nullable(),
  createdAt: DateSchema,
});

export const CreateDrawingSchema = z.object({
  projectId: IdSchema,
  title: z.string().min(1).max(255),
  drawingNumber: z.string().max(50).optional(),
  revision: z.string().max(20).optional(),
  discipline: z.string().max(50).optional(),
  storageUrl: z.string().optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// MEETING SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────
export const MeetingSchema = z.object({
  id: IdSchema,
  companyId: IdSchema,
  projectId: IdSchema.nullable(),
  title: z.string().max(255),
  type: z.string().max(50).nullable(),
  status: z.string().max(20).default("scheduled"),
  scheduledAt: OptionalDate,
  durationMinutes: z.number().default(60),
  location: z.string().max(255).nullable(),
  notes: z.string().nullable(),
  agenda: z.string().nullable(),
  attendees: z.string().nullable(),
  minutes: z.string().nullable(),
  createdAt: DateSchema,
});

export const CreateMeetingSchema = z.object({
  projectId: IdSchema.optional(),
  title: z.string().min(1).max(255),
  type: z.string().max(50).optional(),
  scheduledAt: z.coerce.date().optional(),
  durationMinutes: z.number().default(60),
  location: z.string().max(255).optional(),
  agenda: z.string().optional(),
  attendees: z.string().optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// CHECK-IN SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────
export const CheckInSchema = z.object({
  id: IdSchema,
  userId: IdSchema.nullable(),
  workerName: z.string().max(255).nullable(),
  projectId: IdSchema,
  checkInTime: DateSchema,
  checkOutTime: OptionalDate,
  checkInLat: z.number().nullable(),
  checkInLng: z.number().nullable(),
  checkOutLat: z.number().nullable(),
  checkOutLng: z.number().nullable(),
  gpsVerified: z.boolean().default(false),
  distanceFromSite: z.number().nullable(),
  durationMinutes: z.number().nullable(),
  createdAt: DateSchema,
});

export const CheckInRequestSchema = z.object({
  projectId: IdSchema,
  workerName: z.string().min(1).max(255),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

export const CheckOutRequestSchema = z.object({
  checkInId: IdSchema,
  lat: z.number().optional(),
  lng: z.number().optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// FILE SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────
export const FileCategorySchema = z.enum([
  "photo", "certificate", "payslip", "drawing", "report", "document", "other",
]);

export const FileRecordSchema = z.object({
  id: IdSchema,
  companyId: IdSchema,
  projectId: IdSchema.nullable(),
  name: z.string().max(255),
  category: FileCategorySchema.default("document"),
  mimeType: z.string().max(100).nullable(),
  sizeBytes: z.number().nullable(),
  storageUrl: z.string().nullable(),
  description: z.string().nullable(),
  tags: z.string().nullable(),
  createdAt: DateSchema,
});

// ─────────────────────────────────────────────────────────────────────────────
// AI CONVERSATION SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────
export const AiAgentTypeSchema = z.enum([
  "construction_domain", "safety_compliance", "cost_estimation",
  "project_coordinator", "contracts", "defects", "valuations", "team_management",
]);

export const AiMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
  timestamp: z.string(),
});

export const AiConversationSchema = z.object({
  id: IdSchema,
  userId: IdSchema,
  projectId: IdSchema.nullable(),
  agentType: AiAgentTypeSchema.nullable(),
  title: z.string().max(255).nullable(),
  messages: z.array(AiMessageSchema).default([]),
  model: z.string().max(100).nullable(),
  tokenUsage: z.number().default(0),
  createdAt: DateSchema,
});

export const CreateAiConversationSchema = z.object({
  projectId: IdSchema.optional(),
  agentType: AiAgentTypeSchema.optional(),
  title: z.string().max(255).optional(),
  initialMessage: z.string().min(1),
});

export const AiChatMessageSchema = z.object({
  conversationId: IdSchema,
  message: z.string().min(1),
});

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATION SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────
export const NotificationTypeSchema = z.enum([
  "defect_assigned", "defect_resolved", "inspection_scheduled",
  "rfi_answered", "task_assigned", "task_completed", "incident_reported",
  "timesheet_approved", "change_order_approved", "invoice_paid",
  "meeting_reminder", "permit_expired", "safety_alert", "system",
]);

export const NotificationSchema = z.object({
  id: IdSchema,
  userId: IdSchema,
  type: NotificationTypeSchema,
  title: z.string().max(255),
  body: z.string().nullable(),
  data: z.record(z.unknown()).default({}),
  read: z.boolean().default(false),
  readAt: OptionalDate,
  createdAt: DateSchema,
});

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD / ANALYTICS
// ─────────────────────────────────────────────────────────────────────────────
export const DashboardStatsSchema = z.object({
  totalProjects: z.number().default(0),
  activeProjects: z.number().default(0),
  totalTasks: z.number().default(0),
  openTasks: z.number().default(0),
  openDefects: z.number().default(0),
  openIncidents: z.number().default(0),
  pendingRfis: z.number().default(0),
  pendingApprovals: z.number().default(0),
  totalBudget: z.number().default(0),
  totalSpent: z.number().default(0),
  totalRevenue: z.number().default(0),
  workersOnSite: z.number().default(0),
  overdueItems: z.number().default(0),
});

// ─────────────────────────────────────────────────────────────────────────────
// API RESPONSE WRAPPERS
// ─────────────────────────────────────────────────────────────────────────────
export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(schema: T) =>
  z.object({
    data: z.array(schema),
    pagination: z.object({
      page: z.number(),
      perPage: z.number(),
      total: z.number(),
      totalPages: z.number(),
    }),
  });

export const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean().default(true),
    data: dataSchema.optional(),
    message: z.string().optional(),
    error: z.string().optional(),
  });

// ─────────────────────────────────────────────────────────────────────────────
// AUTH TYPES
// ─────────────────────────────────────────────────────────────────────────────
export interface AuthContext {
  userId: number;
  email: string;
  role: z.infer<typeof UserRoleSchema>;
  companyId: number | null;
  organizationId: string | null;
  permissions: Record<string, boolean>;
}

export type AppContext = {
  auth: AuthContext;
};

export const PaginationInputSchema = z.object({
  page: z.number().int().min(1).default(1),
  perPage: z.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});
