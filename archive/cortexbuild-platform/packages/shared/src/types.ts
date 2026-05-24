// ═══════════════════════════════════════════════════════════════════════════════
// Unified Types for CortexBuild Platform v2
// All types consolidated from BuildTrack, Field, Ultimate, Web, Pro
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Enums ───────────────────────────────────────────────────────────────────
export type UserRole = 'super_admin'|'company_owner'|'company_admin'|'project_manager'|'manager'|'admin'|'supervisor'|'field_worker'|'client'|'viewer';

export type ProjectStatus = 'planning'|'active'|'on_hold'|'completed'|'cancelled';
export type TaskStatus = 'not_started'|'in_progress'|'completed'|'on_hold'|'blocked';
export type TaskPriority = 'low'|'medium'|'high'|'critical';
export type Phase = 'pre_construction'|'groundworks'|'structure'|'mep'|'fit_out'|'completion'|'defects';

export type SafetySeverity = 'near_miss'|'low'|'medium'|'high'|'critical';
export type SafetyStatus = 'open'|'under_investigation'|'action_required'|'resolved'|'closed';
export type InspectionStatus = 'pending'|'passed'|'failed'|'in_progress';
export type DefectPriority = 'low'|'medium'|'high'|'critical';
export type DefectStatus = 'open'|'in_progress'|'resolved'|'closed'|'disputed';

export type PermitType = 'hot_work'|'confined_space'|'excavation'|'working_at_height'|'electrical'|'general';
export type PermitStatus = 'draft'|'pending'|'active'|'expired'|'cancelled';
export type PermitRiskLevel = 'low'|'medium'|'high'|'critical';

export type DailyReportStatus = 'draft'|'submitted'|'approved';
export type InvoiceStatus = 'draft'|'sent'|'paid'|'overdue'|'disputed';
export type TimesheetStatus = 'draft'|'submitted'|'approved'|'rejected';
export type RFIStatus = 'draft'|'pending'|'responded'|'closed';
export type EquipmentStatus = 'available'|'in_use'|'under_repair'|'retired';

export type NotificationType = 'task'|'safety'|'project'|'defect'|'inspection'|'rfi'|'general'|'mention';
export type Platform = 'ios'|'android'|'web';

// ─── Core Entity Types ──────────────────────────────────────────────────────
export interface User {
  id: number;                       // Postgres serial primary key
  openId?: string;                  // OAuth provider ID (Supabase sub, etc.)
  name: string;
  email: string;
  loginMethod: string;
  role: UserRole;
  phone?: string;
  avatar?: string;
  companyId?: number;
  organizationId?: number;
  pushPreferences: Record<string,boolean>;
  passwordHash?: string;
  totpSecret?: string;
  createdAt: Date;
  updatedAt: Date;
  lastSignedIn: Date;
}

