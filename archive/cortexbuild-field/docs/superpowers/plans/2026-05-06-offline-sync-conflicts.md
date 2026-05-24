# Phase 3.7 — Offline sync conflict resolution — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a queued offline UPDATE replays after a server-side change to the same row, the server diffs the touched fields, auto-merges disjoint edits, and surfaces a non-destructive resolution UI for same-field conflicts.

**Architecture:** Snapshot-based optimistic concurrency. Each queued mutation carries the row's pre-edit snapshot. Server diffs fields on replay; conflicts park in a `conflict_pending` sidecar table. A polymorphic resolution sheet (atomic widgets vs. text editor, picked from a hand-maintained `CONFLICT_FIELD_KINDS` registry) lets the user produce final values.

**Tech Stack:** TypeScript 5.9 · tRPC v11 · Drizzle ORM (Postgres jsonb + indexes) · Vitest · Expo Router · TanStack Query 5 · NativeWind 4.

**Spec:** `docs/superpowers/specs/2026-05-06-offline-sync-conflicts-design.md` (commit `558a0fb`).

---

## File map

| File | Status | Responsibility |
|---|---|---|
| `drizzle/0013_conflict_pending.sql` | NEW | Migration: `CREATE TABLE conflict_pending`. |
| `drizzle/meta/_journal.json` | MODIFY | Add idx 10 entry. |
| `drizzle/schema.ts` | MODIFY | Add `conflictPending` table definition. |
| `drizzle/conflict-registry.ts` | NEW | `CONFLICT_FIELD_KINDS` registry: `{table: {field: 'atomic' | 'text'}}`. |
| `tests/conflict-registry-coverage.test.ts` | NEW | Meta-test: every editable column in queueable tables has a kind registered. |
| `server/_core/sync-conflict-detector.ts` | NEW | Pure-ish `detectFieldConflicts(tx, table, rowId, baseUpdatedAt, payload, snapshot) → ok | conflict | row_deleted`. |
| `tests/sync-conflict-detector.test.ts` | NEW | ~15 cases for the detector. |
| `server/_core/sync-replay-dispatcher.ts` | MODIFY | Wire `detectFieldConflicts` into the replay branch; INSERT into `conflict_pending` on conflict. |
| `tests/sync-replay-dispatcher.test.ts` | MODIFY | Add tests for new conflict / row_deleted branches. |
| `server/routers/conflicts.ts` | NEW | `conflicts.list` + `conflicts.resolve` procedures. |
| `tests/conflicts-router.test.ts` | NEW | Router-level tests including recursive-conflict and two-device race. |
| `server/routers/index.ts` | MODIFY | Mount `conflictsRouter` under `appRouter`. |
| `lib/sync-queue.tsx` | MODIFY | `QueuedMutation.baseSnapshot`, extended `ReplayOutcome`, extended `classifyReplayResponse`, `replayQueue` branches for conflict / row_deleted. |
| `tests/sync-queue.test.ts` | MODIFY | Add `classifyReplayResponse` cases. |
| `tests/sync-queue-conflict.test.ts` | NEW | Replay loop with mocked dispatcher returning conflict. |
| `lib/use-sync-conflicts.tsx` | NEW | Hook around `trpc.conflicts.list`. |
| `tests/use-sync-conflicts.test.ts` | NEW | Hook tests with mocked tRPC. |
| `components/ConflictBanner.tsx` | NEW | Global banner showing unresolved count. |
| `app/_layout.tsx` | MODIFY | Mount `<ConflictBanner />` below the existing sync banner. |
| `app/conflicts/index.tsx` | NEW | List screen for unresolved conflicts. |
| `app/conflicts/[id].tsx` | NEW | Resolution sheet — polymorphic per `CONFLICT_FIELD_KINDS`. |
| `app/rfi-detail.tsx` | MODIFY | Capture snapshot at form open; pass to `enqueue` at submit. |
| `docs/ROADMAP.md` | MODIFY | Mark § 3.7 ✅ DONE. |

---

## Task 1: Migration + schema for `conflict_pending`

The sidecar table where parked conflicts live. Tenant-scoped via `companyId`. Indexed for the hot query "what's unresolved for this user?".

**Files:**
- Create: `drizzle/0013_conflict_pending.sql`
- Modify: `drizzle/meta/_journal.json`
- Modify: `drizzle/schema.ts`
- Test: existing `tests/migration-journal-completeness.test.ts` enforces journal entry

- [ ] **Step 1: Write the migration**

Create `drizzle/0013_conflict_pending.sql`:

```sql
CREATE TABLE IF NOT EXISTS "conflict_pending" (
  "id"             SERIAL PRIMARY KEY,
  "companyId"      INTEGER NOT NULL REFERENCES "companies"("id"),
  "userId"         INTEGER NOT NULL REFERENCES "users"("id"),
  "tableName"      VARCHAR(64) NOT NULL,
  "rowId"          INTEGER NOT NULL,
  "conflictFields" JSONB NOT NULL,
  "mineValues"     JSONB NOT NULL,
  "theirsValues"   JSONB NOT NULL,
  "baseUpdatedAt"  TIMESTAMP NOT NULL,
  "resolvedAt"     TIMESTAMP,
  "createdAt"      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "conflict_pending_user_unresolved_idx"
  ON "conflict_pending" ("companyId", "userId", "resolvedAt");
```

- [ ] **Step 2: Append to journal**

Open `drizzle/meta/_journal.json`, append the next entry. Look at the highest existing `idx` and `when` timestamp; the new entry uses `idx = previous + 1` and `when = current ms timestamp`. Example shape (paste at the end of the `entries` array, after the previous trailing comma):

```json
    {
      "idx": 10,
      "version": "7",
      "when": 1778100000000,
      "tag": "0013_conflict_pending",
      "breakpoints": true
    }
```

- [ ] **Step 3: Add Drizzle schema entry**

In `drizzle/schema.ts`, append after the last `pgTable` export (before any helper exports). Make sure `index` is in the imports from `drizzle-orm/pg-core`.

```ts
export const conflictPending = pgTable('conflict_pending', {
  id:              serial('id').primaryKey(),
  companyId:       integer('companyId').notNull().references(() => companies.id),
  userId:          integer('userId').notNull().references(() => users.id),
  tableName:       varchar('tableName', { length: 64 }).notNull(),
  rowId:           integer('rowId').notNull(),
  conflictFields:  jsonb('conflictFields').$type<string[]>().notNull(),
  mineValues:      jsonb('mineValues').$type<Record<string, unknown>>().notNull(),
  theirsValues:    jsonb('theirsValues').$type<Record<string, unknown>>().notNull(),
  baseUpdatedAt:   timestamp('baseUpdatedAt').notNull(),
  resolvedAt:      timestamp('resolvedAt'),
  createdAt:       timestamp('createdAt').defaultNow().notNull(),
}, (t) => ({
  byUserUnresolved: index('conflict_pending_user_unresolved_idx').on(t.companyId, t.userId, t.resolvedAt),
}));

export type ConflictPendingRow = typeof conflictPending.$inferSelect;
export type ConflictPendingInsert = typeof conflictPending.$inferInsert;
```

- [ ] **Step 4: Run migration tests to verify journal completeness**

```bash
pnpm test -- tests/migration-journal-completeness.test.ts
```

Expected: PASS. If it fails with "missing journal entry," the `idx` or `when` was off — fix and re-run.

- [ ] **Step 5: Apply migration locally**

```bash
DATABASE_URL=postgres://cortexbuild:...@127.0.0.1:55432/cortexbuild_field?sslmode=disable pnpm db:push
```

Expected output mentions `0013_conflict_pending`. Verify in psql: `\d conflict_pending` shows the columns and the index.

- [ ] **Step 6: Commit**

```bash
git add drizzle/0013_conflict_pending.sql drizzle/meta/_journal.json drizzle/schema.ts
git commit -m "feat(db): add conflict_pending table for offline sync conflicts"
```

---

## Task 2: Field-type registry + coverage meta-test

The dispatcher needs to know per-column whether resolution should be atomic (Keep Mine / Use Theirs) or text (editable merge). A flat hand-maintained literal table beats Drizzle introspection (per CLAUDE.md: avoid `Symbol.for('drizzle:Name')`).

**Files:**
- Create: `drizzle/conflict-registry.ts`
- Create: `tests/conflict-registry-coverage.test.ts`

- [ ] **Step 1: Write the failing coverage meta-test**

Create `tests/conflict-registry-coverage.test.ts`:

