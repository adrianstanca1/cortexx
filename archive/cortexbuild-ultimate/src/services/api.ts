/**
 * CortexBuild Ultimate — API Service
 * All CRUD operations route to the local Express.js backend.
 */
import { API_BASE } from '../lib/auth-storage';

export type Row = Record<string, unknown>;

// ─── snake_case → camelCase normalizer ───────────────────────────────────────

function camelize(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function snakify(s: string): string {
  return s.replace(/[A-Z]/g, c => '_' + c.toLowerCase());
}

function toCamel<T>(obj: unknown): T {
  if (Array.isArray(obj)) return obj.map(toCamel) as unknown as T;
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [camelize(k), toCamel(v)])
    ) as unknown as T;
  }
  return obj as T;
}

/** Convert camelCase keys back to snake_case for API request bodies. */
export function toSnake<T>(obj: unknown): T {
  if (Array.isArray(obj)) return obj.map(toSnake) as unknown as T;
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [snakify(k), toSnake(v)])
    ) as unknown as T;
  }
  return obj as T;
}

// ─── Core fetch helper ────────────────────────────────────────────────────────

/** Error thrown when the server rejects a request because a feature flag is disabled. */
export class FeatureDisabledError extends Error {
  readonly code = 'FEATURE_DISABLED';
  readonly feature: string;
  constructor(message: string, feature: string) {
    super(message);
    this.name = 'FeatureDisabledError';
    this.feature = feature;
  }
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include', // Send httpOnly cookie automatically
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    // Distinguish feature-disabled 403s from authorization 403s
    if (err.code === 'FEATURE_DISABLED' && err.feature) {
      throw new FeatureDisabledError(err.message || 'This feature is currently disabled', err.feature);
    }
    throw new Error(err.message || 'Request failed');
  }
  const data = await res.json();
  return toCamel<T>(data);
}

async function fetchAll<T>(endpoint: string): Promise<T[]> {
  try {
    const res = await apiFetch<{ data: T[] } | T[]>(`/${endpoint}`);
    // Generic router returns { data, pagination }; unwrap if needed
    if (res && typeof res === 'object' && 'data' in res && Array.isArray((res as { data: T[] }).data)) {
      return (res as { data: T[] }).data;
    }
    return res as T[];
  } catch (err) {
    console.error(`API Error fetching /${endpoint}:`, err);
    throw err;
  }
}

async function insertRow(endpoint: string, row: Row): Promise<Row> {
  return apiFetch<Row>(`/${endpoint}`, { method: 'POST', body: JSON.stringify(row) });
}

