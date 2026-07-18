# Data-Model Drift — raw SQL vs Prisma

_As of 2026-07-18 · v1.4.0 — REVISED after deep-dive verification_

## TL;DR

The earlier "82 vs 34 = 2.4× table explosion" framing was **wrong**. The two
models describe the **same ~34 underlying tables**. The real issue is a
**naming/casing convention mismatch**, plus **one genuine missing model** and
**three legacy/orphan models**.

## What the numbers actually mean

| | Raw SQL (`server/db/schema.sql`) | Prisma (`prisma/schema.prisma`) |
|---|---|---|
| Count | **34 `CREATE TABLE`** | **82 `model` blocks** |
| Role | ✅ **Source of truth** — Express API persists these at `cortexbuildpro.com` via `/api/:collection` | Next.js 16 admin's typed client |

- **79 of the 82 Prisma models map to a real raw-SQL table** (e.g. `actionPlan`
  → `action_plans`, `kaizenCard` → `kaizen_cards`, `serviceCatalogItem` →
  `service_catalog_items`). They are **actively used** by `app/` (verified by
  grepping `prisma.<model>` call sites — 79 distinct models referenced).
- The "extra" Prisma models are mostly **different names for the same 34
  tables** (camelCase singular vs snake_case plural), not new tables.

## The three real problems

1. **Missing model (genuine gap):** the `workspaces` table (tenant root)
   has **no Prisma model at all**. The Next.js admin references workspaces but
   has no typed access. → _Tracked; TODO: add `model Workspace`._
2. **Intentional JSONB/system tables (by design):** 23 tables are persisted
   only via the generic `/api/:collection` JSONB namespace or purpose-built
   auth/integration routes and are intentionally Prisma-free (`documents_store`,
   `ai_history`, `audit_log`, `photos`, `portal_tokens`, `magic_links`,
   `hmrc_submissions`, `bank_connections`, `iap_entitlements`, …).
3. **Legacy/orphan models (safe to keep for now):** `Account`, `Session`,
   `VerificationToken` are next-auth v5 convention names not yet wired to an
   Email provider — kept for future use, documented as allowed orphans.

## Enforcement (the actual fix)

A mechanical 82→34 collapse would **rename 79 used models and break
`next build`** — do NOT do it. Instead we enforce alignment going forward:

- **`scripts/prisma-drift-check.mjs`** — CI guard (wired into `.github/workflows/ci.yml`
  after `prisma format --check`). It fails on:
  - a raw-SQL table with no Prisma model (excluding the 23 intentional ones
    + the 1 tracked gap `workspaces`), or
  - a Prisma model with no SQL table AND no usage anywhere in `app/ components/
    lib/ server/`.
  - Runs green today; turns red on any net-new drift.
- **`scripts/align-prisma-to-sql.mjs`** — reference generator that emits a
  Prisma skeleton from `schema.sql` (one `model` per real table). Useful when
  bootstrapping a new model for a currently-unmodelled table (e.g. `Workspace`).

## Rule of thumb

**When in doubt, `server/db/schema.sql` wins.** Prisma is the admin's typed
view of the canonical SQL model — not an independent source of truth.