```ts
/**
 * Pins coverage of CONFLICT_FIELD_KINDS against the actual schema.
 *
 * For every table that participates in offline sync (the QUEUEABLE_UPDATE_TABLES
 * list below — kept in sync with the wired `enqueue` callers), every editable
 * column must have a registered kind in CONFLICT_FIELD_KINDS. Adding a new
 * editable column without registering it fails this test with a clear message.
 *
 * "Editable" here means: not auto-managed (id, createdAt, updatedAt, *_id
 * foreign keys to companies/users for tenant scoping). Each table declares its
 * editable column set via the EDITABLE_COLUMNS map below — explicit, not
 * introspected.
 */
import { describe, expect, it } from 'vitest';
import { CONFLICT_FIELD_KINDS } from '../drizzle/conflict-registry';

const QUEUEABLE_UPDATE_TABLES = ['rfis'] as const;

const EDITABLE_COLUMNS: Record<typeof QUEUEABLE_UPDATE_TABLES[number], readonly string[]> = {
  rfis: ['description', 'notes', 'status', 'severity', 'assigneeId', 'dueDate'],
};

describe('CONFLICT_FIELD_KINDS coverage', () => {
  for (const table of QUEUEABLE_UPDATE_TABLES) {
    it(`covers every editable column in ${table}`, () => {
      const registered = CONFLICT_FIELD_KINDS[table] ?? {};
      const missing = EDITABLE_COLUMNS[table].filter(c => !(c in registered));
      expect(missing).toEqual([]);
    });

    it(`only registers kinds 'atomic' or 'text' in ${table}`, () => {
      const kinds = Object.values(CONFLICT_FIELD_KINDS[table] ?? {});
      const invalid = kinds.filter(k => k !== 'atomic' && k !== 'text');
      expect(invalid).toEqual([]);
    });
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test -- tests/conflict-registry-coverage.test.ts
```

Expected: FAIL — `Cannot find module '../drizzle/conflict-registry'`.

- [ ] **Step 3: Write the registry**

Create `drizzle/conflict-registry.ts`:

```ts
/**
 * Per-column resolution kind for the offline-sync conflict UI.
 *
 * 'atomic' → Keep Mine / Use Theirs widget. For enums, dates, FKs, numbers.
 * 'text'   → side-by-side display + editable textarea. For free-text fields.
 *
 * The dispatcher in app/conflicts/[id].tsx picks the widget by reading
 * CONFLICT_FIELD_KINDS[tableName][fieldName].
 *
 * Keeping the kinds out-of-band (here, not introspected from Drizzle types)
 * is deliberate: a 'severity' enum and a 'rating' decimal both look like
 * "atomic from the type system but the resolution UX is identical." The
 * registry encodes the *intent*, not the type.
 *
 * Adding a new editable column to a queueable table must add an entry here.
 * tests/conflict-registry-coverage.test.ts pins this — missing entries fail
 * the build with a clear message.
 */
export type ConflictFieldKind = 'atomic' | 'text';

export const CONFLICT_FIELD_KINDS = {
  rfis: {
    description: 'text',
    notes:       'text',
    status:      'atomic',
    severity:    'atomic',
    assigneeId:  'atomic',
    dueDate:     'atomic',
  },
} as const satisfies Record<string, Record<string, ConflictFieldKind>>;

export type ConflictTableName = keyof typeof CONFLICT_FIELD_KINDS;
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test -- tests/conflict-registry-coverage.test.ts
```

Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add drizzle/conflict-registry.ts tests/conflict-registry-coverage.test.ts
git commit -m "feat(sync): add CONFLICT_FIELD_KINDS registry with coverage meta-test"
```

---

## Task 3: `detectFieldConflicts` pure function

The server-side core. Given the row's current state, the snapshot the client based its edit on, and the payload the client wants to apply, decide: clean apply, conflict, or row deleted.

**Files:**
- Create: `server/_core/sync-conflict-detector.ts`
- Test: `tests/sync-conflict-detector.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/sync-conflict-detector.test.ts`:

```ts
/**
 * Pure-unit tests for the field-conflict detector.
 *
 * The detector takes the row's current state (as if SELECT FOR UPDATE just
 * returned), the client's baseSnapshot (what they thought the row looked
 * like), and the payload (what they want to write). It returns one of:
 *   - { kind: 'ok' }                                 → safe to apply
 *   - { kind: 'conflict', fields, theirsValues }     → same field touched
 *   - { kind: 'row_deleted' }                        → row no longer exists
 *
 * Definition of "conflict on field X":
 *   - server's current row[X] != client's snapshot[X]   (someone changed it)
 *   - AND payload[X] != server's current row[X]         (client also wants to change it; if they happen to match, no conflict)
 *
 * Disjoint edits (different fields) → kind: 'ok' even though row.updatedAt
 * has moved past baseUpdatedAt.
 */
import { describe, expect, it } from 'vitest';
import { detectFieldConflicts } from '../server/_core/sync-conflict-detector';

