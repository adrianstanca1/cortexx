import { z } from 'zod';

// Core construction entity schemas for frontend validation
export const rfiSchema = z.object({
  number: z.string().min(1, 'RFI number is required'),
  subject: z.string().min(1, 'Subject is required'),
  question: z.string().min(1, 'Question is required'),
  context: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  status: z.enum(['open', 'answered', 'closed', 'pending-info']).default('open'),
  dueDate: z.string().datetime().optional(),
});

export const changeOrderSchema = z.object({
  number: z.string().min(1, 'Change order number is required'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  proposedChangeAmount: z.number().min(0, 'Amount must be non-negative'),
  status: z.enum(['pending', 'approved', 'rejected', 'negotiation']).default('pending'),
  category: z.enum(['scope', 'design', 'conditions', 'owner', 'regulatory', 'other']).default('scope'),
  justification: z.string().min(1, 'Justification is required'),
  scheduleImpactDays: z.number().int().optional(),
  budgetImpactAmount: z.number().optional(),
});

export const dailyReportSchema = z.object({
  date: z.string().datetime(),
  projectId: z.string().min(1, 'Project ID is required'),
  weather: z.string().optional(),
  temperature: z.string().optional(),
  humidity: z.string().optional(),
  workforce: z.array(z.object({
    trade: z.string().min(1, 'Trade is required'),
    count: z.number().int().min(0, 'Count must be non-negative'),
    hours: z.number().min(0, 'Hours must be non-negative'),
  })).default([]),
  equipment: z.array(z.object({
    name: z.string().min(1, 'Equipment name is required'),
    hours: z.number().min(0, 'Hours must be non-negative'),
    status: z.enum(['operational', 'maintenance', 'down']).default('operational'),
  })).default([]),
  materials: z.array(z.object({
    name: z.string().min(1, 'Material name is required'),
    quantity: z.string().min(1, 'Quantity is required'),
    unit: z.string().min(1, 'Unit is required'),
    delivered: z.boolean().default(false),
  })).default([]),
  progress: z.array(z.object({
    description: z.string().min(1, 'Description is required'),
    percentComplete: z.number().min(0).max(100).optional(),
  })).default([]),
  issues: z.array(z.object({
    type: z.enum(['delay', 'safety', 'quality', 'design', 'supply', 'other']),
    description: z.string().min(1, 'Description is required'),
    impact: z.enum(['low', 'medium', 'high']),
  })).default([]),
  notes: z.string().optional(),
});

export const safetyReportSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  type: z.enum(['incident', 'near-miss', 'inspection', 'audit', 'toolbox-talk', 'hazard-id']),
  date: z.string().datetime(),
  projectId: z.string().min(1, 'Project ID is required'),
  location: z.string().optional(),
  severity: z.enum(['minor', 'moderate', 'serious', 'fatal', 'critical']).optional(),
  status: z.enum(['open', 'investigating', 'resolved', 'closed']).default('open'),
  witnesses: z.array(z.string()).optional(),
  estimatedCost: z.number().min(0).optional(),
  scheduleImpact: z.number().min(0).optional(),
});

// Type exports for frontend use
export type RFIInput = z.infer<typeof rfiSchema>;
export type ChangeOrderInput = z.infer<typeof changeOrderSchema>;
export type DailyReportInput = z.infer<typeof dailyReportSchema>;
export type SafetyReportInput = z.infer<typeof safetyReportSchema>;

// Notification schemas for runtime validation
export const notificationQuietHoursSchema = z.object({
  enabled: z.boolean(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format (HH:mm)'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format (HH:mm)'),
  timezone: z.string(),
});

export const notificationCategoryPreferencesSchema = z.object({
  project_update: z.boolean(),
  task_assignment: z.boolean(),
  rfi_response: z.boolean(),
  safety_incident: z.boolean(),
  document_upload: z.boolean(),
  meeting_reminder: z.boolean(),
  team_mention: z.boolean(),
  system_alert: z.boolean(),
  approval_request: z.boolean(),
  deadline_warning: z.boolean(),
  budget_alert: z.boolean(),
  change_order: z.boolean(),
  inspection_scheduled: z.boolean(),
  material_delivery: z.boolean(),
  timesheet_approval: z.boolean(),
  subcontractor_update: z.boolean(),
});

