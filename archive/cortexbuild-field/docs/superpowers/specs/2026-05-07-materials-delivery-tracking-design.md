# Phase 3.2 — Materials: delivery tracking

**Status:** Design — pending implementation
**Date:** 2026-05-07
**Roadmap:** `docs/ROADMAP.md` § Phase 3.2
**Acceptance:** Site managers can confirm a delivery from a phone (offline-tolerant for the row + GPS; photos online-only). Office sees real-time status — scheduled, received, rejected, cancelled — in an agenda grouped by day.

---

## 1. Goals

1. Two-step workflow: office schedules an expected delivery; site supervisor confirms (or rejects) on arrival.
2. Offline-tolerant for the on-site mutation: `markDelivered`, `markRejected`, `cancelDelivery`, and `update` enqueue when `syncStatus !== 'online'`. `expectDelivery` is office-only and stays online-only.
3. Photos are online-only — site keeps the metadata + GPS path working with no signal; photos attach when the device is back online.
4. Edits use the Phase 3.7 conflict pattern (`baseSnapshot` + `detectFieldConflicts`) so two correctors don't silently overwrite each other.
5. Three new push events drive the office/site loop: `delivery_expected` → site, `delivery_received` and `delivery_rejected` → office.
6. Single agenda screen (`app/materials.tsx`) grouped by day. No calendar grid library — agenda matches site-user mental model and avoids the heavyweight RN calendar dep.

---

## 2. Decisions table

| Choice | Decision | Why |
|---|---|---|
| **Supplier model** | Free-text `supplierName` (no `suppliers` table) | Smallest scope. Construction site staff log suppliers as text on paper today. A `suppliers` table can extract uniques from this column in a follow-up phase without painting into a corner. |
| **Workflow** | Two-step (office schedules → site confirms) | Matches ROADMAP stub and how the office wants to plan. Ad-hoc unscheduled deliveries are out of scope for v1; site users would create an `expected` row for "now" if needed. |
| **Status set** | `expected \| delivered \| rejected \| cancelled` | "Rejected" deserves its own terminal state (wrong items, damage) — office filters and analytics depend on it. "Overdue" is **derived** in queries (`expectedAt < now AND status='expected'`), never stored. |
| **Granularity** | Single row + free-text `materialDescription` | Line items (per-material rows) doubles the spec for a workflow that today is paper-and-marker. Spec calls out the migration shape so a future `delivery_lines` table doesn't need a destructive change. |
| **Photo capture** | Online-only; offline confirms metadata + GPS only | Photos are 1–3 MB each; AsyncStorage-backed sync queue would bloat fast. Site loses photographic evidence on offline confirms — accepted trade-off. UI surfaces "add when online" affordance. |
| **Edits** | `materials.update` with `baseSnapshot` (full Phase 3.7 conflict integration) | RFIs already use this pattern; not using it for materials would create unexplained inconsistency. The 3.7 banner / list / resolution sheet pick up new field kinds via the registry — zero client changes. |
| **Push events** | `delivery_expected`, `delivery_received`, `delivery_rejected`. `delivery_overdue` deferred to Phase 3.2.b | Overdue requires a cron runner; no scheduler exists in the repo. Rather than ship one as part of materials, defer to a follow-up phase that adds it once and uses it everywhere. |
| **UI shape** | Agenda list grouped by day | Mobile-friendly, no calendar grid library, matches "today vs upcoming" thinking site staff actually use. |
| **State machine** | Forward + correction edges only via `assertTransition` (not arbitrary `status` writes) | Mirrors `lib/rfi-actions.ts` discipline — keeps state-transition logic out of free-form `update`. The `update` mutation rejects payloads that try to change `status` to something `assertTransition` disallows. |
| **Tenant gating** | All six procedures `companyScopedProcedure` | No `PROTECTED_TENANT_GAPS` addition needed. Cross-tenant FK guard on `expectDelivery` (project-belongs-to-company) mirrors `rfis.create`. |
| **Module placement** | New `server/routers/materials.ts` sub-router | `server/routers/index.ts` is already 2400+ lines. CLAUDE.md's stated pattern is sub-routers under `server/routers/`. |

