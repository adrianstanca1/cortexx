# Phase 3.7 — Offline sync: conflict resolution

**Status:** Design — pending implementation
**Date:** 2026-05-06
**Roadmap:** `docs/ROADMAP.md` § Phase 3.7
**Acceptance:** Two users editing the same RFI offline see a non-destructive merge UI on reconnect.

---

## 1. Goals

1. Detect concurrent edits to a row when an offline mutation replays after a server-side change happened in between.
2. Auto-merge edits that touch *different* fields. Surface a resolution UI only when both writers changed the *same* field — false-positive fatigue is what kills conflict UIs in practice.
3. When a same-field conflict surfaces, present the right widget per data type: atomic (Keep Mine / Use Theirs) for enums/dates/FKs/numbers; an editable merge text area for free-text fields.
4. Generic over tables. Adding a new mutation through the sync queue must not require any new server-side conflict-detection code, just a registry entry per editable column.
5. Don't halt the queue on a conflict. Conflicts are per-row; other queued mutations for unrelated rows must still replay.

---

## 2. Decisions table

| Choice | Decision | Why |
|---|---|---|
| **Detection granularity** | Field-level (server diffs the touched columns) | Row-level produces a conflict every time two foremen touch the same RFI for *different* reasons. The banner-fatigue cost outweighs the implementation savings. |
| **Resolution UX** | Hybrid — atomic widgets for atomic fields, editor for text | Construction rows are mostly atomic (status enum, severity, dueDate, FK). Always-editable forces a textarea on `status: submitted vs answered`; atomic-only throws away salvageable text on `description`. Hybrid hits the right widget ~80% of the time. |
| **Architecture** | Snapshot-based optimistic concurrency | Queue mutation grows a `baseSnapshot` field; server diffs on replay. ~150 LOC server, no per-table schema migrations. CRDT-lite would migrate 26+ tables; LWW silently loses work. |
| **Mutation scope** | UPDATE-type mutations only (Phase 3.7) | Roadmap language is "two users editing." CREATE conflicts (duplicate creation) are addressed by idempotency keys, out of scope. DELETE conflicts (concurrent delete + update) are deferred — out of scope for 3.7. |
| **Snapshot capture timing** | At form-open time, not save-time | Form-open is when the user sees the values they're acting on. Capturing at save would miss any server-side change between open and save, defeating the snapshot's purpose. |
| **Field-type registry** | Hand-maintained `drizzle/conflict-registry.ts`; meta-test pins coverage | Drizzle column-type introspection is brittle (per CLAUDE.md note about `Symbol.for('drizzle:Name')`). A flat literal table + a coverage test is simpler and self-documenting. |
| **Conflict storage** | New `conflict_pending` table (one migration) | Sidecar avoids per-table changes. Tenant-scoped via `companyId`. Index on `(companyId, userId, resolvedAt)` for the hot query. |
| **Queue-loop semantics** | Conflict parks one item, queue continues | Auth halts the whole queue (every mutation will 401); conflict halts only the affected row (rest are independent). |
| **Resolution endpoint** | `conflicts.resolve(id, finalValues)` is itself a normal write | Goes through the same diff dispatcher. A second user racing to resolve the same conflict gets a fresh `'conflict'` outcome — clean recursion, no resolution-time special case. |
| **Multi-device same user** | Resolution can happen on any device | The `conflict_pending` row is the resolution unit; the queued mutation parks in AsyncStorage with `outcome:'conflict'` and `conflictId` linking it. |

---

## 3. Architecture

