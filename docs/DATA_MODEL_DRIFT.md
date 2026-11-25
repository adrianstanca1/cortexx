# Data-Model Drift — raw SQL vs Prisma

_Historical mapping snapshot: 2026-07-18 (v1.4.0); raw-SQL and Prisma counts refreshed 24 November 2026. The model-by-model mapping has not been re-derived since July._

## TL;DR

The earlier "82 vs 34 = 2.4× table explosion" framing was **wrong**. Current
counts are **112 Prisma `model` blocks** and **36 raw-SQL tables**, but these
schemas belong to separate API implementations: raw SQL is used by the legacy
Express API, while Prisma models and migrations define the designated Next.js
production stack. The July mapping analysis is historical and must not be read as
proof that the current schemas are equivalent.

## What the numbers actually mean

| | Raw SQL (`server/db/schema.sql`) | Prisma (`prisma/schema.prisma`) |
|---|---|---|
| Count (24 Nov 2026) | **36 `CREATE TABLE`** (49 across `server/db/`, including migrations) | **112 `model` blocks** |
| Role | Legacy Express API's raw-SQL schema; not the current production runtime | Next.js 16 app's typed data model and migration authority; designated production stack |

- At the July snapshot, **79 of the 82 Prisma models then present mapped to a real
  raw-SQL table** (e.g. `actionPlan` → `action_plans`, `kaizenCard` →
  `kaizen_cards`, `serviceCatalogItem` → `service_catalog_items`), all actively
  used by `app/`. The mapping has not been re-derived since; `node
  scripts/prisma-drift-check.mjs` prints the current totals on every run.
- In the July snapshot, many Prisma models used different names for SQL tables
  (camelCase singular vs snake_case plural). Do not assume that mapping still
  describes all 112 current Prisma models; re-derive it before using it for a
  migration or deployment decision.

## July snapshot findings to revalidate

These findings describe the July schema comparison, not a verified compatibility
assessment of the current production stack.

1. **Missing model in that snapshot:** the `workspaces` table (tenant root)
   had **no Prisma model**. Recheck the current schemas and Next.js access patterns
   before treating this as an active production gap.
2. **Intentional JSONB/system tables in the legacy Express schema:** 24 tables are
   persisted only via its generic `/api/:collection` namespace or purpose-built
   auth/integration/sync routes and were intentionally Prisma-free (`documents_store`,
   `ai_history`, `audit_log`, `photos`, `portal_tokens`, `magic_links`,
   `hmrc_submissions`, `bank_connections`, `iap_entitlements`, `sync_log`, …).
3. **Legacy/orphan models (safe to keep for now):** `Account`, `Session`,
   `VerificationToken` are next-auth v5 convention names not yet wired to an
   Email provider — kept for future use, documented as allowed orphans.

## Enforcement (best-effort heuristic)

Do not mechanically collapse the Prisma model set onto the raw-SQL tables. The
schemas serve different API implementations; establish data ownership and a
verified mapping before changing either. The CI script is a heuristic, not a
migration plan or production-readiness proof.

- **`scripts/prisma-drift-check.mjs`** — CI heuristic (wired into `.github/workflows/ci.yml`
  after `prisma format --check`). It flags raw-SQL tables without name-matching
  Prisma models (excluding its allowlist) and Prisma models with no matching SQL
  table and no source references. A passing result does not prove schema parity;
  re-review the allowlist and mapping when either runtime changes.
- **`scripts/align-prisma-to-sql.mjs`** — reference generator that emits a
  Prisma skeleton from `schema.sql` (one `model` per real table). Useful when
  bootstrapping a new model for a currently-unmodelled table (e.g. `Workspace`).

## Rule of thumb

`server/db/schema.sql` is authoritative **for the legacy Express API only**.
Prisma schema and migrations define the Next.js app's data model. The CI drift
script is a best-effort cross-check between these distinct schemas, not proof of
schema equivalence or production compatibility. Resolve changes against the
runtime that owns the affected data.