---

## 3. Architecture

```
app/(tabs)/index.tsx ── tile ──▶ app/materials.tsx           // agenda + inline modals
                                       │
                                       ├─ trpc.materials.list           ──▶ server/routers/materials.ts
                                       ├─ trpc.materials.expectDelivery ──▶
                                       ├─ trpc.materials.markDelivered  ──▶  (or enqueue when offline)
                                       ├─ trpc.materials.markRejected   ──▶  (or enqueue when offline)
                                       ├─ trpc.materials.cancelDelivery ──▶  (or enqueue when offline)
                                       └─ trpc.materials.update         ──▶  (or enqueue with baseSnapshot when offline)

server/routers/materials.ts
  ├─ list           companyScopedProcedure
  ├─ expectDelivery companyScopedProcedure  → fires push: delivery_expected
  ├─ markDelivered  companyScopedProcedure  → fires push: delivery_received
  ├─ markRejected   companyScopedProcedure  → fires push: delivery_rejected
  ├─ cancelDelivery companyScopedProcedure
  └─ update         companyScopedProcedure  ← runs detectFieldConflicts when baseSnapshot present

shared/conflict-field-kinds.ts  ← append materials field kinds (10 fields, mix of atomic + text)
shared/notification-events.ts   ← append delivery_expected, delivery_received, delivery_rejected
lib/material-delivery-actions.ts ← visibleActions(status, role) + assertTransition
```

The replay path for offline mutations is unchanged from Phase 3.7 — `lib/sync-queue.tsx` already routes `enqueue(type, payload)` calls through `/api/trpc/sync.replay`, which dispatches by `type` to the relevant procedure. New procedures are picked up automatically by the dispatcher (no changes to `sync-queue.tsx`).

---

## 4. Data model

**Migration:** `drizzle/0013_material_deliveries.sql` + matching `_journal.json` entry.

```sql
CREATE TABLE material_deliveries (
  id                    SERIAL PRIMARY KEY,
  company_id            INTEGER NOT NULL REFERENCES companies(id),
  project_id            INTEGER NOT NULL REFERENCES projects(id),
  supplier_name         VARCHAR(255) NOT NULL,
  material_description  TEXT NOT NULL,
  expected_at           TIMESTAMP NOT NULL,
  delivered_at          TIMESTAMP,
  status                VARCHAR(20) NOT NULL DEFAULT 'expected',
  rejection_reason      TEXT,
  cancellation_reason   TEXT,
  notes                 TEXT,
  gps_lat               DECIMAL(9,6),
  gps_lng               DECIMAL(9,6),
  photo_storage_keys    TEXT[] NOT NULL DEFAULT '{}',
  created_by_id         INTEGER NOT NULL REFERENCES users(id),
  received_by_id        INTEGER REFERENCES users(id),
  created_at            TIMESTAMP NOT NULL DEFAULT now(),
  updated_at            TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_material_deliveries_agenda
  ON material_deliveries (company_id, project_id, expected_at);
CREATE INDEX idx_material_deliveries_status
  ON material_deliveries (company_id, status);
CREATE INDEX idx_material_deliveries_delivered
  ON material_deliveries (company_id, delivered_at)
  WHERE delivered_at IS NOT NULL;
```

**Drizzle table** (`drizzle/schema.ts`) mirrors the SQL with proper typed enums and the `MaterialDeliveryStatus` literal-union export.

**State machine** (enforced by `assertTransition` in `lib/material-delivery-actions.ts`):

| From | To | Allowed | Mutation |
|------|----|---------|----------|
| `(none)` | `expected` | always | `expectDelivery` |
| `expected` | `delivered` | always | `markDelivered` |
| `expected` | `rejected` | always (reason required) | `markRejected` |
| `expected` | `cancelled` | always | `cancelDelivery` |
| `delivered` | `rejected` | always | `update` (status field) |
| `rejected` | `delivered` | always | `update` (status field) |
| `cancelled` | `expected` | always (undo) | `update` (status field) |
| any other | any other | rejected | — |

**Role gates:**

