/**
 * Phase 3.2 — UI side of the materials delivery workflow.
 *
 * Pure helpers used by app/materials.tsx:
 *   1. `visibleMaterialDeliveryActions` — which buttons to render given
 *      current status + the viewer's company role. Mirrors lib/rfi-actions.ts.
 *   2. `groupDeliveriesByDay` — agenda grouping. Today first, then future
 *      ascending, then past descending; rows in-day sorted by expectedAt.
 *      `isOverdue` is derived (not stored): row.status === 'expected' AND
 *      day < today.
 *
 * No React/Native imports — these run in pnpm test (server vitest config).
 */
import type { UserRole } from './company-context';

// Inlined to avoid pulling `lib/company-context.tsx`'s React Native
// transitive dependencies (AsyncStorage, expo-modules-core, etc.) into
// the server-side vitest config. Mirrors the pattern in
// `server/_core/role-check.ts`. Must stay in sync with ROLE_LEVELS in
// `lib/company-context.tsx` — the canonical copy for the UI layer.
const ROLE_LEVELS: Record<UserRole, number> = {
  super_admin:   100,
  company_admin: 80,
  manager:       60,
  supervisor:    40,
  worker:        20,
  viewer:        10,
};

function hasPermission(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_LEVELS[userRole] >= ROLE_LEVELS[requiredRole];
}

export type MaterialDeliveryStatus = 'expected' | 'delivered' | 'rejected' | 'cancelled';

export interface MaterialDeliveryRow {
  id: number;
  companyId: number;
  projectId: number;
  supplierName: string;
  materialDescription: string;
  expectedAt: Date | string;
  deliveredAt: Date | string | null;
  status: MaterialDeliveryStatus;
  // ...other columns the screen will pass through; only the fields above
  // are needed by the helpers in this file. The component code passes the
  // full row, but the type intentionally narrows to just what we read.
}

export type VisibleActions = {
  markDelivered: boolean;
  markRejected:  boolean;
  cancel:        boolean;
  edit:          boolean;
};

export function visibleMaterialDeliveryActions(
  status: MaterialDeliveryStatus,
  role: UserRole | null,
): VisibleActions {
  if (!role) return { markDelivered: false, markRejected: false, cancel: false, edit: false };
  const isExpected  = status === 'expected';
  const supervisor  = hasPermission(role, 'supervisor');
  const manager     = hasPermission(role, 'manager');
  return {
    markDelivered: isExpected && supervisor,
    markRejected:  isExpected && supervisor,
    cancel:        isExpected && manager,
    edit:          supervisor,
  };
}

export interface AgendaRow extends MaterialDeliveryRow {
  /** Derived: status === 'expected' AND day < today. */
  isOverdue: boolean;
}

export interface AgendaGroup {
  /** YYYY-MM-DD in UTC of the anchor, suitable as a key. */
  dayIso: string;
  /** Same anchor's day at 00:00:00.000Z. */
  dayDate: Date;
  /** Rows in the group, sorted by expectedAt ascending. */
  rows: AgendaRow[];
}

/**
 * Group rows by the calendar day of their `expectedAt`, anchored at
 * `todayIso` (a UTC ISO string normally derived from `new Date()` at the
 * top of the screen). Today appears first; future days ascending; past
 * days descending. Empty input → empty array.
 */
export function groupDeliveriesByDay(
  rows: MaterialDeliveryRow[],
  todayIso: string,
): AgendaGroup[] {
  const todayKey = todayIso.slice(0, 10);
  const buckets = new Map<string, AgendaRow[]>();

  for (const r of rows) {
    const ms = (r.expectedAt instanceof Date ? r.expectedAt : new Date(r.expectedAt)).getTime();
    const dayIso = new Date(ms).toISOString().slice(0, 10);
    const isOverdue = r.status === 'expected' && dayIso < todayKey;
    const list = buckets.get(dayIso) ?? [];
    list.push({ ...r, isOverdue });
    buckets.set(dayIso, list);
  }

  for (const list of buckets.values()) {
    list.sort((a, b) => {
      const aMs = (a.expectedAt instanceof Date ? a.expectedAt : new Date(a.expectedAt)).getTime();
      const bMs = (b.expectedAt instanceof Date ? b.expectedAt : new Date(b.expectedAt)).getTime();
      return aMs - bMs;
    });
  }

  const days = Array.from(buckets.keys());
  const future = days.filter(d => d > todayKey).sort();
  const past   = days.filter(d => d < todayKey).sort().reverse();
  const ordered = [
    ...(buckets.has(todayKey) ? [todayKey] : []),
    ...future,
    ...past,
  ];

  return ordered.map(dayIso => ({
    dayIso,
    dayDate: new Date(`${dayIso}T00:00:00.000Z`),
    rows: buckets.get(dayIso)!,
  }));
}