describe('detectFieldConflicts', () => {
  const baseSnapshot = { description: 'old desc', status: 'submitted' as const };
  const baseUpdatedAt = new Date('2026-05-06T10:00:00Z');

  it('returns ok when the row is unchanged since baseUpdatedAt', () => {
    const currentRow = { id: 1, description: 'old desc', status: 'submitted', updatedAt: baseUpdatedAt };
    const payload = { description: 'my new desc' };
    expect(detectFieldConflicts(currentRow, baseUpdatedAt, payload, baseSnapshot)).toEqual({ kind: 'ok' });
  });

  it('returns ok when server changed a different field than client is changing', () => {
    // Server changed status to "answered"; client is changing description.
    const currentRow = { id: 1, description: 'old desc', status: 'answered', updatedAt: new Date('2026-05-06T10:05:00Z') };
    const payload = { description: 'my new desc' };
    expect(detectFieldConflicts(currentRow, baseUpdatedAt, payload, baseSnapshot)).toEqual({ kind: 'ok' });
  });

  it('returns conflict when both touched the same field', () => {
    const currentRow = { id: 1, description: 'their new desc', status: 'submitted', updatedAt: new Date('2026-05-06T10:05:00Z') };
    const payload = { description: 'my new desc' };
    const result = detectFieldConflicts(currentRow, baseUpdatedAt, payload, baseSnapshot);
    expect(result).toEqual({
      kind: 'conflict',
      fields: ['description'],
      theirsValues: { description: 'their new desc' },
    });
  });

  it('returns conflict listing all overlapping fields', () => {
    const currentRow = { id: 1, description: 'their desc', status: 'answered', updatedAt: new Date('2026-05-06T10:05:00Z') };
    const payload = { description: 'my desc', status: 'approved' as const };
    const result = detectFieldConflicts(currentRow, baseUpdatedAt, payload, baseSnapshot);
    expect(result.kind).toBe('conflict');
    if (result.kind !== 'conflict') throw new Error('unreachable');
    expect(result.fields.sort()).toEqual(['description', 'status']);
    expect(result.theirsValues).toEqual({ description: 'their desc', status: 'answered' });
  });

  it('returns ok when client and server happen to write the same value', () => {
    // Both writers chose the same new description — no conflict.
    const currentRow = { id: 1, description: 'agreed text', status: 'submitted', updatedAt: new Date('2026-05-06T10:05:00Z') };
    const payload = { description: 'agreed text' };
    expect(detectFieldConflicts(currentRow, baseUpdatedAt, payload, baseSnapshot)).toEqual({ kind: 'ok' });
  });

  it('returns row_deleted when current row is null', () => {
    const payload = { description: 'doesnt matter' };
    expect(detectFieldConflicts(null, baseUpdatedAt, payload, baseSnapshot)).toEqual({ kind: 'row_deleted' });
  });

  it('treats Date and string baseUpdatedAt equivalently', () => {
    const currentRow = { id: 1, description: 'old desc', status: 'submitted', updatedAt: new Date('2026-05-06T10:05:00Z') };
    const payload = { description: 'my new desc' };
    // String form (as the client would send it)
    const result = detectFieldConflicts(currentRow, '2026-05-06T10:00:00Z', payload, baseSnapshot);
    expect(result).toEqual({ kind: 'ok' });
  });

  it('does not flag a conflict on a field the client did not change', () => {
    // Server changed BOTH description AND status; client is only changing description
    // and was working from an old status. The status divergence is invisible to the
    // detector because client's payload doesn't touch status.
    const currentRow = { id: 1, description: 'their desc', status: 'answered', updatedAt: new Date('2026-05-06T10:05:00Z') };
    const payload = { description: 'my new desc' };
    const result = detectFieldConflicts(currentRow, baseUpdatedAt, payload, baseSnapshot);
    expect(result.kind).toBe('conflict');
    if (result.kind !== 'conflict') throw new Error('unreachable');
    expect(result.fields).toEqual(['description']);
  });

  it('handles snapshot missing a field that payload touches (programming error guard)', () => {
    // If the client somehow sends a payload key that wasn't in baseSnapshot,
    // we cannot diff it correctly. Treat as conflict to be safe — the user
    // sees the resolution UI rather than silently overwriting.
    const currentRow = { id: 1, description: 'old desc', status: 'submitted', notes: 'server notes', updatedAt: baseUpdatedAt };
    const payload = { notes: 'my notes' };
    const result = detectFieldConflicts(currentRow, baseUpdatedAt, payload, baseSnapshot);
    expect(result.kind).toBe('conflict');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test -- tests/sync-conflict-detector.test.ts
```

Expected: FAIL — `Cannot find module '../server/_core/sync-conflict-detector'`.

- [ ] **Step 3: Write the implementation**

Create `server/_core/sync-conflict-detector.ts`:

```ts
/**
 * Server-side detector for field-level conflicts on offline-sync replays.
 *
 * Pure-ish — no DB access. Caller (the sync.replay dispatcher) does the
 * SELECT FOR UPDATE and feeds the row in. Splitting it this way keeps the
 * conflict logic unit-testable without spinning up a DB.
 */

export type DetectorResult =
  | { kind: 'ok' }
  | { kind: 'conflict'; fields: string[]; theirsValues: Record<string, unknown> }
  | { kind: 'row_deleted' };

interface RowLike {
  // The server's current row. Must include every field the client is touching.
  // updatedAt is read by the dispatcher, not the detector.
  [field: string]: unknown;
}

/**
 * @param currentRow      Server's row right now (from SELECT FOR UPDATE), or null if deleted.
 * @param baseUpdatedAt   The row's updatedAt at the moment the client opened the form.
 *                        Accepted as Date or ISO string (clients send strings).
 * @param payload         The fields the client wants to write, with their new values.
 * @param baseSnapshot    The values of those same fields at the moment the client opened the form.
 */
export function detectFieldConflicts(
  currentRow: RowLike | null,
  baseUpdatedAt: Date | string,
  payload: Record<string, unknown>,
  baseSnapshot: Record<string, unknown>,
): DetectorResult {
  if (currentRow === null) return { kind: 'row_deleted' };

  const conflictFields: string[] = [];
  const theirsValues: Record<string, unknown> = {};

  for (const field of Object.keys(payload)) {
    if (!(field in baseSnapshot)) {
      // Programming-error guard: payload mentions a field the snapshot doesn't.
      // We can't safely diff it, so flag a conflict and surface to the user.
      conflictFields.push(field);
      theirsValues[field] = currentRow[field];
      continue;
    }

    const serverValue = currentRow[field];
    const snapshotValue = baseSnapshot[field];
    const payloadValue = payload[field];

    // No conflict if server hasn't moved the field, or if both writers
    // happen to have written the same final value.
    if (serverValue === snapshotValue) continue;
    if (serverValue === payloadValue) continue;

    conflictFields.push(field);
    theirsValues[field] = serverValue;
  }

  if (conflictFields.length === 0) return { kind: 'ok' };
  return { kind: 'conflict', fields: conflictFields, theirsValues };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test -- tests/sync-conflict-detector.test.ts
```

Expected: 9 PASS.

- [ ] **Step 5: Commit**

```bash
git add server/_core/sync-conflict-detector.ts tests/sync-conflict-detector.test.ts
git commit -m "feat(sync): pure-fn detectFieldConflicts for replay diffing"
```

---

## Task 4: Wire detector into the `sync.replay` dispatcher

The dispatcher is what the queue's `executeMutation` calls into. Currently it dispatches by `type` string and applies the payload. The change: when the mutation carries `baseSnapshot`, run the detector first; on conflict, INSERT into `conflict_pending` and return `{status: 'conflict', conflictId, fields}` instead of applying.

**Files:**
- Modify: `server/_core/sync-replay-dispatcher.ts`
- Modify: `tests/sync-replay-dispatcher.test.ts`

- [ ] **Step 1: Read existing dispatcher**

Open `server/_core/sync-replay-dispatcher.ts`. Find the function that handles UPDATE-type entries (e.g. a `case 'rfis.update':` branch). Identify where the row is fetched and where the UPDATE is issued — the detector slots between them.

- [ ] **Step 2: Write the failing test**

Append to `tests/sync-replay-dispatcher.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { dispatchSyncReplay } from '../server/_core/sync-replay-dispatcher';

describe('sync.replay — conflict branch', () => {
  it('returns {status: "conflict", conflictId, fields} when detector reports conflict', async () => {
    // Arrange: fake DB where SELECT returns a row whose description has changed
    // since the client's snapshot, and the client's payload touches description.
    const fakeDb = makeFakeDbWithConflict();

    const result = await dispatchSyncReplay(fakeDb, {
      type: 'rfis.update',
      payload: { id: 1, description: 'my new desc' },
      baseSnapshot: { rowId: 1, updatedAt: '2026-05-06T10:00:00Z', originalValues: { description: 'old desc' } },
      ctx: makeFakeCtx(),
    });

    expect(result.status).toBe('conflict');
    if (result.status !== 'conflict') throw new Error('unreachable');
    expect(result.fields).toEqual(['description']);
    expect(typeof result.conflictId).toBe('number');
    // No UPDATE on the source row.
    expect(fakeDb.updates).toEqual([]);
    // INSERT into conflict_pending happened.
    expect(fakeDb.conflictPendingInserts).toHaveLength(1);
    expect(fakeDb.conflictPendingInserts[0]).toMatchObject({
      tableName: 'rfis',
      rowId: 1,
      conflictFields: ['description'],
      mineValues: { description: 'my new desc' },
      theirsValues: { description: 'their desc' },
    });
  });

  it('returns {status: "row_deleted"} when SELECT returns no row', async () => {
    const fakeDb = makeFakeDbRowMissing();
    const result = await dispatchSyncReplay(fakeDb, {
      type: 'rfis.update',
      payload: { id: 99, description: 'doesnt matter' },
      baseSnapshot: { rowId: 99, updatedAt: '2026-05-06T10:00:00Z', originalValues: { description: 'old' } },
      ctx: makeFakeCtx(),
    });
    expect(result).toEqual({ status: 'row_deleted' });
    expect(fakeDb.updates).toEqual([]);
    expect(fakeDb.conflictPendingInserts).toEqual([]);
  });

  it('applies cleanly when fields are disjoint (auto-merge)', async () => {
    // Server has changed status; client is touching description only.
    const fakeDb = makeFakeDbDisjoint();
    const result = await dispatchSyncReplay(fakeDb, {
      type: 'rfis.update',
      payload: { id: 1, description: 'my new desc' },
      baseSnapshot: { rowId: 1, updatedAt: '2026-05-06T10:00:00Z', originalValues: { description: 'old desc' } },
      ctx: makeFakeCtx(),
    });
    expect(result).toEqual({ status: 'success' });
    expect(fakeDb.updates).toEqual([{ table: 'rfis', id: 1, set: { description: 'my new desc' } }]);
    expect(fakeDb.conflictPendingInserts).toEqual([]);
  });
});

// --- fake DB helpers (paste at the bottom of the test file) ---

function makeFakeDbWithConflict() {
  const updates: any[] = [];
  const inserts: any[] = [];
  return {
    updates,
    conflictPendingInserts: inserts,
    selectRfiForUpdate: async (id: number) => ({
      id,
      description: 'their desc',
      status: 'submitted',
      updatedAt: new Date('2026-05-06T10:05:00Z'),
    }),
    insertConflictPending: async (row: any) => {
      inserts.push(row);
      return { id: 42 };
    },
    updateRfi: async (...args: any[]) => updates.push({ table: 'rfis', ...args }),
  };
}

function makeFakeDbRowMissing() {
  const inserts: any[] = [];
  const updates: any[] = [];
  return {
    updates,
    conflictPendingInserts: inserts,
    selectRfiForUpdate: async () => null,
    insertConflictPending: async () => { throw new Error('should not be called'); },
    updateRfi: async () => { throw new Error('should not be called'); },
  };
}

function makeFakeDbDisjoint() {
  const inserts: any[] = [];
  const updates: any[] = [];
  return {
    updates,
    conflictPendingInserts: inserts,
    selectRfiForUpdate: async (id: number) => ({
      id,
      description: 'old desc',  // unchanged from snapshot
      status: 'answered',       // changed but client doesn't touch status
      updatedAt: new Date('2026-05-06T10:05:00Z'),
    }),
    insertConflictPending: async () => { throw new Error('should not be called'); },
    updateRfi: async (id: number, set: any) => updates.push({ table: 'rfis', id, set }),
  };
}

function makeFakeCtx() {
  return { user: { id: 7, companyId: 3 } };
}
```

- [ ] **Step 3: Run test to verify it fails**

```bash
pnpm test -- tests/sync-replay-dispatcher.test.ts -t conflict
```

Expected: FAIL — dispatcher doesn't know about `baseSnapshot` yet.

- [ ] **Step 4: Modify the dispatcher**

In `server/_core/sync-replay-dispatcher.ts`:

```ts
import { detectFieldConflicts } from './sync-conflict-detector';

// Add to whatever Result union the dispatcher already exports:
export type DispatchResult =
  | { status: 'success' }
  | { status: 'conflict'; conflictId: number; fields: string[] }
  | { status: 'row_deleted' };

// Within the rfis.update branch (replace the existing direct UPDATE path):
case 'rfis.update': {
  const { id, ...payload } = mutation.payload as { id: number; [k: string]: unknown };
  if (!mutation.baseSnapshot) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'MISSING_SNAPSHOT_FOR_UPDATE' });
  }

  return await tx.transaction(async (innerTx) => {
    const currentRow = await db.selectRfiForUpdate(id, innerTx);
    const detection = detectFieldConflicts(
      currentRow,
      mutation.baseSnapshot.updatedAt,
      payload,
      mutation.baseSnapshot.originalValues,
    );

    if (detection.kind === 'row_deleted') {
      return { status: 'row_deleted' };
    }

    if (detection.kind === 'conflict') {
      const inserted = await db.insertConflictPending({
        companyId: ctx.user.companyId,
        userId: ctx.user.id,
        tableName: 'rfis',
        rowId: id,
        conflictFields: detection.fields,
        mineValues: pickFields(payload, detection.fields),
        theirsValues: detection.theirsValues,
        baseUpdatedAt: new Date(mutation.baseSnapshot.updatedAt),
      }, innerTx);
      return { status: 'conflict', conflictId: inserted.id, fields: detection.fields };
    }

    await db.updateRfi(id, payload, innerTx);
    return { status: 'success' };
  });
}

// Add helper at the bottom of the file:
function pickFields(obj: Record<string, unknown>, fields: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) if (f in obj) out[f] = obj[f];
  return out;
}
```

(Adapt `db.selectRfiForUpdate`, `db.updateRfi`, `db.insertConflictPending` to match the actual DB-helper shape in `server/db.ts`. If those helpers don't exist yet, add them as small wrappers around `tx.select(...).from(rfis)...`, `tx.update(rfis)...`, `tx.insert(conflictPending)...`.)

- [ ] **Step 5: Run tests to verify they pass**

```bash
pnpm test -- tests/sync-replay-dispatcher.test.ts
```

Expected: all PASS, including the existing tests (the change is additive within the rfis.update branch).

- [ ] **Step 6: Commit**

```bash
git add server/_core/sync-replay-dispatcher.ts tests/sync-replay-dispatcher.test.ts
git commit -m "feat(sync): replay dispatcher detects + parks field conflicts"
```

---

## Task 5: `conflicts.list` tRPC procedure

Read-side: the resolution UI lists what's open for the current user.

**Files:**
- Create: `server/routers/conflicts.ts`
- Modify: `server/routers/index.ts`
- Test: `tests/conflicts-router.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/conflicts-router.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { conflictsRouter } from '../server/routers/conflicts';
import { createCallerWithDb } from './_helpers/caller';

describe('conflicts.list', () => {
  it('returns unresolved conflicts for the current user only', async () => {
    const db = await seedDbWithTwoUsers();
    const caller = createCallerWithDb(db, { user: { id: 7, companyId: 3 } });
    const result = await caller.conflicts.list({ resolved: false });
    expect(result).toHaveLength(2);
    expect(result.every(r => r.userId === 7)).toBe(true);
    expect(result.every(r => r.resolvedAt === null)).toBe(true);
  });

  it('respects resolved=true to fetch resolved history', async () => {
    const db = await seedDbWithResolvedHistory();
    const caller = createCallerWithDb(db, { user: { id: 7, companyId: 3 } });
    const result = await caller.conflicts.list({ resolved: true });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every(r => r.resolvedAt !== null)).toBe(true);
  });

  it('does not leak cross-tenant conflicts even via direct id reference', async () => {
    const db = await seedDbWithCrossTenantConflict();
    // Caller is in company 3 but tries to read conflict from company 5.
    const caller = createCallerWithDb(db, { user: { id: 7, companyId: 3 } });
    const result = await caller.conflicts.list({ resolved: false });
    expect(result).toHaveLength(0);
  });
});

