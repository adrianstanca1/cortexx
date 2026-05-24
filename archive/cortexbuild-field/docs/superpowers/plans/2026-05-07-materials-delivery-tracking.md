# Phase 3.2 — Materials: delivery tracking — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Site managers schedule (office) and confirm/reject (site, offline-tolerant) material deliveries with photos and GPS, surfaced as an agenda-by-day in a new screen and integrated with Phase 3.6 push prefs and Phase 3.7 conflict resolution.

**Architecture:** Single new table `material_deliveries` (no separate suppliers / line-items table — both deferred). One new sub-router `server/routers/materials.ts` with six procedures. Three new push event types. Conflict-aware UPDATE via the same `baseSnapshot` pattern shipped in Phase 3.7. Photos online-only (no AsyncStorage bloat). Single new screen + status pill + state-machine helper pair (server + client mirror).

**Tech Stack:** TypeScript 5.9 · tRPC v11 · Drizzle ORM (PostgreSQL) · Vitest · Expo Router · Expo Image Picker · Expo Location · TanStack Query 5 · NativeWind 4.

**Spec:** `docs/superpowers/specs/2026-05-07-materials-delivery-tracking-design.md` (commit `ce23fe7`).

**Spec deviations** (verified against the live codebase before writing this plan):

| Spec said | Reality | Plan uses |
|---|---|---|
| Migration `0013_material_deliveries.sql` | `0013_*` is already taken by `conflict_pending` (Phase 3.7) | `0014_material_deliveries.sql` |
| Conflict registry at `shared/conflict-field-kinds.ts` with dotted keys (`materials.notes`) | Actually at `drizzle/conflict-registry.ts` with nested-table shape | `drizzle/conflict-registry.ts` with `materials: { notes: 'text', ... }` |
| `assertTransition` in `lib/material-delivery-actions.ts` | Existing `rfi-state-machine` precedent puts server transitions in `server/_core/` | `server/_core/material-delivery-state-machine.ts` for server transitions; `lib/material-delivery-actions.ts` for client visibility |

---

## File map

| File | Status | Responsibility |
|---|---|---|
| `drizzle/0014_material_deliveries.sql` | NEW | Migration: `CREATE TABLE material_deliveries` + 3 indexes. |
| `drizzle/meta/_journal.json` | MODIFY | Add idx 11 entry. |
| `drizzle/schema.ts` | MODIFY | Add `materialDeliveries` table + `MaterialDelivery` / `InsertMaterialDelivery` / `MaterialDeliveryStatus` types. |
| `drizzle/conflict-registry.ts` | MODIFY | Append `materials: { ... }` table block (10 entries). |
| `tests/conflict-registry-coverage.test.ts` | MODIFY | Add `'materials'` to `QUEUEABLE_UPDATE_TABLES` + its column list. |
| `server/_core/material-delivery-state-machine.ts` | NEW | `MaterialDeliveryStatus` literal + `canTransition` + `assertTransition`. |
| `tests/material-delivery-state-machine.test.ts` | NEW | Unit tests for every edge in the transition table. |
| `lib/material-delivery-actions.ts` | NEW | `visibleMaterialDeliveryActions(status, role)` + `groupDeliveriesByDay(rows, todayIso)` (pure; no React). |
| `tests/material-delivery-actions.test.ts` | NEW | Unit tests for visibility + agenda grouping. |
| `shared/notification-events.ts` | MODIFY | Append `delivery_expected`, `delivery_received`, `delivery_rejected`. |
| `tests/notification-events.test.ts` | MODIFY | Extend snapshot of `NOTIFICATION_EVENT_TYPES`. |
| `server/routers/materials.ts` | NEW | Six procedures (`list`, `expectDelivery`, `markDelivered`, `markRejected`, `cancelDelivery`, `update`). |
| `tests/materials-router.test.ts` | NEW | Router-level tests mirroring `tests/rfis-router.test.ts` shape. |
| `tests/materials-conflict-detection.test.ts` | NEW | `update` with `baseSnapshot`: ok / conflict / row_deleted. |
| `server/routers/index.ts` | MODIFY | Import `materialsRouter` + mount under `appRouter`. |
| `components/delivery-status-pill.tsx` | NEW | Status chip. |
| `tests/delivery-status-pill.component.test.tsx` | NEW | Renders correct label per status. |
| `app/materials.tsx` | NEW | Agenda screen + detail / mark-delivered / mark-rejected / edit modals + offline branches. |
| `app/(tabs)/index.tsx` | MODIFY | Add Materials tile to the Field-Operations grid. |
| `docs/ROADMAP.md` | MODIFY | Mark § 3.2 ✅ DONE with commit SHAs. |

---

## Task 1: Migration + Drizzle schema for `material_deliveries`

The single new table. Tenant-scoped via `companyId`, indexed for the agenda query and status filtering.

**Files:**
- Create: `drizzle/0014_material_deliveries.sql`
- Modify: `drizzle/meta/_journal.json`
- Modify: `drizzle/schema.ts`
- Test: existing `tests/migration-journal-completeness.test.ts` enforces the journal entry.

- [ ] **Step 1: Write the migration**

Create `drizzle/0014_material_deliveries.sql`:

```sql
CREATE TABLE IF NOT EXISTS "material_deliveries" (
  "id"                    SERIAL PRIMARY KEY,
  "companyId"             INTEGER NOT NULL REFERENCES "companies"("id"),
  "projectId"             INTEGER NOT NULL REFERENCES "projects"("id"),
  "supplierName"          VARCHAR(255) NOT NULL,
  "materialDescription"   TEXT NOT NULL,
  "expectedAt"            TIMESTAMP NOT NULL,
  "deliveredAt"           TIMESTAMP,
  "status"                VARCHAR(20) NOT NULL DEFAULT 'expected',
  "rejectionReason"       TEXT,
  "cancellationReason"    TEXT,
  "notes"                 TEXT,
  "gpsLat"                NUMERIC(9,6),
  "gpsLng"                NUMERIC(9,6),
  "photoStorageKeys"      TEXT[] NOT NULL DEFAULT '{}',
  "createdById"           INTEGER NOT NULL REFERENCES "users"("id"),
  "receivedById"          INTEGER REFERENCES "users"("id"),
  "createdAt"             TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt"             TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "material_deliveries_agenda_idx"
  ON "material_deliveries" ("companyId", "projectId", "expectedAt");

CREATE INDEX IF NOT EXISTS "material_deliveries_status_idx"
  ON "material_deliveries" ("companyId", "status");

CREATE INDEX IF NOT EXISTS "material_deliveries_delivered_idx"
  ON "material_deliveries" ("companyId", "deliveredAt")
  WHERE "deliveredAt" IS NOT NULL;
```

- [ ] **Step 2: Add the journal entry**

Append to `drizzle/meta/_journal.json` (inside the `entries` array, after idx 10):

```json
{
  "idx": 11,
  "version": "7",
  "when": 1778200000000,
  "tag": "0014_material_deliveries",
  "breakpoints": true
}
```

- [ ] **Step 3: Add the Drizzle table to `drizzle/schema.ts`**

Append after the `conflictPending` block (at end of file):

```ts
// ─────────────────────────────────────────────────────────────────────────────
// MATERIAL DELIVERIES (Phase 3.2)
// ─────────────────────────────────────────────────────────────────────────────
export const materialDeliveries = pgTable('material_deliveries', {
  id:                  serial('id').primaryKey(),
  companyId:           integer('companyId').notNull(),
  projectId:           integer('projectId').notNull(),
  supplierName:        varchar('supplierName', { length: 255 }).notNull(),
  materialDescription: text('materialDescription').notNull(),
  expectedAt:          timestamp('expectedAt').notNull(),
  deliveredAt:         timestamp('deliveredAt'),
  status:              varchar('status', { length: 20 }).notNull().default('expected'),
  rejectionReason:     text('rejectionReason'),
  cancellationReason:  text('cancellationReason'),
  notes:               text('notes'),
  gpsLat:              decimal('gpsLat',  { precision: 9, scale: 6 }),
  gpsLng:              decimal('gpsLng',  { precision: 9, scale: 6 }),
  photoStorageKeys:    text('photoStorageKeys').array().notNull().default(sql`'{}'`),
  createdById:         integer('createdById').notNull(),
  receivedById:        integer('receivedById'),
  createdAt:           timestamp('createdAt').defaultNow().notNull(),
  updatedAt:           timestamp('updatedAt').defaultNow().notNull(),
});
export type MaterialDelivery       = typeof materialDeliveries.$inferSelect;
export type InsertMaterialDelivery = typeof materialDeliveries.$inferInsert;
export type MaterialDeliveryStatus = 'expected' | 'delivered' | 'rejected' | 'cancelled';
```

If `decimal`, `sql`, or `text(...).array()` aren't already imported at the top of `schema.ts`, add them to the existing `drizzle-orm/pg-core` and `drizzle-orm` imports.

- [ ] **Step 4: Run the typecheck and journal-completeness test**

```bash
pnpm check
pnpm test -- tests/migration-journal-completeness.test.ts
```

Expected: `pnpm check` clean; the journal test passes (it walks the SQL files and matches against `_journal.json`).

- [ ] **Step 5: Commit**

```bash
git add drizzle/0014_material_deliveries.sql drizzle/meta/_journal.json drizzle/schema.ts
git commit -m "feat(materials): add material_deliveries table + Drizzle schema"
```

---

## Task 2: Server-side state machine

Pure helper for state transitions. Mirrors `server/_core/rfi-state-machine.ts` so reviewers see the same shape.