| Procedure | Role required |
|-----------|---------------|
| `list` | `viewer+` (any company member) |
| `expectDelivery` | `manager+` |
| `cancelDelivery` | `manager+` |
| `markDelivered` | `supervisor+` |
| `markRejected` | `supervisor+` |
| `update` | `supervisor+` |

Role checks use `requireCompanyRole(ctx.companyMembership, '<role>')` (existing helper).

---

## 5. Server contract

### 5.1 `materials.list`

```ts
input:  { companyId: number, projectId?: number, status?: MaterialDeliveryStatus,
          fromDate?: string /* ISO */, toDate?: string /* ISO */ }
output: MaterialDelivery[]   // ordered by expectedAt ASC
```

No role check beyond `companyScopedProcedure`. Used by both the agenda screen and the conflict resolution sheet.

### 5.2 `materials.expectDelivery`

```ts
input:  { companyId: number, projectId: number,
          supplierName: string /* min 1 */, materialDescription: string /* min 1 */,
          expectedAt: string /* ISO */, notes?: string }
output: MaterialDelivery
```

Steps:
1. `requireCompanyRole(ctx.companyMembership, 'manager')`.
2. Cross-tenant FK guard: `SELECT id FROM projects WHERE id = ? AND company_id = ?` — `FORBIDDEN` if not found (mirrors `rfis.create`).
3. `INSERT … RETURNING *` with `created_by_id = ctx.user.id`, `status = 'expected'`.
4. Resolve push recipients: company members with role ≥ `supervisor` (in v1, scoped to company — no `projectMembership` table exists yet; plan calls this out so future per-project-membership work can narrow the recipient list).
5. Fire `sendPushToUsers(recipientIds, 'delivery_expected', { deliveryId, projectName, expectedAt, supplierName })` (fire-and-forget; failures hit the existing `recordPushError` path).

### 5.3 `materials.markDelivered`

```ts
input:  { companyId: number, id: number,
          deliveredAt?: string /* ISO; default now() */,
          notes?: string,
          gpsLat?: number, gpsLng?: number,
          photoStorageKeys?: string[] /* online callers only */ }
output: MaterialDelivery
```

Steps:
1. `requireCompanyRole(ctx.companyMembership, 'supervisor')`.
2. `SELECT FOR UPDATE` the row. `NOT_FOUND` if absent.
3. `assertTransition(row.status, 'delivered')` — throws `BAD_REQUEST` if illegal.
4. Build a sparse update set: always set `status='delivered'`, `delivered_at = input.deliveredAt ?? now()`, `received_by_id = ctx.user.id`, `updated_at = now()`. For each of `notes`, `gpsLat`, `gpsLng`, `photoStorageKeys`: only include in the SET clause if the input field is present (i.e. `!== undefined`). This preserves prior values on the offline replay path, where the original mutation didn't carry photo keys.
5. Fire `sendPushToUsers(officeRecipients, 'delivery_received', { deliveryId, projectName, supplierName })`.

### 5.4 `materials.markRejected`

Same shape as `markDelivered` but adds `rejectionReason: z.string().min(1)` (required). Same sparse-update discipline: only present fields go into the SET clause. Always sets `status='rejected'`, `delivered_at = input.deliveredAt ?? now()`, `rejection_reason`, `received_by_id = ctx.user.id`, `updated_at = now()`. Fires `delivery_rejected` to office. `delivered_at` is set on rejection too — semantically "this is when we determined the outcome."

### 5.5 `materials.cancelDelivery`

```ts
input:  { companyId: number, id: number, cancellationReason?: string }
output: MaterialDelivery
```

Steps:
1. `requireCompanyRole(ctx.companyMembership, 'manager')`.
2. `assertTransition(row.status, 'cancelled')`.
3. `UPDATE … SET status='cancelled', cancellation_reason = ?, updated_at = now()`.
4. No push fired (cancel is office-internal).

### 5.6 `materials.update`

```ts
input:  { companyId: number, id: number,
          supplierName?, materialDescription?, expectedAt?, deliveredAt?,
          status?: MaterialDeliveryStatus, notes?, gpsLat?, gpsLng?,
          rejectionReason?, cancellationReason?,
          baseSnapshot?: { updatedAt: string, originalValues: Record<string, unknown> } }
output: MaterialDelivery
        | { status: 'conflict', conflictId: number, fields: string[] }
        | { status: 'row_deleted' }
```

