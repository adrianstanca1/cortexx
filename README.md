# Cortexx — The Construction OS that thinks with you

UK SMB contractor management with an autonomous AI CEO (**Vera**). One product, **three deployment targets**, **one shared backend** (`/api/*` on **cortexbuildpro.com**).

[![Version](https://img.shields.io/badge/version-1.4.0-2563eb)](CHANGELOG.md)
[![PWA](https://img.shields.io/badge/PWA-offline--first-2563eb)](manifest.json)
[![iOS](https://img.shields.io/badge/iOS-Capacitor%208.4-1a73e8)](ios/README.md)
[![Expo](https://img.shields.io/badge/Expo-SDK%2057-000)](expo/DEPLOY-IOS.md)
[![Tests](https://img.shields.io/badge/tests-234%20passing-10b981)](test/)

![Cortexx](icon.svg)

---

## What Cortexx is today

Cortexx (product name **CortexBuild Pro**) is a UK SMB construction-management platform deployed live at **cortexbuildpro.com**. It is a **monorepo** with three client stacks that all talk to one Express + PostgreSQL backend, sharing an API contract via `@cortexbuild/core` (`packages/core`). See [`MONOREPO.md`](MONOREPO.md) for the layout.

### Three deployment targets, one backend

| # | Target | Path | Stack | Role |
|---|--------|------|-------|------|
| 1 | **Offline PWA** | `Cortexx.html` + `lib/` → `dist/` | Vanilla JS, Babel-in-browser (no bundler) | Offline-first, local-first, `<1s` cold start, private Ollama LLM |
| 2 | **Web admin** | `app/`, `components/`, `prisma/` | Next.js 16, React 19, next-auth v5, Prisma 7, Tailwind v4 | Server + web admin dashboard |
| 3 | **Native (iOS + Android)** | `expo/`, `ios/` | Expo SDK 57 / Capacitor 8.4 | Native app shell |

All three consume the same `/api/*` endpoints. Business data in the PWA lives on-device (localStorage + IndexedDB) and syncs to the backend optionally.

---

## Backend (`server/`)

Express + PostgreSQL. `server/index.js` is the single entry; route modules live in `server/routes/`.

- **Multi-tenant** via `workspace_id`
- **Auth**: JWT (Bearer) + magic-link
- **Realtime**: Server-Sent Events (SSE) per workspace
- **LLM**: **Ollama** local inference — no external API keys
- **Data model**: a **raw SQL schema** (`server/db/schema.sql`, applied at volume init via docker-compose). Prisma's `schema.prisma` is a *parallel* model for the Next.js stack — **not** the source of truth for the Express API. See [`docs/DATA_MODEL_DRIFT.md`](docs/DATA_MODEL_DRIFT.md).

**Route modules** (`server/routes/`): `banking` (TrueLayer open-banking), `hmrc` (CIS300), `iap` (Stripe / StoreKit), `llm`, `payments`, `push`, `sync`, `portal`, `ledger`, `intelligence`, `agents`.

Deployment brings up four services via `docker-compose.yml`: `db` (Postgres 16), `api` (Express), `ollama` (local LLM), and `web` (Caddy static host + reverse proxy; config in `Caddyfile`).

---

## By the numbers (v1.4.0, grep-verified)

| Area | Count |
|------|-------|
| SPA screen/logic modules (`lib/*.jsx|js` → `dist/*.js`) | **113** precompiled modules; phase modules through **phase 118** |
| Dashboard layouts | **15** (`dashboards.jsx` + `dashboards-v2…v5.jsx`) |
| Next.js pages (`app/**/page.tsx`) | **110+** |
| Expo native app | thin shell — **5 core screens** + collection-driven tabs (SDK 57 / Capacitor 8), shares `@cortexbuild/core` |
| Backend route modules | **11** (`server/routes/`) |
| Backend data model | **34 SQL tables** (`schema.sql`) vs **82 Prisma models** (drift — see below) |
| AI leadership team | **Vera** autonomous CEO + 5-person leadership team |
| Test suite | **234 passing** (`npm test`) |

> Honesty note: the native `expo/` app is currently a lean shell (login, projects, project detail, tickets, a generic collection screen + tabbed nav) sharing the cross-app API contract — not a full mirror of the 113-module PWA. The PWA is the feature-complete client.

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

Node **>=22**, npm **>=10**.

---

## Build

```bash
npm run build              # next build && precompile (rebuilds dist/ from lib/)
npm run precompile         # node build-dist.js — rebuild dist/ from lib/
node build-dist.js --check # byte-verify dist/ vs lib/ sync, exit 1 on drift
npm test                   # node --test test/*.test.js  (234 passing)
```

`build-dist.js` is the **single** SPA builder: `lib/*.jsx` → Babel → `dist/*.js`; `lib/*.js` copied verbatim; `.ts`/other server-only files are **not** emitted. `postinstall` runs `precompile`, so `npm install` rebuilds `dist/` automatically. **After editing any `lib/*.js|jsx`, run `node build-dist.js` and commit the updated `dist/`** — otherwise prod serves stale code.

---

## Deploy

The stack is **self-hosted** via Docker Compose on a VPS (Postgres + Express + Ollama + Caddy). It is **not** a static-only site.

- Architecture, secrets, gotchas: [`CLAUDE.md`](CLAUDE.md) § **Deployment**
- VPS runbooks: [`DEPLOY_VPS.md`](DEPLOY_VPS.md), [`DEPLOY_cortexbuildpro.md`](DEPLOY_cortexbuildpro.md), [`DEPLOYMENT.md`](DEPLOYMENT.md), [`DEPLOY_NOW.md`](DEPLOY_NOW.md)
- Ops (systemd, backups, restore): [`deploy/README.md`](deploy/README.md), [`docs/RUNBOOK.md`](docs/RUNBOOK.md)

Traefik owns host ports 80/443; the `web` Caddy service joins Traefik via docker-provider labels and must **not** publish 80/443 itself (see `CLAUDE.md`).

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