// --- helpers ---
async function seedDbWithTwoUsers() {/* TODO: returns a fake DB with conflict_pending rows for users 7 and 8 in company 3 */}
async function seedDbWithResolvedHistory() {/* TODO: returns rows with resolvedAt set */}
async function seedDbWithCrossTenantConflict() {/* TODO: returns rows in company 5 only */}
```

(Replace the `TODO`s with real fixtures matching whatever shape `tests/_helpers/caller.ts` already uses for other tests — see `tests/conflicts-router.test.ts` siblings like `tests/push-preferences-router.test.ts` for the pattern.)

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test -- tests/conflicts-router.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the router**

Create `server/routers/conflicts.ts`:

```ts
import { z } from 'zod';
import { router } from '../_core/trpc';
import { companyScopedProcedure } from '../_core/trpc';
import { eq, and, isNull, isNotNull, desc } from 'drizzle-orm';
import { conflictPending } from '../../drizzle/schema';

export const conflictsRouter = router({
  /**
   * List the current user's conflicts.
   * resolved=false (default) → only those still awaiting resolution.
   * resolved=true → resolved history (audit; up to 30 days retention).
   */
  list: companyScopedProcedure
    .input(z.object({ resolved: z.boolean().optional().default(false) }))
    .query(async ({ ctx, input }) => {
      const db = ctx.db;
      const filter = input.resolved
        ? isNotNull(conflictPending.resolvedAt)
        : isNull(conflictPending.resolvedAt);

      return await db
        .select()
        .from(conflictPending)
        .where(and(
          eq(conflictPending.companyId, ctx.user.companyId),
          eq(conflictPending.userId, ctx.user.id),
          filter,
        ))
        .orderBy(desc(conflictPending.createdAt));
    }),
});
```

- [ ] **Step 4: Mount the router**

In `server/routers/index.ts`, alongside the existing router merges:

```ts
import { conflictsRouter } from './conflicts';

export const appRouter = router({
  // ... existing entries
  conflicts: conflictsRouter,
});
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pnpm test -- tests/conflicts-router.test.ts -t list
```

Expected: 3 PASS.

- [ ] **Step 6: Commit**

```bash
git add server/routers/conflicts.ts server/routers/index.ts tests/conflicts-router.test.ts
git commit -m "feat(sync): conflicts.list tRPC — unresolved + resolved history"
```

---

## Task 6: `conflicts.resolve` tRPC procedure (with recursive-conflict semantics)

Write-side: user submits `finalValues` for a parked conflict. The procedure applies them to the source row through the same diff dispatcher — meaning a same-field write that races a third writer can itself produce a fresh conflict.

**Files:**
- Modify: `server/routers/conflicts.ts`
- Modify: `tests/conflicts-router.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/conflicts-router.test.ts`:

```ts
describe('conflicts.resolve', () => {
  it('applies finalValues and marks resolvedAt', async () => {
    const db = await seedDbWithOneConflict();
    const caller = createCallerWithDb(db, { user: { id: 7, companyId: 3 } });
    const result = await caller.conflicts.resolve({
      id: 42,
      finalValues: { description: 'merged text' },
    });
    expect(result.ok).toBe(true);
    expect(db.rows.rfis[1].description).toBe('merged text');
    expect(db.rows.conflict_pending[42].resolvedAt).not.toBeNull();
  });

  it('returns CONFLICT_ALREADY_RESOLVED when row was already resolved by another device', async () => {
    const db = await seedDbWithAlreadyResolved();
    const caller = createCallerWithDb(db, { user: { id: 7, companyId: 3 } });
    await expect(
      caller.conflicts.resolve({ id: 42, finalValues: { description: 'x' } })
    ).rejects.toMatchObject({ data: { code: 'CONFLICT' }, message: expect.stringContaining('CONFLICT_ALREADY_RESOLVED') });
  });

  it('produces a new conflict_pending row when resolution itself races a third writer', async () => {
    // While user was filling out the resolution sheet, a third writer changed
    // the same field again. Our resolution Apply must surface this as a fresh
    // conflict, not silently overwrite.
    const db = await seedDbWithRecursiveConflict();
    const caller = createCallerWithDb(db, { user: { id: 7, companyId: 3 } });
    const result = await caller.conflicts.resolve({
      id: 42,
      finalValues: { description: 'my merged text' },
    });
    // Old conflict stays unresolved; a NEW one is created.
    expect(db.rows.conflict_pending[42].resolvedAt).toBeNull();
    expect(Object.keys(db.rows.conflict_pending).length).toBe(2);
    // Caller learns about the new conflict via the response.
    expect(result).toMatchObject({ ok: false, recursiveConflictId: expect.any(Number) });
  });

  it('rejects cross-tenant resolve attempts (FORBIDDEN)', async () => {
    const db = await seedDbWithCrossTenantConflict();
    const caller = createCallerWithDb(db, { user: { id: 7, companyId: 3 } });
    await expect(
      caller.conflicts.resolve({ id: 99, finalValues: {} })
    ).rejects.toMatchObject({ data: { code: 'FORBIDDEN' } });
  });
});

