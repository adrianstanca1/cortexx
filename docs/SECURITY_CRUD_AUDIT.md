# Security Audit — Generic `/api/:collection` CRUD Catch-All

**Scope:** `server/index.js` generic collection REST handlers, their collection-name
handling, field/query construction, tenant isolation, and the `INTEGRATION_PUBLIC`
allowlist. Line numbers refer to `server/index.js` as of this audit.

**Handlers under review:**

| Method | Route | Line |
|--------|-------|------|
| GET    | `/api/:collection`      | ~300 |
| POST   | `/api/:collection`      | ~335 |
| PUT    | `/api/:collection/:id`  | ~357 |
| DELETE | `/api/:collection/:id`  | ~378 |

All four are mounted **after** the specific routers (lines 261–271) and guarded by
`apiLimiter` + `auth` (JWT Bearer, line 94).

---

## (a) Are system / tenant-admin tables reachable via the generic route?

### Original behaviour (before this change)

The generic route routes a collection name to a physical table only via two
allowlists and a name map:

- `NATIVE` (lines 276–285) — collections with first-class typed tables.
- `TYPED_JSONB` (lines 330–333) — TEXT-id + `data JSONB` tables.
- `tableFor()` (line 298) maps camelCase → snake_case; **defaults to the raw
  collection name** when not in the map.

For **GET**, a name **not** in `NATIVE` falls through to a parameterised
`documents_store` query scoped by collection (line 325) — it does **not** read an
arbitrary table. For **POST/PUT/DELETE**, a name not in `TYPED_JSONB` writes to
`documents_store` (lines 348–352, 369–373, 386). So arbitrary raw-table **reads**
of `users`/`workspaces` etc. were **not** possible through GET, because those
names are absent from `NATIVE` and thus never reach `SELECT * FROM <tbl>`.

**However**, this safety was *incidental* (it relied on those names simply not
being in the allowlists), not *intentional* (there was no explicit denial). Risks:

1. **No defence-in-depth / no explicit denial.** Any future addition of a
   sensitive table name to `NATIVE`/`TYPED_JSONB`, or any change to `tableFor()`,
   would silently expose it. There was no guard asserting "these names are never
   valid here."
2. **`documents_store` namespace pollution.** An authenticated user could
   POST to `/api/users` and create a *workspace-scoped `documents_store`
   document* under collection `"users"`. This does not touch the real `users`
   table, but it shadows/pollutes the sync namespace and could confuse clients
   or later code that trusts collection names.
3. **Sensitive names had no clear "off-limits" contract**, making review and
   future maintenance error-prone.

### After this change

A new module **`server/security.js`** exports `isRestrictedCollection(name)` and a
`RESTRICTED_COLLECTIONS` denylist. All four handlers call it **first** and return
**403 `collection_restricted`** for any denylisted name (added at the top of each
handler, immediately after destructuring `req.params`). System/auth/audit/
integration-secret tables are now **explicitly** unreachable via the generic route,
regardless of the `NATIVE`/`TYPED_JSONB` allowlist contents.

**Denylist (case-insensitive; covers snake_case + camelCase aliases):**

- `users`, `workspaces` — tenant/auth records, password hashes, roles, PII
- `magic_links` — passwordless login tokens
- `portal_tokens` — client-portal share tokens (grant project access)
- `api_keys` — reserved (no table today; denied pre-emptively)
- `audit_log` (+ `audit`) — immutable hash-chained audit trail
- `sync_log` — internal sync bookkeeping
- `bank_connections` — OAuth access/refresh tokens (encrypted at rest)
- `iap_entitlements` — subscription entitlement state
- `hmrc_submissions` — HMRC filing payloads (request/response XML)
- `push_subscriptions` — device push endpoints
- `ai_history` — AI prompt/response memory (may contain sensitive content)

These tables all have (or should have) purpose-built, separately-authorised
routes (e.g. `/api/audit` at line 414, `/api/admin/*` behind `adminAuth` at
line 428, integration routers behind `integrationAuth`).

---

## (b) Field-level validation / raw-body-to-SQL

**Verdict: No field-level validation exists. The full request body is stored
verbatim as JSONB.** This is by design for the SPA's schemaless sync model, and
it is **not a SQL-injection risk** because:

- All values are passed as **parameterised** query bindings (`$1..$n`), never
  string-concatenated. E.g. POST writes `req.body` as `$3`/`$4` (lines 343, 351).
- The **only** identifier interpolated into SQL text is the table name, and that
  comes from `tableFor(collection)` gated by the `NATIVE`/`TYPED_JSONB`
  allowlists (and now the denylist) — never directly from user input for
  arbitrary tables. `orderCol` (line 311–312) and `LIMIT/OFFSET` (line 315–317)
  are drawn from fixed maps / integer-clamped, not raw input.

**Residual (documented, not fixed — out of scope / by design):**

- There is **no allowlist of writable fields** per collection. A client can
  store arbitrary keys in the JSONB `data` blob. For `documents_store` and the
  `TYPED_JSONB` tables this is intentional (forward-compatible schemaless store).