Mirrors `rfis.update` exactly:

- Without `baseSnapshot`: simple online path. If `status` is in the payload, `assertTransition(currentStatus, newStatus)` runs first.
- With `baseSnapshot`: opens a transaction with `SELECT FOR UPDATE`, runs `detectFieldConflicts(currentRow, baseSnapshot.updatedAt, userPayload, baseSnapshot.originalValues)`, then either:
  - `row_deleted` → return `{ status: 'row_deleted' }` (replay drops).
  - `conflict` → insert a `conflict_pending` row (table from Phase 3.7) and return `{ status: 'conflict', conflictId, fields }`.
  - `ok` → apply the update (still through `assertTransition` if `status` is touched).

Photos are not editable through `update` — `photoStorageKeys` is **not** in the input schema. Photo edits are deferred (see § 10).

---

## 6. Client changes

### 6.1 New files

```
app/materials.tsx                          // agenda screen + create / detail / mark / edit modals
components/delivery-status-pill.tsx        // status chip
lib/material-delivery-actions.ts           // assertTransition + visibleActions + agenda grouping helper
```

### 6.2 Modified files

```
app/(tabs)/index.tsx        // add Materials tile to Field-Operations grid
shared/notification-events.ts  // append three new event types
shared/conflict-field-kinds.ts // append materials field kinds (10 entries)
server/routers/index.ts     // import materialsRouter, merge into appRouter
```

### 6.3 Agenda layout

```
┌────────────────────────────────────────────┐
│  Materials             [+ Schedule]         │  + visible to manager+
├────────────────────────────────────────────┤
│  All  Expected  Delivered  Rejected        │  filter chips
├────────────────────────────────────────────┤
│  TODAY · Mon 7 May          (2 expected)   │  section header
│   ┌──────────────────────────────────────┐ │
│   │ 14:00  Travis Perkins                │ │  expectedAt time
│   │        5 pallets brick + 20 cement   │ │  materialDescription (truncated)
│   │  [expected]  [OVERDUE]      Burnt M  │ │  status pill + derived overdue + project name
│   └──────────────────────────────────────┘ │
│  TOMORROW · Tue 8 May       (1 expected)   │
│  ...                                        │
│  YESTERDAY · Sun 6 May      (3 delivered)  │  past days, opacity 0.6
└────────────────────────────────────────────┘
```

Sections built client-side from the `list` query, grouped by `expectedAt` date in device TZ.

### 6.4 Detail / action modal

Slide-up sheet (matches `app/rfis.tsx` modal). Action buttons gated by `visibleActions(status, role)`:

| Status | Role | Buttons |
|--------|------|---------|
| `expected` | `supervisor+` | **Mark Delivered** · **Mark Rejected** · **Edit** |
| `expected` | `manager+` | adds **Cancel** |
| `delivered` | `supervisor+` | **Edit** (also can transition to rejected via the edit form's status field) |
| `rejected` | `supervisor+` | **Edit** |
| `cancelled` | `manager+` | **Edit** (only undo: cancelled → expected) |

### 6.5 Mark-delivered / mark-rejected sheets

- Auto-fetch GPS via `expo-location` on sheet open. Manual override via "Use map" button.
- Photo picker (`expo-image-picker`) — disabled when `syncStatus !== 'online'`, shows "Photos can be added when online" toast.
- Online photo flow: pick → `manus-storage` upload → accumulate keys → submit mutation with keys. Reuses whatever `manus-storage` upload procedure currently exists (verify name during plan-writing — likely `files.upload` or direct `storagePut` proxy).
- `markRejected` sheet has a required `rejectionReason` textarea (`min(1)`).

### 6.6 Edit modal — conflict-aware

Mirrors the Phase 3.7 RFI edit pattern (commit `1cf89d6`):

```ts
const editSnapshotRef = useRef<{ updatedAt: string; originalValues: Record<string, unknown> } | null>(null);

// at openEdit(item):
editSnapshotRef.current = {
  updatedAt: item.updatedAt,
  originalValues: { supplierName, materialDescription, expectedAt, deliveredAt,
                    status, notes, gpsLat, gpsLng, rejectionReason, cancellationReason },
};

// at submit:
if (syncStatus !== 'online' && editSnapshotRef.current) {
  await enqueue('materials.update', { ...payload, baseSnapshot: editSnapshotRef.current });
  return;
}
await updateMutation.mutateAsync(payload);
```

The 3.7 banner / list / resolution sheet automatically render conflict UX when one fires — no client work needed.

### 6.7 Offline behaviour table

| Mutation | Offline | Online |
|----------|---------|--------|
| `expectDelivery` | toast: "Schedule available when online" (no enqueue — office user) | direct `mutateAsync` + push |
| `markDelivered` | `enqueue('materials.markDelivered', payload)` (no photo keys) | direct + photos uploaded first |
| `markRejected` | `enqueue('materials.markRejected', payload)` (no photo keys) | direct + photos uploaded first |
| `cancelDelivery` | `enqueue('materials.cancelDelivery', payload)` | direct |
| `update` | `enqueue('materials.update', { ...payload, baseSnapshot })` | direct (no snapshot) |

---

## 7. Push events registry additions

`shared/notification-events.ts`:

```ts
delivery_expected:  { label: "Delivery expected on my site",      category: "Materials" },
delivery_received:  { label: "Material delivery confirmed",       category: "Materials" },
delivery_rejected:  { label: "Material delivery rejected",        category: "Materials" },
```

**Recipient resolution** (in the procedures, not the registry):

- `delivery_expected` → company members with role ≥ `supervisor` (covers site supervisors and managers). v1 limitation: not project-scoped, since no `projectMembership` table exists. Plan flags this as the natural Phase 3.2.c follow-up if recipient noise becomes an issue.
- `delivery_received`, `delivery_rejected` → company members with role ≥ `manager` (office only).

The push gate (Phase 3.6) honours user `pushPreferences` — a user with `delivery_received: false` is excluded automatically by `filterByPreferences` before any token lookup.

`delivery_overdue` is **out of scope for v1** (§ 10) — it needs a cron runner that doesn't exist yet.

---

## 8. Conflict field-kinds registry additions

`shared/conflict-field-kinds.ts`:

```ts
'materials.supplierName':         'text',
'materials.materialDescription':  'text',
'materials.notes':                'text',
'materials.rejectionReason':      'text',
'materials.cancellationReason':   'text',
'materials.expectedAt':           'atomic',
'materials.deliveredAt':          'atomic',
'materials.status':               'atomic',
'materials.gpsLat':               'atomic',
'materials.gpsLng':               'atomic',
```

`photoStorageKeys` is intentionally absent — it's not in `materials.update`'s editable input set (per § 5.6), so the 3.7 coverage meta-test will pass.

---

## 9. Error handling

- All procedures throw `dbUnavailable()` (per CLAUDE.md) when `getDb()` returns null — never `new Error('Database unavailable')`.
- `assertTransition` failures throw `TRPCError({ code: 'BAD_REQUEST', message: 'Illegal status transition: <from> → <to>' })`.
- Cross-tenant FK violations throw `TRPCError({ code: 'FORBIDDEN', message: 'Project not found for this company.' })` — same wording as `rfis.create`.
- Role-gate violations throw via `requireCompanyRole` (existing helper raises `FORBIDDEN`).
- `markRejected` with empty `rejectionReason` rejects at the Zod layer (`min(1)`) → `BAD_REQUEST`.
- Push failures are fire-and-forget through `recordPushError` — never block the mutation response.
- Conflict detection on `update`: returns a structured `{ status: 'conflict' | 'row_deleted', ... }` body, not a thrown error (matches Phase 3.7 dispatcher contract).

---

## 10. Out of scope (Phase 3.2)

- **Delivery line items.** Single row + free-text materialDescription. The `delivery_lines(deliveryId, materialName, quantity, unit)` table is a future phase; v1's `materialDescription` text column is forward-compatible (lines can be parsed from history if needed).
- **`suppliers` table.** Free-text `supplierName` for v1. A migration that extracts uniques into a normalised table is a clean follow-up.
- **`delivery_overdue` push.** Needs a cron runner that doesn't exist in this repo. Defer to Phase 3.2.b alongside the cron infra.
- **Per-project recipient scoping.** No `projectMembership` table exists. v1 fans out company-wide for the role; Phase 3.2.c can narrow once project-membership lands.
- **Photo edit / re-upload.** Photos attach via `markDelivered` / `markRejected` only (online). Editing the photo set after the fact is deferred — unusual workflow, can be added with a dedicated `materials.replacePhotos` mutation later.
- **Delivery PDF / proof-of-delivery export.** Phase 3.8 (Document export: PDF rendering) covers PDF generation generally; that's the natural home.
- **Supplier / driver app integration.** No external party can update these rows in v1 — only company members.

---

## 11. Acceptance criteria (verifiable)

1. Office user (`manager+`) schedules an expected delivery; a `manager+`/`supervisor` site user receives a `delivery_expected` push (modulo `pushPreferences`).
2. Site user (`supervisor+`) marks the delivery delivered offline. The row enqueues, replays on reconnect, and the office sees `status='delivered'` with the GPS captured. Office receives a `delivery_received` push.
3. Site user marks delivered with photos when online: photos are uploaded to `manus-storage`, keys persist on the row, the modal renders the photos.
4. Site user marks rejected with a reason: `rejectionReason` is required (empty rejected at validation), office receives `delivery_rejected` push.
5. Two users edit the same delivery row offline (one changes `notes`, one changes `expectedAt`): on replay, the second arrives, `detectFieldConflicts` returns `kind: 'ok'` (different fields), both edits land. (Same-field conflict goes through the 3.7 resolution sheet.)
6. A `manager+` user cancels an expected delivery; status becomes `cancelled`, no push fires.
7. Filter chips on the agenda show only the matching status.
8. Past days with `status='expected'` render an `OVERDUE` badge derived from `expectedAt < startOfToday`.
9. Tenant isolation: a `companyA` user cannot list, mutate, or fetch any `companyB` delivery (`tests/tenant-isolation.test.ts` continues to pass).
10. `pnpm test` green (~30 new tests). `pnpm check` clean. `pnpm lint` clean.

---

## 12. Detailed sub-plan handoff

This spec hands to `superpowers:writing-plans` to produce `docs/superpowers/plans/2026-05-07-materials-delivery-tracking.md` — a TDD per-task plan in the same shape as `docs/superpowers/plans/2026-05-06-offline-sync-conflicts.md`.

**Spec section → plan task mapping:**

| Spec § | Plan task |
|--------|-----------|
| § 4 (data model) | Migration + Drizzle schema + `_journal.json` |
| § 4 (state machine) | `lib/material-delivery-actions.ts` (pure helpers + tests) |
| § 5.1 | `materials.list` |
| § 5.2 | `materials.expectDelivery` (incl. `delivery_expected` push wiring + recipient query) |
| § 5.3 | `materials.markDelivered` (incl. `delivery_received` push) |
| § 5.4 | `materials.markRejected` (incl. `delivery_rejected` push) |
| § 5.5 | `materials.cancelDelivery` |
| § 5.6 | `materials.update` (with `baseSnapshot` conflict integration) |
| § 7 | Append 3 entries to `shared/notification-events.ts` + extend test |
| § 8 | Append 10 entries to `shared/conflict-field-kinds.ts` |
| § 6.1–6.4 | `app/materials.tsx` agenda screen + status pill |
| § 6.5 | Mark-delivered / mark-rejected sheets (online photo flow) |
| § 6.6 | Edit modal with `baseSnapshot` capture |
| § 6.7 | Offline-branch wiring per mutation |
| § 6.2 | Tile on `app/(tabs)/index.tsx` |
| § 11 | Final acceptance pass + ROADMAP § 3.2 ✅ DONE update |

**Test count target:** ~1060 → ~1090 (~30 new tests, all server-side or pure-helper).

**Push notification dependency:** This phase appends three new event types but does not add cron infra. Phase 3.2.b is the natural home for `delivery_overdue` once a scheduler exists.