export const notificationSettingsSchema = z.object({
  emailNotifications: z.boolean(),
  pushNotifications: z.boolean(),
  soundAlerts: z.boolean(),
  browserNotifications: z.boolean(),
  quietHours: notificationQuietHoursSchema,
  digestFrequency: z.enum(['never', 'hourly', 'daily', 'weekly']),
  categoryPreferences: notificationCategoryPreferencesSchema,
});

export const relatedItemSchema = z.object({
  type: z.enum([
    'project', 'task', 'rfi', 'safety_incident', 'document',
    'meeting', 'approval', 'change_order', 'budget', 'timesheet',
    'subcontractor', 'inspection', 'material'
  ]),
  id: z.string(),
  title: z.string(),
  url: z.string().url(),
});

export const notificationActionSchema = z.object({
  type: z.enum(['navigate', 'approve', 'reject', 'reply', 'snooze', 'dismiss']),
  label: z.string(),
  url: z.string().url().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

export const notificationMetadataSchema = z.object({
  projectId: z.string().optional(),
  projectName: z.string().optional(),
  taskId: z.string().optional(),
  rfiId: z.string().optional(),
  safetyIncidentId: z.string().optional(),
  documentId: z.string().optional(),
  meetingId: z.string().optional(),
  approvalId: z.string().optional(),
  changeOrderId: z.string().optional(),
  budgetId: z.string().optional(),
  timesheetId: z.string().optional(),
  subcontractorId: z.string().optional(),
  inspectionId: z.string().optional(),
  materialId: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  dueDate: z.string().optional(),
  originalValue: z.number().optional(),
  newValue: z.number().optional(),
  currency: z.string().optional(),
  mentionedUsers: z.array(z.string()).optional(),
  attachmentCount: z.number().optional(),
  commentCount: z.number().optional(),
});

export const notificationSchema = z.object({
  id: z.string(),
  type: z.enum([
    'project_update', 'task_assignment', 'rfi_response', 'safety_incident',
    'document_upload', 'meeting_reminder', 'team_mention', 'system_alert',
    'approval_request', 'deadline_warning', 'budget_alert', 'change_order',
    'inspection_scheduled', 'material_delivery', 'timesheet_approval',
    'subcontractor_update'
  ]),
  category: z.enum([
    'all', 'unread', 'mentions', 'assignments', 'system', 'safety',
    'projects', 'documents', 'meetings', 'approvals', 'deadlines'
  ]),
  severity: z.enum(['critical', 'error', 'warning', 'info', 'success']),
  status: z.enum(['unread', 'read', 'archived', 'snoozed']),
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  description: z.string().optional(),
  relatedItem: relatedItemSchema.optional(),
  actions: z.array(notificationActionSchema).optional(),
  fromUser: z.object({
    id: z.string(),
    name: z.string(),
    avatar: z.string().optional(),
    role: z.enum(['super_admin', 'company_owner', 'admin', 'project_manager', 'field_worker']),
  }).optional(),
  createdAt: z.string().datetime(),
  readAt: z.string().datetime().optional(),
  archivedAt: z.string().datetime().optional(),
  snoozedUntil: z.string().datetime().optional(),
  metadata: notificationMetadataSchema.optional(),
});

// Schema for API response validation
export const notificationsResponseSchema = z.object({
  notifications: z.array(notificationSchema),
  unreadCount: z.number().int().min(0),
  total: z.number().int().min(0),
  hasMore: z.boolean(),
  nextCursor: z.string().optional(),
});

// Type exports for notification validation
export type NotificationQuietHoursInput = z.infer<typeof notificationQuietHoursSchema>;
export type NotificationSettingsInput = z.infer<typeof notificationSettingsSchema>;
export type NotificationInput = z.infer<typeof notificationSchema>;
export type NotificationsResponseInput = z.infer<typeof notificationsResponseSchema>;
