// ═══════════════════════════════════════════════════════════════════════════════
// Zod Validation Schemas — Shared
// ═══════════════════════════════════════════════════════════════════════════════

import { z } from 'zod';

export const IdParam = z.coerce.number().positive();
export const UuidParam = z.string().uuid();
export const PaginationQuery = z.object({
  page:    z.coerce.number().min(1).default(1),
  limit:   z.coerce.number().min(1).max(100).default(20),
  sortBy:  z.string().optional(),
  order:   z.enum(['asc','desc']).default('desc'),
});

export const createProjectSchema = z.object({
  name:          z.string().min(2).max(255),
  description:   z.string().max(5000).optional(),
  clientName:    z.string().max(255).optional(),
  contractType:  z.string().max(100).optional(),
  contractValue: z.coerce.number().min(0).optional(),
  status:        z.enum(['planning','active','on_hold','completed','cancelled']).default('planning'),
  phase:         z.enum(['pre_construction','groundworks','structure','mep','fit_out','completion','defects']).optional(),
  startDate:     z.coerce.date().optional(),
  endDate:       z.coerce.date().optional(),
  budget:        z.coerce.number().min(0).optional(),
  siteAddress:   z.string().max(1000).optional(),
  siteLat:       z.coerce.number().min(-90).max(90).optional(),
  siteLng:       z.coerce.number().min(-180).max(180).optional(),
  geofenceRadius: z.coerce.number().min(10).max(5000).default(200),
  projectManager: z.string().max(255).optional(),
});

export const createTaskSchema = z.object({
  projectId:    z.number().positive(),
  title:        z.string().min(2).max(255),
  description:  z.string().max(5000).optional(),
  status:       z.enum(['not_started','in_progress','completed','on_hold','blocked']).default('not_started'),
  priority:     z.enum(['low','medium','high','critical']).default('medium'),
  phase:        z.enum(['pre_construction','groundworks','structure','mep','fit_out','completion','defects']).optional(),
  assigneeId:   z.number().positive().optional(),
  plannedStart: z.coerce.date().optional(),
  plannedEnd:   z.coerce.date().optional(),
  wbsId:        z.string().max(50).optional(),
  cost:         z.coerce.number().min(0).optional(),
});

export const createIncidentSchema = z.object({
  projectId:          z.number().positive().optional(),
  title:              z.string().min(2).max(255),
  description:        z.string().max(5000).optional(),
  severity:           z.enum(['near_miss','low','medium','high','critical']).default('low'),
  type:               z.string().max(100).optional(),
  incidentDate:       z.coerce.date().optional(),
  location:           z.string().max(1000).optional(),
  immediateAction:    z.string().max(2000).optional(),
  correctiveAction:   z.string().max(2000).optional(),
  injuries:           z.coerce.number().min(0).default(0),
  witnesses:          z.array(z.string()).optional(),
  photos:             z.array(z.string().url()).optional(),
});

export const createInspectionSchema = z.object({
  projectId:      z.number().positive().optional(),
  title:          z.string().min(2).max(255),
  description:    z.string().max(5000).optional(),
  type:           z.string().min(1).max(100),
  status:         z.enum(['pending','passed','failed','in_progress']).default('pending'),
  inspectionDate: z.coerce.date().optional(),
  dueDate:        z.coerce.date().optional(),
  inspector:      z.string().max(255).optional(),
  findings:       z.array(z.string()).optional(),
  photos:         z.array(z.string().url()).optional(),
});

export const createDefectSchema = z.object({
  projectId:      z.number().positive().optional(),
  title:          z.string().min(2).max(255),
  description:    z.string().max(5000).optional(),
  priority:       z.enum(['low','medium','high','critical']).default('medium'),
  location:       z.string().max(1000).optional(),
  trade:          z.string().max(100).optional(),
  assigneeId:     z.number().positive().optional(),
  estimatedCost:  z.coerce.number().min(0).optional(),
  dueDate:        z.coerce.date().optional(),
  photos:         z.array(z.string().url()).optional(),
});

