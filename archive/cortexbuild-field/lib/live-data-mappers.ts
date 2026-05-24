import {
  MOCK_DEFECTS,
  MOCK_INCIDENTS,
  MOCK_PROJECTS,
} from './mock-data';
import type { Project } from './types';

export function safeJsonArray(value: unknown): unknown[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function mapProjectRows(rows: any[] | undefined, useFallback: boolean): Project[] {
  if (!rows) return useFallback ? MOCK_PROJECTS : [];
  return rows.map((p: any) => ({
    id: String(p.id),
    name: p.name,
    description: p.description ?? '',
    client: p.clientName ?? 'Unknown Client',
    status: (p.status ?? 'active') as import('@/lib/types').ProjectStatus,
    progress: p.progress ?? 0,
    contractValue: Number(p.budget ?? 0),
    budgetSpent: Number(p.spent ?? 0),
    budget: Number(p.budget ?? 0),
    spent: Number(p.spent ?? 0),
    startDate: p.startDate ? new Date(p.startDate).toISOString().split('T')[0] : '',
    endDate: p.endDate ? new Date(p.endDate).toISOString().split('T')[0] : '',
    siteAddress: p.siteAddress ?? '',
    location: p.siteAddress ?? '',
    projectManager: p.projectManager ?? '',
    managerId: '',
    managerName: p.projectManager ?? '',
    contractType: p.contractType ?? '',
    teamCount: 0,
    openTasks: 0,
    openDefects: 0,
    siteLat: p.siteLat ? Number(p.siteLat) : undefined,
    siteLng: p.siteLng ? Number(p.siteLng) : undefined,
    geofenceRadius: p.geofenceRadius ?? 200,
    createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: p.updatedAt ? new Date(p.updatedAt).toISOString() : new Date().toISOString(),
  }));
}

export function mapDefectRows(rows: any[] | undefined, useFallback: boolean) {
  if (!rows) return useFallback ? MOCK_DEFECTS : [];
  return rows.map((d: any) => ({
    id: String(d.id),
    projectId: String(d.projectId),
    title: d.title,
    description: d.description ?? '',
    location: d.location ?? '',
    trade: d.trade ?? '',
    priority: d.priority ?? 'medium',
    status: d.status ?? 'open',
    assignedTo: d.assignedTo ?? '',
    reportedBy: d.reportedBy ?? '',
    dueDate: d.dueDate ? new Date(d.dueDate).toISOString().split('T')[0] : '',
    photoUrls: safeJsonArray(d.photoUrls),
    aiAnalysis: d.aiAnalysis,
    createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : new Date().toISOString(),
  }));
}

export function mapIncidentRows(rows: any[] | undefined, useFallback: boolean) {
  if (!rows) return useFallback ? MOCK_INCIDENTS : [];
  return rows.map((i: any) => ({
    id: String(i.id),
    projectId: String(i.projectId),
    title: i.title,
    description: i.description ?? '',
    type: i.type ?? 'near_miss',
    severity: i.severity ?? 'low',
    status: i.status ?? 'open',
    location: i.location ?? '',
    reportedBy: i.reportedBy ?? '',
    photoUrls: safeJsonArray(i.photoUrls),
    immediateAction: i.immediateAction ?? '',
    riddorRequired: i.riddorRequired ?? false,
    createdAt: i.createdAt ? new Date(i.createdAt).toISOString() : new Date().toISOString(),
  }));
}