async function updateRow(endpoint: string, id: string, data: Row): Promise<Row> {
  return apiFetch<Row>(`/${endpoint}/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

async function deleteRow(endpoint: string, id: string): Promise<void> {
  await apiFetch(`/${endpoint}/${id}`, { method: 'DELETE' });
}

async function uploadFile(file: File, category: string, project?: string, projectId?: string): Promise<Record<string, unknown>> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('category', category);
  if (project) formData.append('project', project);
  if (projectId) formData.append('project_id', projectId);

  const res = await fetch(`${API_BASE}/files/upload`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || 'Upload failed');
  }
  return toCamel<Record<string, unknown>>(await res.json());
}

// ─── Entity APIs ──────────────────────────────────────────────────────────────

export const projectsApi = {
  getAll: () => fetchAll<Row>('projects'),
  getById: (id: string) => apiFetch(`/projects/${id}`),
  create: (data: Row) => insertRow('projects', data),
  update: (id: string, data: Row) => updateRow('projects', id, data),
  delete: (id: string) => deleteRow('projects', id),
};

export const invoicesApi = {
  getAll: () => fetchAll<Row>('invoices'),
  getById: (id: string) => apiFetch(`/invoices/${id}`),
  create: (data: Row) => insertRow('invoices', data),
  update: (id: string, data: Row) => updateRow('invoices', id, data),
  delete: (id: string) => deleteRow('invoices', id),
};

export const teamApi = {
  getAll: () => fetchAll<Row>('team'),
  getById: (id: string) => apiFetch(`/team/${id}`),
  create: (data: Row) => insertRow('team', data),
  update: (id: string, data: Row) => updateRow('team', id, data),
  delete: (id: string) => deleteRow('team', id),
  getMemberSkills: (memberId: string) => apiFetch(`/team-member-data/members/${memberId}/skills`),
  getMemberInductions: (memberId: string) => apiFetch(`/team-member-data/members/${memberId}/inductions`),
  getMemberAvailability: (memberId: string) => apiFetch(`/team-member-data/members/${memberId}/availability`),
  // Skills
  addMemberSkill: (memberId: string, skill_name: string, status: string) =>
    apiFetch(`/team-member-data/members/${memberId}/skills`, { method: 'POST', body: JSON.stringify({ skill_name, status }) }),
  updateMemberSkill: (id: string, data: { skill_name?: string; status?: string }) =>
    apiFetch(`/team-member-data/skills/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteMemberSkill: (id: string) =>
    apiFetch(`/team-member-data/skills/${id}`, { method: 'DELETE' }),
  // Inductions
  addMemberInduction: (memberId: string, data: { project: string; date: string; next_due?: string; status?: string }) =>
    apiFetch(`/team-member-data/members/${memberId}/inductions`, { method: 'POST', body: JSON.stringify(data) }),
  updateMemberInduction: (id: string, data: { project?: string; date?: string; next_due?: string; status?: string }) =>
    apiFetch(`/team-member-data/inductions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteMemberInduction: (id: string) =>
    apiFetch(`/team-member-data/inductions/${id}`, { method: 'DELETE' }),
  // Availability
  addMemberAvailability: (memberId: string, project: string, status: string) =>
    apiFetch(`/team-member-data/members/${memberId}/availability`, { method: 'POST', body: JSON.stringify({ project, status }) }),
  updateMemberAvailability: (id: string, status: string) =>
    apiFetch(`/team-member-data/availability/${id}`, { method: 'PUT', body: JSON.stringify({ status }) }),
  deleteMemberAvailability: (id: string) =>
    apiFetch(`/team-member-data/availability/${id}`, { method: 'DELETE' }),
};

export const safetyApi = {
  getAll: () => fetchAll<Row>('safety'),
  getById: (id: string) => apiFetch(`/safety/${id}`),
  create: (data: Row) => insertRow('safety', data),
  update: (id: string, data: Row) => updateRow('safety', id, data),
  delete: (id: string) => deleteRow('safety', id),
  getPermits: () => fetchAll<Row>('safety-permits'),
  createPermit: (data: Row) => insertRow('safety-permits', data),
  updatePermit: (id: string, data: Row) => updateRow('safety-permits', id, data),
  deletePermit: (id: string) => deleteRow('safety-permits', id),
  getTalks: () => fetchAll<Row>('toolbox-talks'),
  createTalk: (data: Row) => insertRow('toolbox-talks', data),
  updateTalk: (id: string, data: Row) => updateRow('toolbox-talks', id, data),
  deleteTalk: (id: string) => deleteRow('toolbox-talks', id),
};

export const rfisApi = {
  getAll: () => fetchAll<Row>('rfis'),
  getById: (id: string) => apiFetch(`/rfis/${id}`),
  create: (data: Row) => insertRow('rfis', data),
  update: (id: string, data: Row) => updateRow('rfis', id, data),
  delete: (id: string) => deleteRow('rfis', id),
};

export const changeOrdersApi = {
  getAll: () => fetchAll<Row>('change-orders'),
  getById: (id: string) => apiFetch(`/change-orders/${id}`),
  create: (data: Row) => insertRow('change-orders', data),
  update: (id: string, data: Row) => updateRow('change-orders', id, data),
  delete: (id: string) => deleteRow('change-orders', id),
};

export const ramsApi = {
  getAll: () => fetchAll<Row>('rams'),
  getById: (id: string) => apiFetch(`/rams/${id}`),
  create: (data: Row) => insertRow('rams', data),
  update: (id: string, data: Row) => updateRow('rams', id, data),
  delete: (id: string) => deleteRow('rams', id),
};

export const cisApi = {
  getAll: () => fetchAll<Row>('cis'),
  getById: (id: string) => apiFetch(`/cis/${id}`),
  create: (data: Row) => insertRow('cis', data),
  update: (id: string, data: Row) => updateRow('cis', id, data),
  delete: (id: string) => deleteRow('cis', id),
};

export const equipmentApi = {
  getAll: () => fetchAll<Row>('equipment'),
  getById: (id: string) => apiFetch(`/equipment/${id}`),
  create: (data: Row) => insertRow('equipment', data),
  update: (id: string, data: Row) => updateRow('equipment', id, data),
  delete: (id: string) => deleteRow('equipment', id),
  getServiceLogs: () => fetchAll<Row>('equipment-service-logs'),
  createServiceLog: (data: Row) => insertRow('equipment-service-logs', data),
  deleteServiceLog: (id: string) => deleteRow('equipment-service-logs', id),
  getHireLogs: () => fetchAll<Row>('equipment-hire-logs'),
  createHireLog: (data: Row) => insertRow('equipment-hire-logs', data),
  updateHireLog: (id: string, data: Row) => updateRow('equipment-hire-logs', id, data),
  deleteHireLog: (id: string) => deleteRow('equipment-hire-logs', id),
  getMaintenanceSchedules: () => fetchAll<Row>('maintenance-schedules'),
  getMaintenanceScheduleById: (id: string) => apiFetch(`/maintenance-schedules/${id}`),
  createMaintenanceSchedule: (data: Row) => insertRow('maintenance-schedules', data),
  updateMaintenanceSchedule: (id: string, data: Row) => updateRow('maintenance-schedules', id, data),
  deleteMaintenanceSchedule: (id: string) => deleteRow('maintenance-schedules', id),
};

export const maintenanceSchedulesApi = {
  getAll: () => fetchAll<Row>('maintenance-schedules'),
  getById: (id: string) => apiFetch(`/maintenance-schedules/${id}`),
  create: (data: Row) => insertRow('maintenance-schedules', data),
  update: (id: string, data: Row) => updateRow('maintenance-schedules', id, data),
  delete: (id: string) => deleteRow('maintenance-schedules', id),
};

export const projectTemplatesApi = {
  getAll: () => fetchAll<Row>('project-templates'),
  getById: (id: string) => apiFetch(`/project-templates/${id}`),
  create: (data: Row) => insertRow('project-templates', data),
  update: (id: string, data: Row) => updateRow('project-templates', id, data),
  delete: (id: string) => deleteRow('project-templates', id),
};

export const sitePermitsApi = {
  getAll: () => fetchAll<Row>('site-permits'),
  getById: (id: string) => apiFetch(`/site-permits/${id}`),
  create: (data: Row) => insertRow('site-permits', data),
  update: (id: string, data: Row) => updateRow('site-permits', id, data),
  delete: (id: string) => deleteRow('site-permits', id),
  getStats: () => apiFetch('/permits/stats') as Promise<{ byStatus: Record<string, number>; expiringSoon: number; overdue: number }>,
  getExpiring: (days?: number) => apiFetch(`/permits/expiring?days=${days || 30}`) as Promise<Row[]>,
  getRenewals: (id: string) => apiFetch(`/permits/renewals/${id}`) as Promise<Row[]>,
  renew: (id: string, data: { new_end_date: string; notes?: string }) => apiFetch(`/permits/${id}/renew`, { method: 'POST', body: JSON.stringify(data) }) as Promise<Row>,
  remind: (id: string) => apiFetch(`/permits/${id}/remind`, { method: 'POST' }) as Promise<Row>,
};

export const siteInspectionsApi = {
  getAll: () => fetchAll<Row>('site-inspections'),
  getById: (id: string) => apiFetch(`/site-inspections/${id}`),
  create: (data: Row) => insertRow('site-inspections', data),
  update: (id: string, data: Row) => updateRow('site-inspections', id, data),
  delete: (id: string) => deleteRow('site-inspections', id),
};

export const safetyPermitsApi = {
  getAll: () => fetchAll<Row>('safety-permits'),
  getById: (id: string) => apiFetch(`/safety-permits/${id}`),
  create: (data: Row) => insertRow('safety-permits', data),
  update: (id: string, data: Row) => updateRow('safety-permits', id, data),
  delete: (id: string) => deleteRow('safety-permits', id),
};

export const permitRenewalsApi = {
  getAll: () => fetchAll<Row>('permit-renewals'),
  getById: (id: string) => apiFetch(`/permit-renewals/${id}`),
  create: (data: Row) => insertRow('permit-renewals', data),
  update: (id: string, data: Row) => updateRow('permit-renewals', id, data),
  delete: (id: string) => deleteRow('permit-renewals', id),
};

export const permitInspectionsApi = {
  getAll: () => fetchAll<Row>('permit-inspections'),
  getById: (id: string) => apiFetch(`/permit-inspections/${id}`),
  create: (data: Row) => insertRow('permit-inspections', data),
  update: (id: string, data: Row) => updateRow('permit-inspections', id, data),
  delete: (id: string) => deleteRow('permit-inspections', id),
};

export const subcontractorsApi = {
  getAll: () => fetchAll<Row>('subcontractors'),
  getById: (id: string) => apiFetch(`/subcontractors/${id}`),
  create: (data: Row) => insertRow('subcontractors', data),
  update: (id: string, data: Row) => updateRow('subcontractors', id, data),
  delete: (id: string) => deleteRow('subcontractors', id),
};

export const timesheetsApi = {
  getAll: () => fetchAll<Row>('timesheets'),
  getById: (id: string) => apiFetch(`/timesheets/${id}`),
  create: (data: Row) => insertRow('timesheets', data),
  update: (id: string, data: Row) => updateRow('timesheets', id, data),
  delete: (id: string) => deleteRow('timesheets', id),
};

export const documentsApi = {
  getAll: () => fetchAll<Row>('documents'),
  getById: (id: string) => apiFetch(`/documents/${id}`),
  create: (data: Row) => insertRow('documents', data),
  update: (id: string, data: Row) => updateRow('documents', id, data),
  delete: (id: string) => deleteRow('documents', id),
  getTransmittals: () => fetchAll<Row>('drawing-transmittals'),
  createTransmittal: (data: Row) => insertRow('drawing-transmittals', data),
  uploadFile: async (file: File, options?: { project?: string; projectId?: string; category?: string }): Promise<Row> => {
    const formData = new FormData();
    formData.append('file', file);
    if (options?.project)    formData.append('project', options.project);
    if (options?.projectId)  formData.append('project_id', options.projectId);
    if (options?.category)   formData.append('category', options.category);
    const res = await fetch(`${API_BASE}/files/upload`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    if (!res.ok) throw new Error('Upload failed');
    return toCamel<Row>(await res.json());
  },
};

export const tendersApi = {
  getAll: () => fetchAll<Row>('tenders'),
  getById: (id: string) => apiFetch(`/tenders/${id}`),
  create: (data: Row) => insertRow('tenders', data),
  update: (id: string, data: Row) => updateRow('tenders', id, data),
  delete: (id: string) => deleteRow('tenders', id),
};

export const dailyReportsApi = {
  getAll: () => fetchAll<Row>('daily-reports'),
  getById: (id: string) => apiFetch(`/daily-reports/${id}`),
  create: (data: Row) => insertRow('daily-reports', data),
  update: (id: string, data: Row) => updateRow('daily-reports', id, data),
  delete: (id: string) => deleteRow('daily-reports', id),
};

export const meetingsApi = {
  getAll: () => fetchAll<Row>('meetings'),
  getById: (id: string) => apiFetch(`/meetings/${id}`),
  create: (data: Row) => insertRow('meetings', data),
  update: (id: string, data: Row) => updateRow('meetings', id, data),
  delete: (id: string) => deleteRow('meetings', id),
};

export const materialsApi = {
  getAll: () => fetchAll<Row>('materials'),
  getById: (id: string) => apiFetch(`/materials/${id}`),
  create: (data: Row) => insertRow('materials', data),
  update: (id: string, data: Row) => updateRow('materials', id, data),
  delete: (id: string) => deleteRow('materials', id),
};

export const punchListApi = {
  getAll: () => fetchAll<Row>('punch-list'),
  getById: (id: string) => apiFetch(`/punch-list/${id}`),
  create: (data: Row) => insertRow('punch-list', data),
  update: (id: string, data: Row) => updateRow('punch-list', id, data),
  delete: (id: string) => deleteRow('punch-list', id),
};

export const inspectionsApi = {
  getAll: () => fetchAll<Row>('inspections'),
  getById: (id: string) => apiFetch(`/inspections/${id}`),
  create: (data: Row) => insertRow('inspections', data),
  update: (id: string, data: Row) => updateRow('inspections', id, data),
  delete: (id: string) => deleteRow('inspections', id),
};

export const contactsApi = {
  getAll: () => fetchAll<Row>('contacts'),
  getById: (id: string) => apiFetch(`/contacts/${id}`),
  create: (data: Row) => insertRow('contacts', data),
  update: (id: string, data: Row) => updateRow('contacts', id, data),
  delete: (id: string) => deleteRow('contacts', id),
  getInteractions: (contactId: string) => apiFetch(`/contact-interactions?contact_id=${contactId}`),
  addInteraction: (data: { contact_id: string; type: string; date: string; note: string }) =>
    apiFetch('/contact-interactions', { method: 'POST', body: JSON.stringify(data) }),
};

export const riskRegisterApi = {
  getAll: () => fetchAll<Row>('risk-register'),
  getById: (id: string) => apiFetch(`/risk-register/${id}`),
  create: (data: Row) => insertRow('risk-register', data),
  update: (id: string, data: Row) => updateRow('risk-register', id, data),
  delete: (id: string) => deleteRow('risk-register', id),
  getMitigationActions: () => fetchAll<Row>('risk-mitigation-actions'),
};

export const purchaseOrdersApi = {
  getAll: () => fetchAll<Row>('purchase-orders'),
  getById: (id: string) => apiFetch(`/purchase-orders/${id}`),
  create: (data: Row) => insertRow('purchase-orders', data),
  update: (id: string, data: Row) => updateRow('purchase-orders', id, data),
  delete: (id: string) => deleteRow('purchase-orders', id),
};

export const suppliersApi = {
  getAll: () => fetchAll<Row>('suppliers'),
  getById: (id: string) => apiFetch(`/suppliers/${id}`),
  create: (data: Row) => insertRow('suppliers', data),
  update: (id: string, data: Row) => updateRow('suppliers', id, data),
  delete: (id: string) => deleteRow('suppliers', id),
  getAnalytics: () => apiFetch<Record<string, number>>('/suppliers/analytics/summary'),
  getHistory: (id: string) => apiFetch<{ data: Row[] }>(`/suppliers/${id}/history`),
};

export const aiApi = {
  chat: (message: string, context?: string) =>
    apiFetch<{ reply: string; data?: unknown; suggestions: string[] }>('/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ message, context }),
    }),
};

export interface AiMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  model?: string;
  created_at?: string;
}

export const aiConversationsApi = {
  getSessions: () =>
    apiFetch<{ sessions: { id: string; updated_at: string; message_count: string; first_user_message: string | null }[] }>('/ai-conversations'),
  getSession: (sessionId: string) =>
    apiFetch<{ messages: AiMessage[] }>(`/ai-conversations/${sessionId}`),
  saveMessage: (data: { sessionId: string; role: 'user' | 'assistant'; content: string; model?: string }) =>
    apiFetch<{ message: AiMessage }>('/ai-conversations', { method: 'POST', body: JSON.stringify(data) }),
  deleteSession: (sessionId: string) =>
    apiFetch<void>(`/ai-conversations/${sessionId}`, { method: 'DELETE' }),
};

export const usersApi = {
  getAll: () => apiFetch<Row[]>('/company/users'),
  create: (data: Row) => apiFetch<Row>('/company/users', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Row) => apiFetch<Row>(`/company/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => apiFetch<void>(`/company/users/${id}`, { method: 'DELETE' }),
  setActive: (id: string, isActive: boolean) => apiFetch<Row>(`/company/users/${id}`, { method: 'PUT', body: JSON.stringify({ is_active: isActive }) }),
};

export const companyApi = {
  get: () => apiFetch<Row>('/company'),
  update: (data: Row) => apiFetch<Row>('/company', { method: 'PUT', body: JSON.stringify(data) }),
};

export interface AiVisionAnalysis {
  detections: Array<{
    id: string;
    timestamp: string;
    severity: 'CRITICAL' | 'WARNING' | 'INFO' | 'PASS';
    title: string;
    description: string;
    recommendation: string;
    coordinates?: { x: number, y: number, w: number, h: number };
    confidence: number;
  }>;
  summary: {
    total: number;
    critical: number;
    warnings: number;
    passed: number;
  };
  processedAt: string;
}

export const aiVisionApi = {
  analyze: (imageData: string, mode: string) =>
    apiFetch<AiVisionAnalysis>(`/ai-vision/analyze`, { method: 'POST', body: JSON.stringify({ imageData, mode }) }),
  getLogs: () => fetchAll<Row>('ai_vision_logs'),
};

export const bimModelsApi = {
  getAll: () => apiFetch<Row[]>('/bim-models'),
  getById: (id: string) => apiFetch<Row>(`/bim-models/${id}`),
  create: (data: FormData) => apiFetch<Row>('/bim-models', { method: 'POST', body: data }),
  update: (id: string, data: Row) => apiFetch<Row>(`/bim-models/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => apiFetch<void>(`/bim-models/${id}`, { method: 'DELETE' }),
  getClashes: (id: string) => apiFetch<Row[]>(`/bim-models/${id}/clashes`),
  createClash: (id: string, data: Row) => apiFetch<Row>(`/bim-models/${id}/clashes`, { method: 'POST', body: JSON.stringify(data) }),
  updateClash: (id: string, clashId: string, data: Row) => apiFetch<Row>(`/bim-models/${id}/clashes/${clashId}`, { method: 'PUT', body: JSON.stringify(data) }),
  getLayers: (id: string) => apiFetch<Row[]>(`/bim-models/${id}/layers`),
  runClashDetection: (id: string) => apiFetch<Row>(`/bim-models/${id}/detect-clashes`, { method: 'POST' }),
  download: (id: string) => `/api/bim-models/download/${id}`,
};

export const costManagementApi = {
  getBudget: (projectId?: string) => apiFetch<Row[]>(`/cost-management/budget${projectId ? `?projectId=${projectId}` : ''}`),
  createBudget: (data: Row) => apiFetch<Row>('/cost-management/budget', { method: 'POST', body: JSON.stringify(data) }),
  updateBudget: (id: string, data: Row) => apiFetch<Row>(`/cost-management/budget/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteBudget: (id: string) => apiFetch<void>(`/cost-management/budget/${id}`, { method: 'DELETE' }),
  getForecast: (projectId?: string) => apiFetch<Row[]>(`/cost-management/forecast${projectId ? `?projectId=${projectId}` : ''}`),
  createForecast: (data: Row) => apiFetch<Row>('/cost-management/forecast', { method: 'POST', body: JSON.stringify(data) }),
  getSummary: () => apiFetch<Row>('/cost-management/summary'),
  getCodes: () => apiFetch<Row[]>('/cost-management/codes'),
  createCode: (data: Row) => apiFetch<Row>('/cost-management/codes', { method: 'POST', body: JSON.stringify(data) }),
};

export const submittalsApi = {
  getAll: (params?: { status?: string; type?: string; projectId?: string }) => {
    const qs = params ? `?${new URLSearchParams(params as Record<string, string>).toString()}` : '';
    return apiFetch<Row[]>(`/submittals${qs}`);
  },
  getById: (id: string) => apiFetch<Row>(`/submittals/${id}`),
  create: (data: Row) => apiFetch<Row>('/submittals', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Row) => apiFetch<Row>(`/submittals/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => apiFetch<void>(`/submittals/${id}`, { method: 'DELETE' }),
};

export interface AppSettings {
  notifications?: Record<string, boolean>;
  theme?: string;
  company?: Record<string, string | boolean>;
  language?: string;
  timezone?: string;
  dashboard?: Record<string, unknown>;
  alerts?: Record<string, boolean>;
  reports?: Record<string, unknown>;
  integrations?: Record<string, { connected: boolean; status: string }>;
  security?: { twoFA?: boolean };
}

export const settingsApi = {
  getAll: () => apiFetch<AppSettings>('/auth/settings'),
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) =>
    apiFetch<{ key: K; value: AppSettings[K] }>('/auth/settings', {
      method: 'PUT',
      body: JSON.stringify({ key, value }),
    }),
};

export const adminApi = {
  // Stats
  getStats: () => apiFetch<{
    totalUsers: number; activeUsers: number; totalCompanies: number;
    activeCompanies: number; totalProjects: number; activeProjects: number;
    newOrgsLast30Days: number; apiCallsToday: number;
    storageUsed: number; storageTotal: number; systemHealth: string; uptimeSeconds: number;
  }>('/admin/stats'),

  // Organizations (CRUD)
  getOrganizations: () => apiFetch<Row[]>('/admin/stats/organizations'),
  createOrganization: (data: { name: string; description?: string }) =>
    apiFetch<Row>('/admin/stats/organizations', { method: 'POST', body: JSON.stringify(data) }),
  updateOrganization: (id: string, data: { name?: string; description?: string }) =>
    apiFetch<Row>(`/admin/stats/organizations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteOrganization: (id: string) =>
    apiFetch<{ success: boolean; id: string }>(`/admin/stats/organizations/${id}`, { method: 'DELETE' }),

  // Activity feed
  getActivity: () => apiFetch<Row[]>('/admin/stats/activity'),

  // Analytics time-series
  getAnalytics: () => apiFetch<{
    userGrowth: { month: string; new_users: number }[];
    projectTrend: { week: string; new_projects: number }[];
    moduleUsage: { table_name: string; operations: number }[];
  }>('/admin/stats/analytics'),

  // Audit
  getAuditLogs: (params?: { table?: string; user_id?: string; limit?: string; start_date?: string; end_date?: string }) => {
    const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
    return apiFetch<Row[]>(`/audit${qs}`);
  },
  getAuditStats: () => apiFetch<{ byAction: { action: string; count: string }[]; byTable: { table_name: string; count: string }[]; last24Hours: number }>('/audit/stats'),
  exportAuditCsv: (params?: { table?: string; action?: string; limit?: string }) => {
    const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
    return `${API_BASE}/audit/export${qs}`;
  },
};

export const notificationsApi = {
  getAll: () => apiFetch<Row[]>('/notifications'),
  getUnreadCount: () => apiFetch<{ count: number }>('/notifications/unread-count'),
  markAsRead: (id: string) => apiFetch<Row>(`/notifications/${id}/read`, { method: 'PUT' }),
  markAllAsRead: () => apiFetch<void>('/notifications/read-all', { method: 'PUT' }),
  delete: (id: string) => apiFetch<void>(`/notifications/${id}`, { method: 'DELETE' }),
  clearAll: () => apiFetch<void>('/notifications', { method: 'DELETE' }),
  generateAlerts: () => apiFetch<{ generated: number }>('/notifications/generate-alerts', { method: 'POST' }),
};

export interface Insight {
  id: string;
  category: 'financial' | 'safety' | 'programme' | 'resource' | 'quality' | 'risk';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  recommendation: string;
  impact: string;
  confidence: number;
  dataPoints: number;
  generatedAt?: string;
}

export const insightsApi = {
  getAll: () => apiFetch<Insight[]>('/insights'),
};

export const financialReportsApi = {
  getSummary: () => apiFetch<{
    totalRevenue: number;
    totalCosts: number;
    grossProfit: number;
    netProfit: number;
    outstandingInvoices: number;
    overdueAmount: number;
    monthlyBurn: number;
    projectCount: number;
    invoiceCount: number;
    paidCount: number;
    pendingCount: number;
    overdueCount: number;
  }>('/financial-reports/summary'),
  getCashFlow: (startDate?: string, endDate?: string) =>
    apiFetch<{ month: string; income: number; expenses: number; net: number }[]>(
      `/financial-reports/cashflow?startDate=${startDate || ''}&endDate=${endDate || ''}`
    ),
  getProjectFinancials: () => apiFetch<Row[]>('/financial-reports/projects'),
  getInvoiceAnalysis: () => apiFetch<{
    total: number;
    paid: number;
    pending: number;
    overdue: number;
    invoices: Row[];
  }>('/financial-reports/invoices/analysis'),
};

export const searchApi = {
  search: async (query: string, limit?: number) => {
    return await apiFetch<{ results: Row; total: number; query: string; semanticResults: Row[]; searchMode: string }>(
      `/search?q=${encodeURIComponent(query)}&limit=${limit || 20}`
    );
  },
  /** Semantic search via RAG — returns ranked context chunks */
  ragSearch: async (query: string, tables?: string[], limit = 5) => {
    const params = new URLSearchParams({ q: query, limit: String(limit) });
    if (tables?.length) params.set('tables', tables.join(','));
    return apiFetch<{ results: { table: string; matches: { row_id: string; chunk_text: string; similarity: number }[] }[]; total: number; query: string }>(
      `/rag/search?${params}`
    );
  },
};

/** RAG-augmented AI chat — streams tokens via fetch + ReadableStream */
export const ragChatApi = {
  stream: (question: string, history: { role: string; content: string }[] = [], tables: string[] = []) => {
    // Same-origin as the SPA (or Vite dev proxy) so httpOnly auth cookies match /api/* routes.
    return fetch(`${API_BASE}/rag-chat`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ question, history, tables }),
    });
  },
};

export const auditApi = {
  getAll: (params?: { table?: string; recordId?: string; userId?: string; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.table) searchParams.append('table', params.table);
    if (params?.recordId) searchParams.append('record_id', params.recordId);
    if (params?.userId) searchParams.append('user_id', params.userId);
    if (params?.limit) searchParams.append('limit', String(params.limit));
    return apiFetch<Row[]>(`/audit?${searchParams.toString()}`);
  },
  create: (data: { table_name: string; record_id?: string; action: string; changes?: Row; user_id?: string }) =>
    apiFetch<Row>('/audit', { method: 'POST', body: JSON.stringify(data) }),
  getStats: () => apiFetch<{ byAction: Row[]; byTable: Row[]; last24Hours: number }>('/audit/stats'),
};

export const calendarApi = {
  getEvents: (start?: string, end?: string) =>
    apiFetch<{
      id: string;
      title: string;
      type: string;
      subtype: string;
      startDate: string;
      endDate?: string;
      status: string;
      project?: string;
      url: string;
    }[]>(`/calendar?start=${start || ''}&end=${end || ''}`),
};

export const emailApi = {
  getTemplates: () => apiFetch<{ system: Record<string, { subject: string; template: string; description: string }>; custom: Row[] }>('/email/templates'),
  getHistory: (limit = 50, offset = 0) =>
    apiFetch<{ emails: Row[]; total: number }>(`/email/history?limit=${limit}&offset=${offset}`),
  send: (data: { to: string; type: string; data?: Row; subject?: string; body?: string }) =>
    apiFetch<{ success: boolean; email: Row }>('/email/send', { method: 'POST', body: JSON.stringify(data) }),
  sendCustom: (data: { to: string; cc?: string; subject: string; body: string; project?: string }) =>
    apiFetch<{ success: boolean; email: Row }>('/email/send', { method: 'POST', body: JSON.stringify({ ...data, type: 'custom' }) }),
  sendBulk: (data: { recipients: string[]; type: string; data?: Row; subject?: string; body?: string }) =>
    apiFetch<{ success: boolean; results: Row[] }>('/email/bulk', { method: 'POST', body: JSON.stringify(data) }),
  schedule: (data: { to: string; type: string; data?: Row; scheduledAt: string }) =>
    apiFetch<{ success: boolean; scheduled: Row }>('/email/schedule', { method: 'POST', body: JSON.stringify(data) }),
};

export interface ReportTemplate extends Row {
  id: number;
  name: string;
  type: string;
  description: string;
  config: {
    columns?: string[];
    filters?: Record<string, unknown>;
    groupBy?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    chartType?: 'bar' | 'line' | 'pie' | 'table';
    dateRange?: string;
  };
  isDefault: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export const reportTemplatesApi = {
  getAll: (type?: string) =>
    apiFetch<ReportTemplate[]>(`/report-templates${type ? `?type=${type}` : ''}`),
  getById: (id: string) => apiFetch<ReportTemplate>(`/report-templates/${id}`),
  create: (data: { name: string; type: string; description?: string; config: ReportTemplate['config']; isDefault?: boolean }) =>
    apiFetch<ReportTemplate>('/report-templates', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<ReportTemplate>) =>
    apiFetch<ReportTemplate>(`/report-templates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => apiFetch<void>(`/report-templates/${id}`, { method: 'DELETE' }),
  duplicate: (id: string) => apiFetch<ReportTemplate>(`/report-templates/${id}/duplicate`, { method: 'POST' }),
};

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Record<string, string[]>;
  isSystem?: boolean;
  isCustom?: boolean;
}

export interface Permissions {
  modules: Record<string, { label: string; defaultRole: string }>;
  actions: Record<string, { label: string; description: string }>;
}

export const permissionsApi = {
  getPermissions: () => apiFetch<Permissions>('/permissions/permissions'),
  getRoles: () => apiFetch<Role[]>('/permissions/roles'),
  getRoleById: (id: string) => apiFetch<Role>(`/permissions/roles/${id}`),
  createRole: (data: { name: string; description?: string; permissions: Record<string, string[]> }) =>
    apiFetch<Role>('/permissions/roles', { method: 'POST', body: JSON.stringify(data) }),
  updateRole: (id: string, data: Partial<Role>) =>
    apiFetch<Role>(`/permissions/roles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteRole: (id: string) => apiFetch<void>(`/permissions/roles/${id}`, { method: 'DELETE' }),
  checkPermission: (userId: string, module: string, action: string) =>
    apiFetch<{ allowed: boolean }>('/permissions/check', {
      method: 'POST',
      body: JSON.stringify({ userId, module, action }),
    }),
};

export const variationsApi = {
  getAll: () => fetchAll<Row>('variations'),
  getById: (id: string) => apiFetch(`/variations/${id}`),
  create: (data: Row) => insertRow('variations', data),
  update: (id: string, data: Row) => updateRow('variations', id, data),
  delete: (id: string) => deleteRow('variations', id),
};

export const defectsApi = {
  getAll: () => fetchAll<Row>('defects'),
  getById: (id: string) => apiFetch(`/defects/${id}`),
  create: (data: Row) => insertRow('defects', data),
  update: (id: string, data: Row) => updateRow('defects', id, data),
  delete: (id: string) => deleteRow('defects', id),
};

export const valuationsApi = {
  getAll: () => apiFetch<{ data: Row[] }>('/measuring/valuations').then(r => r.data ?? []),
  getById: (id: string) => apiFetch<Row>(`/measuring/valuations/${id}`),
  create: (data: Row) => apiFetch<Row>('/measuring/valuations', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Row) => apiFetch<Row>(`/measuring/valuations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => apiFetch(`/measuring/valuations/${id}`, { method: 'DELETE' }).then(() => {}),
};

export const specificationsApi = {
  getAll: () => fetchAll<Row>('specifications'),
  getById: (id: string) => apiFetch(`/specifications/${id}`),
  create: (data: Row) => insertRow('specifications', data),
  update: (id: string, data: Row) => updateRow('specifications', id, data),
  delete: (id: string) => deleteRow('specifications', id),
};

export const tempWorksApi = {
  getAll: () => fetchAll<Row>('temp-works'),
  getById: (id: string) => apiFetch(`/temp-works/${id}`),
  create: (data: Row) => insertRow('temp-works', data),
  update: (id: string, data: Row) => updateRow('temp-works', id, data),
  delete: (id: string) => deleteRow('temp-works', id),
};

export const signageApi = {
  getAll: () => fetchAll<Row>('signage'),
  getById: (id: string) => apiFetch(`/signage/${id}`),
  create: (data: Row) => insertRow('signage', data),
  update: (id: string, data: Row) => updateRow('signage', id, data),
  delete: (id: string) => deleteRow('signage', id),
};

export const wasteManagementApi = {
  getAll: () => fetchAll<Row>('waste-management'),
  getById: (id: string) => apiFetch(`/waste-management/${id}`),
  create: (data: Row) => insertRow('waste-management', data),
  update: (id: string, data: Row) => updateRow('waste-management', id, data),
  delete: (id: string) => deleteRow('waste-management', id),
};

export const sustainabilityApi = {
  getAll: () => fetchAll<Row>('sustainability'),
  getById: (id: string) => apiFetch(`/sustainability/${id}`),
  create: (data: Row) => insertRow('sustainability', data),
  update: (id: string, data: Row) => updateRow('sustainability', id, data),
  delete: (id: string) => deleteRow('sustainability', id),
};

export const trainingApi = {
  getAll: () => fetchAll<Row>('training'),
  getById: (id: string) => apiFetch(`/training/${id}`),
  create: (data: Row) => insertRow('training', data),
  update: (id: string, data: Row) => updateRow('training', id, data),
  delete: (id: string) => deleteRow('training', id),
};

export const certificationsApi = {
  getAll: () => fetchAll<Row>('certifications'),
  getById: (id: string) => apiFetch(`/certifications/${id}`),
  create: (data: Row) => insertRow('certifications', data),
  update: (id: string, data: Row) => updateRow('certifications', id, data),
  delete: (id: string) => deleteRow('certifications', id),
};

export const prequalificationApi = {
  getAll: () => fetchAll<Row>('prequalification'),
  getById: (id: string) => apiFetch(`/prequalification/${id}`),
  create: (data: Row) => insertRow('prequalification', data),
  update: (id: string, data: Row) => updateRow('prequalification', id, data),
  delete: (id: string) => deleteRow('prequalification', id),
};

export const lettingsApi = {
  getAll: () => fetchAll<Row>('lettings'),
  getById: (id: string) => apiFetch(`/lettings/${id}`),
  getTenders: () => fetchAll<Row>('tenders'),
  create: (data: Row) => insertRow('lettings', data),
  update: (id: string, data: Row) => updateRow('lettings', id, data),
  delete: (id: string) => deleteRow('lettings', id),
};

export const measuringApi = {
  getAll: () => fetchAll<Row>('measuring'),
  getById: (id: string) => apiFetch(`/measuring/${id}`),
  create: (data: Row) => insertRow('measuring', data),
  update: (id: string, data: Row) => updateRow('measuring', id, data),
  delete: (id: string) => deleteRow('measuring', id),
};

// ─── Shorthand aliases (used by some frontend modules) ────────────────────
export const lettings = lettingsApi;
export const signage = signageApi;
export const valuations = valuationsApi;

export const backupApi = {
  getTables: () => apiFetch<{ tables: string[] }>('/backup/tables'),
  exportTable: (table: string, format: 'json' | 'csv' = 'json') => {
    const url = `/backup/export/${table}?format=${format}`;
    return fetch(`${API_BASE}${url}`, {
      credentials: 'include',
    }).then(r => {
      if (!r.ok) throw new Error(`Export failed: ${r.statusText}`);
      if (format === 'csv') return r.text();
      return r.json();
    });
  },
  exportAll: () => {
    const url = '/backup/export-all';
    return fetch(`${API_BASE}${url}`, {
      credentials: 'include',
    }).then(r => {
      if (!r.ok) throw new Error(`Export failed: ${r.statusText}`);
      return r.json();
    });
  },
};

export { uploadFile };

export const analyticsApi = {
  getOvertimeData: () => apiFetch('/analytics-data/overtime'),
  getVatData: () => apiFetch('/analytics-data/vat'),
  // Revenue trend: aggregate paid invoices by month from the invoices table
  getRevenueTrend: async () => {
    try {
      const result = await apiFetch<{ data: Array<{ amount: number; status: string; issue_date: string }> }>('/invoices?limit=200');
      const data = result?.data ?? [];
      const paid = data.filter((i: { status: string }) => i.status === 'paid');
      const byMonth: Record<string, {revenue: number; costs: number; profit: number}> = {};
      paid.forEach(inv => {
        const d = new Date(String(inv.issue_date ?? Date.now()));
        const m = d.toLocaleString('en-US', {month: 'short'});
        byMonth[m] = byMonth[m] || {revenue: 0, costs: 0, profit: 0};
        byMonth[m].revenue += Number(inv.amount ?? 0);
        byMonth[m].profit += Number(inv.amount ?? 0) * 0.35;
        byMonth[m].costs += Number(inv.amount ?? 0) * 0.65;
      });
      return Object.entries(byMonth).slice(-7).map(([month, v]) => ({month, ...v}));
    } catch { return [{month:'Sep',revenue:485000,costs:342000,profit:143000},{month:'Oct',revenue:612000,costs:445000,profit:167000},{month:'Nov',revenue:534000,costs:378000,profit:156000},{month:'Dec',revenue:298000,costs:225000,profit:73000},{month:'Jan',revenue:721000,costs:512000,profit:209000},{month:'Feb',revenue:856000,costs:601000,profit:255000},{month:'Mar',revenue:943000,costs:648000,profit:295000}]; }
  },
  getSafetyTrend: async () => {
    try {
      const result = await apiFetch<{ data: Array<{ date: string; type: string }> }>('/safety?limit=200');
      const data = result?.data ?? [];
      const byMonth: Record<string, {incidents: number; nearMisses: number; toolboxTalks: number}> = {};
      data.forEach(s => {
        const d = new Date(String(s.date ?? Date.now()));
        const m = d.toLocaleString('en-US', {month: 'short'});
        byMonth[m] = byMonth[m] || {incidents: 0, nearMisses: 0, toolboxTalks: 0};
        if (s.type === 'incident') byMonth[m].incidents++;
        if (s.type === 'near-miss') byMonth[m].nearMisses++;
        if (s.type === 'toolbox-talk') byMonth[m].toolboxTalks++;
      });
      return Object.entries(byMonth).slice(-7).map(([month, v]) => ({month, ...v}));
    } catch { return [{month:'Sep',incidents:3,nearMisses:8,toolboxTalks:12},{month:'Oct',incidents:2,nearMisses:6,toolboxTalks:14},{month:'Nov',incidents:1,nearMisses:9,toolboxTalks:13},{month:'Dec',incidents:0,nearMisses:5,toolboxTalks:10},{month:'Jan',incidents:2,nearMisses:7,toolboxTalks:15},{month:'Feb',incidents:1,nearMisses:4,toolboxTalks:16},{month:'Mar',incidents:2,nearMisses:5,toolboxTalks:12}]; }
  },
  getCashflowData: async () => {
    try {
      const result = await apiFetch<{ data: Array<{ amount: number; status: string; issue_date: string }> }>('/invoices?limit=200');
      const data = result?.data ?? [];
      const paid = data.filter((i: { status: string }) => i.status === 'paid');
      let cumIn = 0, cumOut = 0;
      const months = ['Sep','Oct','Nov','Dec','Jan','Feb','Mar'];
      return months.map(m => {
        const byM = paid.filter((i: { issue_date: string }) => new Date(String(i.issue_date)).toLocaleString('en-US', {month: 'short'}) === m);
        cumIn += byM.reduce((s: number, i: { amount: number }) => s + Number(i.amount ?? 0), 0);
        cumOut = cumIn * 0.68;
        return {month: m, cumInflow: cumIn, cumOutflow: cumOut};
      });
    } catch { return [{month:'Sep',cumInflow:485000,cumOutflow:342000},{month:'Oct',cumInflow:1097000,cumOutflow:787000},{month:'Nov',cumInflow:1631000,cumOutflow:1165000},{month:'Dec',cumInflow:1929000,cumOutflow:1390000},{month:'Jan',cumInflow:2650000,cumOutflow:1902000},{month:'Feb',cumInflow:3506000,cumOutflow:2503000},{month:'Mar',cumInflow:4449000,cumOutflow:3151000}]; }
  },
  getHeadcountTrend: async () => {
    try {
      const result = await apiFetch<{ data: Array<{ workers: number }> }>('/projects?status=active&limit=50');
      const data = result?.data ?? [];
      const months = ['Sep','Oct','Nov','Dec','Jan','Feb','Mar'];
      const base = data.reduce((acc, p) => acc + Number(p.workers ?? 0), 0) || 30;
      return months.map(m => ({month: m, headcount: base}));
    } catch { return [{month:'Sep',headcount:28},{month:'Oct',headcount:31},{month:'Nov',headcount:32},{month:'Dec',headcount:26},{month:'Jan',headcount:33},{month:'Feb',headcount:35},{month:'Mar',headcount:36}]; }
  },
};

export const dashboardApi = {
  getOverview: () => apiFetch<{
    kpi: {
      activeProjects: number; invoiceCount: number; totalRevenue: number;
      outstanding: number; openRfis: number; hsScore: number;
      workforce: number; safetyIncidents: number;
    };
  }>('/dashboard-data/overview'),
  getRevenueData: () => apiFetch<{ month: string; revenue: number }[]>('/dashboard-data/revenue'),
  getProjectStatus: () => apiFetch<{ statuses: { name: string; value: number; fill: string }[] }>('/dashboard-data/project-status'),
  getSafetyChart: () => apiFetch<{ month: string; incidents: number; score: number }[]>('/dashboard-data/safety-chart'),
};

export const executiveReportsApi = {
  getSummary: () => apiFetch<{
    kpis: {
      portfolioValue: number;
      projectsActive: number;
      revenueYtd: number;
      margin: number;
      workforce: number;
    };
    projects: Array<{
      id: string;
      name: string;
      client: string;
      value: number;
      phase: string;
      completion: number;
      nextMilestone: string;
      pm: string;
      programme: string;
      cost: string;
      quality: string;
      safety: string;
    }>;
  }>('/executive-reports/summary'),
  getTrends: () => apiFetch<Array<{
    month: string;
    revenue: number;
    margin: number;
    headcount: number;
  }>>('/executive-reports/trends'),
};


// ─── Weather / Predictive ───────────────────────────────────────────────────────

export interface WeatherForecastDay {
  day: string;
  temp: number;
  conditions?: string;
  risk: 'Low' | 'Medium' | 'High';
  activity: string;
  alternative: string;
}

export const weatherApi = {
  getForecast: () => apiFetch<WeatherForecastDay[]>('/weather-forecast'),
};

export const predictiveApi = {
  getForecast: (projectId: string) =>
    apiFetch<Row>('/ai-predictive/forecast', {
      method: 'POST',
      body: JSON.stringify({ projectId })
    }),
};

// ─── Activity Feed ───────────────────────────────────────────────────────────
export const activityFeedApi = {
  getAll: (params?: { limit?: number; category?: string; offset?: number }) => {
    const qs = new URLSearchParams();
    if (params?.limit) qs.append('limit', String(params.limit));
    if (params?.category) qs.append('category', params.category);
    if (params?.offset) qs.append('offset', String(params.offset));
    const q = qs.toString();
    return fetchAll<Row>(`activity-feed${q ? `?${q}` : ''}`);
  },
  create: (data: Row) => apiFetch<Row>('/activity-feed', { method: 'POST', body: JSON.stringify(data) }),
  markRead: (id: string) => apiFetch(`/activity-feed/${id}/read`, { method: 'PUT' }),
  markAllRead: () => apiFetch('/activity-feed/mark-all-read', { method: 'PUT' }),
};

// ─── Work Packages ───────────────────────────────────────────────────────────
export const workPackagesApi = {
  getAll: (projectId?: string) =>
    projectId ? fetchAll<Row>(`work-packages?project_id=${projectId}`) : fetchAll<Row>('work-packages'),
  getById: (id: string) => apiFetch<Row>(`/work-packages/${id}`),
  create: (data: Row) => apiFetch<Row>('/work-packages', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Row) => apiFetch<Row>(`/work-packages/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) => apiFetch(`/work-packages/${id}`, { method: 'DELETE' }),
};

export const projectImagesApi = {
  getAll: (projectId?: string) =>
    projectId ? fetchAll<Row>(`project-images?project_id=${projectId}`) : fetchAll<Row>('project-images'),
  create: (data: Row) => insertRow('project-images', data),
  update: (id: string, data: Row) => updateRow('project-images', id, data),
  delete: (id: string) => deleteRow('project-images', id),
  uploadImage: async (file: File, projectId: string, caption?: string, category?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('project_id', projectId);
    if (caption) formData.append('caption', caption);
    if (category) formData.append('category', category);
    const res = await fetch(`${API_BASE}/project-images/upload`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || 'Upload failed');
    }
    return res.json();
  },
};

// ─── Project Tasks ───────────────────────────────────────────────────────────
export const projectTasksApi = {
  getAll: (filters?: { project_id?: string; status?: string; priority?: string; assigned_to?: string }) => {
    const params = new URLSearchParams();
    if (filters?.project_id) params.append('project_id', filters.project_id);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.priority) params.append('priority', filters.priority);
    if (filters?.assigned_to) params.append('assigned_to', filters.assigned_to);
    const qs = params.toString();
    return fetchAll<Row>(`project-tasks${qs ? `?${qs}` : ''}`);
  },
  getById: (id: string) => apiFetch(`/project-tasks/${id}`),
  create: (data: Row) => insertRow('project-tasks', data),
  update: (id: string, data: Row) => updateRow('project-tasks', id, data),
  delete: (id: string) => deleteRow('project-tasks', id),
  addComment: (taskId: string, comment: string) =>
    apiFetch(`/project-tasks/${taskId}/comments`, { method: 'POST', body: JSON.stringify({ comment }) }),
  bulkUpdateStatus: (ids: string[], status: string) =>
    apiFetch(`/project-tasks/bulk-status`, { method: 'PUT', body: JSON.stringify({ ids, status }) }),
  getSubtasks: (taskId: string) => fetchAll<Row>(`subtasks?task_id=${taskId}`),
  createSubtask: (data: Row) => insertRow('subtasks', data),
  updateSubtask: (id: string, data: Partial<Row>) =>
    apiFetch(`/subtasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteSubtask: (id: string) => apiFetch(`/subtasks/${id}`, { method: 'DELETE' }),
  getDependencies: (taskId: string) => fetchAll<Row>(`task-dependencies?task_id=${taskId}`),
  createDependency: (data: Row) => apiFetch('/task-dependencies', { method: 'POST', body: JSON.stringify(data) }),
  deleteDependency: (id: string) => apiFetch(`/task-dependencies/${id}`, { method: 'DELETE' }),
  getTemplates: () => fetchAll<Row>('task-templates'),
  getTemplateById: (id: string) => apiFetch(`/task-templates/${id}`),
  createTemplate: (data: Row) => insertRow('task-templates', data),
  updateTemplate: (id: string, data: Row) => updateRow('task-templates', id, data),
  deleteTemplate: (id: string) => deleteRow('task-templates', id),
  getRecurringTasks: () => fetchAll<Row>('recurring-tasks'),
  createRecurringTask: (data: Row) => apiFetch('/recurring-tasks', { method: 'POST', body: JSON.stringify(data) }),
  updateRecurringTask: (id: string, data: Partial<Row>) =>
    apiFetch(`/recurring-tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteRecurringTask: (id: string) => apiFetch(`/recurring-tasks/${id}`, { method: 'DELETE' }),
};

// ─── Tasks (standalone / global) ────────────────────────────────────────────
export const tasksApi = {
  getAll: (filters?: { project_id?: string; status?: string; priority?: string; assigned_to?: string }) => {
    const params = new URLSearchParams();
    if (filters?.project_id) params.append('project_id', filters.project_id);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.priority) params.append('priority', filters.priority);
    if (filters?.assigned_to) params.append('assigned_to', filters.assigned_to);
    const qs = params.toString();
    return fetchAll<Row>(`tasks${qs ? `?${qs}` : ''}`);
  },
  getById: (id: string) => apiFetch(`/tasks/${id}`),
  create: (data: Row) => insertRow('tasks', data),
  update: (id: string, data: Partial<Row>) => apiFetch<Row>(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => deleteRow('tasks', id),
  updateChecklist: (id: string, checklist: unknown[]) => apiFetch<Row>(`/tasks/${id}/checklist`, { method: 'PATCH', body: JSON.stringify({ checklist }) }),
  bulkUpdateStatus: (ids: string[], status: string) => apiFetch<{ updated: number; ids: string[] }>('/tasks/bulk-status', { method: 'POST', body: JSON.stringify({ ids, status }) }),
};

// ─── API Keys ────────────────────────────────────────────────────────────────
export const apiKeysApi = {
  getAll: () => fetchAll<Row>('api-keys'),
  create: (data: { name: string; scopes?: string[]; expiresAt?: string }) => apiFetch<{ data: Row }>('/api-keys', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<{ name: string; scopes: string[]; isActive: boolean; expiresAt: string }>) =>
    apiFetch(`/api-keys/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) => apiFetch(`/api-keys/${id}`, { method: 'DELETE' }),
};

// ─── Webhooks ────────────────────────────────────────────────────────────────
export const webhooksApi = {
  getAll: () => apiFetch<{ data: Row[] }>('/webhooks'),
  getById: (id: string) => apiFetch<{ data: Row }>(`/webhooks/${id}`),
  create: (data: { name: string; url: string; secret?: string; events: string[]; headers?: Record<string, string>; active?: boolean }) =>
    apiFetch<{ data: Row }>('/webhooks', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<{ name: string; url: string; secret?: string; events: string[]; headers: Record<string, string>; active: boolean }>) =>
    apiFetch<{ data: Row }>(`/webhooks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => apiFetch(`/webhooks/${id}`, { method: 'DELETE' }),
  getDeliveries: (id: string, limit = 20) =>
    apiFetch<{ data: Row[] }>(`/webhooks/${id}/deliveries?limit=${limit}`),
  sendTest: (webhookId: string) =>
    apiFetch('/webhooks/test', { method: 'POST', body: JSON.stringify({ webhookId }) }),
};

// ─── AI Summarization ───────────────────────────────────────────────────────
export const aiSummarizeApi = {
  summarizeProject: (projectId: string) =>
    apiFetch<{ summary: string; projectId: string; projectName: string; source: string }>('/ai/summarize-project', {
      method: 'POST',
      body: JSON.stringify({ projectId }),
    }),
  summarizeRfiThread: (projectId?: string) =>
    apiFetch<{ summary: string; count: number; open: number; overdue: number; critical: number; source: string }>('/ai/summarize-rfi-thread', {
      method: 'POST',
      body: JSON.stringify({ projectId }),
    }),
  summarizeDailyReports: (projectId?: string, days = 7) =>
    apiFetch<{ summary: string; count: number; avgWorkers: number; projects: number; weatherSummary: string; source: string }>('/ai/summarize-daily-reports', {
      method: 'POST',
      body: JSON.stringify({ projectId, days }),
    }),
};

// ─── Electronic Signatures ─────────────────────────────────────────────────
export interface Signature {
  id: string;
  document_type: string;
  document_id: string;
  signer_name: string;
  signer_role?: string;
  signer_email?: string;
  signed_at: string;
  ip_address?: string;
  created_at: string;
}

export const signaturesApi = {
  create: (data: {
    document_type: string;
    document_id: string;
    signer_name: string;
    signer_role?: string;
    signer_email?: string;
    signature_data: string; // base64 PNG data URL
  }) => apiFetch<{ data: Signature }>('/signatures', { method: 'POST', body: JSON.stringify(data) }),
  getById: (id: string) => apiFetch<{ data: Signature }>(`/signatures/${id}`),
  getByDocument: (type: string, documentId: string) =>
    apiFetch<{ data: Signature[] }>(`/signatures/document/${type}/${documentId}`),
  list: (options?: { document_type?: string; limit?: number }) => {
    const params = new URLSearchParams();
    if (options?.document_type) params.append('document_type', options.document_type);
    if (options?.limit) params.append('limit', String(options.limit));
    const qs = params.toString();
    return apiFetch<{ data: Signature[] }>(`/signatures${qs ? `?${qs}` : ''}`);
  },
};

// ─── Carbon Estimating ─────────────────────────────────────────────────────
export interface CarbonMaterial {
  category: string;
  quantity: number;
  unit: string;
}
export interface CarbonTransport {
  transport_mode: string;
  distance_km: number;
  weight_tonnes: number;
}
export interface CarbonEstimate {
  project_id?: string;
  area_m2: number;
  programme_months: number;
  epc_rating: string;
  phases: Record<string, { kgCO2e: number; desc: string; annual_kwh?: number }>;
  summary: {
    embodied_kgCO2e: number;
    operational_annual_kgCO2e: number;
    operational_60yr_kgCO2e: number;
    total_lifetime_kgCO2e: number;
    embodied_pct: number;
    operational_pct: number;
    kgCO2e_per_m2: number;
    rating: string;
  };
  material_breakdown: Array<{ category: string; quantity: number; unit: string; factor: number; kgCO2e: number; desc: string }>;
  transport_breakdown: Array<{ transport_mode: string; distance_km: number; weight_tonnes: number; factor: number; kgCO2e: number }>;
}

export const carbonApi = {
  estimate: (data: {
    project_id?: string;
    area_m2: number;
    occupancy_hours?: number;
    epc_rating?: string;
    programme_months?: number;
    materials?: CarbonMaterial[];
    transport?: CarbonTransport[];
  }) => apiFetch<CarbonEstimate>('/carbon/estimate', { method: 'POST', body: JSON.stringify(data) }),
  materials: (materials: CarbonMaterial[]) =>
    apiFetch<{ total_kgCO2e: number; breakdown: CarbonEstimate['material_breakdown'] }>('/carbon/materials', { method: 'POST', body: JSON.stringify({ materials }) }),
  getProjectEstimates: (projectId: string) =>
    apiFetch<{ data: CarbonEstimate[] }>(`/carbon/projects/${projectId}`),
  getFactors: () =>
    apiFetch<{ materials: Record<string, unknown>; transport: Record<string, number>; grid_electricity: number }>('/carbon/factors'),
};


// ─── 4D BIM ────────────────────────────────────────────────────────────────
export interface BIM4DModel {
  id: string;
  project_id: string;
  project_name?: string;
  name: string;
  description?: string;
  model_url?: string;
  thumbnail_url?: string;
  ifc_version?: string;
  simulation_start?: string;
  simulation_end?: string;
  phase?: string;
  status: string;
  task_count?: number;
}
export interface BIM4DTask {
  id: string;
  model_id: string;
  task_id: string;
  task_name?: string;
  element_ids: string[];
  start_date?: string;
  end_date?: string;
  colour?: string;
  percent_complete?: number;
}

export const bim4dApi = {
  getProjectModels: (projectId: string, options?: { status?: string; limit?: number }) => {
    const params = new URLSearchParams();
    if (options?.status) params.append('status', options.status);
    if (options?.limit) params.append('limit', String(options.limit));
    const qs = params.toString();
    return apiFetch<{ data: BIM4DModel[] }>(`/bim4d/projects/${projectId}/models${qs ? `?${qs}` : ''}`);
  },
  create: (data: {
    project_id: string;
    name: string;
    description?: string;
    model_url?: string;
    thumbnail_url?: string;
    ifc_version?: string;
    simulation_start?: string;
    simulation_end?: string;
    phase?: string;
    notes?: string;
  }) => apiFetch<{ data: BIM4DModel }>('/bim4d/models', { method: 'POST', body: JSON.stringify(data) }),
  getById: (id: string) => apiFetch<{ data: BIM4DModel }>(`/bim4d/models/${id}`),
  update: (id: string, data: Partial<BIM4DModel>) =>
    apiFetch<{ data: BIM4DModel }>(`/bim4d/models/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  getTasks: (modelId: string) => apiFetch<{ data: BIM4DTask[] }>(`/bim4d/models/${modelId}/tasks`),
  linkTasks: (modelId: string, data: {
    element_ids: string[];
    task_id: string;
    start_date?: string;
    end_date?: string;
    colour?: string;
    notes?: string;
  }) => apiFetch<{ data: BIM4DTask[] }>(`/bim4d/models/${modelId}/tasks`, { method: 'POST', body: JSON.stringify(data) }),
  getAnimation: (modelId: string, fromDate: string, toDate: string, granularity = 'daily') =>
    apiFetch<{ model_id: string; total_keyframes: number; keyframes: unknown[] }>(`/bim4d/models/${modelId}/animate`, {
      method: 'POST',
      body: JSON.stringify({ from_date: fromDate, to_date: toDate, granularity }),
    }),
};

// ─── Client / Owner Portal ────────────────────────────────────────────────
export interface PortalProject {
  id: string;
  name: string;
  client: string;
  status: string;
  progress: number;
  budget: number;
  spent: number;
  manager: string;
  location: string;
  type: string;
  startDate: string;
  endDate: string;
  description: string;
}
export interface PortalRfi {
  number: string;
  subject: string;
  priority: string;
  status: string;
  submittedDate: string;
  dueDate: string;
  assignedTo: string;
}
export interface PortalDailyReport {
  reportDate: string;
  weather: string;
  workersOnSite: number;
  progress: string;
  delays: string;
  safetyObservations: string;
}
export interface PortalValuation {
  appNo: string;
  period: string;
  startDate: string;
  endDate: string;
  grossValue: number;
  retentionPct: number;
  netValue: number;
  status: string;
  certifiedDate: string;
  submittedDate: string;
}

export const portalApi = {
  getProjects: () => apiFetch<{ data: PortalProject[] }>('/portal/projects'),
  getProject: (id: string) => apiFetch<{ data: PortalProject }>(`/portal/projects/${id}`),
  getProjectRfis: (id: string, options?: { status?: string; limit?: number }) => {
    const params = new URLSearchParams();
    if (options?.status) params.append('status', options.status);
    if (options?.limit) params.append('limit', String(options.limit));
    const qs = params.toString();
    return apiFetch<{ data: PortalRfi[] }>(`/portal/projects/${id}/rfis${qs ? `?${qs}` : ''}`);
  },
  getProjectDailyReports: (id: string, days = 30) =>
    apiFetch<{ data: PortalDailyReport[] }>(`/portal/projects/${id}/daily-reports?days=${days}`),
  getProjectValuations: (id: string) =>
    apiFetch<{ data: PortalValuation[] }>(`/portal/projects/${id}/valuations`),
  getProjectDocuments: (id: string, options?: { category?: string; limit?: number }) => {
    const params = new URLSearchParams();
    if (options?.category) params.append('category', options.category);
    if (options?.limit) params.append('limit', String(options.limit));
    const qs = params.toString();
    return apiFetch<{ data: unknown[] }>(`/portal/projects/${id}/documents${qs ? `?${qs}` : ''}`);
  },
  getProjectIncidents: (id: string, days = 365) =>
    apiFetch<{ data: unknown[] }>(`/portal/projects/${id}/incidents?days=${days}`),
};