async function seedDbWithOneConflict() {/* fake DB with conflict_pending id=42 unresolved on rfis row 1 */}
async function seedDbWithAlreadyResolved() {/* fake DB where conflict_pending id=42 has resolvedAt set */}
async function seedDbWithRecursiveConflict() {/* fake DB where rfis row 1 has been changed AGAIN since theirsValues was written */}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test -- tests/conflicts-router.test.ts -t resolve
```

Expected: FAIL — `resolve` not on the router.

- [ ] **Step 3: Implement `resolve`**

Append to `server/routers/conflicts.ts`:

```ts
import { TRPCError } from '@trpc/server';
import { detectFieldConflicts } from '../_core/sync-conflict-detector';
// ... existing imports

resolve: companyScopedProcedure
  .input(z.object({
    id: z.number().int().positive(),
    finalValues: z.record(z.unknown()),
  }))
  .mutation(async ({ ctx, input }) => {
    return await ctx.db.transaction(async (tx) => {
      // 1. Fetch + lock the conflict row, scoped to user/company.
      const [pending] = await tx
        .select()
        .from(conflictPending)
        .where(and(
          eq(conflictPending.id, input.id),
          eq(conflictPending.companyId, ctx.user.companyId),
          eq(conflictPending.userId, ctx.user.id),
        ))
        .for('update');

      if (!pending) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'CONFLICT_NOT_FOUND' });
      }
      if (pending.resolvedAt !== null) {
        throw new TRPCError({ code: 'CONFLICT', message: 'CONFLICT_ALREADY_RESOLVED' });
      }

      // 2. Apply finalValues through the same diff dispatcher.
      const sourceRow = await fetchSourceRow(tx, pending.tableName, pending.rowId);
      const detection = detectFieldConflicts(
        sourceRow,
        pending.baseUpdatedAt,
        input.finalValues,
        // For resolution, "snapshot" is theirsValues — what we believed the row looked like
        // when the conflict was first parked. If a third writer has moved past that, recursion.
        pending.theirsValues,
      );

      if (detection.kind === 'row_deleted') {
        // Mark resolved with a sentinel; UI will show "row was deleted" toast.
        await tx.update(conflictPending)
          .set({ resolvedAt: new Date() })
          .where(eq(conflictPending.id, pending.id));
        return { ok: true as const, sourceDeleted: true };
      }

      if (detection.kind === 'conflict') {
        // Recursive conflict — a third writer changed the same field again.
        const [newConflict] = await tx
          .insert(conflictPending)
          .values({
            companyId: ctx.user.companyId,
            userId: ctx.user.id,
            tableName: pending.tableName,
            rowId: pending.rowId,
            conflictFields: detection.fields,
            mineValues: pickFields(input.finalValues, detection.fields),
            theirsValues: detection.theirsValues,
            baseUpdatedAt: pending.baseUpdatedAt,
          })
          .returning({ id: conflictPending.id });

        return { ok: false as const, recursiveConflictId: newConflict.id };
      }

      // 3. Apply the user's final values to the source row.
      await applyToSource(tx, pending.tableName, pending.rowId, input.finalValues);
      await tx.update(conflictPending)
        .set({ resolvedAt: new Date() })
        .where(eq(conflictPending.id, pending.id));

      return { ok: true as const };
    });
  }),
```

Add helpers at the bottom of the same file:

```ts
async function fetchSourceRow(tx: any, tableName: string, rowId: number) {
  // Single-table dispatch for now (rfis); generalize as more tables get queueable.
  if (tableName === 'rfis') {
    const [row] = await tx.select().from(rfis).where(eq(rfis.id, rowId)).for('update');
    return row ?? null;
  }
  throw new TRPCError({ code: 'BAD_REQUEST', message: `unsupported tableName: ${tableName}` });
}

async function applyToSource(tx: any, tableName: string, rowId: number, values: Record<string, unknown>) {
  if (tableName === 'rfis') {
    await tx.update(rfis).set({ ...values, updatedAt: new Date() }).where(eq(rfis.id, rowId));
    return;
  }
  throw new TRPCError({ code: 'BAD_REQUEST', message: `unsupported tableName: ${tableName}` });
}

function pickFields(obj: Record<string, unknown>, fields: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) if (f in obj) out[f] = obj[f];
  return out;
}
```

(Add `import { rfis } from '../../drizzle/schema';` at the top.)

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test -- tests/conflicts-router.test.ts
```

Expected: all PASS (list + resolve).

- [ ] **Step 5: Commit**

```bash
git add server/routers/conflicts.ts tests/conflicts-router.test.ts
git commit -m "feat(sync): conflicts.resolve with recursive-conflict semantics"
```

---

## Task 7: Client types — `QueuedMutation.baseSnapshot` + `ReplayOutcome`

The client side begins. Type extensions only; no behaviour change yet.

**Files:**
- Modify: `lib/sync-queue.tsx`

- [ ] **Step 1: Add the type extensions**

In `lib/sync-queue.tsx`, locate `QueuedMutation` (~line 28). Replace with:

```ts
export interface QueuedMutation {
  id: string;
  type: string;
  payload: unknown;
  createdAt: string;
  retries: number;
  lastError?: string;

  // NEW — UPDATE-type mutations only. Captured at form-open by the caller.
  baseSnapshot?: {
    rowId: number;
    updatedAt: string;                     // ISO from when user opened the row
    originalValues: Record<string, unknown>; // values of fields user is changing, AS THEY WERE
  };

  // NEW — set when a replay parked the mutation as a conflict, so the UI
  // can route the user to the corresponding conflict_pending row.
  conflictId?: number;
}
```

Locate `ReplayOutcome` (~line 86). Replace with:

```ts
export type ReplayOutcome = 'success' | 'transient' | 'auth' | 'permanent' | 'conflict' | 'row_deleted';
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm check
```

Expected: PASS. (No callers reference the new fields yet.)

- [ ] **Step 3: Commit**

```bash
git add lib/sync-queue.tsx
git commit -m "feat(sync): extend QueuedMutation and ReplayOutcome for conflicts"
```

---

## Task 8: Extend `classifyReplayResponse` to recognize new HTTP shapes

Server returns 200 with `{status: 'conflict' | 'row_deleted'}` on those branches. The classifier currently treats any 2xx as `'success'` — we need to peek the body.

**Files:**
- Modify: `lib/sync-queue.tsx`
- Modify: `tests/sync-queue.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/sync-queue.test.ts`:

```ts
import { classifyReplayResponse } from '../lib/sync-queue';

describe('classifyReplayResponse — conflict/row_deleted', () => {
  it('classifies HTTP 200 + body.status="conflict" as "conflict"', () => {
    expect(classifyReplayResponse(200, { status: 'conflict', conflictId: 42, fields: ['description'] })).toEqual({
      kind: 'conflict',
      conflictId: 42,
      fields: ['description'],
    });
  });

  it('classifies HTTP 200 + body.status="row_deleted" as "row_deleted"', () => {
    expect(classifyReplayResponse(200, { status: 'row_deleted' })).toEqual({ kind: 'row_deleted' });
  });

  it('still classifies HTTP 200 with no special body as "success"', () => {
    expect(classifyReplayResponse(200, { status: 'success' })).toEqual({ kind: 'success' });
    expect(classifyReplayResponse(200, undefined)).toEqual({ kind: 'success' });
  });

  it('still classifies 401 as "auth", 5xx as "transient" regardless of body', () => {
    expect(classifyReplayResponse(401, undefined)).toEqual({ kind: 'auth' });
    expect(classifyReplayResponse(503, undefined)).toEqual({ kind: 'transient' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test -- tests/sync-queue.test.ts -t classifyReplayResponse
```

Expected: FAIL — `classifyReplayResponse` currently takes only `status`, not `body`, and returns a string not an object.

- [ ] **Step 3: Update `classifyReplayResponse` signature**

In `lib/sync-queue.tsx`, replace the existing `classifyReplayResponse` function:

```ts
/**
 * Classify a replay response. Returns a discriminated union so the conflict
 * branch can carry the conflictId + fields back to the caller for parking.
 *
 * The previous string-returning shape was simpler but couldn't pass the
 * conflictId through; now every callsite gets the carrier object.
 */
export type ClassifiedReplay =
  | { kind: 'success' }
  | { kind: 'transient' }
  | { kind: 'auth' }
  | { kind: 'permanent' }
  | { kind: 'conflict'; conflictId: number; fields: string[] }
  | { kind: 'row_deleted' };

export function classifyReplayResponse(
  status: number | null,
  body?: { status?: 'success' | 'conflict' | 'row_deleted'; conflictId?: number; fields?: string[] },
): ClassifiedReplay {
  if (status === null) return { kind: 'transient' };
  if (status === 401 || status === 403) return { kind: 'auth' };
  if (status >= 200 && status < 300) {
    if (body?.status === 'conflict' && typeof body.conflictId === 'number' && Array.isArray(body.fields)) {
      return { kind: 'conflict', conflictId: body.conflictId, fields: body.fields };
    }
    if (body?.status === 'row_deleted') {
      return { kind: 'row_deleted' };
    }
    return { kind: 'success' };
  }
  if (status >= 400 && status < 500) return { kind: 'permanent' };
  return { kind: 'transient' };
}
```

