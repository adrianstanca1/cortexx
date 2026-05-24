export interface Project {
  id: string;
  name: string;
  description?: string;
  status: "planning" | "active" | "on_hold" | "completed" | "cancelled";
  location?: { lat: number; lng: number; address?: string };
  startDate?: string;
  endDate?: string;
  budget?: number;
  orgId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  status: "todo" | "in_progress" | "review" | "done";
  priority: "low" | "medium" | "high" | "critical";
  assigneeId?: string;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SafetyIncident {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  severity: "near_miss" | "minor" | "major" | "critical";
  status: "open" | "investigating" | "resolved" | "closed";
  reportedBy: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface TeamMember {
  id: string;
  orgId: string;
  userId: string;
  name: string;
  email: string;
  phone?: string;
  role: "admin" | "manager" | "foreman" | "worker";
  trade?: string;
  certifications?: string[];
  cscsCard?: {
    number: string;
    expiryDate: string;
    type: string;
  };
  hourlyRate?: number;
}

export interface Organisation {
  id: string;
  name: string;
  slug: string;
  plan: "free" | "pro" | "enterprise";
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  body?: string;
  type: "task" | "incident" | "project" | "system";
  read: boolean;
  data?: Record<string, any>;
  createdAt: string;
}

export interface RFI {
  id: string;
  projectId: string;
  number: string;
  title: string;
  description?: string;
  status: "draft" | "submitted" | "responded" | "closed" | "rejected";
  priority: "low" | "medium" | "high" | "urgent";
  submittedBy: string;
  submittedAt?: string;
  response?: string;
  respondedAt?: string;
  respondedBy?: string;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Drawing {
  id: string;
  projectId: string;
  name: string;
  drawingNumber: string;
  discipline: "architectural" | "structural" | "mechanical" | "electrical" | "plumbing" | "civil" | "landscape";
  revision: string;
  revisionDate: string;
  status: "current" | "superseded" | "for_approval" | "approved";
  url?: string;
  uploadedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface DailyReport {
  id: string;
  projectId: string;
  date: string;
  weather: {
    condition: "clear" | "cloudy" | "rain" | "snow" | "windy" | "fog";
    temperature?: number;
  };
  summary: string;
  workCompleted: string;
  issues: string;
  workforce: number;
  visitors?: string[];
  photos?: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type AppRoute =
  | "/"
  | "/login"
  | "/dashboard"
  | "/projects"
  | "/tasks"
  | "/safety"
  | "/team"
  | "/settings"
  | "/rfis"
  | "/drawings"
  | "/daily-reports"
  | "/budget"
  | "/materials"
  | "/invoices"
  | "/punch-items"
  | "/defects";

export interface Budget {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  totalBudget?: number;
  totalSpent?: number;
  currency: string;
  status: "draft" | "approved" | "revised" | "closed";
  createdAt: string;
  updatedAt: string;
}

export interface BudgetCategory {
  id: string;
  budgetId: string;
  name: string;
  description?: string;
  allocated: number;
  spent: number;
  createdAt: string;
}

export interface BudgetLineItem {
  id: string;
  categoryId: string;
  description: string;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
  status: "planned" | "ordered" | "delivered" | "invoiced";
  createdAt: string;
}

export interface Material {
  id: string;
  projectId: string;
  name: string;
  category: string;
  description?: string;
  quantity: number;
  unit: string;
  status: "ordered" | "delivered" | "in_stock" | "used";
  deliveryDate?: string;
  supplier?: string;
  cost?: number;
  createdAt: string;
  updatedAt: string;
}

export interface PunchItem {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  location?: string;
  severity: "minor" | "major" | "critical";
  status: "open" | "in_progress" | "resolved" | "verified" | "closed";
  assignedTo?: string;
  dueDate?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Invoice {
  id: string;
  projectId: string;
  invoiceNumber: string;
  vendor: string;
  description?: string;
  amount: number;
  tax?: number;
  total: number;
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled";
  issueDate: string;
  dueDate?: string;
  paidDate?: string;
  lineItems: InvoiceLineItem[];
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
}

export interface Defect {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  location?: string;
  severity: "minor" | "major" | "critical";
  status: "open" | "in_progress" | "resolved" | "closed";
  assignedTo?: string;
  dueDate?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Equipment {
  id: string;
  projectId?: string;
  name: string;
  type: string;
  make?: string;
  model?: string;
  serialNumber?: string;
  status: "available" | "in_use" | "maintenance" | "retired";
  location?: string;
  hoursUsed?: number;
  nextServiceDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Meeting {
  id: string;
  projectId?: string;
  title: string;
  meetingType: "site" | "progress" | "safety" | "design" | "other";
  type?: string; // backward-compatible alias
  date: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  agenda?: string;
  attendees: string[];
  minutes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Permit {
  id: string;
  projectId?: string;
  permitNumber: string;
  permitType: string;
  type?: string; // backward-compatible alias
  authority: string;
  status: "applied" | "under_review" | "approved" | "rejected" | "expired";
  issueDate?: string;
  expiryDate?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TimesheetEntry {
  id: string;
  projectId?: string;
  workerName: string;
  date: string;
  startTime?: string;
  endTime?: string;
  breakMinutes?: number;
  hoursWorked: number;
  task?: string;
  notes?: string;
  status: "draft" | "submitted" | "approved" | "rejected";
  createdAt: string;
  updatedAt: string;
}

export interface Submittal {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  status: "draft" | "submitted" | "under_review" | "approved" | "rejected" | "resubmitted";
  submittedBy: string;
  submissionDate: string;
  reviewedBy?: string;
  reviewDate?: string;
  reviewComments?: string;
  attachments?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrder {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  vendor: string;
  status: "draft" | "submitted" | "approved" | "ordered" | "delivered" | "invoiced" | "cancelled";
  totalAmount?: number;
  items?: PurchaseOrderItem[];
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrderItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
}
