# Cortexx — Product Status

_One-page status as of **2026-07-18** · v1.4.0 · supersedes the 6 Jun 2026 review below the fold_

Cortexx (**CortexBuild Pro**) is a UK SMB construction-management platform live at **cortexbuildpro.com**: an autonomous AI CEO (Vera) plus contractor tooling, delivered as a monorepo with three client stacks over one backend.

---

## Architecture

**One backend, three frontends** (all consume `/api/*`; contract shared via `@cortexbuild/core`):

| Target | Path | Stack |
|--------|------|-------|
| Offline PWA | `Cortexx.html` + `lib/` → `dist/` | Vanilla JS, Babel-in-browser, no bundler; offline-first; private Ollama LLM |
| Web admin | `app/`, `prisma/` | Next.js 16, React 19, next-auth v5, Prisma 7, Tailwind v4 |
| Native | `expo/`, `ios/` | Expo SDK 57 / Capacitor 8.4 |

**Backend** (`server/`): Express + PostgreSQL, multi-tenant (`workspace_id`), JWT + magic-link auth, SSE realtime, Ollama LLM. 11 route modules (banking, hmrc, iap, llm, payments, push, sync, portal, ledger, intelligence, agents). Deployed via `docker-compose.yml` (Postgres 16 + Express + Ollama + Caddy). Canonical data model is **raw SQL** (`server/db/schema.sql`).

---

## What's live

- ✅ Production PWA at cortexbuildpro.com — **113** precompiled modules (phases through 118), **15** dashboard layouts, `<1s` cold start, offline-capable.
- ✅ Express + Postgres backend — multi-tenant, JWT + magic-link, SSE realtime, local Ollama LLM (no external keys).
- ✅ Next.js 16 web admin — **110+** pages.
- ✅ Monorepo consolidation with shared `@cortexbuild/core` (commit `7865114d`).
- ✅ iOS Capacitor 8 + Expo SDK 57 native shell, build-ready (commit `b3974259`).
- ✅ 8-dangling-nav fix (commit `d2cc8713`); cloud-sync on shared core (commit `8e83da72`).
- ✅ **234 tests passing** (`npm test`); `node build-dist.js --check` reports `dist/` in sync with `lib/`.
- ✅ Vera autonomous CEO + 5-person leadership team (Marcus Pound, Pip Carter, Ada Whitfield, River Ng).

---

## What's blocked

- 🚧 **iOS App Store submission** — requires a **Mac + Apple Developer account** (provisioning, universal-links/AASA, StoreKit IAP). **Not reproducible from this Linux VPS.** Runbooks: `expo/DEPLOY-IOS.md`, `ios/README.md`, `app-store/SUBMISSION.md`.
- ⚠️ Native Expo app is a **thin 5-screen shell**, not a full mirror of the PWA — feature parity is future work.

---

## Top 3 P0 fixes

1. **Nav registry** — replace the **184-branch** `sheet === '…'` dispatcher in `lib/app-main.jsx` with a declarative **SheetRegistry** (`test/nav-registry.test.js` seeds this).
2. **Docs accuracy** — README/ROADMAP/STATUS were stale (wrong module count, outdated Capacitor version, "no backend" and static-only deploy claims). **Fixed in this pass** — keep them true to v1.4.0.
3. **Data-model unification** — two divergent models: **raw SQL (34 tables)** canonical vs **Prisma (82 models)** parallel. Unify. See [`docs/DATA_MODEL_DRIFT.md`](docs/DATA_MODEL_DRIFT.md) + `scripts/align-prisma-to-sql.mjs`.

---

## Health snapshot

| Signal | State |
|--------|-------|
| Version | 1.4.0 |
| Tests | 234 passing |
| `dist/` ↔ `lib/` | in sync (`build-dist.js --check` = 0) |
| Workaround markers (TODO/FIXME/HACK/XXX/WORKAROUND) | ~32 across `lib/`+`server/`+`app/`+`packages/` — triage backlog |
| Nav dispatcher | 184 branches — refactor pending |
| Data models | 2 (drifted) — unify pending |

See [`ROADMAP.md`](ROADMAP.md) § Status (2026-07-18) for detail and [`CLAUDE.md`](CLAUDE.md) for architecture + deployment.