export interface Company {
  id: number;
  name: string;
  slug: string;
  logo?: string;
  plan: 'free'|'starter'|'growth'|'enterprise';
  maxUsers: number;
  maxProjects: number;
  billingEmail?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStatus: 'active'|'trialing'|'past_due'|'cancelled';
  metadata?: Record<string,unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Project {
  id: number;
  companyId: number;
  name: string;
  description?: string;
  clientName?: string;
  contractType?: string;
  contractValue?: number;
  status: ProjectStatus;
  phase?: Phase;
  startDate?: Date;
  endDate?: Date;
  actualCompletionDate?: Date;
  budget?: number;
  spent?: number;
  progress: number;
  siteAddress?: string;
  siteLat?: number;
  siteLng?: number;
  geofenceRadius: number;
  projectManager?: string;
  siteManager?: string;
  supervisor?: string;
  teamSize?: number;
  health?: 'green'|'amber'|'red';
  wtg?: number;
  createdBy?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Task {
  id: number;
  companyId: number;
  projectId: number;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  phase?: Phase;
  assigneeId?: number;
  plannedStart?: Date;
  plannedEnd?: Date;
  actualStart?: Date;
  actualEnd?: Date;
  durationHours?: number;
  cost?: number;
  wbsId?: string;
  wbsPath?: string;
  parentId?: number;
  createdBy?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SafetyIncident {
  id: number;
  companyId: number;
  projectId?: number;
  title: string;
  description?: string;
  severity: SafetySeverity;
  status: SafetyStatus;
  type: string;
  incidentDate?: Date;
  location?: string;
  immediateAction?: string;
  correctiveAction?: string;
  followUpDate?: Date;
  injuries?: number;
  witnesses?: string[];
  reportedBy?: number;
  photos?: string[];
  attachments?: string[];
  ramsId?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Inspection {
  id: number;
  companyId: number;
  projectId?: number;
  title: string;
  description?: string;
  type: string;
  status: InspectionStatus;
  inspectionDate?: Date;
  dueDate?: Date;
  inspector?: string;
  findings?: string[];
  photos?: string[];
  score?: number;
  ramsId?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Defect {
  id: number;
  companyId: number;
  projectId?: number;
  title: string;
  description?: string;
  priority: DefectPriority;
  status: DefectStatus;
  location?: string;
  trade?: string;
  assigneeId?: number;
  photos?: string[];
  estimatedCost?: number;
  actualCost?: number;
  dueDate?: Date;
  completedAt?: Date;
  createdBy?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Permit {
  id: number;
  companyId: number;
  projectId?: number;
  title: string;
  type: PermitType;
  status: PermitStatus;
  riskLevel: PermitRiskLevel;
  validFrom?: Date;
  validUntil?: Date;
  holderName?: string;
  holderId?: number;
  supervisorId?: number;
  workDescription?: string;
  controlMeasures?: string;
  emergencyProcedure?: string;
  location?: string;
  createdBy?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface DailyReport {
  id: number;
  companyId: number;
  projectId: number;
  reportDate: Date;
  status: DailyReportStatus;
  weather: string;
  temperature?: number;
  windSpeed?: number;
  siteConditions?: string;
  manpowerTotal: number;
  manpowerBreakdown?: Record<string,number>;
  progressSummary?: string;
  issues?: string;
  materialsDelivered?: string[];
  equipmentUsed?: string[];
  visitors?: string[];
  photoUrls?: string[];
  signedBy?: string;
  createdBy?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Worker {
  id: number;
  companyId: number;
  name: string;
  email?: string;
  phone?: string;
  role: string;
  trade?: string;
  hourlyRate?: number;
  status: 'active'|'inactive'|'on_leave';
  certifications?: string[];
  skills?: string[];
  inductionDate?: Date;
  inductionExpiry?: Date;
  cscsNumber?: string;
  photoUrl?: string;
  projectAssignments?: number[];
  createdAt: Date;
  updatedAt: Date;
}

export interface RFI {
  id: number;
  companyId: number;
  projectId?: number;
  number: string;
  subject: string;
  description?: string;
  status: RFIStatus;
  requestedBy?: number;
  assignedTo?: number;
  dueDate?: Date;
  response?: string;
  respondedBy?: number;
  respondedAt?: Date;
  attachments?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Invoice {
  id: number;
  companyId: number;
  projectId?: number;
  number: string;
  status: InvoiceStatus;
  amount: number;
  taxAmount?: number;
  totalAmount: number;
  paidAmount?: number;
  issueDate?: Date;
  dueDate?: Date;
  paidDate?: Date;
  description?: string;
  lineItems?: InvoiceLineItem[];
  pdfUrl?: string;
  createdBy?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface InvoiceLineItem {
  id?: string;
  description: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
  costCode?: string;
}

export interface Equipment {
  id: number;
  companyId: number;
  name: string;
  type: string;
  status: EquipmentStatus;
  serialNumber?: string;
  manufacturer?: string;
  yearPurchased?: number;
  projectId?: number;
  operatorId?: number;
  dailyRate?: number;
  gpsDeviceId?: string;
  telemetryData?: Record<string,unknown>;
  lastServiceDate?: Date;
  nextServiceDate?: Date;
  photoUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TeamMember {
  id: number;
  companyId: number;
  userId: number;
  role: string;
  trade?: string;
  hourlyRate?: number;
  status: 'active'|'inactive'|'on_leave';
  joinDate?: Date;
  leaveDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Timesheet {
  id: number;
  companyId: number;
  workerId: number;
  projectId: number;
  date: Date;
  hours: number;
  status: TimesheetStatus;
  approvedBy?: number;
  approvedAt?: Date;
  costCode?: string;
  notes?: string;
  photos?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Document {
  id: number;
  companyId: number;
  projectId?: number;
  name: string;
  type: string;
  category: 'drawing'|'certificate'|'report'|'rams'|'insurance'|'contract'|'photo'|'other';
  fileUrl: string;
  fileSize?: number;
  mimeType?: string;
  version: number;
  previousVersionId?: number;
  uploadedBy?: number;
  reviewedBy?: number;
  reviewedAt?: Date;
  status?: string;
  embedding?: number[];
  metadata?: Record<string,unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatChannel {
  id: number;
  companyId: number;
  projectId?: number;
  type: 'direct'|'group'|'project';
  name?: string;
  createdBy?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatMessage {
  id: number;
  channelId: number;
  senderId: number;
  content?: string;
  messageType: 'text'|'image'|'file'|'voice'|'drawing_pin';
  fileId?: number;
  replyTo?: number;
  mentions?: number[];
  readBy?: number[];
  createdAt: Date;
  updatedAt: Date;
}

export interface DrawingPin {
  id: number;
  drawingId: number;
  x: number;
  y: number;
  type: 'defect'|'rfi'|'note';
  status: 'open'|'in_progress'|'resolved';
  relatedId?: number;
  createdBy?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationEvent {
  id: number;
  userId: number;
  title: string;
  body?: string;
  type: NotificationType;
  relatedTable?: string;
  relatedId?: number;
  read: boolean;
  actioned: boolean;
  imageUrl?: string;
  icon?: string;
  sentViaPush: boolean;
  sentViaEmail: boolean;
  sentViaSlack: boolean;
  createdAt: Date;
}

export interface WhatsAppContact {
  id: number;
  waId: string;
  phoneNumber: string;
  displayName?: string;
  profileName?: string;
  projectTag?: string;
  notes?: string;
  isActive: boolean;
  lastSeenAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CostCode {
  id: number;
  companyId: number;
  code: string;
  description: string;
  parentCodeId?: number;
  budget?: number;
  spent?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface BIMModel {
  id: number;
  companyId: number;
  projectId?: number;
  name: string;
  fileUrl?: string;
  fileSize?: number;
  format: 'ifc'|'rvt'|'nwd'|'dwg'|'pdf';
  version: string;
  status: 'uploading'|'processing'|'ready'|'failed'|'deprecated';
  metadata?: Record<string,unknown>;
  clashCount?: number;
  createdBy?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CarbonEstimate {
  id: number;
  companyId: number;
  projectId?: number;
  element: string;
  material: string;
  volume?: number;
  mass?: number;
  embodiedCarbonKg?: number;
  sequesteredCarbonKg?: number;
  totalA1A3?: number;
  epdReference?: string;
  source: string;
  confidence: 'low'|'medium'|'high';
  createdAt: Date;
}

export interface Session {
  id: string;
  userId: number;
  companyId?: number;
  ipAddress?: string;
  userAgent?: string;
  deviceType?: 'mobile'|'tablet'|'desktop';
  platform?: Platform;
  lastActiveAt: Date;
  expiresAt: Date;
  revokedAt?: Date;
  createdAt: Date;
}

// ─── AI & Analytics ─────────────────────────────────────────────────────────

export interface AIConversation {
  id: number;
  companyId: number;
  projectId?: number;
  userId: number;
  title?: string;
  agent: string;
  messages: AIMessage[];
  toolCalls?: string[];
  modelUsed?: string;
  tokensUsed?: number;
  feedback?: 'thumbs_up'|'thumbs_down';
  createdAt: Date;
  updatedAt: Date;
}

export interface AIMessage {
  id: string;
  role: 'system'|'user'|'assistant'|'tool';
  content: string;
  toolCalls?: Record<string,unknown>[];
  toolResults?: Record<string,unknown>[];
  tokens?: number;
  latencyMs?: number;
  model?: string;
  createdAt: Date;
}

export interface ActivityLog {
  id: number;
  companyId: number;
  userId?: number;
  action: string;
  entityType: string;
  entityId?: number;
  metadata?: Record<string,unknown>;
  ipAddress?: string;
  userAgent?: string;
  severity: 'info'|'warning'|'error'|'critical';
  createdAt: Date;
}

export interface DashboardStats {
  projects: { total: number; active: number; completed: number; onHold: number };
  tasks: { total: number; completed: number; inProgress: number; overdue: number };
  safety: { totalIncidents: number; open: number; critical: number; monthToDate: number };
  finance: { totalBudget: number; spent: number; unpaid: number; overdue: number };
  team: { total: number; onSite: number; active: number };
  schedule: { onTrack: number; atRisk: number; behind: number };
  carbon: { totalA1A3: number; reductionPercent: number };
  bim: { models: number; clashes: number; openIssues: number };
  progress: number;
  wtg?: number;
}

// ─── Unified Response ───────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