- The typed columns of `TYPED_JSONB` tables (e.g. `receipts.amount`) are **not**
  populated from the body by the generic POST/PUT — only `id`, `workspace_id`,
  and the whole `data` blob are written (lines 340–344). So there is no way to
  spoof a typed column via the generic route; hot columns are only promoted by
  dedicated routes / migrations.
- `id` is client-controllable (line 337) but always co-scoped with
  `workspace_id` in the upsert `ON CONFLICT` key, so it cannot overwrite another
  tenant's row (see tenant isolation below).

No change was made here — introducing per-field validation would break the
schemaless sync contract and risks silent data loss. Flagged for product/human
review if a stricter schema is desired.

---

## (c) Tenant isolation — **VERDICT: SCOPED (correct)**

Every generic handler scopes by the authenticated user's `workspace_id`
(`req.user.ws`, set from the verified JWT at line 96):

- **GET** native: `... WHERE workspace_id=$1 ...` with `[req.user.ws]` (line 318).
- **GET** documents_store: `... WHERE workspace_id=$1 AND collection=$2` (line 325).
- **POST** typed: insert `(id, workspace_id, data)` with `req.user.ws`; upsert key
  is `(id)` but the row's `workspace_id` is always the caller's (lines 341–344).
- **POST** documents_store: upsert keyed `(workspace_id, collection, doc_id)` with
  `req.user.ws` (lines 349–351).
- **PUT** typed / documents_store: same `req.user.ws` scoping (lines 362–365,
  369–373).
- **DELETE** typed: `DELETE ... WHERE id=$1 AND workspace_id=$2` (line 382).
- **DELETE** documents_store: `... WHERE workspace_id=$1 AND collection=$2 AND
  doc_id=$3` (line 386).

**Note (minor, documented — not a cross-tenant read/write hole):** For the
`TYPED_JSONB` POST/PUT upserts (lines 341, 362) the `ON CONFLICT (id)` target is
the primary key `id` alone, while the inserted `workspace_id` is always the
caller's. Because `id` for these tables is a client-supplied TEXT value, a caller
who *guesses another tenant's row id* would, on conflict, run
`DO UPDATE SET data=$3` — the `WHERE`-less upsert does **not** re-check that the
existing row's `workspace_id` matches the caller. In principle this allows a
cross-tenant **overwrite** of a `TYPED_JSONB` row if an attacker knows/guesses a
victim's opaque row id. Ids are UUIDs/`crypto.randomUUID()` or client TEXT, so
this is low-probability, but it is a real gap.

- **Not auto-fixed** because the correct fix (add
  `WHERE <tbl>.workspace_id = $2` to the `ON CONFLICT DO UPDATE`, or a
  `WHERE workspace_id=$2` guard) changes upsert semantics and needs testing
  against the sync client's replay path (`routes/sync.js`
  `/sync/bulk`) which shares the same pattern. **Flagged for human review.**
- The GET/DELETE paths are fully scoped and safe. DELETE explicitly ANDs
  `workspace_id`, so it cannot delete another tenant's row.

---

## (d) `INTEGRATION_PUBLIC` correctness — **VERDICT: CORRECT, matches the 3 documented endpoints**

`INTEGRATION_PUBLIC` (lines 107–111) is exactly:

```
GET /banking/callback   — TrueLayer OAuth redirect (browser top-level navigation)
POST /iap/webhook       — Stripe webhook (signature-verified inside iap.js)
GET /push/vapid         — public VAPID key
```

- Matches the 3 endpoints documented in `CLAUDE.md`. Nothing extra is
  unauthenticated. `integrationAuth` (lines 112–116) falls through to `auth` for
  every other path on the integration routers (mounted lines 265–270).
- The Stripe raw-body exception (`express.raw` on `/api/iap/webhook`, line 56) is
  registered **before** `express.json()` (line 57) — correct and unchanged.
- **Left EXACTLY as-is.** No loosening.

---

## Summary of changes

| File | Change |
|------|--------|
| `server/security.js` | **New.** `RESTRICTED_COLLECTIONS` denylist + pure `isRestrictedCollection()`. |
| `server/index.js` | `require('./security')`; 403 guard at the top of all four generic handlers. |
| `test/crud-security.test.js` | **New.** Asserts GET/POST for denylisted collections → 403, plus predicate coverage. |

**Behavioural impact:** none for legitimate business collections (projects,
tasks, invoices, receipts, snags, rfis, … all still allowed). Only the sensitive
system/integration table names — which the frontend never uses as collections —
now return 403 instead of silently hitting `documents_store`.

**Open items flagged for human review (not auto-fixed):**

1. `TYPED_JSONB` upsert `ON CONFLICT (id)` lacks a `workspace_id` re-check →
   theoretical cross-tenant overwrite by guessed row id. Same pattern in
   `routes/sync.js`.
2. No per-field write validation (by design — schemaless sync).
