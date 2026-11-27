# Cortexx — The Construction OS that thinks with you

UK SMB contractor management with an autonomous AI CEO (**Vera**). One product, **three client targets**, a staged Next.js production stack, and a legacy Express API.

[![Version](https://img.shields.io/badge/version-1.7.6-2563eb)](CHANGELOG.md)
[![PWA](https://img.shields.io/badge/PWA-offline--first-2563eb)](manifest.json)
[![iOS](https://img.shields.io/badge/iOS-Capacitor%208.4-1a73e8)](ios/README.md)
[![Expo](https://img.shields.io/badge/Expo-SDK%2057-000)](expo/DEPLOY-IOS.md)
[![CI](https://github.com/adrianstanca1/cortexx/actions/workflows/ci.yml/badge.svg)](https://github.com/adrianstanca1/cortexx/actions/workflows/ci.yml)

![Cortexx](icon.svg)

---

## What Cortexx is today

Cortexx (product name **CortexBuild Pro**) is a UK SMB construction-management platform whose production domain is **cortexbuildpro.tech**. It is a monorepo with three client stacks and two API implementations: the Next.js app (`app/api/`) and a legacy Express API (`server/`). The designated production stack is the isolated Next.js Compose deployment; see [`MONOREPO.md`](MONOREPO.md) for the repository layout.

> **The public domain does not serve HTTPS (verified 24 November 2026).** `https://cortexbuildpro.tech` fails at the TLS handshake; its A record still resolves to `85.190.100.68`, the retired host. The replacement stack at `85.190.122.27` has staging health evidence only. The verified source-data restore, acceptance and cutover remain outstanding. PR #476's CI matrix passed, but GitHub still shows a historical Backup Verify SSH failure against the retired host. Local changes now target the new VPS with a gated app-only rebuild; they are not active on `main` yet. Details: [`STATUS.md`](STATUS.md), [`docs/RUNBOOK.md`](docs/RUNBOOK.md).

### Three deployment targets

| # | Target | Path | Stack | Role |
|---|--------|------|-------|------|
| 1 | **Offline PWA** | `Cortexx.html` + `lib/` → `dist/` | Vanilla JS, Babel-in-browser (no bundler) | Offline-first, local-first, private Ollama LLM |
| 2 | **Web app and admin** | `app/`, `components/`, `prisma/` | Next.js 16, React 19, next-auth v5, Prisma 7, Tailwind v4 | Designated production server stack; currently staged, not accepted |
| 3 | **Native (iOS + Android)** | `expo/`, `ios/` | Expo SDK 57 / Capacitor 8.4 | Native clients |

The clients do not currently have one verified, interchangeable live backend. PWA/native clients were built against the Express API contract; the Next.js app has its own route handlers and Prisma data model. `@cortexbuild/core` (`packages/core`) shares API types/helpers in parts of the repo, but compatibility of every workflow with the replacement stack remains an acceptance gate. PWA business data is also held locally in localStorage and IndexedDB and syncs optionally.

---

## Legacy Express API (`server/`)

Express + PostgreSQL. `server/index.js` is the entry point; route modules live in `server/routes/`.

> This is **not the production runtime**. The designated production target is the isolated Next.js Compose stack in `docker-compose.construction.yml`; it is staged, not accepted. The retired Express/static deployment is not the current production path. See [`STATUS.md`](STATUS.md) and [`docs/RUNBOOK.md`](docs/RUNBOOK.md).

- **Multi-tenant** via `workspace_id`
- **Auth**: JWT (Bearer) + magic-link
- **Realtime**: Server-Sent Events (SSE) per workspace
- **LLM**: **Ollama** local inference — no external API keys
- **Data model**: `server/db/schema.sql` defines the legacy Express API's raw-SQL schema. The Next.js app uses Prisma models and migrations; these are separate data-model authorities. See [`docs/DATA_MODEL_DRIFT.md`](docs/DATA_MODEL_DRIFT.md).

**Route modules** (`server/routes/`): `banking` (TrueLayer open-banking), `hmrc` (CIS300), `iap` (Stripe / StoreKit), `llm`, `payments`, `push`, `sync`, `portal`, `ledger`, `intelligence`, `agents`, plus the operator surface `admin`, `admin-features`, `admin-ai` and `api-connections`.

The historical Express deployment used `docker-compose.yml`: `db` (Postgres 16), `api` (Express), `ollama` (local LLM), and `web` (Caddy static host + reverse proxy). The designated replacement stack is `docker-compose.construction.yml`.

---

## Repository counts (reviewed 24 November 2026)

> Canonical release: **v1.7.6**, chosen to match the latest `CHANGELOG.md` entry. Root package, lockfile and production Compose version metadata are aligned to this release; older deployment records remain historical.

| Area | Count |
|------|-------|
| SPA screen/logic modules (`lib/*.jsx` / `lib/*.js` → `dist/*.js`) | **135** modules; phase modules through **phase 120** |
| Dashboard layouts | **15** (`dashboards.jsx` + `dashboards-v2…v5.jsx`) |
| Next.js pages (`app/**/page.tsx`) | **131** |
| Expo native app | **26 screens** (`expo/*Screen.tsx`) behind a tabbed shell (SDK 57 / Capacitor 8), sharing `@cortexbuild/core` |
| Backend route modules | **15** (`server/routes/`) |
| Backend data model | **36 legacy Express SQL tables** (49 including its migrations) and **112 Next.js Prisma models**; separate schemas, not directly comparable ([details](docs/DATA_MODEL_DRIFT.md)) |
| AI leadership team | **Vera** autonomous CEO + 5-person leadership team |
| Test suite | **871** `test()` declarations (grep count over `test/*.test.js`, `test/*.ts` and `packages/core/test`, 24 Nov 2026; CI reports the pass total), plus the PostgreSQL integration suite and six browser shards |

> Honesty note: the native `expo/` app covers 26 screens (login, projects, overview, tasks, tickets, check-in, photos, documents, drawings, RFIs, deliveries, timesheets, safety, snags, profile, field hub/controls/readiness/closeout) sharing the cross-app API contract — broad, but not a full mirror of the 135-module PWA. The PWA is the feature-complete client.

---

## Quick start

```bash
# 1) Offline PWA — no build, no server needed for local dev
open Cortexx.html                 # loads precompiled dist/
open "Cortexx.html?dev=1"         # hot-edit JSX via in-browser Babel
open "Cortexx.html?perf=1"        # perf HUD

# 2) Next.js web admin + API dev server
npm run dev

# 3) Native (Expo)
cd expo && npm install && npx expo start
```

Node **26.x LTS**, npm **>=10**.

---

## Build

```bash
npm run build              # next build && precompile (rebuilds dist/ from lib/)
npm run precompile         # node build-dist.js — rebuild dist/ from lib/
node build-dist.js --check # byte-verify dist/ vs lib/ sync, exit 1 on drift
npm test                   # node --test test/*.test.js
```

`build-dist.js` is the SPA builder: `lib/*.jsx` → Babel → `dist/*.js`; `lib/*.js` copied verbatim; `.ts`/other server-only files are **not** emitted. `postinstall` runs `precompile`, so `npm install` rebuilds `dist/` automatically. After editing `lib/*.js` or `lib/*.jsx`, rebuild and verify the corresponding PWA distribution assets before release; this legacy/static path is not the designated production server stack.

---

## Deploy

The designated production target is the isolated Next.js stack in `docker-compose.construction.yml` on the one.com replacement host. It is running as a staging stack, not yet accepted; `cortexbuildpro.tech` still fails TLS and the production data restore/cutover are outstanding. Do not follow the legacy Express/Caddy/Traefik instructions below as the live production path.

- Current state and cutover gates: [`STATUS.md`](STATUS.md), [`docs/RUNBOOK.md`](docs/RUNBOOK.md), [`docs/VPS_REPLACEMENT_MIGRATION.md`](docs/VPS_REPLACEMENT_MIGRATION.md)
- Historical deployment references: [`DEPLOY_VPS.md`](DEPLOY_VPS.md), [`DEPLOY_cortexbuildpro.md`](DEPLOY_cortexbuildpro.md), [`DEPLOYMENT.md`](DEPLOYMENT.md), [`deploy/README.md`](deploy/README.md)
- Backup and restore limits: [`docs/CONSTRUCTION_RECOVERY.md`](docs/CONSTRUCTION_RECOVERY.md)

---

## iOS / App Store — honest constraints

The iOS path (Expo SDK 57 + Capacitor 8, `expo/` and `ios/`) **cannot be completed from this Linux VPS**. **EAS Build and App Store submission require a Mac + an Apple Developer account** for:

- Provisioning profiles & signing
- Universal-links / AASA association
- StoreKit IAP plugin configuration and receipt validation

Canonical bundle id is `com.cortexbuild.app`. Runbooks: [`expo/DEPLOY-IOS.md`](expo/DEPLOY-IOS.md), [`ios/README.md`](ios/README.md), [`app-store/SUBMISSION.md`](app-store/SUBMISSION.md).

---

## AI flows

All AI runs through a **local-first shim** (`lib/llm-shim.js`) with a 3-tier router — no third-party API key required:

1. **Server LLM** — `POST /api/llm` proxies to **Ollama** (`llama3.2:3b` chat, `llava` vision) on the VPS.
2. **WebLLM in-browser** — Llama-3.2-1B via WebGPU (opt-in from Settings; fully on-device, offline-capable).
3. **Deterministic engine** — `CortexLocalAgent.respond()` reads live Brain state; never fails.

Health check: `GET /api/llm/health` reports which models are installed and ready.

Flows: AI estimator (NL → UK line items + total), daily briefing / decisions / 30-day strategy, receipt OCR + categorisation, smart task parsing, invoice-chase drafting, project health check, material forecast, schedule optimisation, document generation (RAMS / Method Statement / H&S Policy / Tender), photo→snag vision, voice-memo transcription.

---

## Vera — autonomous CEO

**Vera Stone** is the autonomous CEO persona, backed by a 5-person leadership team: **Marcus Pound** (CFO), **Pip Carter** (Site Manager), **Ada Whitfield** (Compliance), **River Ng** (Sales Director). Vera generates leads from market intelligence, auto-quotes new/qualified leads, drafts chase emails for overdue invoices, health-checks active projects, forecasts material orders, and schedules briefings on cron.

---

## Docs

- [`MONOREPO.md`](MONOREPO.md) — three-app layout + shared core
- [`ROADMAP.md`](ROADMAP.md) — shipped / in-flight / planned + current risks
- [`STATUS.md`](STATUS.md) — one-page product status
- [`CLAUDE.md`](CLAUDE.md) — architecture, deployment, gotchas
- [`docs/DATA_MODEL_DRIFT.md`](docs/DATA_MODEL_DRIFT.md) — SQL-vs-Prisma model drift
- [`CHANGELOG.md`](CHANGELOG.md) · [`VAULT.md`](VAULT.md) (secrets)

## License

Provided as-is. Use it, fork it, ship it.

## Author

Built in partnership with Adrian Stanca.