- [ ] **Step 4: Update `executeMutation` to pass the body**

Within `lib/sync-queue.tsx`, find `executeMutation` (~line 187). Replace:

```ts
const executeMutation = async (mutation: QueuedMutation): Promise<ClassifiedReplay> => {
  try {
    const token = await Auth.getSessionToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const { url, body } = buildSyncReplayRequest(getApiBaseUrl(), mutation);
    const response = await fetch(url, { method: 'POST', headers, credentials: 'include', body });
    let parsed: any = undefined;
    try { parsed = await response.json(); } catch { /* body might be empty */ }
    // tRPC envelopes responses as { result: { data: ... } }
    const inner = parsed?.result?.data ?? parsed;
    return classifyReplayResponse(response.status, inner);
  } catch {
    return classifyReplayResponse(null);
  }
};
```

(Adapt the `inner` extraction to whatever envelope shape the existing tests assume; if the existing dispatcher already returns flat `{status: ...}`, drop the `?.result?.data` chain.)

- [ ] **Step 5: Run tests to verify they pass**

```bash
pnpm test -- tests/sync-queue.test.ts -t classifyReplayResponse
```

Expected: 4 PASS. The existing tests in this file may need a one-line update (`expect(result).toBe('success')` → `expect(result.kind).toBe('success')`) — make those changes if the test file has them.

- [ ] **Step 6: Commit**

```bash
git add lib/sync-queue.tsx tests/sync-queue.test.ts
git commit -m "feat(sync): classifyReplayResponse parses conflict/row_deleted bodies"
```

---

## Task 9: `replayQueue` parks on conflict, drops on row_deleted

The replay loop's switch statement needs two new cases.

**Files:**
- Modify: `lib/sync-queue.tsx`
- Test: `tests/sync-queue-conflict.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/sync-queue-conflict.test.ts`:

```ts
/**
 * Tests for the replay loop's handling of conflict and row_deleted outcomes.
 *
 * The replay loop is in `lib/sync-queue.tsx` and is exercised here via a
 * fake-fetch + fake-AsyncStorage harness — same shape as tests/sync-replay.test.ts
 * already uses for the existing outcome branches.
 */
import { describe, expect, it } from 'vitest';
import { runReplayWithMockedFetch, primeQueue, readQueueAfter } from './_helpers/sync-replay-harness';

describe('replayQueue — conflict outcome', () => {
  it('parks the conflicted mutation in queue with conflictId, continues to the next', async () => {
    await primeQueue([
      { id: 'a', type: 'rfis.update', payload: {}, baseSnapshot: { rowId: 1, updatedAt: 'T0', originalValues: {} } },
      { id: 'b', type: 'rfis.update', payload: {}, baseSnapshot: { rowId: 2, updatedAt: 'T0', originalValues: {} } },
    ]);

    await runReplayWithMockedFetch({
      a: { status: 200, body: { status: 'conflict', conflictId: 42, fields: ['description'] } },
      b: { status: 200, body: { status: 'success' } },
    });

    const after = await readQueueAfter();
    // Conflicted mutation stays; success mutation is gone.
    expect(after).toHaveLength(1);
    expect(after[0].id).toBe('a');
    expect(after[0].conflictId).toBe(42);
    expect(after[0].lastError).toBe('Awaiting resolution');
    // Retries did NOT increment (conflict is not a retryable error).
    expect(after[0].retries).toBe(0);
  });

  it('drops mutation on row_deleted', async () => {
    await primeQueue([
      { id: 'a', type: 'rfis.update', payload: {}, baseSnapshot: { rowId: 99, updatedAt: 'T0', originalValues: {} } },
    ]);

    await runReplayWithMockedFetch({
      a: { status: 200, body: { status: 'row_deleted' } },
    });

    const after = await readQueueAfter();
    expect(after).toHaveLength(0);
  });

  it('continues processing other mutations even after a conflict (does not halt like auth)', async () => {
    await primeQueue([
      { id: 'a', type: 'rfis.update', payload: {}, baseSnapshot: { rowId: 1, updatedAt: 'T0', originalValues: {} } },
      { id: 'b', type: 'rfis.update', payload: {}, baseSnapshot: { rowId: 2, updatedAt: 'T0', originalValues: {} } },
      { id: 'c', type: 'rfis.update', payload: {}, baseSnapshot: { rowId: 3, updatedAt: 'T0', originalValues: {} } },
    ]);

    await runReplayWithMockedFetch({
      a: { status: 200, body: { status: 'conflict', conflictId: 42, fields: ['x'] } },
      b: { status: 200, body: { status: 'success' } },
      c: { status: 200, body: { status: 'success' } },
    });

    const after = await readQueueAfter();
    expect(after).toHaveLength(1); // only the parked conflict
    expect(after[0].id).toBe('a');
  });
});
```

(Adapt `tests/_helpers/sync-replay-harness.ts` if needed — the existing `tests/sync-replay.test.ts` has a similar harness; reuse or extend it.)

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test -- tests/sync-queue-conflict.test.ts
```

Expected: FAIL — replay loop doesn't recognize the new outcomes.

- [ ] **Step 3: Update the replay loop**

In `lib/sync-queue.tsx`, find the `switch (outcome)` block inside `replayQueue` (~line 232). Replace the inner type and switch:

```ts
const classified = await executeMutation(mutation);
switch (classified.kind) {
  case 'success':
    break;
  case 'permanent':
    break;
  case 'auth':
    remaining.push({ ...mutation, lastError: 'Session expired — waiting for re-login' });
    sawAuthFailure = true;
    break;
  case 'conflict':
    // Park — don't bump retries, don't halt the loop. Other rows can still replay.
    remaining.push({
      ...mutation,
      conflictId: classified.conflictId,
      lastError: 'Awaiting resolution',
    });
    break;
  case 'row_deleted':
    // Drop — the row this mutation targets no longer exists. UI surfaces a toast
    // separately via the conflicts listing (the mutation is gone for good).
    break;
  case 'transient':
  default:
    remaining.push({ ...mutation, retries: mutation.retries + 1, lastError: 'Network error' });
    await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
    break;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test -- tests/sync-queue-conflict.test.ts tests/sync-queue.test.ts tests/sync-replay.test.ts
```

Expected: all PASS. Existing replay tests stay green because the success/auth/permanent/transient branches are functionally unchanged.

- [ ] **Step 5: Commit**

```bash
git add lib/sync-queue.tsx tests/sync-queue-conflict.test.ts
git commit -m "feat(sync): replay loop parks conflicts, drops on row_deleted"
```

---

## Task 10: `useSyncConflicts` hook

A thin TanStack-Query wrapper around `trpc.conflicts.list({resolved:false})`. Drives the banner count and the badge on list rows.

**Files:**
- Create: `lib/use-sync-conflicts.tsx`
- Test: `tests/use-sync-conflicts.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/use-sync-conflicts.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useSyncConflicts } from '../lib/use-sync-conflicts';
import { wrapWithMockTrpc } from './_helpers/trpc-mock';

describe('useSyncConflicts', () => {
  it('returns count and rows from conflicts.list', async () => {
    const { result } = renderHook(() => useSyncConflicts(), {
      wrapper: wrapWithMockTrpc({
        'conflicts.list': () => [
          { id: 1, tableName: 'rfis', rowId: 1, conflictFields: ['description'], mineValues: {}, theirsValues: {}, createdAt: 'T', resolvedAt: null },
          { id: 2, tableName: 'rfis', rowId: 2, conflictFields: ['status'],     mineValues: {}, theirsValues: {}, createdAt: 'T', resolvedAt: null },
        ],
      }),
    });
    await waitFor(() => expect(result.current.count).toBe(2));
    expect(result.current.conflicts).toHaveLength(2);
  });

  it('returns count=0 and empty conflicts when none exist', async () => {
    const { result } = renderHook(() => useSyncConflicts(), {
      wrapper: wrapWithMockTrpc({ 'conflicts.list': () => [] }),
    });
    await waitFor(() => expect(result.current.count).toBe(0));
  });
});
```

(Reuse `tests/_helpers/trpc-mock.ts` if it exists; otherwise add a small helper that wraps a TanStack QueryClientProvider + tRPC mock.)

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test -- tests/use-sync-conflicts.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the hook**

Create `lib/use-sync-conflicts.tsx`:

```ts
import { trpc } from '@/lib/trpc';

/**
 * Live view of unresolved conflicts for the current user. Used by the global
 * banner and by list-row badges. TanStack Query handles caching + refetch on
 * focus.
 */
