// ─── User & Auth ─────────────────────────────────────────────────────────────

/**
 * Legacy role taxonomy used by mock data and the older "domain" screens
 * (super-admin, projects/[id], teams, etc.).
 *
 * NOT the role enum that flows through the live auth system — for that use
 * `UserRole` from `@/lib/company-context`, which mirrors `companyUsers.companyRole`
 * in the database (super_admin / company_admin / manager / supervisor / worker / viewer).
 *
 * These two taxonomies have drifted historically and have not been unified.
 * New code should prefer the company-context one.
 */
export type UserRole =
  | 'super_admin'
  | 'company_owner'
  | 'admin'
  | 'project_manager'
  | 'field_worker'
  | 'subcontractor'
  | 'client';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
  companyId: string;
  companyName: string;
  phone?: string;
}

// ─── Projects ────────────────────────────────────────────────────────────────

export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  client: string;
  siteAddress: string;
  startDate: string;
  endDate: string;
  contractValue: number;
  budgetSpent: number;
  progress: number; // 0-100
  managerId: string;
  managerName: string;
  teamCount: number;
  openTasks: number;
  openDefects: number;
  createdAt: string;
  updatedAt: string;
  /** Per-project GPS distance filter override in metres. Overrides the worker's personal setting when set. */
  gpsDistanceFilterM?: number;
}

// ─── Tasks ───────────────────────────────────────────────────────────────────

export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'blocked';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export interface Task {
  id: string;
  projectId: string;
  projectName: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId?: string;
  assigneeName?: string;
  dueDate?: string;
  completedAt?: string;
  createdAt: string;
}

// ─── Daily Reports ────────────────────────────────────────────────────────────

export interface DailyReport {
  id: string;
  projectId: string;
  projectName: string;
  reportDate: string;
  authorId: string;
  authorName: string;
  weatherCondition: string;
  temperature?: number;
  workersOnSite: number;
  workCompleted: string;
  workPlanned: string;
  issues?: string;
  materialsUsed?: string;
  equipmentUsed?: string;
  // Server folds `visitors` into safetyObservations on create (no DB column),
  // so the field round-trips with that combined text in it.
  safetyObservations?: string;
  photos: string[];
  status: 'draft' | 'submitted' | 'approved';
  createdAt: string;
}

// ─── Safety ──────────────────────────────────────────────────────────────────

export type IncidentSeverity = 'near_miss' | 'low' | 'medium' | 'high' | 'critical';
export type IncidentStatus = 'open' | 'investigating' | 'resolved' | 'closed';

export interface SafetyIncident {
  id: string;
  projectId: string;
  projectName: string;
  title: string;
  description: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  location: string;
  reportedById: string;
  reportedByName: string;
  assignedToId?: string;
  assignedToName?: string;
  incidentDate: string;
  photos: string[];
  actionsTaken?: string;
  createdAt: string;
}

export type PermitType = 'hot_work' | 'confined_space' | 'excavation' | 'working_at_height' | 'electrical' | 'general';
export type PermitStatus = 'pending' | 'active' | 'expired' | 'cancelled';

export interface Permit {
  id: string;
  projectId: string;
  type: PermitType;
  title: string;
  issuedById: string;
  issuedByName: string;
  status: PermitStatus;
  validFrom: string;
  validTo: string;
  location: string;
  conditions?: string;
  createdAt: string;
}

// ─── Timesheets ───────────────────────────────────────────────────────────────

export interface TimesheetEntry {
  id: string;
  workerId: string;
  workerName: string;
  projectId: string;
  projectName: string;
  date: string;
  regularHours: number;
  overtimeHours: number;
  breakMinutes: number;
  notes?: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  createdAt: string;
}

// ─── Defects ─────────────────────────────────────────────────────────────────

export type DefectPriority = 'low' | 'medium' | 'high' | 'critical';
export type DefectStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export interface Defect {
  id: string;
  projectId: string;
  projectName: string;
  title: string;
  description: string;
  priority: DefectPriority;
  status: DefectStatus;
  trade: string;
  location: string;
  reportedById: string;
  reportedByName: string;
  assignedToId?: string;
  assignedToName?: string;
  photos: string[];
  dueDate?: string;
  resolvedAt?: string;
  createdAt: string;
}

// ─── Team ─────────────────────────────────────────────────────────────────────

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  trade?: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  cscsCardType?: string;
  cscsExpiry?: string;
  isOnSite: boolean;
  projectId?: string;
  projectName?: string;
}

// ─── AI ──────────────────────────────────────────────────────────────────────

export type AIAgentType =
  | 'construction_domain'
  | 'safety_compliance'
  | 'cost_estimation'
  | 'project_coordinator'
  | 'defects'
  | 'contracts'
  | 'valuations'
  | 'team_management';

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  agentType?: AIAgentType;
  timestamp: string;
}

export interface AIAgent {
  type: AIAgentType;
  name: string;
  description: string;
  icon: string;
  color: string;
}

// ─── Site Check-In ────────────────────────────────────────────────────────────

export interface SiteCheckIn {
  id: string;
  userId: string;
  userName: string;
  projectId: string;
  projectName: string;
  checkInTime: string;
  checkOutTime?: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
}

// ─── Notifications ────────────────────────────────────────────────────────────

export type NotificationType = 'task' | 'safety' | 'defect' | 'timesheet' | 'report' | 'ai' | 'system';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  projectId?: string;
  entityId?: string;
  createdAt: string;
}