**Files:**
- Create: `server/_core/material-delivery-state-machine.ts`
- Test: `tests/material-delivery-state-machine.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/material-delivery-state-machine.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  canTransition,
  assertTransition,
  type MaterialDeliveryStatus,
} from '../server/_core/material-delivery-state-machine';
import { TRPCError } from '@trpc/server';

const ALLOWED: Array<[MaterialDeliveryStatus, MaterialDeliveryStatus]> = [
  ['expected',  'delivered'],
  ['expected',  'rejected'],
  ['expected',  'cancelled'],
  ['delivered', 'rejected'],
  ['rejected',  'delivered'],
  ['cancelled', 'expected'],
];

const ALL: MaterialDeliveryStatus[] = ['expected', 'delivered', 'rejected', 'cancelled'];

describe('material-delivery state machine', () => {
  it('canTransition true for every allowed edge', () => {
    for (const [from, to] of ALLOWED) {
      expect(canTransition(from, to)).toBe(true);
    }
  });

  it('canTransition false for every other (from,to) pair', () => {
    for (const from of ALL) for (const to of ALL) {
      const allowed = ALLOWED.some(([f, t]) => f === from && t === to);
      if (allowed) continue;
      expect(canTransition(from, to)).toBe(false);
    }
  });

  it('assertTransition throws BAD_REQUEST on illegal transition', () => {
    let err: unknown;
    try { assertTransition('delivered', 'expected'); } catch (e) { err = e; }
    expect(err).toBeInstanceOf(TRPCError);
    expect((err as TRPCError).code).toBe('BAD_REQUEST');
    expect((err as TRPCError).message).toContain('"delivered"');
    expect((err as TRPCError).message).toContain('"expected"');
  });

  it('assertTransition is a no-op on legal transition', () => {
    expect(() => assertTransition('expected', 'delivered')).not.toThrow();
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

```bash
pnpm test -- tests/material-delivery-state-machine.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the helper**

Create `server/_core/material-delivery-state-machine.ts`:

```ts
/**
 * Phase 3.2 — material-delivery lifecycle state machine.
 *
 * Pure helper, server-side. Mirrors server/_core/rfi-state-machine.ts.
 * Every status mutation in server/routers/materials.ts MUST go through
 * `assertTransition` so the rules don't drift across endpoints.
 */
import { TRPCError } from '@trpc/server';

export type MaterialDeliveryStatus = 'expected' | 'delivered' | 'rejected' | 'cancelled';

const TRANSITIONS: Record<MaterialDeliveryStatus, MaterialDeliveryStatus[]> = {
  expected:  ['delivered', 'rejected', 'cancelled'],
  delivered: ['rejected'],          // correction path
  rejected:  ['delivered'],         // correction path
  cancelled: ['expected'],          // undo cancel
};

export function canTransition(from: MaterialDeliveryStatus, to: MaterialDeliveryStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(from: MaterialDeliveryStatus, to: MaterialDeliveryStatus): void {
  if (!canTransition(from, to)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Cannot transition material delivery from "${from}" to "${to}".`,
    });
  }
}
```

- [ ] **Step 4: Run the tests to see them pass**

```bash
pnpm test -- tests/material-delivery-state-machine.test.ts
```

Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add server/_core/material-delivery-state-machine.ts tests/material-delivery-state-machine.test.ts
git commit -m "feat(materials): pure state-machine helper for delivery transitions"
```

---

## Task 3: Client-side action visibility + agenda grouping helpers

Two pure helpers, both used by `app/materials.tsx`. Bundled because both are tiny and serve the same screen.

**Files:**
- Create: `lib/material-delivery-actions.ts`
- Test: `tests/material-delivery-actions.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/material-delivery-actions.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  visibleMaterialDeliveryActions,
  groupDeliveriesByDay,
  type MaterialDeliveryRow,
} from '../lib/material-delivery-actions';

const row = (overrides: Partial<MaterialDeliveryRow>): MaterialDeliveryRow => ({
  id: 1,
  companyId: 1,
  projectId: 1,
  supplierName: 'Travis Perkins',
  materialDescription: 'Bricks',
  expectedAt: new Date('2026-05-07T14:00:00Z'),
  deliveredAt: null,
  status: 'expected',
  ...overrides,
} as MaterialDeliveryRow);

describe('visibleMaterialDeliveryActions', () => {
  it('expected + supervisor → mark/reject/edit, no cancel', () => {
    expect(visibleMaterialDeliveryActions('expected', 'supervisor'))
      .toEqual({ markDelivered: true, markRejected: true, cancel: false, edit: true });
  });

  it('expected + manager → adds cancel', () => {
    expect(visibleMaterialDeliveryActions('expected', 'manager'))
      .toEqual({ markDelivered: true, markRejected: true, cancel: true, edit: true });
  });

  it('delivered + supervisor → only edit (state-flip via edit form)', () => {
    expect(visibleMaterialDeliveryActions('delivered', 'supervisor'))
      .toEqual({ markDelivered: false, markRejected: false, cancel: false, edit: true });
  });

  it('cancelled + manager → only edit (undo path)', () => {
    expect(visibleMaterialDeliveryActions('cancelled', 'manager'))
      .toEqual({ markDelivered: false, markRejected: false, cancel: false, edit: true });
  });

  it('worker / null role → all false', () => {
    expect(visibleMaterialDeliveryActions('expected', 'worker'))
      .toEqual({ markDelivered: false, markRejected: false, cancel: false, edit: false });
    expect(visibleMaterialDeliveryActions('expected', null))
      .toEqual({ markDelivered: false, markRejected: false, cancel: false, edit: false });
  });
});

describe('groupDeliveriesByDay', () => {
  // Anchor "today" at midnight UTC for determinism. The helper accepts an ISO
  // anchor so tests don't depend on system clock.
  const today = '2026-05-07T00:00:00.000Z';

  it('groups rows by day in TZ of the anchor', () => {
    const rows = [
      row({ id: 1, expectedAt: new Date('2026-05-07T09:00:00Z') }), // today
      row({ id: 2, expectedAt: new Date('2026-05-07T17:30:00Z') }), // today
      row({ id: 3, expectedAt: new Date('2026-05-08T08:00:00Z') }), // tomorrow
      row({ id: 4, expectedAt: new Date('2026-05-06T12:00:00Z') }), // yesterday
    ];
    const groups = groupDeliveriesByDay(rows, today);
    expect(groups.map(g => g.dayIso)).toEqual([
      '2026-05-08', '2026-05-07', '2026-05-06',
    ]);
    expect(groups.find(g => g.dayIso === '2026-05-07')!.rows.map(r => r.id)).toEqual([1, 2]);
  });

  it('sorts future ascending and past descending around today', () => {
    const rows = [
      row({ id: 1, expectedAt: new Date('2026-05-09T09:00:00Z') }),
      row({ id: 2, expectedAt: new Date('2026-05-08T09:00:00Z') }),
      row({ id: 3, expectedAt: new Date('2026-05-07T09:00:00Z') }),
      row({ id: 4, expectedAt: new Date('2026-05-06T09:00:00Z') }),
      row({ id: 5, expectedAt: new Date('2026-05-05T09:00:00Z') }),
    ];
    const groups = groupDeliveriesByDay(rows, today);
    // Today first, then future ascending, then past descending.
    expect(groups.map(g => g.dayIso)).toEqual([
      '2026-05-07', '2026-05-08', '2026-05-09', '2026-05-06', '2026-05-05',
    ]);
  });

  it('flags overdue: status=expected and day < today', () => {
    const rows = [
      row({ id: 1, expectedAt: new Date('2026-05-06T09:00:00Z'), status: 'expected' }), // overdue
      row({ id: 2, expectedAt: new Date('2026-05-06T09:00:00Z'), status: 'delivered' }),
      row({ id: 3, expectedAt: new Date('2026-05-08T09:00:00Z'), status: 'expected' }), // future, not overdue
    ];
    const groups = groupDeliveriesByDay(rows, today);
    const lookup = new Map(groups.flatMap(g => g.rows.map(r => [r.id, r])));
    expect(lookup.get(1)!.isOverdue).toBe(true);
    expect(lookup.get(2)!.isOverdue).toBe(false);
    expect(lookup.get(3)!.isOverdue).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

```bash
pnpm test -- tests/material-delivery-actions.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the helper**

Create `lib/material-delivery-actions.ts`:

```ts
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
import { hasPermission, type UserRole } from './company-context';

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
```

- [ ] **Step 4: Run the tests to see them pass**

```bash
pnpm test -- tests/material-delivery-actions.test.ts
```

Expected: PASS (8 tests). If `hasPermission` import fails, mirror `lib/rfi-actions.ts` exactly — it uses the same import.

- [ ] **Step 5: Commit**

```bash
git add lib/material-delivery-actions.ts tests/material-delivery-actions.test.ts
git commit -m "feat(materials): action visibility + agenda grouping helpers"
```

---

## Task 4: Notification events registry — append three keys

Three new event types per the spec § 7. Per CLAUDE.md, event types must be appended in the same PR as a call site — Tasks 7-9 will land the call sites; this task lands the registry entries first so the procedures compile.

**Files:**
- Modify: `shared/notification-events.ts`
- Modify: `tests/notification-events.test.ts`

- [ ] **Step 1: Update the failing test**

In `tests/notification-events.test.ts`, find the test that asserts the keys of `NOTIFICATION_EVENTS` (or `NOTIFICATION_EVENT_TYPES`). Add the three new keys to the expected list:

```ts
// Was:
expect(NOTIFICATION_EVENT_TYPES).toEqual([
  'defect_assigned',
  'defect_resolved',
]);

// To:
expect(NOTIFICATION_EVENT_TYPES).toEqual([
  'defect_assigned',
  'defect_resolved',
  'delivery_expected',
  'delivery_received',
  'delivery_rejected',
]);
```

Add a smoke test for each new key's `isEventEnabled` behaviour at the bottom of the file:

```ts
describe('delivery_* events', () => {
  it('isEventEnabled defaults to true for missing keys', () => {
    expect(isEventEnabled({}, 'delivery_expected')).toBe(true);
    expect(isEventEnabled({}, 'delivery_received')).toBe(true);
    expect(isEventEnabled({}, 'delivery_rejected')).toBe(true);
  });

  it('isEventEnabled is false when explicitly muted', () => {
    expect(isEventEnabled({ delivery_received: false }, 'delivery_received')).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

```bash
pnpm test -- tests/notification-events.test.ts
```

Expected: FAIL — extra keys not present.

- [ ] **Step 3: Append the entries**

In `shared/notification-events.ts`, extend `NOTIFICATION_EVENTS`:

```ts
export const NOTIFICATION_EVENTS = {
  defect_assigned:   { label: "Defect assigned to me",            category: "Defects" },
  defect_resolved:   { label: "My defect was resolved",           category: "Defects" },
  delivery_expected: { label: "Delivery expected on my site",     category: "Materials" },
  delivery_received: { label: "Material delivery confirmed",      category: "Materials" },
  delivery_rejected: { label: "Material delivery rejected",       category: "Materials" },
} as const;
```

- [ ] **Step 4: Run the tests + the typechecker**

```bash
pnpm test -- tests/notification-events.test.ts
pnpm check
```

Expected: PASS; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add shared/notification-events.ts tests/notification-events.test.ts
git commit -m "feat(materials): register delivery_* push event types"
```