export function useSyncConflicts() {
  const query = trpc.conflicts.list.useQuery(
    { resolved: false },
    {
      refetchOnWindowFocus: true,
      // After a resolve mutation, conflicts.list is invalidated by the resolve
      // hook itself (Task 13). The 60s default staleTime is fine here.
    },
  );

  return {
    conflicts: query.data ?? [],
    count: (query.data ?? []).length,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test -- tests/use-sync-conflicts.test.ts
```

Expected: 2 PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/use-sync-conflicts.tsx tests/use-sync-conflicts.test.ts
git commit -m "feat(sync): useSyncConflicts hook drives banner + badges"
```

---

## Task 11: Global banner + injection in `_layout.tsx`

A small banner below the existing sync banner. Tappable; routes to the conflicts list (or directly to a single conflict if there's only one).

**Files:**
- Create: `components/ConflictBanner.tsx`
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Write the banner**

Create `components/ConflictBanner.tsx`:

```tsx
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSyncConflicts } from '@/lib/use-sync-conflicts';

export function ConflictBanner() {
  const { count, conflicts } = useSyncConflicts();
  if (count === 0) return null;

  const onPress = () => {
    if (count === 1) router.push(`/conflicts/${conflicts[0].id}`);
    else router.push('/conflicts');
  };

  return (
    <Pressable onPress={onPress} className="bg-amber-100 border-b border-amber-400 px-4 py-2 flex-row justify-between items-center">
      <View>
        <Text className="text-amber-900 font-semibold">
          {count === 1 ? '1 conflict needs resolution' : `${count} conflicts need resolution`}
        </Text>
        <Text className="text-amber-700 text-xs">queued offline · tap to resolve</Text>
      </View>
      <Text className="text-amber-900 font-bold">→</Text>
    </Pressable>
  );
}
```

- [ ] **Step 2: Inject into `_layout.tsx`**

In `app/_layout.tsx`, locate the existing sync-status banner (search for `SyncQueueProvider` or whatever wraps the sync banner). Inject `<ConflictBanner />` immediately below the sync banner so they stack:

```tsx
import { ConflictBanner } from '@/components/ConflictBanner';

// ... within the providers tree, just below the existing sync banner:
<ConflictBanner />
```

- [ ] **Step 3: Run typecheck**

```bash
pnpm check
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add components/ConflictBanner.tsx app/_layout.tsx
git commit -m "feat(sync): global ConflictBanner with route-on-tap behaviour"
```

---

## Task 12: `app/conflicts/index.tsx` — list of unresolved conflicts

Reached by the banner when `count > 1`. A simple list; tapping a row navigates to the resolution sheet.

**Files:**
- Create: `app/conflicts/index.tsx`

- [ ] **Step 1: Write the list screen**

Create `app/conflicts/index.tsx`:

```tsx
import React from 'react';
import { ScrollView, Text, View, Pressable } from 'react-native';
import { router, Stack } from 'expo-router';
import { useSyncConflicts } from '@/lib/use-sync-conflicts';

export default function ConflictsListScreen() {
  const { conflicts, isLoading } = useSyncConflicts();

  return (
    <View className="flex-1 bg-white">
      <Stack.Screen options={{ title: 'Conflicts' }} />
      {isLoading ? (
        <Text className="p-4 text-gray-500">Loading…</Text>
      ) : conflicts.length === 0 ? (
        <Text className="p-4 text-gray-500">No unresolved conflicts.</Text>
      ) : (
        <ScrollView>
          {conflicts.map(c => (
            <Pressable
              key={c.id}
              onPress={() => router.push(`/conflicts/${c.id}`)}
              className="border-b border-gray-200 p-4 flex-row justify-between items-center"
            >
              <View className="flex-1">
                <Text className="font-semibold">{labelForTable(c.tableName)} #{c.rowId}</Text>
                <Text className="text-gray-500 text-sm mt-1">
                  {c.conflictFields.length === 1
                    ? `${c.conflictFields[0]} conflicts`
                    : `${c.conflictFields.length} fields conflict`}
                </Text>
              </View>
              <Text className="text-gray-400">→</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function labelForTable(t: string): string {
  if (t === 'rfis') return 'RFI';
  return t;
}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm check
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/conflicts/index.tsx
git commit -m "feat(sync): app/conflicts list screen"
```

---

## Task 13: `app/conflicts/[id].tsx` — polymorphic resolution sheet

The user-facing resolution UI. Reads `conflicts.list` for the row, picks the widget per field via `CONFLICT_FIELD_KINDS`, lets the user produce `finalValues`, calls `conflicts.resolve`.

**Files:**
- Create: `app/conflicts/[id].tsx`

- [ ] **Step 1: Write the resolution sheet**

Create `app/conflicts/[id].tsx`:

```tsx
import React, { useState } from 'react';
import { ScrollView, Text, TextInput, View, Pressable, Alert } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSyncConflicts } from '@/lib/use-sync-conflicts';
import { trpc } from '@/lib/trpc';
import { CONFLICT_FIELD_KINDS, type ConflictTableName, type ConflictFieldKind } from '@/drizzle/conflict-registry';

export default function ConflictResolutionScreen() {
  const { id: idStr } = useLocalSearchParams<{ id: string }>();
  const id = Number(idStr);

  const { conflicts, refetch } = useSyncConflicts();
  const conflict = conflicts.find(c => c.id === id);

  // Local edit state — keyed by field name. Pre-populated from "mine" so the user
  // sees their work first; they can switch to theirs or edit a merged value.
  const [draft, setDraft] = useState<Record<string, unknown>>(
    () => ({ ...(conflict?.mineValues ?? {}) }),
  );

  const resolveMut = trpc.conflicts.resolve.useMutation({
    onSuccess: async (result) => {
      await refetch();
      if ('recursiveConflictId' in result && result.recursiveConflictId) {
        router.replace(`/conflicts/${result.recursiveConflictId}`);
        Alert.alert('Conflict updated', 'Another writer changed this row again. Please re-resolve.');
        return;
      }
      router.back();
    },
    onError: (err) => {
      if (err.data?.code === 'CONFLICT' && /ALREADY_RESOLVED/.test(err.message)) {
        Alert.alert('Already resolved', 'This conflict was resolved on another device.');
        router.back();
        return;
      }
      Alert.alert('Resolve failed', err.message);
    },
  });

  if (!conflict) {
    return (
      <View className="flex-1 bg-white p-4">
        <Stack.Screen options={{ title: 'Resolve conflict' }} />
        <Text className="text-gray-500">Conflict not found — it may have been resolved on another device.</Text>
      </View>
    );
  }

  const tableKind: Record<string, ConflictFieldKind> | undefined =
    (CONFLICT_FIELD_KINDS as any)[conflict.tableName];

  return (
    <ScrollView className="flex-1 bg-white" contentContainerStyle={{ padding: 16 }}>
      <Stack.Screen options={{ title: 'Resolve conflict' }} />
      <Text className="text-gray-500 mb-4">
        {conflict.tableName} #{conflict.rowId} · {conflict.conflictFields.length} field
        {conflict.conflictFields.length === 1 ? '' : 's'} conflict
      </Text>

      {conflict.conflictFields.map(field => {
        const kind = tableKind?.[field] ?? 'text';
        const mine = (conflict.mineValues as any)[field];
        const theirs = (conflict.theirsValues as any)[field];

        return (
          <View key={field} className="border border-gray-200 rounded-lg p-3 mb-3">
            <Text className="text-xs uppercase text-gray-500 mb-1">{field}</Text>

            {kind === 'atomic' ? (
              <View className="flex-row gap-2 mt-2">
                <Pressable
                  onPress={() => setDraft(d => ({ ...d, [field]: mine }))}
                  className={`flex-1 px-3 py-2 rounded border ${draft[field] === mine ? 'bg-blue-100 border-blue-500' : 'bg-white border-gray-300'}`}
                >
                  <Text className="text-sm">Mine: {String(mine)}</Text>
                </Pressable>
                <Pressable
                  onPress={() => setDraft(d => ({ ...d, [field]: theirs }))}
                  className={`flex-1 px-3 py-2 rounded border ${draft[field] === theirs ? 'bg-blue-100 border-blue-500' : 'bg-white border-gray-300'}`}
                >
                  <Text className="text-sm">Theirs: {String(theirs)}</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <View className="flex-row gap-2 mb-2 mt-1">
                  <View className="flex-1 border border-gray-200 rounded p-2">
                    <Text className="text-xs text-gray-500">Mine</Text>
                    <Text className="text-sm mt-1">{String(mine)}</Text>
                  </View>
                  <View className="flex-1 border border-gray-200 rounded p-2">
                    <Text className="text-xs text-gray-500">Theirs</Text>
                    <Text className="text-sm mt-1">{String(theirs)}</Text>
                  </View>
                </View>
                <TextInput
                  multiline
                  className="border border-gray-300 rounded px-2 py-1 min-h-[60px]"
                  value={String(draft[field] ?? '')}
                  onChangeText={(v) => setDraft(d => ({ ...d, [field]: v }))}
                />
              </>
            )}
          </View>
        );
      })}

      <View className="flex-row justify-end gap-2 mt-2">
        <Pressable
          onPress={() => setDraft({ ...conflict.theirsValues })}
          className="px-3 py-2 rounded border border-gray-300"
        >
          <Text>Discard mine</Text>
        </Pressable>
        <Pressable
          disabled={resolveMut.isPending}
          onPress={() => resolveMut.mutate({ id, finalValues: draft })}
          className="px-4 py-2 rounded bg-indigo-600"
        >
          <Text className="text-white font-semibold">{resolveMut.isPending ? 'Applying…' : 'Apply'}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm check
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/conflicts/\[id\].tsx
git commit -m "feat(sync): resolution sheet — polymorphic widgets per field kind"
```

---

## Task 14: Wire RFI edit flow as the canonical caller

The first (and for Phase 3.7, only) UPDATE caller wired to capture a snapshot at form-open and pass it through `enqueue`. Other tables get wired in follow-ups.

**Files:**
- Modify: `app/rfi-detail.tsx` (or wherever the RFI edit form lives — search for `enqueue.*rfi` or `trpc.rfis.update`)

- [ ] **Step 1: Locate the edit form**

```bash
grep -nE "rfis\.update|enqueue.*rfi" /root/cortexbuild-field/app/ -r
```

The relevant file is the screen where the user can edit an RFI (description, status, etc.). Open it.

- [ ] **Step 2: Capture snapshot at form open**

Near the top of the component, after the initial query that fetches the RFI:

```tsx
import { useEffect, useRef } from 'react';
// ... existing imports

const rfiQuery = trpc.rfis.byId.useQuery({ id: rfiId });
const snapshotRef = useRef<{ rowId: number; updatedAt: string; originalValues: Record<string, unknown> } | null>(null);

useEffect(() => {
  // Capture once, the first time the row's data lands. This freezes "what the
  // user is editing against." If they re-open the form later (after a refetch
  // or a back-and-forth), we deliberately keep the original snapshot — see
  // spec § 2 (snapshot capture timing).
  if (snapshotRef.current === null && rfiQuery.data) {
    snapshotRef.current = {
      rowId: rfiQuery.data.id,
      updatedAt: typeof rfiQuery.data.updatedAt === 'string'
        ? rfiQuery.data.updatedAt
        : rfiQuery.data.updatedAt.toISOString(),
      originalValues: pickEditableFields(rfiQuery.data),
    };
  }
}, [rfiQuery.data]);

function pickEditableFields(row: typeof rfiQuery.data extends infer T ? T : never): Record<string, unknown> {
  if (!row) return {};
  return {
    description: row.description,
    notes:       row.notes,
    status:      row.status,
    severity:    row.severity,
    assigneeId:  row.assigneeId,
    dueDate:     row.dueDate,
  };
}
```

- [ ] **Step 3: Pass snapshot to `enqueue` at submit**

Find the existing submit handler (probably calls `enqueue('rfis.update', payload)` or `trpc.rfis.update.mutate(...)`). Replace with:

```tsx
const onSubmit = async (formValues: { description: string; notes?: string; status: string; ... }) => {
  if (!snapshotRef.current) {
    Alert.alert('Cannot save yet', 'RFI data still loading.');
    return;
  }
  await syncQueue.enqueue('rfis.update', { id: rfiId, ...formValues }, snapshotRef.current);
  router.back();
};
```

(If the existing submit goes through `trpc.rfis.update.mutate(...)` directly when online, leave that path as-is for online users; only the offline-queue branch needs the snapshot. Check what happens when `syncQueueStatus !== 'online'` and inject the snapshot there.)

- [ ] **Step 4: Smoke-test offline flow manually**

```bash
pnpm dev
```

In a simulator:
1. Open an RFI, note its current `description`.
2. Toggle airplane mode (or kill network).
3. Edit the description, save. The mutation enqueues.
4. From a second browser/session online, edit the *same* RFI's description to a different value.
5. Re-enable network on the simulator.
6. Banner appears: "1 conflict needs resolution."
7. Tap; resolution sheet shows mine + theirs side-by-side with editable text.
8. Apply with merged text. RFI now reflects the merged value.

(Capture screenshots in the PR description.)

- [ ] **Step 5: Add a coverage entry to the registry coverage test**

Already covered by Task 2 since `rfis` is the only table. No change needed here unless you've added more tables in your branch.

- [ ] **Step 6: Run the full test suite**

```bash
pnpm test
```

Expected: all tests pass. Total count ~1051 (was 1019).

- [ ] **Step 7: Commit**

```bash
git add app/rfi-detail.tsx  # or whichever file you modified
git commit -m "feat(sync): RFI edit form captures + sends baseSnapshot"
```

---

## Task 15: Mark ROADMAP § 3.7 done + run final checks

**Files:**
- Modify: `docs/ROADMAP.md`

- [ ] **Step 1: Mark Phase 3.7 in ROADMAP**

Open `docs/ROADMAP.md`. Find the row for Phase 3.7 (the table near the top, plus the § 3.7 detail section). Update both to `✅ DONE (2026-05-06)` with the spec/plan commits referenced. Example shape (matching how 3.4 and 3.6 are documented):

```markdown
### 3.7 — Offline sync: conflict resolution ✅ DONE (2026-05-06)

**Tasks:**
1. ✅ `conflict_pending` sidecar table + Drizzle schema (commit `<task1>`)
2. ✅ `CONFLICT_FIELD_KINDS` registry + coverage meta-test (commit `<task2>`)
3. ✅ `detectFieldConflicts` server-side detector (commit `<task3>`)
4. ✅ `sync.replay` dispatcher integration (commit `<task4>`)
5. ✅ `conflicts.list` + `conflicts.resolve` tRPC, recursive-conflict semantics (commits `<task5>`, `<task6>`)
6. ✅ Client queue extensions + new `ClassifiedReplay` shape (commits `<task7>`–`<task9>`)
7. ✅ `useSyncConflicts` hook + global banner + list screen + polymorphic resolution sheet (commits `<task10>`–`<task13>`)
8. ✅ RFI edit form wired as canonical UPDATE caller (commit `<task14>`)

**Acceptance:** Two users editing the same RFI offline see a non-destructive merge UI on reconnect. ✅ Met.

**Tests added:** ~32 (1019 → ~1051). Spec: `docs/superpowers/specs/2026-05-06-offline-sync-conflicts-design.md`. Plan: `docs/superpowers/plans/2026-05-06-offline-sync-conflicts.md`.
```

(Replace each `<taskN>` with the actual commit SHA from `git log --oneline | head -20`.)

- [ ] **Step 2: Run full test suite + typecheck + lint**

```bash
pnpm test && pnpm check && pnpm lint
```

Expected: all green.

- [ ] **Step 3: Commit**

```bash
git add docs/ROADMAP.md
git commit -m "docs(roadmap): mark Phase 3.7 ✅ DONE"
```

- [ ] **Step 4: Push and confirm deploy**

```bash
git push
```

Watch for the GH Actions deploy run; verify `/api/version` flips on production after ~5 minutes. Smoke-test the conflict path end-to-end with the manual recipe from Task 14 Step 4.

---

## Self-review notes

**Spec coverage:** Every section of the spec is implemented:

| Spec section | Plan task |
|---|---|
| § 4 data model | Task 1 |
| § 5.1 `detectFieldConflicts` | Tasks 3, 4 |
| § 5.2 `conflicts.list` | Task 5 |
| § 5.2 `conflicts.resolve` (incl. recursive) | Task 6 |
| § 6.1 `QueuedMutation.baseSnapshot` | Task 7 |
| § 6.1 `ReplayOutcome` extension | Task 7 |
| § 6.1 `classifyReplayResponse` | Task 8 |
| § 6.1 `replayQueue` branches | Task 9 |
| § 6.3 `useSyncConflicts` hook | Task 10 |
| § 6.4 global banner | Task 11 |
| § 6.4 list screen | Task 12 |
| § 6.4 resolution sheet (polymorphic) | Task 13 |
| § 6.2 caller wiring | Task 14 |
| § 7 field-type registry | Task 2 |
| § 7 coverage meta-test | Task 2 |
| § 9 testing strategy | Tasks 3, 6, 8, 9, 10 |
| § 11 acceptance criteria | Task 14 manual smoke + Task 15 final checks |

**No placeholders:** Every "TODO" in helper-fixture stubs (e.g. `seedDbWithTwoUsers`) is a marker for the engineer to write the fixture body following the existing pattern in sibling test files (`tests/push-preferences-router.test.ts`, etc.). The structural intent is concrete and the fixture pattern already exists in the repo — not inventable, just adaptable.

**Type consistency:** `ClassifiedReplay` (Task 8) is the discriminated union returned by `classifyReplayResponse` and consumed by `replayQueue` (Task 9). `DetectorResult` (Task 3) is exported from `sync-conflict-detector.ts` and consumed by both `sync-replay-dispatcher.ts` (Task 4) and `conflicts.ts` resolve (Task 6). `ConflictFieldKind` (Task 2) is consumed by the resolution sheet (Task 13).
