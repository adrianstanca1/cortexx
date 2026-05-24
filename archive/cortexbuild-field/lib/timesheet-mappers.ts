export type TimesheetStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

export interface TimesheetSubmissionView {
  id: string;
  workerName: string;
  projectName?: string;
  weekStarting: string;
  totalHours: number;
  overtimeHours: number;
  status: TimesheetStatus;
  submittedAt?: string;
  reviewedBy?: string;
  notes?: string;
  mondayHours?: number;
  tuesdayHours?: number;
  wednesdayHours?: number;
  thursdayHours?: number;
  fridayHours?: number;
  saturdayHours?: number;
  sundayHours?: number;
}

export function parseHours(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function toIsoString(value: unknown): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

export function mapTimesheetRows(rows: any[] | undefined, fallback: TimesheetSubmissionView[]): TimesheetSubmissionView[] {
  if (!rows) return fallback;
  return rows.map((row: any) => ({
    id: String(row.id),
    workerName: row.workerName ?? 'Unknown Worker',
    projectName: row.projectName ?? undefined,
    weekStarting: row.weekStarting,
    totalHours: parseHours(row.totalHours),
    overtimeHours: parseHours(row.overtimeHours),
    status: (row.status ?? 'draft') as TimesheetStatus,
    submittedAt: toIsoString(row.submittedAt ?? row.createdAt),
    reviewedBy: row.approvedBy ?? undefined,
    notes: row.notes ?? undefined,
    mondayHours: parseHours(row.mondayHours),
    tuesdayHours: parseHours(row.tuesdayHours),
    wednesdayHours: parseHours(row.wednesdayHours),
    thursdayHours: parseHours(row.thursdayHours),
    fridayHours: parseHours(row.fridayHours),
    saturdayHours: parseHours(row.saturdayHours),
    sundayHours: parseHours(row.sundayHours),
  }));
}

export const mapTimesheetSubmissions = mapTimesheetRows;

const DAY_KEYS = [
  'mondayHours',
  'tuesdayHours',
  'wednesdayHours',
  'thursdayHours',
  'fridayHours',
  'saturdayHours',
  'sundayHours',
] as const;

export type TimesheetEntryView = {
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
  status: TimesheetStatus;
  createdAt: string;
};

export function rowsToWeekEntries(rows: any[] | undefined, weekStarting: string): TimesheetEntryView[] {
  if (!rows) return [];
  const weekStart = new Date(`${weekStarting}T00:00:00.000Z`);
  return rows.flatMap((row: any) => {
    if (row.weekStarting !== weekStarting) return [];
    return DAY_KEYS.map((key, index) => {
      const date = new Date(weekStart);
      date.setUTCDate(weekStart.getUTCDate() + index);
      const hours = parseHours(row[key]);
      return {
        id: `${row.id}-${key}`,
        workerId: row.workerId ? String(row.workerId) : '',
        workerName: row.workerName ?? 'Unknown Worker',
        projectId: row.projectId ? String(row.projectId) : '',
        projectName: row.projectName ?? 'Project',
        date: date.toISOString().slice(0, 10),
        regularHours: hours,
        overtimeHours: 0,
        breakMinutes: 0,
        notes: row.notes ?? undefined,
        status: (row.status ?? 'draft') as TimesheetStatus,
        createdAt: toIsoString(row.createdAt) ?? new Date().toISOString(),
      };
    });
  });
}

export function mapTimesheetEntries(rows: any[] | undefined, fallback: TimesheetEntryView[], weekStarting: string): TimesheetEntryView[] {
  if (!rows) return fallback;
  return rowsToWeekEntries(rows, weekStarting);
}