---

## Task 5: Conflict registry — append `materials` table block

The `materials.update` procedure in Task 11 will be queueable (Task 14 enqueues offline edits with `baseSnapshot`). The 3.7 coverage meta-test in `tests/conflict-registry-coverage.test.ts` enforces that every table in `QUEUEABLE_UPDATE_TABLES` has a registered kind for every editable column. Land the registry entries first so Task 11 doesn't break CI on the way in.

**Files:**
- Modify: `drizzle/conflict-registry.ts`
- Modify: `tests/conflict-registry-coverage.test.ts`

- [ ] **Step 1: Update the coverage test**

In `tests/conflict-registry-coverage.test.ts`, extend the two top-level constants:

```ts
const QUEUEABLE_UPDATE_TABLES = ['rfis', 'materials'] as const;

const EDITABLE_COLUMNS: Record<typeof QUEUEABLE_UPDATE_TABLES[number], readonly string[]> = {
  rfis: ['question', 'response', 'status', 'priority', 'dueDate'],
  materials: [
    'supplierName',
    'materialDescription',
    'notes',
    'rejectionReason',
    'cancellationReason',
    'expectedAt',
    'deliveredAt',
    'status',
    'gpsLat',
    'gpsLng',
  ],
};
```

- [ ] **Step 2: Run it to see it fail**

```bash
pnpm test -- tests/conflict-registry-coverage.test.ts
```

Expected: FAIL with a list of `materials` columns not yet registered.

- [ ] **Step 3: Append registry entries**

In `drizzle/conflict-registry.ts`, extend `CONFLICT_FIELD_KINDS`:

```ts
export const CONFLICT_FIELD_KINDS = {
  rfis: {
    question: 'text',
    response: 'text',
    status:   'atomic',
    priority: 'atomic',
    dueDate:  'atomic',
  },
  materials: {
    supplierName:        'text',
    materialDescription: 'text',
    notes:               'text',
    rejectionReason:     'text',
    cancellationReason:  'text',
    expectedAt:          'atomic',
    deliveredAt:         'atomic',
    status:              'atomic',
    gpsLat:              'atomic',
    gpsLng:              'atomic',
  },
} as const satisfies Record<string, Record<string, ConflictFieldKind>>;
```

- [ ] **Step 4: Re-run the test + typecheck**

```bash
pnpm test -- tests/conflict-registry-coverage.test.ts
pnpm check
```

Expected: PASS (covers `materials`); typecheck clean. The 3.7 conflicts list/sheet will now render the right widget per `materials` field automatically — no client work needed.

- [ ] **Step 5: Commit**

```bash
git add drizzle/conflict-registry.ts tests/conflict-registry-coverage.test.ts
git commit -m "feat(materials): register conflict-field kinds for materials.update"
```

---

## Task 6: `materials.list` procedure + sub-router scaffold

First procedure on the new sub-router. Sets up `server/routers/materials.ts` and mounts it under `appRouter`.

**Files:**
- Create: `server/routers/materials.ts`
- Modify: `server/routers/index.ts`
- Test: `tests/materials-router.test.ts` (NEW; will be extended by Tasks 7-11).

- [ ] **Step 1: Write the failing test**

Create `tests/materials-router.test.ts`. Mirror the shape of `tests/rfis-router.test.ts` (read it first to copy the `vi.mock('../server/db', ...)` chain helpers and the `dbCalls` accumulator pattern). Start with a single happy-path test:

```ts
import { describe, expect, it, beforeEach, vi } from 'vitest';
import type { TrpcContext } from '../server/_core/context';
import { tableName, collectColumns, collectBindings } from './_helpers/drizzle-mock';

// (Replicate the dbCalls + vi.mock('../server/db', ...) structure from
// tests/rfis-router.test.ts. The materials list query is the simplest
// shape: select().from(materialDeliveries).where(...).orderBy(...).
// `vi.mock("../server/_core/pushNotifications", () => ({ sendPushToUsers: vi.fn() }))`
// is required because Tasks 7-9 will reach for it; mock it from this
// file's setup so future tests can assert call args.)

import { appRouter } from '../server/routers';

const baseCtx: TrpcContext = {
  user: { id: 1, name: 'Alice', email: 'a@b.com', role: 'user' } as any,
  companyMembership: { companyId: 1, companyRole: 'manager', isActive: true } as any,
} as TrpcContext;

describe('materials.list', () => {
  beforeEach(() => { /* reset dbCalls per the rfis test pattern */ });

  it('binds companyId in WHERE and orders by expectedAt asc', async () => {
    const caller = appRouter.createCaller(baseCtx);
    await caller.materials.list({ companyId: 1 });

    const sel = dbCalls.selectFroms.find(s => s.table === 'material_deliveries');
    expect(sel).toBeDefined();
    expect(sel!.whereBindings.companyId).toBe(1);
    expect(sel!.whereCols).toContain('companyId');
    // Optional projectId / status / fromDate / toDate not in this call.
  });

  it('adds projectId predicate when provided', async () => {
    const caller = appRouter.createCaller(baseCtx);
    await caller.materials.list({ companyId: 1, projectId: 7 });
    const sel = dbCalls.selectFroms.find(s => s.table === 'material_deliveries')!;
    expect(sel.whereBindings.projectId).toBe(7);
  });
});
```

- [ ] **Step 2: Run it — see it fail (router not found)**

```bash
pnpm test -- tests/materials-router.test.ts
```

Expected: FAIL — `caller.materials` is undefined.

- [ ] **Step 3: Create the materials sub-router with `list`**

Create `server/routers/materials.ts`:

```ts
/**
 * Phase 3.2 — Materials delivery tracking.
 *
 * Schedule (office) → confirm/reject (site, offline-tolerant) workflow.
 * Tenant gating via companyScopedProcedure on every procedure. Role
 * gates via requireCompanyRole. Status transitions through assertTransition
 * from server/_core/material-delivery-state-machine.ts.
 */
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { and, asc, eq, gte, lte } from 'drizzle-orm';
import { companyScopedProcedure, router } from '../_core/trpc';
import { getDb } from '../db';
import { dbUnavailable } from '../_core/errors';
import { requireCompanyRole } from '../_core/role-check';
import {
  assertTransition,
  type MaterialDeliveryStatus,
} from '../_core/material-delivery-state-machine';
import { detectFieldConflicts } from '../_core/sync-conflict-detector';
import { sendPushToUsers } from '../_core/pushNotifications';
import {
  materialDeliveries,
  conflictPending,
  companyUsers,
  projects,
} from '../../drizzle/schema';

const STATUS = ['expected', 'delivered', 'rejected', 'cancelled'] as const;

export const materialsRouter = router({
  list: companyScopedProcedure
    .input(z.object({
      companyId: z.number(),
      projectId: z.number().optional(),
      status:    z.enum(STATUS).optional(),
      fromDate:  z.string().optional(),
      toDate:    z.string().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions = [eq(materialDeliveries.companyId, input.companyId)];
      if (input.projectId) conditions.push(eq(materialDeliveries.projectId, input.projectId));
      if (input.status)    conditions.push(eq(materialDeliveries.status, input.status));
      if (input.fromDate)  conditions.push(gte(materialDeliveries.expectedAt, new Date(input.fromDate)));
      if (input.toDate)    conditions.push(lte(materialDeliveries.expectedAt, new Date(input.toDate)));
      return db.select().from(materialDeliveries)
        .where(and(...conditions))
        .orderBy(asc(materialDeliveries.expectedAt));
    }),
});
```

- [ ] **Step 4: Mount on `appRouter`**

In `server/routers/index.ts`:

1. Add to the imports block (alphabetised among the sub-router imports):
   ```ts
   import { materialsRouter } from './materials';
   ```
2. Find the `appRouter = router({ ... })` definition and add `materials: materialsRouter,` in the alphabetised position.

- [ ] **Step 5: Re-run the test**

```bash
pnpm test -- tests/materials-router.test.ts
pnpm check
```