```
┌──────────────────────────────────┐
│ MOBILE — offline edit             │
│  user opens RFI #42                │
│  captures: rfi.updatedAt + values │
│  user edits → save                 │
│  enqueue({                         │
│    type: 'rfis.update',            │
│    payload: {id, description},     │
│    baseSnapshot: {                 │
│      rowId, updatedAt, originalValues } │
│  })                                │
└─────────────────┬────────────────┘
                  │ network back
                  ▼
┌──────────────────────────────────┐
│ SERVER — sync.replay dispatcher   │
│  detectFieldConflicts():          │
│    SELECT row FOR UPDATE          │
│    for each field in payload:     │
│      if row[f] != snapshot[f]     │
│        AND row[f] != payload[f]:  │
│        → conflictFields.push(f)   │
│  if conflictFields.empty:         │
│    apply(); return {success}      │
│  else:                            │
│    INSERT conflict_pending(...)   │
│    return {conflict, conflictId,  │
│             fields}               │
└─────────────────┬────────────────┘
                  │ {status:'conflict'}
                  ▼
┌──────────────────────────────────┐
│ MOBILE — sync queue               │
│  parks mutation with              │
│    outcome: 'conflict'            │
│    conflictId                     │
│  continues processing other       │
│  queued mutations                 │
│  surfaces banner via              │
│    useSyncConflicts() hook        │
└─────────────────┬────────────────┘
                  │ user taps banner
                  ▼
┌──────────────────────────────────┐
│ MOBILE — app/conflicts/[id].tsx   │
│  for each conflictField:          │
│    kind = CONFLICT_FIELD_KINDS    │
│           [tableName][field]      │
│    render atomic | text widget    │
│  user picks/edits → Apply         │
│  → conflicts.resolve(id, values)  │
└──────────────────────────────────┘
```

---

## 4. Data model

One new table; no per-table schema changes:

```ts
// drizzle/schema.ts
export const conflictPending = pgTable('conflict_pending', {
  id:              serial('id').primaryKey(),
  companyId:       integer('companyId').notNull().references(() => companies.id),
  userId:          integer('userId').notNull().references(() => users.id),
  tableName:       varchar('tableName', { length: 64 }).notNull(),
  rowId:           integer('rowId').notNull(),
  conflictFields:  jsonb('conflictFields').notNull().$type<string[]>(),
  mineValues:      jsonb('mineValues').notNull().$type<Record<string, unknown>>(),
  theirsValues:    jsonb('theirsValues').notNull().$type<Record<string, unknown>>(),
  baseUpdatedAt:   timestamp('baseUpdatedAt').notNull(),
  resolvedAt:      timestamp('resolvedAt'),
  createdAt:       timestamp('createdAt').defaultNow().notNull(),
}, (t) => ({
  byUserUnresolved: index().on(t.companyId, t.userId, t.resolvedAt),
}));
```

Migration: `drizzle/0013_conflict_pending.sql`. Retention: a daily cron keeps `resolvedAt IS NOT NULL AND resolvedAt < now() - interval '30 days'` rows for tombstone; older are hard-deleted.

---

## 5. Server contract

### 5.1 `sync.replay` extension

The existing dispatcher gains a per-mutation pre-flight when `baseSnapshot` is present:

```ts
// server/_core/sync-conflict-detector.ts (new)
export async function detectFieldConflicts(
  tx: PgTransaction<...>,
  table: AnyPgTable,
  rowId: number,
  baseUpdatedAt: Date,
  payload: Record<string, unknown>,
  baseSnapshot: Record<string, unknown>,
): Promise<
  | { kind: 'ok' }
  | { kind: 'conflict'; fields: string[]; theirsValues: Record<string, unknown> }
  | { kind: 'row_deleted' }
>
```