export const createWorkerSchema = z.object({
  name:            z.string().min(2).max(255),
  email:           z.string().email().optional(),
  phone:           z.string().max(50).optional(),
  role:            z.string().min(1).max(100),
  trade:           z.string().max(100).optional(),
  hourlyRate:      z.coerce.number().min(0).optional(),
  certifications:  z.array(z.string()).optional(),
  skills:          z.array(z.string()).optional(),
  cscsNumber:      z.string().max(50).optional(),
  inductionDate:   z.coerce.date().optional(),
});

export const createDocumentSchema = z.object({
  projectId:    z.number().positive().optional(),
  name:         z.string().min(2).max(500),
  type:         z.string().min(1).max(100),
  category:     z.enum(['drawing','certificate','report','rams','insurance','contract','photo','other']),
  fileUrl:      z.string().url(),
  fileSize:     z.coerce.number().optional(),
  mimeType:     z.string().max(200).optional(),
  metadata:     z.record(z.unknown()).optional(),
});

export const emailSchema = z.string().email();
export const passwordSchema = z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/);

// ─── Invoices ────────────────────────────────────────────────────────────────
// Mirrors packages/db/src/schema.ts:403 (invoices). Money columns are
// `numeric(precision, scale)` in Postgres which Drizzle exposes as string;
// we accept number and coerce to a string with two decimal places at the
// route layer if needed. Status enum mirrors invoiceStatusEnum in schema.ts.
const invoiceLineItemSchema = z.object({
  description: z.string().min(1).max(1000),
  quantity:    z.coerce.number().min(0),
  unitPrice:   z.coerce.number().min(0),
  total:       z.coerce.number().min(0).optional(),
}).passthrough();

export const createInvoiceSchema = z.object({
  projectId:    z.coerce.number().positive().optional(),
  number:       z.string().min(1).max(100),
  status:       z.enum(['draft','sent','paid','overdue','disputed']).default('draft'),
  amount:       z.coerce.number().min(0).max(1e12),
  taxAmount:    z.coerce.number().min(0).max(1e12).optional(),
  totalAmount:  z.coerce.number().min(0).max(1e12),
  paidAmount:   z.coerce.number().min(0).max(1e12).optional(),
  issueDate:    z.coerce.date().optional(),
  dueDate:      z.coerce.date().optional(),
  paidDate:     z.coerce.date().optional(),
  description:  z.string().max(5000).optional(),
  lineItems:    z.array(invoiceLineItemSchema).max(500).optional(),
  pdfUrl:       z.string().url().optional(),
});

// ─── Timesheets ──────────────────────────────────────────────────────────────
// Mirrors packages/db/src/schema.ts:329 (timesheets). Hours capped at 24 per
// row to catch obvious data-entry / API-abuse errors that would otherwise
// pollute payroll calculations downstream.
export const createTimesheetSchema = z.object({
  workerId:    z.coerce.number().positive(),
  projectId:   z.coerce.number().positive(),
  date:        z.coerce.date(),
  hours:       z.coerce.number().min(0).max(24),
  overtime:    z.coerce.number().min(0).max(24).optional(),
  costCode:    z.string().max(50).optional(),
  notes:       z.string().max(5000).optional(),
  photos:      z.array(z.string().url()).max(50).optional(),
  status:      z.enum(['draft','submitted','approved','rejected']).default('draft'),
});

// ─── Users (admin create) ────────────────────────────────────────────────────
// Mirrors packages/db/src/schema.ts users table. SECURITY: `role` is a
// string column in the DB with no enum constraint, so without validation a
// caller could POST { role: 'super_admin' } and silently grant themselves
// platform-wide access. The enum below is the closed set of roles the
// product recognises; anything else is rejected.
export const userRoleSchema = z.enum([
  'viewer',
  'field_worker',
  'supervisor',
  'project_manager',
  'manager',
  'admin',
  'company_admin',
  'company_owner',
]);

export const createUserSchema = z.object({
  name:           z.string().min(1).max(255),
  email:          z.string().email().max(320),
  role:           userRoleSchema.default('viewer'),
  passwordHash:   z.string().min(20).max(255).optional(),
  phone:          z.string().max(50).optional(),
  jobTitle:       z.string().max(255).optional(),
  department:     z.string().max(255).optional(),
  openId:         z.string().max(64).optional(),
  loginMethod:    z.string().max(50).optional(),
  isActive:       z.boolean().optional(),
});