Expected: PASS (2 tests); typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add server/routers/materials.ts server/routers/index.ts tests/materials-router.test.ts
git commit -m "feat(materials): list procedure + materials sub-router scaffold"
```

---

## Task 7: `materials.expectDelivery` (+ delivery_expected push)

Office-side scheduling. Cross-tenant FK guard mirrors `rfis.create`. Fires `delivery_expected` to all `supervisor+` company members (v1 fan-out — see spec § 7 for the per-project narrowing follow-up).

**Files:**
- Modify: `server/routers/materials.ts`
- Modify: `tests/materials-router.test.ts`

- [ ] **Step 1: Add the failing tests**

Append to `tests/materials-router.test.ts`:

```ts
describe('materials.expectDelivery', () => {
  beforeEach(() => { /* reset */ });

  it('inserts with createdById from ctx.user, status default expected, and pushes delivery_expected', async () => {
    dbCalls.projectsSelectReturn = [{ id: 7, companyId: 1 }]; // FK guard passes
    dbCalls.companyUsersBroadcastReturn = [
      { userId: 11, companyRole: 'supervisor', isActive: true },
      { userId: 12, companyRole: 'manager',    isActive: true },
      { userId: 13, companyRole: 'worker',     isActive: true }, // excluded by role
    ];
    const caller = appRouter.createCaller(baseCtx);
    await caller.materials.expectDelivery({
      companyId: 1, projectId: 7,
      supplierName: 'Travis Perkins', materialDescription: '5 pallets brick',
      expectedAt: '2026-05-08T14:00:00.000Z', notes: 'gate code 4321',
    });

    const ins = dbCalls.inserts.find(i => i.table === 'material_deliveries')!;
    expect(ins.values.createdById).toBe(baseCtx.user.id);
    expect(ins.values.status).toBe('expected');
    expect(ins.values.companyId).toBe(1);

    expect(sendPushToUsers).toHaveBeenCalledWith(
      [11, 12],
      'delivery_expected',
      expect.objectContaining({ supplierName: 'Travis Perkins' }),
    );
  });

  it('rejects FORBIDDEN when project belongs to a different company (cross-tenant guard)', async () => {
    dbCalls.projectsSelectReturn = []; // no row → guard fails
    const caller = appRouter.createCaller(baseCtx);
    await expect(caller.materials.expectDelivery({
      companyId: 1, projectId: 99,
      supplierName: 'X', materialDescription: 'Y',
      expectedAt: '2026-05-08T14:00:00.000Z',
    })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('rejects FORBIDDEN when caller role < manager', async () => {
    dbCalls.companyUsersReturn = [{ companyRole: 'supervisor', isActive: true }]; // gate test
    const caller = appRouter.createCaller(baseCtx);
    await expect(caller.materials.expectDelivery({
      companyId: 1, projectId: 7,
      supplierName: 'X', materialDescription: 'Y',
      expectedAt: '2026-05-08T14:00:00.000Z',
    })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
```

- [ ] **Step 2: Run them to fail**

```bash
pnpm test -- tests/materials-router.test.ts
```

Expected: FAIL — procedure not defined.

- [ ] **Step 3: Implement `expectDelivery`**

Add to `materialsRouter` in `server/routers/materials.ts` (after `list`):

```ts
expectDelivery: companyScopedProcedure
  .input(z.object({
    companyId:           z.number(),
    projectId:           z.number(),
    supplierName:        z.string().min(1),
    materialDescription: z.string().min(1),
    expectedAt:          z.string(),
    notes:               z.string().optional(),
  }))
  .mutation(async ({ ctx, input }) => {
    requireCompanyRole(ctx.companyMembership, 'manager');
    const db = await getDb();
    if (!db) throw dbUnavailable();

    // Cross-tenant FK guard — mirrors rfis.create.
    const [project] = await db.select().from(projects)
      .where(and(eq(projects.id, input.projectId), eq(projects.companyId, input.companyId)))
      .limit(1);
    if (!project) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Project not found for this company.' });
    }

    const [row] = await db.insert(materialDeliveries).values({
      companyId:           input.companyId,
      projectId:           input.projectId,
      supplierName:        input.supplierName,
      materialDescription: input.materialDescription,
      expectedAt:          new Date(input.expectedAt),
      notes:               input.notes,
      status:              'expected',
      createdById:         ctx.user.id,
    }).returning();

    // Resolve recipients: every active member of this company at supervisor+.
    // v1 fan-out is company-wide for the role (no projectMembership table
    // exists yet — see spec § 7 / § 10).
    const RECIPIENT_ROLES = ['supervisor', 'manager', 'company_admin', 'super_admin'] as const;
    const memberships = await db.select().from(companyUsers).where(and(
      eq(companyUsers.companyId, input.companyId),
      eq(companyUsers.isActive, true),
    ));
    const recipientIds = memberships
      .filter(m => RECIPIENT_ROLES.includes(m.companyRole as any))
      .map(m => m.userId);

    if (recipientIds.length > 0) {
      void sendPushToUsers(recipientIds, 'delivery_expected', {
        deliveryId:   row.id,
        projectName:  project.name,
        supplierName: row.supplierName,
        expectedAt:   row.expectedAt.toISOString(),
      }).catch(err => console.error('[materials.expectDelivery] push failed:', err));
    }

    return row;
  }),
```

- [ ] **Step 4: Re-run tests**

```bash
pnpm test -- tests/materials-router.test.ts
pnpm check
```

Expected: PASS (5 tests in this file now).

- [ ] **Step 5: Commit**

```bash
git add server/routers/materials.ts tests/materials-router.test.ts
git commit -m "feat(materials): expectDelivery procedure + delivery_expected push"
```

---

## Task 8: `materials.markDelivered` (+ delivery_received push)

Site-side confirmation. Sparse update — only fields present in the input are written, so the offline replay path that omits photos doesn't clobber a previously-attached photo set.

**Files:**
- Modify: `server/routers/materials.ts`
- Modify: `tests/materials-router.test.ts`

- [ ] **Step 1: Add the failing tests**

Append to `tests/materials-router.test.ts`:

```ts
describe('materials.markDelivered', () => {
  beforeEach(() => {
    dbCalls.materialDeliveriesSelectReturn = [{
      id: 42, companyId: 1, projectId: 7, status: 'expected',
      supplierName: 'X', materialDescription: 'Y',
      expectedAt: new Date('2026-05-08T14:00:00Z'),
    }];
    dbCalls.companyUsersBroadcastReturn = [
      { userId: 21, companyRole: 'manager', isActive: true },
      { userId: 22, companyRole: 'supervisor', isActive: true }, // excluded
    ];
  });

  it('transitions expected→delivered, sets receivedById, and pushes delivery_received to managers', async () => {
    const caller = appRouter.createCaller(baseCtx);
    await caller.materials.markDelivered({
      companyId: 1, id: 42, gpsLat: 51.5, gpsLng: -0.1,
      photoStorageKeys: ['k1', 'k2'],
    });

    const upd = dbCalls.updates.find(u => u.table === 'material_deliveries')!;
    expect(upd.values.status).toBe('delivered');
    expect(upd.values.receivedById).toBe(baseCtx.user.id);
    expect(upd.values.deliveredAt).toBeInstanceOf(Date);
    expect(upd.values.photoStorageKeys).toEqual(['k1', 'k2']);

    expect(sendPushToUsers).toHaveBeenCalledWith(
      [21], 'delivery_received', expect.any(Object),
    );
  });

  it('omits absent fields from SET (sparse update, preserves prior photos on offline replay)', async () => {
    const caller = appRouter.createCaller(baseCtx);
    await caller.materials.markDelivered({ companyId: 1, id: 42 }); // no photos
    const upd = dbCalls.updates.find(u => u.table === 'material_deliveries')!;
    expect(upd.values.photoStorageKeys).toBeUndefined();
    expect(upd.values.notes).toBeUndefined();
    expect(upd.values.gpsLat).toBeUndefined();
  });

  it('rejects BAD_REQUEST when current status is delivered (illegal transition)', async () => {
    dbCalls.materialDeliveriesSelectReturn = [{ id: 42, companyId: 1, status: 'delivered' }];
    const caller = appRouter.createCaller(baseCtx);
    await expect(caller.materials.markDelivered({ companyId: 1, id: 42 }))
      .rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('rejects FORBIDDEN when caller role < supervisor', async () => {
    dbCalls.companyUsersReturn = [{ companyRole: 'worker', isActive: true }];
    const caller = appRouter.createCaller(baseCtx);
    await expect(caller.materials.markDelivered({ companyId: 1, id: 42 }))
      .rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
```

(The dbCalls mock's `materialDeliveriesSelectReturn` field needs to be added to the mock setup at the top of the file alongside the existing `rfisSelectReturn`. Mirror the same shape.)

- [ ] **Step 2: Run them to fail**

```bash
pnpm test -- tests/materials-router.test.ts
```

Expected: FAIL — procedure not defined.

- [ ] **Step 3: Implement `markDelivered`**

Add to `materialsRouter`:

```ts
markDelivered: companyScopedProcedure
  .input(z.object({
    companyId:        z.number(),
    id:               z.number(),
    deliveredAt:      z.string().optional(),
    notes:            z.string().optional(),
    gpsLat:           z.number().optional(),
    gpsLng:           z.number().optional(),
    photoStorageKeys: z.array(z.string()).optional(),
  }))
  .mutation(async ({ ctx, input }) => {
    requireCompanyRole(ctx.companyMembership, 'supervisor');
    const db = await getDb();
    if (!db) throw dbUnavailable();

    const [current] = await db.select().from(materialDeliveries)
      .where(and(eq(materialDeliveries.id, input.id), eq(materialDeliveries.companyId, input.companyId)))
      .limit(1);
    if (!current) throw new TRPCError({ code: 'NOT_FOUND', message: 'Delivery not found.' });
    assertTransition(current.status as MaterialDeliveryStatus, 'delivered');

    // Sparse SET: only fields explicitly present in input are written.
    const set: Record<string, unknown> = {
      status:       'delivered',
      deliveredAt:  input.deliveredAt ? new Date(input.deliveredAt) : new Date(),
      receivedById: ctx.user.id,
      updatedAt:    new Date(),
    };
    if (input.notes            !== undefined) set.notes            = input.notes;
    if (input.gpsLat           !== undefined) set.gpsLat           = String(input.gpsLat);
    if (input.gpsLng           !== undefined) set.gpsLng           = String(input.gpsLng);
    if (input.photoStorageKeys !== undefined) set.photoStorageKeys = input.photoStorageKeys;

    const [row] = await db.update(materialDeliveries)
      .set(set)
      .where(and(eq(materialDeliveries.id, input.id), eq(materialDeliveries.companyId, input.companyId)))
      .returning();

    // Push delivery_received → office (manager+).
    const RECIPIENT_ROLES = ['manager', 'company_admin', 'super_admin'] as const;
    const memberships = await db.select().from(companyUsers).where(and(
      eq(companyUsers.companyId, input.companyId),
      eq(companyUsers.isActive, true),
    ));
    const recipientIds = memberships
      .filter(m => RECIPIENT_ROLES.includes(m.companyRole as any))
      .map(m => m.userId);
    if (recipientIds.length > 0) {
      void sendPushToUsers(recipientIds, 'delivery_received', {
        deliveryId:   row.id,
        supplierName: row.supplierName,
        deliveredAt:  row.deliveredAt!.toISOString(),
      }).catch(err => console.error('[materials.markDelivered] push failed:', err));
    }

    return row;
  }),
```

(Note: gps numerics are written as strings because Drizzle's `decimal` round-trips as string at runtime — see CLAUDE.md gotchas list.)

- [ ] **Step 4: Re-run tests**

```bash
pnpm test -- tests/materials-router.test.ts
pnpm check
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/routers/materials.ts tests/materials-router.test.ts
git commit -m "feat(materials): markDelivered + delivery_received push"
```

---

## Task 9: `materials.markRejected` (+ delivery_rejected push)

Same shape as `markDelivered` but `rejectionReason` is required. Fires `delivery_rejected` (urgent variant — same recipients, distinct event so users can mute one without the other).

**Files:**
- Modify: `server/routers/materials.ts`
- Modify: `tests/materials-router.test.ts`

- [ ] **Step 1: Add the failing tests**

Append:

```ts
describe('materials.markRejected', () => {
  beforeEach(() => {
    dbCalls.materialDeliveriesSelectReturn = [{ id: 42, companyId: 1, status: 'expected' }];
  });

  it('rejects BAD_REQUEST when rejectionReason is empty (zod min(1))', async () => {
    const caller = appRouter.createCaller(baseCtx);
    await expect(caller.materials.markRejected({
      companyId: 1, id: 42, rejectionReason: '',
    })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('transitions to rejected, persists reason, fires delivery_rejected', async () => {
    dbCalls.companyUsersBroadcastReturn = [
      { userId: 21, companyRole: 'manager', isActive: true },
    ];
    const caller = appRouter.createCaller(baseCtx);
    await caller.materials.markRejected({
      companyId: 1, id: 42, rejectionReason: 'Wrong size delivered (305x165 instead of 254x146)',
    });

    const upd = dbCalls.updates.find(u => u.table === 'material_deliveries')!;
    expect(upd.values.status).toBe('rejected');
    expect(upd.values.rejectionReason).toContain('Wrong size');
    expect(sendPushToUsers).toHaveBeenCalledWith(
      [21], 'delivery_rejected', expect.objectContaining({ rejectionReason: expect.any(String) }),
    );
  });
});
```

- [ ] **Step 2: Run to see fail**

```bash
pnpm test -- tests/materials-router.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement `markRejected`**

Add to `materialsRouter`:

```ts
markRejected: companyScopedProcedure
  .input(z.object({
    companyId:        z.number(),
    id:               z.number(),
    rejectionReason:  z.string().min(1),
    deliveredAt:      z.string().optional(),
    notes:            z.string().optional(),
    gpsLat:           z.number().optional(),
    gpsLng:           z.number().optional(),
    photoStorageKeys: z.array(z.string()).optional(),
  }))
  .mutation(async ({ ctx, input }) => {
    requireCompanyRole(ctx.companyMembership, 'supervisor');
    const db = await getDb();
    if (!db) throw dbUnavailable();

    const [current] = await db.select().from(materialDeliveries)
      .where(and(eq(materialDeliveries.id, input.id), eq(materialDeliveries.companyId, input.companyId)))
      .limit(1);
    if (!current) throw new TRPCError({ code: 'NOT_FOUND', message: 'Delivery not found.' });
    assertTransition(current.status as MaterialDeliveryStatus, 'rejected');

    const set: Record<string, unknown> = {
      status:          'rejected',
      rejectionReason: input.rejectionReason,
      deliveredAt:     input.deliveredAt ? new Date(input.deliveredAt) : new Date(),
      receivedById:    ctx.user.id,
      updatedAt:       new Date(),
    };
    if (input.notes            !== undefined) set.notes            = input.notes;
    if (input.gpsLat           !== undefined) set.gpsLat           = String(input.gpsLat);
    if (input.gpsLng           !== undefined) set.gpsLng           = String(input.gpsLng);
    if (input.photoStorageKeys !== undefined) set.photoStorageKeys = input.photoStorageKeys;

    const [row] = await db.update(materialDeliveries)
      .set(set)
      .where(and(eq(materialDeliveries.id, input.id), eq(materialDeliveries.companyId, input.companyId)))
      .returning();

    const RECIPIENT_ROLES = ['manager', 'company_admin', 'super_admin'] as const;
    const memberships = await db.select().from(companyUsers).where(and(
      eq(companyUsers.companyId, input.companyId),
      eq(companyUsers.isActive, true),
    ));
    const recipientIds = memberships
      .filter(m => RECIPIENT_ROLES.includes(m.companyRole as any))
      .map(m => m.userId);
    if (recipientIds.length > 0) {
      void sendPushToUsers(recipientIds, 'delivery_rejected', {
        deliveryId:      row.id,
        supplierName:    row.supplierName,
        rejectionReason: row.rejectionReason,
      }).catch(err => console.error('[materials.markRejected] push failed:', err));
    }

    return row;
  }),
```

- [ ] **Step 4: Re-run tests**

```bash
pnpm test -- tests/materials-router.test.ts
pnpm check
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/routers/materials.ts tests/materials-router.test.ts
git commit -m "feat(materials): markRejected + delivery_rejected push"
```

---

## Task 10: `materials.cancelDelivery`

Office-only. No push fires (cancel is internal).

**Files:**
- Modify: `server/routers/materials.ts`
- Modify: `tests/materials-router.test.ts`

- [ ] **Step 1: Failing tests**

Append:

```ts
describe('materials.cancelDelivery', () => {
  beforeEach(() => {
    dbCalls.materialDeliveriesSelectReturn = [{ id: 42, companyId: 1, status: 'expected' }];
  });

  it('transitions expected→cancelled, persists optional cancellationReason', async () => {
    const caller = appRouter.createCaller(baseCtx);
    await caller.materials.cancelDelivery({ companyId: 1, id: 42, cancellationReason: 'Supplier strike' });
    const upd = dbCalls.updates.find(u => u.table === 'material_deliveries')!;
    expect(upd.values.status).toBe('cancelled');
    expect(upd.values.cancellationReason).toBe('Supplier strike');
  });

  it('rejects FORBIDDEN when caller role < manager', async () => {
    dbCalls.companyUsersReturn = [{ companyRole: 'supervisor', isActive: true }];
    const caller = appRouter.createCaller(baseCtx);
    await expect(caller.materials.cancelDelivery({ companyId: 1, id: 42 }))
      .rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('does NOT call sendPushToUsers', async () => {
    (sendPushToUsers as any).mockClear?.();
    const caller = appRouter.createCaller(baseCtx);
    await caller.materials.cancelDelivery({ companyId: 1, id: 42 });
    expect(sendPushToUsers).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to fail**

```bash
pnpm test -- tests/materials-router.test.ts
```

- [ ] **Step 3: Implement `cancelDelivery`**

Add to `materialsRouter`:

```ts
cancelDelivery: companyScopedProcedure
  .input(z.object({
    companyId:          z.number(),
    id:                 z.number(),
    cancellationReason: z.string().optional(),
  }))
  .mutation(async ({ ctx, input }) => {
    requireCompanyRole(ctx.companyMembership, 'manager');
    const db = await getDb();
    if (!db) throw dbUnavailable();

    const [current] = await db.select().from(materialDeliveries)
      .where(and(eq(materialDeliveries.id, input.id), eq(materialDeliveries.companyId, input.companyId)))
      .limit(1);
    if (!current) throw new TRPCError({ code: 'NOT_FOUND', message: 'Delivery not found.' });
    assertTransition(current.status as MaterialDeliveryStatus, 'cancelled');

    const set: Record<string, unknown> = { status: 'cancelled', updatedAt: new Date() };
    if (input.cancellationReason !== undefined) set.cancellationReason = input.cancellationReason;

    const [row] = await db.update(materialDeliveries)
      .set(set)
      .where(and(eq(materialDeliveries.id, input.id), eq(materialDeliveries.companyId, input.companyId)))
      .returning();
    return row;
  }),
```

- [ ] **Step 4: Re-run tests**

```bash
pnpm test -- tests/materials-router.test.ts
pnpm check
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/routers/materials.ts tests/materials-router.test.ts
git commit -m "feat(materials): cancelDelivery procedure"
```

---

## Task 11: `materials.update` with `baseSnapshot` conflict integration

Mirrors `rfis.update` from Phase 3.7. Without `baseSnapshot`, the procedure does a sparse online update (with `assertTransition` on any `status` change). With `baseSnapshot`, it opens a transaction with `SELECT FOR UPDATE`, runs `detectFieldConflicts`, and either applies, parks a `conflict_pending` row, or returns `row_deleted`.

**Files:**
- Modify: `server/routers/materials.ts`
- Create: `tests/materials-conflict-detection.test.ts`
- Modify: `tests/materials-router.test.ts` (no-snapshot path tests)

- [ ] **Step 1: Failing tests for the no-snapshot path**

Append to `tests/materials-router.test.ts`:

```ts
describe('materials.update (no baseSnapshot)', () => {
  beforeEach(() => {
    dbCalls.materialDeliveriesSelectReturn = [{ id: 42, companyId: 1, status: 'expected' }];
  });

  it('writes only present fields (sparse SET); strips id / companyId; sets updatedAt', async () => {
    const caller = appRouter.createCaller(baseCtx);
    await caller.materials.update({
      companyId: 1, id: 42, notes: 'Gate code 4321', supplierName: 'Travis',
    });
    const upd = dbCalls.updates.find(u => u.table === 'material_deliveries')!;
    expect(upd.values.notes).toBe('Gate code 4321');
    expect(upd.values.supplierName).toBe('Travis');
    expect(upd.values.materialDescription).toBeUndefined();
    expect(upd.values.id).toBeUndefined();
    expect(upd.values.companyId).toBeUndefined();
    expect(upd.values.updatedAt).toBeInstanceOf(Date);
  });

  it('runs assertTransition when status changes (delivered→expected is illegal)', async () => {
    dbCalls.materialDeliveriesSelectReturn = [{ id: 42, companyId: 1, status: 'delivered' }];
    const caller = appRouter.createCaller(baseCtx);
    await expect(caller.materials.update({ companyId: 1, id: 42, status: 'expected' }))
      .rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});
```

- [ ] **Step 2: Failing tests for the baseSnapshot path**

Create `tests/materials-conflict-detection.test.ts` — mirror the structure of `tests/sync-conflict-detector.test.ts` but exercising `materials.update` end-to-end through the router caller. Tests to write (~6):

```ts
import { describe, expect, it, beforeEach, vi } from 'vitest';
// (Full mock setup as in tests/materials-router.test.ts.)
import { appRouter } from '../server/routers';

describe('materials.update with baseSnapshot', () => {
  const SNAPSHOT_AT = '2026-05-07T10:00:00.000Z';

  it('returns success when no field has moved (ok branch)', async () => {
    dbCalls.materialDeliveriesSelectReturn = [{
      id: 42, companyId: 1, status: 'expected',
      notes: 'A', supplierName: 'X',
      updatedAt: new Date(SNAPSHOT_AT),
    }];
    const caller = appRouter.createCaller(baseCtx);
    const result = await caller.materials.update({
      companyId: 1, id: 42, notes: 'B',
      baseSnapshot: { updatedAt: SNAPSHOT_AT, originalValues: { notes: 'A' } },
    });
    expect(result).toMatchObject({ id: 42 });
  });

  it('parks conflict_pending when same field moved on server (conflict branch)', async () => {
    dbCalls.materialDeliveriesSelectReturn = [{
      id: 42, companyId: 1, status: 'expected',
      notes: 'C', // server moved A → C
      updatedAt: new Date('2026-05-07T11:00:00Z'),
    }];
    const caller = appRouter.createCaller(baseCtx);
    const result = await caller.materials.update({
      companyId: 1, id: 42, notes: 'B', // user wants A → B
      baseSnapshot: { updatedAt: SNAPSHOT_AT, originalValues: { notes: 'A' } },
    });
    expect(result).toMatchObject({ status: 'conflict', fields: ['notes'] });
    const ins = dbCalls.inserts.find(i => i.table === 'conflict_pending')!;
    expect(ins.values.tableName).toBe('materials');
    expect(ins.values.rowId).toBe(42);
  });

  it('returns row_deleted when row is gone', async () => {
    dbCalls.materialDeliveriesSelectReturn = [];
    const caller = appRouter.createCaller(baseCtx);
    const result = await caller.materials.update({
      companyId: 1, id: 42, notes: 'B',
      baseSnapshot: { updatedAt: SNAPSHOT_AT, originalValues: { notes: 'A' } },
    });
    expect(result).toMatchObject({ status: 'row_deleted' });
  });

  it('atomic field conflict: expectedAt change → conflict', async () => {
    dbCalls.materialDeliveriesSelectReturn = [{
      id: 42, companyId: 1, status: 'expected',
      expectedAt: new Date('2026-05-09T14:00:00Z'),
    }];
    const caller = appRouter.createCaller(baseCtx);
    const result = await caller.materials.update({
      companyId: 1, id: 42, expectedAt: '2026-05-08T16:00:00Z',
      baseSnapshot: {
        updatedAt: SNAPSHOT_AT,
        originalValues: { expectedAt: '2026-05-08T14:00:00.000Z' },
      },
    });
    expect(result).toMatchObject({ status: 'conflict', fields: ['expectedAt'] });
  });

  it('disjoint edits auto-merge (different fields → ok)', async () => {
    dbCalls.materialDeliveriesSelectReturn = [{
      id: 42, companyId: 1, status: 'expected',
      notes: 'A',
      supplierName: 'Y', // server changed supplierName X→Y
    }];
    const caller = appRouter.createCaller(baseCtx);
    const result = await caller.materials.update({
      companyId: 1, id: 42, notes: 'B', // user changed notes A→B (different field)
      baseSnapshot: {
        updatedAt: SNAPSHOT_AT,
        originalValues: { notes: 'A', supplierName: 'X' },
      },
    });
    expect(result).toMatchObject({ id: 42 });
  });
});
```

- [ ] **Step 3: Run both test files to fail**

```bash
pnpm test -- tests/materials-router.test.ts tests/materials-conflict-detection.test.ts
```

- [ ] **Step 4: Implement `update`**

Add to `materialsRouter`. The shape mirrors `rfis.update` (`server/routers/index.ts:2343-2422`) closely; if anything's unclear, read that procedure first.

```ts
update: companyScopedProcedure
  .input(z.object({
    companyId:           z.number(),
    id:                  z.number(),
    supplierName:        z.string().min(1).optional(),
    materialDescription: z.string().min(1).optional(),
    expectedAt:          z.string().optional(),
    deliveredAt:         z.string().nullable().optional(),
    status:              z.enum(STATUS).optional(),
    notes:               z.string().nullable().optional(),
    gpsLat:              z.number().nullable().optional(),
    gpsLng:              z.number().nullable().optional(),
    rejectionReason:     z.string().nullable().optional(),
    cancellationReason:  z.string().nullable().optional(),
    baseSnapshot: z.object({
      updatedAt:      z.string(),
      originalValues: z.record(z.string(), z.unknown()),
    }).optional(),
  }))
  .mutation(async ({ ctx, input }) => {
    requireCompanyRole(ctx.companyMembership, 'supervisor');
    const db = await getDb();
    if (!db) throw dbUnavailable();
    const { companyId, id, baseSnapshot, ...rest } = input;

    // Build the user-payload sparsely. Only fields explicitly present go in.
    const userPayload: Record<string, unknown> = {};
    for (const k of Object.keys(rest) as (keyof typeof rest)[]) {
      if (rest[k] === undefined) continue;
      const v = rest[k];
      if (k === 'expectedAt' || k === 'deliveredAt') {
        userPayload[k] = v === null ? null : new Date(v as string);
      } else if (k === 'gpsLat' || k === 'gpsLng') {
        userPayload[k] = v === null ? null : String(v);
      } else {
        userPayload[k] = v;
      }
    }

    if (baseSnapshot) {
      return await db.transaction(async (tx) => {
        const rows = await tx.select().from(materialDeliveries)
          .where(and(eq(materialDeliveries.id, id), eq(materialDeliveries.companyId, companyId)))
          .limit(1)
          .for('update');
        const currentRow = rows[0] ?? null;

        const detection = detectFieldConflicts(
          currentRow,
          baseSnapshot.updatedAt,
          userPayload,
          baseSnapshot.originalValues,
        );

        if (detection.kind === 'row_deleted') {
          return { status: 'row_deleted' as const };
        }
        if (detection.kind === 'conflict') {
          const minePicked: Record<string, unknown> = {};
          for (const f of detection.fields) {
            if (f in userPayload) minePicked[f] = userPayload[f];
          }
          const [inserted] = await tx.insert(conflictPending).values({
            companyId,
            userId:           ctx.user.id,
            tableName:        'materials',
            rowId:            id,
            conflictFields:   detection.fields,
            mineValues:       minePicked,
            theirsValues:     detection.theirsValues,
            baseUpdatedAt:    new Date(baseSnapshot.updatedAt),
          }).returning({ id: conflictPending.id });
          return { status: 'conflict' as const, conflictId: inserted.id, fields: detection.fields };
        }

        // ok — apply
        if (userPayload.status !== undefined) {
          assertTransition(
            currentRow!.status as MaterialDeliveryStatus,
            userPayload.status as MaterialDeliveryStatus,
          );
        }
        const [row] = await tx.update(materialDeliveries)
          .set({ ...userPayload, updatedAt: new Date() })
          .where(and(eq(materialDeliveries.id, id), eq(materialDeliveries.companyId, companyId)))
          .returning();
        return row;
      });
    }

    // Online path — no snapshot.
    if (userPayload.status !== undefined) {
      const [current] = await db.select().from(materialDeliveries)
        .where(and(eq(materialDeliveries.id, id), eq(materialDeliveries.companyId, companyId)))
        .limit(1);
      if (!current) throw new TRPCError({ code: 'NOT_FOUND', message: 'Delivery not found.' });
      assertTransition(
        current.status as MaterialDeliveryStatus,
        userPayload.status as MaterialDeliveryStatus,
      );
    }
    const [row] = await db.update(materialDeliveries)
      .set({ ...userPayload, updatedAt: new Date() })
      .where(and(eq(materialDeliveries.id, id), eq(materialDeliveries.companyId, companyId)))
      .returning();
    return row;
  }),
```

- [ ] **Step 5: Run all tests**

```bash
pnpm test
pnpm check
```

Expected: PASS — including `tests/conflict-registry-coverage.test.ts` (proves Task 5's registry is consistent with this procedure's editable-field set) and `tests/tenant-isolation.test.ts` (proves no `PROTECTED_TENANT_GAPS` regression).

- [ ] **Step 6: Commit**

```bash
git add server/routers/materials.ts tests/materials-router.test.ts tests/materials-conflict-detection.test.ts
git commit -m "feat(materials): update procedure with baseSnapshot conflict detection"
```

---

## Task 12: `<DeliveryStatusPill>` component

Tiny presentational component. Mirrors `components/rfi-status-pill.tsx`.

**Files:**
- Create: `components/delivery-status-pill.tsx`
- Test: `tests/delivery-status-pill.component.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react-native';
import { DeliveryStatusPill } from '../components/delivery-status-pill';

describe('<DeliveryStatusPill>', () => {
  it.each([
    ['expected',  'Expected'],
    ['delivered', 'Delivered'],
    ['rejected',  'Rejected'],
    ['cancelled', 'Cancelled'],
  ] as const)('renders the right label for %s', (status, label) => {
    const { getByText } = render(<DeliveryStatusPill status={status} />);
    expect(getByText(label)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to fail**

```bash
pnpm test -- tests/delivery-status-pill.component.test.tsx
```

- [ ] **Step 3: Implement**

```tsx
// components/delivery-status-pill.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

type Status = 'expected' | 'delivered' | 'rejected' | 'cancelled';

const CFG: Record<Status, { bg: string; fg: string; label: string }> = {
  expected:  { bg: '#DBEAFE', fg: '#1D4ED8', label: 'Expected' },
  delivered: { bg: '#DCFCE7', fg: '#15803D', label: 'Delivered' },
  rejected:  { bg: '#FEE2E2', fg: '#B91C1C', label: 'Rejected' },
  cancelled: { bg: '#E5E7EB', fg: '#374151', label: 'Cancelled' },
};

export function DeliveryStatusPill({ status }: { status: Status }) {
  const cfg = CFG[status];
  return (
    <View style={[s.pill, { backgroundColor: cfg.bg }]}>
      <Text style={[s.text, { color: cfg.fg }]}>{cfg.label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start' },
  text: { fontSize: 12, fontWeight: '700' },
});
```

- [ ] **Step 4: Run to pass**

```bash
pnpm test -- tests/delivery-status-pill.component.test.tsx
pnpm check
```

- [ ] **Step 5: Commit**

```bash
git add components/delivery-status-pill.tsx tests/delivery-status-pill.component.test.tsx
git commit -m "feat(materials): DeliveryStatusPill component"
```

---

## Task 13: `app/materials.tsx` — agenda screen + detail modal

Main client screen. Fetches via `trpc.materials.list`, groups via `groupDeliveriesByDay` (Task 3), renders sections, opens a detail modal on tap. Edit / mark-delivered / mark-rejected sheets ship in Tasks 14-15 — this task gets the read-side working end-to-end.

**Files:**
- Create: `app/materials.tsx`

- [ ] **Step 1: Implement the screen (read-side only)**

Mirror the structure of `app/rfis.tsx` for header / filter chips / FlatList / detail modal — but render section headers and use the agenda grouping helper. Reference everything as it would actually be imported:

```tsx
import React, { useMemo, useState } from 'react';
import { View, Text, FlatList, Modal, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { trpc } from '@/lib/trpc';
import { useCompany } from '@/lib/company-context';
import { DeliveryStatusPill } from '@/components/delivery-status-pill';
import {
  groupDeliveriesByDay,
  visibleMaterialDeliveryActions,
  type MaterialDeliveryStatus,
} from '@/lib/material-delivery-actions';

type FilterStatus = 'all' | MaterialDeliveryStatus;

export default function MaterialsScreen() {
  const colors = useColors();
  const { currentCompany, currentUser, can } = useCompany();
  const companyId = currentCompany?.id ?? 1;
  const role = currentUser?.role ?? null;

  const listQuery = trpc.materials.list.useQuery({ companyId }, { retry: 1, staleTime: 30_000 });
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [selected, setSelected] = useState<any | null>(null);
  // The mark-delivered / mark-rejected / edit sheets land in subsequent tasks.

  const groups = useMemo(() => {
    const rows = (listQuery.data ?? []).filter(r => filter === 'all' ? true : r.status === filter);
    return groupDeliveriesByDay(rows as any, new Date().toISOString());
  }, [listQuery.data, filter]);

  return (
    <ScreenContainer edges={['top','left','right']}>
      <View style={[s.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={{ padding: 4 }}>
          <IconSymbol name="chevron.left" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={[s.title, { color: colors.foreground }]}>Materials</Text>
        {can('manager') && (
          <Pressable style={[s.btn, { backgroundColor: '#1E3A5F' }]} onPress={() => { /* open create sheet — Task 14 */ }}>
            <Text style={s.btnText}>+ Schedule</Text>
          </Pressable>
        )}
      </View>
      <View style={[s.filterBar, { borderBottomColor: colors.border }]}>
        {(['all','expected','delivered','rejected','cancelled'] as const).map(f => (
          <Pressable key={f} onPress={() => setFilter(f)}
            style={[s.pill, filter === f && { backgroundColor: '#1E3A5F' }]}>
            <Text style={{ color: filter === f ? '#fff' : colors.muted, fontSize: 13, fontWeight: '600' }}>
              {f === 'all' ? 'All' : f[0].toUpperCase() + f.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>
      <FlatList
        data={groups}
        keyExtractor={g => g.dayIso}
        contentContainerStyle={{ padding: 12, gap: 16 }}
        ListHeaderComponent={listQuery.isLoading ? <ActivityIndicator color={colors.primary} /> : null}
        ListEmptyComponent={!listQuery.isLoading ? (
          <Text style={{ color: colors.muted, textAlign: 'center', padding: 32 }}>No deliveries.</Text>
        ) : null}
        renderItem={({ item: group }) => {
          const isPast = group.dayIso < new Date().toISOString().slice(0, 10);
          return (
            <View style={{ opacity: isPast ? 0.65 : 1 }}>
              <Text style={[s.section, { color: colors.foreground }]}>
                {formatSectionHeader(group.dayDate)}  ·  {group.rows.length}
              </Text>
              {group.rows.map(row => (
                <Pressable key={row.id} onPress={() => setSelected(row)}
                  style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Text style={[s.cardTime, { color: colors.muted }]}>
                      {new Date(row.expectedAt).toISOString().slice(11, 16)}
                    </Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.cardTitle, { color: colors.foreground }]} numberOfLines={1}>{row.supplierName}</Text>
                      <Text style={[s.cardSub,   { color: colors.muted     }]} numberOfLines={1}>{row.materialDescription}</Text>
                    </View>
                    <DeliveryStatusPill status={row.status} />
                  </View>
                  {row.isOverdue && (
                    <Text style={{ color: '#B91C1C', fontWeight: '700', fontSize: 11, marginTop: 6 }}>OVERDUE</Text>
                  )}
                </Pressable>
              ))}
            </View>
          );
        }}
      />
      <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelected(null)}>
        {selected && (
          <View style={[s.modal, { backgroundColor: colors.background }]}>
            <View style={[s.modalHead, { borderBottomColor: colors.border }]}>
              <Text style={[s.title, { color: colors.foreground, flex: 1 }]}>
                {selected.supplierName}
              </Text>
              <Pressable onPress={() => setSelected(null)}>
                <IconSymbol name="xmark.circle.fill" size={28} color={colors.muted} />
              </Pressable>
            </View>
            {/* Detail body + action buttons land in Tasks 14-15 */}
          </View>
        )}
      </Modal>
    </ScreenContainer>
  );
}

function formatSectionHeader(d: Date): string {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dayMs = d.getTime();
  const todayMs = today.getTime();
  if (dayMs === todayMs)            return `TODAY · ${d.toUTCString().slice(0, 11)}`;
  if (dayMs === todayMs + 86400000) return `TOMORROW · ${d.toUTCString().slice(0, 11)}`;
  if (dayMs === todayMs - 86400000) return `YESTERDAY · ${d.toUTCString().slice(0, 11)}`;
  return d.toUTCString().slice(0, 11).toUpperCase();
}

const s = StyleSheet.create({
  header:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0.5, gap: 12 },
  title:      { flex: 1, fontSize: 18, fontWeight: '700' },
  btn:        { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  btnText:    { color: '#fff', fontWeight: '700', fontSize: 13 },
  filterBar:  { flexDirection: 'row', gap: 8, padding: 12, borderBottomWidth: 0.5 },
  pill:       { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#F3F4F6' },
  section:    { fontSize: 12, fontWeight: '700', marginBottom: 6, letterSpacing: 0.5 },
  card:       { borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 8 },
  cardTime:   { fontSize: 12, fontWeight: '700', width: 44 },
  cardTitle:  { fontSize: 14, fontWeight: '700' },
  cardSub:    { fontSize: 12, marginTop: 2 },
  modal:      { flex: 1 },
  modalHead:  { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 0.5, gap: 12 },
});
```

- [ ] **Step 2: Typecheck + smoke test compile**

```bash
pnpm check
pnpm test
```

Expected: tsc clean. No new tests fail (existing 1090ish tests still green; this is a UI-only file with no server-side test).

- [ ] **Step 3: Commit**

```bash
git add app/materials.tsx
git commit -m "feat(materials): agenda screen with grouped sections + detail modal scaffold"
```

---

## Task 14: Schedule + mark-delivered + mark-rejected sheets (with offline branches)

Three modal-content blocks added to the screen. Each branches on `useSyncQueue().status` — online calls the mutation directly (with photos uploaded first via `manus-storage`); offline enqueues a payload-only call.

**Files:**
- Modify: `app/materials.tsx`

- [ ] **Step 1: Verify the storage upload procedure name**

The spec § 6.5 left this as a "verify in plan" tag. Run:

```bash
grep -nE "storagePut|files\.upload|photo\.upload|trpc\..*\.upload" server/routers/index.ts server/routers/files.ts app/photo-ai.tsx app/receipt-scanner.tsx 2>/dev/null | head
```

Use whichever tRPC procedure or REST endpoint these existing screens use to send a captured photo to `manus-storage`. If none exists at the tRPC layer, use the existing `/manus-storage/<key>` REST proxy directly per `server/storage.ts`.

- [ ] **Step 2: Add useSyncQueue + state for the three sheets**

In `app/materials.tsx` near the top of `MaterialsScreen`, add:

```tsx
import { useSyncQueue } from '@/lib/sync-queue';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Alert, TextInput, ScrollView } from 'react-native';

const { status: syncStatus, enqueue } = useSyncQueue();

const [showSchedule,   setShowSchedule]   = useState(false);
const [showDeliver,    setShowDeliver]    = useState<null | typeof selected>(null);
const [showReject,     setShowReject]     = useState<null | typeof selected>(null);

const utils = trpc.useUtils();
const expectMutation  = trpc.materials.expectDelivery.useMutation({
  onSuccess: () => utils.materials.list.invalidate(),
});
const deliverMutation = trpc.materials.markDelivered.useMutation({
  onSuccess: () => utils.materials.list.invalidate(),
});
const rejectMutation  = trpc.materials.markRejected.useMutation({
  onSuccess: () => utils.materials.list.invalidate(),
});

async function captureGps(): Promise<{ lat?: number; lng?: number }> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return {};
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    return {};
  }
}

async function pickPhotos(existing: string[]): Promise<string[]> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsMultipleSelection: true,
    quality: 0.7,
  });
  if (result.canceled) return existing;
  // For each picked asset, upload to manus-storage and collect keys.
  // Use whichever upload path Step 1 identified — example shape:
  const keys: string[] = [...existing];
  for (const a of result.assets) {
    const key = await uploadAssetToManusStorage(a); // wire per Step 1's finding
    keys.push(key);
  }
  return keys;
}
```

- [ ] **Step 3: Add the Schedule sheet**

Add a `<Modal visible={showSchedule}>` block near the existing detail modal, with form state for `projectId, supplierName, materialDescription, expectedAt, notes`. Submit handler:

```tsx
async function submitSchedule() {
  if (!form.supplierName.trim() || !form.materialDescription.trim() || !form.expectedAt) {
    Alert.alert('Missing details', 'Supplier, description, and expected date are required.');
    return;
  }
  if (syncStatus !== 'online') {
    Alert.alert('Offline', 'Scheduling deliveries requires a connection.');
    return;
  }
  await expectMutation.mutateAsync({
    companyId, projectId: Number(form.projectId),
    supplierName:        form.supplierName.trim(),
    materialDescription: form.materialDescription.trim(),
    expectedAt:          new Date(form.expectedAt).toISOString(),
    notes:               form.notes.trim() || undefined,
  });
  setShowSchedule(false);
}
```

- [ ] **Step 4: Add the Mark-Delivered sheet**

State: `notes, photoKeys` (online only), GPS captured on sheet open. Submit:

```tsx
async function submitDelivered(row: NonNullable<typeof showDeliver>) {
  const { lat, lng } = await captureGps();
  const payload = {
    companyId, id: row.id,
    deliveredAt: new Date().toISOString(),
    notes: deliverNotes.trim() || undefined,
    gpsLat: lat, gpsLng: lng,
    ...(syncStatus === 'online' && photoKeys.length > 0 ? { photoStorageKeys: photoKeys } : {}),
  };
  if (syncStatus !== 'online') {
    await enqueue('materials.markDelivered', payload);
    Alert.alert('Saved offline', 'Will sync when back online.');
  } else {
    await deliverMutation.mutateAsync(payload);
  }
  setShowDeliver(null);
}
```

The "Add photo" button in the sheet checks `syncStatus !== 'online'` and shows a toast `"Photos can be added when online"` instead of opening the picker.

- [ ] **Step 5: Add the Mark-Rejected sheet**

Same shape as Mark-Delivered but with a required `rejectionReason` textarea. Submit short-circuits if reason is empty. Calls `materials.markRejected` (online) or `enqueue('materials.markRejected', payload)` (offline).

- [ ] **Step 6: Wire the action buttons in the detail modal**

Inside the existing `<Modal visible={!!selected}>`, after the head, render the action buttons gated by `visibleMaterialDeliveryActions(selected.status, role)`:

```tsx
{(() => {
  const actions = visibleMaterialDeliveryActions(selected.status, role);
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
      {/* delivery details (supplier, description, expectedAt, deliveredAt, notes, gps, photos) */}
      <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
        {actions.markDelivered && (
          <Pressable style={[s.btn, { backgroundColor: '#16A34A' }]}
            onPress={() => { setShowDeliver(selected); setSelected(null); }}>
            <Text style={s.btnText}>Mark Delivered</Text>
          </Pressable>
        )}
        {actions.markRejected && (
          <Pressable style={[s.btn, { backgroundColor: '#DC2626' }]}
            onPress={() => { setShowReject(selected); setSelected(null); }}>
            <Text style={s.btnText}>Mark Rejected</Text>
          </Pressable>
        )}
        {actions.cancel && (
          <Pressable style={[s.btn, { backgroundColor: '#6B7280' }]}
            onPress={async () => {
              if (syncStatus !== 'online') {
                await enqueue('materials.cancelDelivery', { companyId, id: selected.id });
              } else {
                await trpc.materials.cancelDelivery.mutate({ companyId, id: selected.id });
                utils.materials.list.invalidate();
              }
              setSelected(null);
            }}>
            <Text style={s.btnText}>Cancel</Text>
          </Pressable>
        )}
        {/* Edit button lands in Task 15 */}
      </View>
    </ScrollView>
  );
})()}
```

- [ ] **Step 7: Typecheck + smoke**

```bash
pnpm check
pnpm test
```

Expected: tsc clean. All existing tests still pass.

- [ ] **Step 8: Commit**

```bash
git add app/materials.tsx
git commit -m "feat(materials): schedule + mark delivered/rejected sheets with offline branches"
```

---

## Task 15: Edit modal with `baseSnapshot` capture

Mirrors Phase 3.7 Task 14 (commit `1cf89d6`) — snapshot frozen at modal-open, embedded in payload only on the offline path.

**Files:**
- Modify: `app/materials.tsx`

- [ ] **Step 1: Add the edit-modal state + snapshot ref**

```tsx
const [editing, setEditing] = useState<null | typeof selected>(null);
const editSnapshotRef = useRef<{
  updatedAt: string;
  originalValues: Record<string, unknown>;
} | null>(null);

const updateMutation = trpc.materials.update.useMutation({
  onSuccess: () => utils.materials.list.invalidate(),
});

function openEdit(row: NonNullable<typeof selected>) {
  setEditing(row);
  setSelected(null);
  editSnapshotRef.current = {
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
    originalValues: {
      supplierName:        row.supplierName,
      materialDescription: row.materialDescription,
      notes:               row.notes,
      rejectionReason:     row.rejectionReason,
      cancellationReason:  row.cancellationReason,
      expectedAt:          row.expectedAt instanceof Date ? row.expectedAt.toISOString() : row.expectedAt,
      deliveredAt:         row.deliveredAt instanceof Date
        ? row.deliveredAt.toISOString()
        : row.deliveredAt ?? null,
      status:              row.status,
      gpsLat:              row.gpsLat,
      gpsLng:              row.gpsLng,
    },
  };
}

function resetEdit() {
  editSnapshotRef.current = null;
  setEditing(null);
}
```

- [ ] **Step 2: Render the edit modal**

A second `<Modal visible={!!editing}>` containing inputs for the editable fields (text inputs for `supplierName`, `materialDescription`, `notes`, `rejectionReason`, `cancellationReason`; ISO date input for `expectedAt`, `deliveredAt`; status pill picker for `status`).

- [ ] **Step 3: Submit handler with offline-aware snapshot embed**

```tsx
async function submitEdit() {
  if (!editing) return;
  const payload = {
    companyId, id: editing.id,
    supplierName:        form.supplierName.trim() || undefined,
    materialDescription: form.materialDescription.trim() || undefined,
    notes:               form.notes,
    expectedAt:          form.expectedAt || undefined,
    deliveredAt:         form.deliveredAt || undefined,
    status:              form.status,
    rejectionReason:     form.rejectionReason || undefined,
    cancellationReason:  form.cancellationReason || undefined,
    // gpsLat / gpsLng could be added once edit UI exposes them; keeping out for v1.
  };

  if (syncStatus !== 'online' && editSnapshotRef.current) {
    await enqueue('materials.update', { ...payload, baseSnapshot: editSnapshotRef.current });
    resetEdit();
    Alert.alert('Saved offline', 'Will sync when back online.');
    return;
  }

  await updateMutation.mutateAsync(payload);
  resetEdit();
}
```

- [ ] **Step 4: Wire the Edit button in the detail modal**

In the action-button block from Task 14, add (gated by `actions.edit`):

```tsx
{actions.edit && (
  <Pressable style={[s.btn, { backgroundColor: '#1E3A5F' }]} onPress={() => openEdit(selected)}>
    <Text style={s.btnText}>Edit</Text>
  </Pressable>
)}
```

- [ ] **Step 5: Typecheck + tests**

```bash
pnpm check
pnpm test
```

Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add app/materials.tsx
git commit -m "feat(materials): edit modal with baseSnapshot capture for offline conflicts"
```

---

## Task 16: Tile on the Field-Operations grid

Routes the user from the home tab to the materials screen.

**Files:**
- Modify: `app/(tabs)/index.tsx`

- [ ] **Step 1: Locate the Field-Operations grid**

```bash
grep -nE "rfis|Defects|Field" app/(tabs)/index.tsx | head
```

The tile pattern lives near where Defects / RFIs / Permits are rendered. Add a "Materials" tile that pushes `/materials`:

```tsx
{
  key: 'materials',
  label: 'Materials',
  icon: 'shippingbox.fill',
  onPress: () => router.push('/materials'),
}
```

(Use whatever object shape the existing tiles use — copy verbatim from the RFI tile and change `key/label/icon/onPress`.)

- [ ] **Step 2: Typecheck + smoke**

```bash
pnpm check
pnpm test
```

- [ ] **Step 3: Commit**

```bash
git add app/(tabs)/index.tsx
git commit -m "feat(materials): tile on Field-Operations grid"
```

---

## Task 17: Mark ROADMAP § 3.2 ✅ DONE + run final checks + push

Mirrors Phase 3.7 Task 15.

**Files:**
- Modify: `docs/ROADMAP.md`

- [ ] **Step 1: Mark Phase 3.2 in ROADMAP**

Update the row at line ~35 (Phase 3 summary) to add `3.2 ✅`. Update the § 3.2 detail section to ✅ DONE (2026-05-07) with commit SHAs from `git log --oneline | head -25`. Match the shape of how 3.6 / 3.7 are documented. Example:

```markdown
### 3.2 — Materials: delivery tracking ✅ DONE (2026-05-07)

**Tasks:**
1. ✅ `material_deliveries` table + Drizzle schema (commit `<task1>`)
2. ✅ `material-delivery-state-machine.ts` + `material-delivery-actions.ts` (commits `<task2>`, `<task3>`)
3. ✅ `delivery_*` push event types + `materials` conflict-registry entries (commits `<task4>`, `<task5>`)
4. ✅ Six-procedure `server/routers/materials.ts` sub-router (commits `<task6>`–`<task11>`)
5. ✅ `app/materials.tsx` agenda + sheets + edit modal + tile (commits `<task12>`–`<task16>`)

**Acceptance:** Site managers confirm deliveries from phone with photo + GPS (photos online-only); office sees real-time status; offline edits go through the Phase 3.7 conflict-resolution sheet. ✅ Met.

**Tests added:** ~30 (1060 → ~1090). Spec: `docs/superpowers/specs/2026-05-07-materials-delivery-tracking-design.md`. Plan: `docs/superpowers/plans/2026-05-07-materials-delivery-tracking.md`.

**Known limitations / follow-ups:**
- Photo capture is online-only (offline path skips photos).
- `delivery_overdue` push deferred to Phase 3.2.b (needs cron infra).
- Recipient resolution is company-wide for the role; per-project narrowing deferred to Phase 3.2.c (needs `projectMembership` table).
```

- [ ] **Step 2: Final checks**

```bash
pnpm test && pnpm check && pnpm lint
```

Expected: all green.

- [ ] **Step 3: Commit + push**

```bash
git add docs/ROADMAP.md
git commit -m "docs(roadmap): mark Phase 3.2 ✅ DONE"
git push origin main
```

- [ ] **Step 4: Verify production deploy**

GH Actions takes ~5 min to build, deploy to VPS, and PM2-restart. Curl `/api/version` to confirm the new HEAD has flipped:

```bash
curl -fsS https://field.cortexbuildpro.com/api/version
git rev-parse HEAD
```

Smoke-test the Phase 3.2 path manually with two simulators per the spec § 11 acceptance criteria.

---

## Self-review notes

**Spec coverage:** Every section of the spec maps to a task —

| Spec § | Plan task |
|---|---|
| § 4 (data model + state machine) | 1, 2 |
| § 5.1 list | 6 |
| § 5.2 expectDelivery | 7 |
| § 5.3 markDelivered | 8 |
| § 5.4 markRejected | 9 |
| § 5.5 cancelDelivery | 10 |
| § 5.6 update with baseSnapshot | 11 |
| § 6.1–6.3 agenda screen + status pill | 12, 13 |
| § 6.4–6.5 detail + mark sheets + offline | 14 |
| § 6.6 edit modal with snapshot | 15 |
| § 6.2 tile on tabs | 16 |
| § 7 push events registry | 4 |
| § 8 conflict registry | 5 |
| § 9 error handling | covered inline (dbUnavailable, assertTransition, requireCompanyRole, FORBIDDEN guard) |
| § 10 out of scope | covered in Task 17 ROADMAP "Known limitations" |
| § 11 acceptance criteria | covered in Task 17 manual smoke |

**Test count target:** 1060 → ~1090. Server tests: state machine (4), action visibility + agenda grouping (8), notification events (2 new), conflict-registry coverage already pinned, materials-router (`list` 2, `expectDelivery` 3, `markDelivered` 4, `markRejected` 2, `cancelDelivery` 3, `update` no-snapshot 2), materials-conflict-detection (5), DeliveryStatusPill (4). ≈ 39 new server-side or pure-helper tests.

**Push notification dependency:** This plan appends three new event types but does not add cron infra. Phase 3.2.b is the natural home for `delivery_overdue` once a scheduler exists.

**Watch the deploy** after Task 17's push. Production should flip to the new HEAD on `https://field.cortexbuildpro.com/api/version` after ~5 minutes.