If `kind === 'conflict'`, the dispatcher inserts a `conflict_pending` row in the same transaction, then returns to the client `{status: 'conflict', conflictId, fields}` (HTTP 200; conflict isn't an error).

If `kind === 'row_deleted'`, returns `{status: 'row_deleted'}` — the client surfaces "This row was deleted by another user" and discards the mutation.

If `kind === 'ok'`, applies the UPDATE and returns `{status: 'success'}`.

### 5.2 New tRPC procedures

Both behind `companyScopedProcedure`:

```
conflicts.list({ resolved?: boolean })
  → { id, tableName, rowId, conflictFields, mineValues, theirsValues, createdAt, resolvedAt }[]

conflicts.resolve({ id, finalValues: Record<string, unknown> })
  → { ok: true, updatedRow: <the now-current source row, type matches the table> }
```

`conflicts.resolve` semantics:

1. `SELECT conflict_pending FOR UPDATE` — ensure the row exists, belongs to current user, and `resolvedAt IS NULL`. Otherwise `CONFLICT_ALREADY_RESOLVED`.
2. Apply `finalValues` to the source row using the same diff dispatcher (`detectFieldConflicts`) — itself can return `'conflict'` (rare race) or `'success'`.
3. On success, mark `resolvedAt = now()`. On nested conflict, the new `conflict_pending` row supersedes; old row keeps `resolvedAt` null and the user re-resolves.

---

## 6. Client changes

### 6.1 `lib/sync-queue.tsx`

Three localized changes:

**(a)** `QueuedMutation` gains optional `baseSnapshot`:
```ts
baseSnapshot?: {
  rowId: number;
  updatedAt: string;             // ISO
  originalValues: Record<string, unknown>;
};
```

**(b)** `ReplayOutcome` gains `'conflict'` and `'row_deleted'`:
```ts
export type ReplayOutcome = 'success' | 'transient' | 'auth' | 'permanent' | 'conflict' | 'row_deleted';
```

`classifyReplayResponse` learns the new shape (HTTP 200 with `body.status === 'conflict' | 'row_deleted'`). Other call sites unchanged.

**(c)** `replayQueue` decision tree gains two branches: `'conflict'` parks the mutation with `lastError: 'Awaiting resolution'` and a `conflictId` field; `'row_deleted'` drops it and surfaces a one-shot toast. Neither halts the loop.

### 6.2 `enqueue` callers

UPDATE-type call sites follow a two-step pattern:

1. **Capture at form open** — when the row's data first lands in component state (the initial `trpc.<table>.byId` query result), stash `{updatedAt, originalValues}` into a ref or `useState`. This freezes "what the user is editing against."
2. **Pass at submit** — when the user submits, `enqueue('rfis.update', payload, capturedSnapshot)`.

CREATE/DELETE call sites unchanged.

### 6.3 New hook `lib/use-sync-conflicts.tsx`

Wraps `trpc.conflicts.list({ resolved: false })` with TanStack `useQuery`. Exposes:

```ts
useSyncConflicts(): {
  conflicts: ConflictRow[];
  count: number;
  refetch: () => void;
}
```

### 6.4 Resolution UI

- `app/conflicts/index.tsx` — list of unresolved (route from global banner when count > 1).
- `app/conflicts/[id].tsx` — resolution sheet for one conflict. Polymorphic per field via the registry (§ 7).
- New global banner component injected below the existing sync banner in `app/_layout.tsx`.
- New badge on list rows in screens that render rows of conflictable types (RFIs, defects, daily reports). Implementation: list rows query `useSyncConflicts()` and decorate by `tableName + rowId` match.

---

## 7. Field-type registry

```ts
// drizzle/conflict-registry.ts (new)
export type ConflictFieldKind = 'atomic' | 'text';

export const CONFLICT_FIELD_KINDS = {
  rfis: {
    description: 'text',
    notes: 'text',
    status: 'atomic',
    severity: 'atomic',
    assigneeId: 'atomic',
    dueDate: 'atomic',
  },
  defects: {
    description: 'text',
    resolution: 'text',
    status: 'atomic',
    severity: 'atomic',
    assigneeId: 'atomic',
  },
  // ... one entry per table whose mutations carry baseSnapshot
} as const satisfies Record<string, Record<string, ConflictFieldKind>>;
```

`tests/conflict-registry-coverage.test.ts` enumerates every `pgTable` in `drizzle/schema.ts` whose UPDATE mutations are queueable, walks its column list, and asserts each editable column has a kind registered. New editable column → test fails with a clear missing-kind message.

---

## 8. Error handling

| Scenario | Handling |
|---|---|
| `conflicts.resolve` network failure | tRPC retry; user sees toast; sheet stays open with their edits in component state |
| Resolution arrives but row was deleted server-side | Server `NOT_FOUND` → sheet shows "Deleted by another user. Discard?" — only path is discard |
| 401 during resolution | Standard re-login; TanStack cache preserves user's in-progress edits |
| Two devices race the same conflict | First wins (`resolvedAt IS NULL` gate inside resolution txn); second gets `CONFLICT_ALREADY_RESOLVED`, refetches and shows current row |
| Server-side edit during resolution | The Apply itself goes through the diff dispatcher → can produce a *new* conflict. Acceptable: resolution is itself a write, recursion handles it. |
| `baseSnapshot` missing on a UPDATE-type mutation | Treated as a programming error — server returns `BAD_REQUEST` with `MISSING_SNAPSHOT_FOR_UPDATE`. Caught by typing at call sites; tests pin the error code. |

---

## 9. Testing strategy

| Test file | Coverage |
|---|---|
| `tests/sync-conflict-detector.test.ts` | Pure unit: `detectFieldConflicts(row, snapshot, payload)` → expected outcome. ~15 cases including no-conflict, all-fields-conflict, partial-conflict, snapshot-stale (`updatedAt` change but value match), row-deleted, missing-snapshot. |
| `tests/sync-queue-conflict.test.ts` | Replay loop with mocked dispatcher returning `'conflict'`; verify mutation parks (not dropped, retries unchanged), queue continues to next item, banner-count hook reflects state. |
| `tests/conflicts-router.test.ts` | `conflicts.list` filters by user/company, paginates; `conflicts.resolve` is idempotent, FORBIDDEN cross-tenant, recursive-conflict produces a new `conflict_pending` and leaves the old one. |
| `tests/conflict-registry-coverage.test.ts` | Meta-test: every editable column in every queueable table has a registered kind. |
| `tests/sync-replay-dispatcher.test.ts` (extend) | Recognizes new `'conflict'` and `'row_deleted'` HTTP shapes from server. |

Estimated **~32 new tests**, taking total from 1019 → ~1051. No existing test should break.

---

## 10. Out of scope (Phase 3.7)

- **CREATE-type conflicts** — handled by idempotency keys, deferred to a later phase (no current pain reported).
- **DELETE-type conflicts** — concurrent delete + update; deferred to a separate phase.
- **Non-tenant tables** — `companies`, `users` (managed by admins, not field workers, conflicts are vanishingly rare).
- **Bulk conflict resolution** — "accept all theirs" across N rows; addable later if the inbox volume warrants.
- **Conflict on `updatedAt` itself** — system-managed; never user-editable.
- **Real-time conflict notification** — push or websocket telling other users "your edit is now conflicted." Out of scope; banner is sufficient on reconnect.

---

## 11. Acceptance criteria (verifiable)

1. ✅ A queued UPDATE mutation that races a server-side edit on a *different* field applies cleanly, no UI shown.
2. ✅ A queued UPDATE mutation that races a server-side edit on the *same* field parks in the queue with `outcome:'conflict'`, creates a `conflict_pending` row, surfaces the global banner, and the queue continues processing other mutations.
3. ✅ The resolution sheet renders atomic widgets for `status`-class fields and a textarea for `description`-class fields, driven by `CONFLICT_FIELD_KINDS`.
4. ✅ `conflicts.resolve` applies the user's `finalValues` to the source row in one transaction; recursive conflicts produce a new `conflict_pending` and the old one stays unresolved.
5. ✅ Two devices racing the same resolution: first wins; second receives `CONFLICT_ALREADY_RESOLVED` and refetches.
6. ✅ A row deleted server-side while the user has a queued UPDATE produces `'row_deleted'` and a discard toast — never crashes the queue or leaves the mutation orphaned.
7. ✅ A new editable column added to a queueable table without a registry entry fails `conflict-registry-coverage.test.ts` with a clear missing-kind message.
8. ✅ All existing 1019 tests continue to pass; new total is ~1051.

---

## 12. Detailed sub-plan handoff

To be produced via `superpowers:writing-plans` once this spec is user-approved. Plan target: `docs/superpowers/plans/2026-05-06-offline-sync-conflicts.md`.
