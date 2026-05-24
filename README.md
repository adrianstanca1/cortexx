# Cortexx

Mobile-first construction-management app for UK SMEs.
Live: **https://cortexbuildpro.com**

> **May 2026 consolidation.** The sibling [`cortexx-pwa`](https://github.com/adrianstanca1/cortexx-pwa)
> repo (single-file static PWA + iOS Capacitor scaffold + App Store pack) has
> been folded into this codebase:
> - iOS shell → `ios/` (Capacitor 6, ready for Xcode)
> - App Store submission pack → `app-store/`
> - Legacy single-file PWA → `public/legacy/` (served at `/legacy/`)
> - Legacy docs → `docs/pwa/`
>
> One repo, one source of truth.

## Stack

- **Next.js 14** (App Router) — 46+ pages, 35+ API routes, 30+ components
- **PostgreSQL + Prisma** — 14 models, 5 migrations
- **NextAuth** (credentials) + middleware-gated routes
- **PWA** — service worker, offline fallback, install hint, splash screens
- **iOS** — Capacitor 6 native shell (`ios/`) targeting the App Store
- **Hostinger VPS** + nginx + pm2, automated deploys via GitHub Actions

## Structure

```
app/                     # Next.js App Router
  (auth)/login           # Public auth pages
  (auth)/register
  dashboard              # 12 dashboard variants — matches Claude design
  projects               # List + detail + board + gallery
  tasks                  # List + bulk ops + select mode
  team                   # Members + per-member profile
  apps                   # Modules hub (CAPTURE + 24 modules)
  capture                # Photo / receipt / voice / check-in / incident
  inbox                  # Aggregated overdue invoices, expiring docs, etc.
  activity               # Audit feed with filters
  search                 # Workspace-wide
  reports                # Finance + project margins
  documents              # Per-project files
  settings               # Profile + password
  + 24 module pages      # Messages, RFIs, Ask Cortex, Leads, Customers,
                         # Quotes, Client view, Schedule, Site diary,
                         # Photos, Drawings, Snags, Variations, POs,
                         # Sub invoices, Materials, Subs, Equipment,
                         # Cost catalog, Mileage, Timesheets, Check-in,
                         # Live status, Training
                         # — stubs with planned-capabilities roadmap
  api/                   # 35 route handlers (auth-gated by middleware)
  not-found.tsx          # Themed 404
  loading.tsx            # Top-level skeleton
  error.tsx              # Reports to /api/errors

components/
  ui/                    # Atoms: TabBar, DrawerMenu, QuickActions, Avatar,
                         #        Pill, ProgressBar, SWRegister, InstallHint,
                         #        ModuleStub, Icons, ErrorBoundary…
  dashboard/             # 12 variant components (dynamic-imported)

prisma/
  schema.prisma          # 13 models: User, Project, Task, TeamMember,
                         # Assignment, Invoice, Document, TimeEntry,
                         # Activity, Comment, Account, Session,
                         # VerificationToken
  migrations/            # 4 applied
  seed.ts                # Idempotent demo data

public/                  # PWA assets
  manifest.json          # Shortcuts: Capture / Tasks / Projects
  sw.js                  # cortexx-v2 cache; network-first navigation
  offline.html           # Themed offline fallback
  icon-{192,512}.png + maskable variants
  apple-touch-icon{,-152,-167}.png
  apple-splash-* (6 sizes)
  favicon.{ico,16,32}.png

.github/workflows/
  ci.yml                 # tsc + tests + build (cached)
  deploy-vps.yml         # rsync-free deploy via SSH + system Postgres
  health-monitor.yml     # 15-min /api/health probe
  debug-vps.yml          # manual VPS introspection

test/
  validation.test.js     # 8 unit tests — node:test (no deps)
```

## Develop

```
npm install
DATABASE_URL=postgresql://user:pass@localhost:5432/cortexx npx prisma migrate deploy
DATABASE_URL=… npm run dev          # http://localhost:3000
DATABASE_URL=… npm test             # unit tests
npm run build                        # production build
```

## Deploy

Push to `main`. GitHub Actions handles the rest:

1. **CI** — `tsc` + `npm test` + `npm run build` (Next.js cache hit on subsequent runs)
2. **Deploy to Hostinger VPS** — SSH in, install system Postgres if missing,
   provision the DB user idempotently, `git fetch` + `git reset --hard origin/main`
   (authenticated via workflow `GITHUB_TOKEN`), `npm ci` + `prisma migrate deploy`
   + `prisma db seed` + `npm run build`, `pm2 delete + start` (clean env),
   `/api/health` gate before considering the deploy successful.
3. **Health Monitor** — every 15 min hits `/api/health`; auto-opens an issue
   if production goes down, auto-closes when it recovers.

Deploys are idempotent: re-running on the same commit is a no-op apart from
the DB password rotation.

## Routes summary

- **43 pages** — 12 dashboard variants + 31 distinct screens
- **35 API routes** — full CRUD for Projects, Tasks, Team, Invoices, Documents,
  Time Entries, Comments, plus `/api/inbox`, `/api/activity`, `/api/search`,
  `/api/reports`, `/api/health`, `/api/auth/*`, `/api/seed`, `/api/errors`,
  `/api/events/stream` (SSE), `/api/export/[type]` (CSV)
- All API routes auth-gated by `middleware.ts` except `/api/auth/*`,
  `/api/health`, `/api/seed`, `/login`, `/register`, `/manifest.json`,
  `/sw.js`, `/offline.html`, `/favicon.ico`

## Architecture notes

- **Server components everywhere we can** — only `'use client'` where there's
  state, effects, or browser APIs.
- **API responses use Prisma `select` clauses** where it materially reduces
  payload size (see `/api/inbox`, `/api/dashboard`).
- **`force-dynamic` on every GET API route** — these are auth-gated and would
  otherwise be cached by Next.js's default behaviour.
- **Service worker** — `cortexx-v2` cache. Navigation = network-first with
  cache fallback to `offline.html`. Static assets = stale-while-revalidate.
  Bumping `CACHE_VERSION` purges old caches on next visit; `SWRegister`
  surfaces a "Reload to update" toast when a new SW is waiting.
- **Realtime** — SSE stream at `/api/events/stream` notifies clients of new
  activity items; `useRealtimeActivity` hook merges incoming events into
  the dashboard's activity list.
- **Optimistic UI** — task toggles, project archives, bulk operations all
  update local state first, then rollback if the API call fails.

## Production target

- Domain: cortexbuildpro.com (HTTPS, certbot-managed)
- VPS: Hostinger Ubuntu, port 3010 behind nginx
- Postgres: system service (no docker), nightly compressed pg_dump backups
  in `/opt/cortexx-backups` with 30-day retention
- pm2 process: `cortexx`, single instance, loads `.env.production`

See `ROADMAP.md` for shipped phases, in-flight work, and planned releases.
See `FINAL_REVIEW.md` for the most recent audit pass.
