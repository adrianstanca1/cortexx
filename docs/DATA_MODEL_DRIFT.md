# Data-Model Drift — raw SQL vs Prisma

_As of 2026-07-18 · v1.4.0_

CortexBuild Pro carries **two data models that have drifted apart**. This is a P0 structural risk.

## The two models

| | Canonical (live API) | Parallel (Next.js only) |
|---|---|---|
| **Where** | `server/db/schema.sql` | `prisma/schema.prisma` |
| **Engine** | Raw SQL, applied at Postgres volume init via `docker-compose.yml` | Prisma 7 |
| **Consumed by** | Express API (`server/`) → serves `cortexbuildpro.com` `/api/*` | Next.js 16 web admin (`app/`) |
| **Size** | **34 `CREATE TABLE`** statements | **82 `model` blocks** |
| **Authority** | ✅ **Source of truth** for everything the product actually persists | ❌ Parallel model — **not** what the Express API reads/writes |

## Why this matters

- The live product (`cortexbuildpro.com`) is served by the **Express + raw-SQL** path. The `/api/:collection` routes, sync, portal, ledger, HMRC, banking, IAP, and intelligence endpoints all read/write the SQL tables.
- Prisma's 82 models are used by the Next.js admin stack only. They do **not** define the backend contract.
- Any developer who treats `schema.prisma` as the backend source of truth will build against a model that the production API does not honour.

## Reconciliation tooling

`scripts/align-prisma-to-sql.mjs` reads `server/db/schema.sql`, parses every `CREATE TABLE`, and emits a Prisma model skeleton (one `model` per real table) — a starting point for aligning Prisma down to the 34 tables the backend actually persists.

```bash
node scripts/align-prisma-to-sql.mjs   # print skeleton + drift report
```

## The fix (P0)

Unify on one model. The recommended direction is to make Prisma reflect the raw SQL schema (SQL stays canonical because it is what production runs), or to collapse the two so the three frontends share a single, verified contract via `@cortexbuild/core`.

Until then: **when in doubt, `server/db/schema.sql` wins.**
