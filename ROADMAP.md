# Cortexx — Roadmap

Status as of **23 May 2026**. Source of truth for what's shipped, in-flight,
and planned. Maintained alongside the codebase, not in a separate tracker.

## ✅ Shipped

| Phase | What landed |
|---|---|
| **Foundation** | Next.js 14 App Router, Postgres + Prisma, NextAuth credentials, 4 migrations, idempotent seed, ErrorBoundary, themed 404 + loading, error reporting to `/api/errors`. |
| **Mobile shell** | 5-tab TabBar (Dashboard / Projects / + / Tasks / Team), hamburger DrawerMenu with active-page highlight, QuickActions bottom-sheet from + FAB (6 actions), UserMenu, AuthedShell wrapper. |
| **12 dashboards** | ActionFirst, StatusBoard, Calm, Bento, AIForward, Field, Timeline, Money/Books, Stories, Rings, SiteMap, Focus — all matching the Claude design (gradient hero, blueprint SVG, accent palette, etc). |
| **Project surfaces** | List + filters (active/archived), detail with Overview/Tasks/Team/Finance tabs, Kanban board, gallery, archive (soft-delete + restore). |
| **Task surfaces** | List + search + filters, bulk select (complete/reopen/delete), category badges, comments + count, due-time picker, edit modal, optimistic toggles. |
| **Team surfaces** | List with empty-state CTA, per-member profile, edit modal, hours tracking. |
| **Capture flow** | Camera photo upload, Voice RFI → task, Receipt scan, Incident report, Check-In with onSiteCount + activity log. |
| **Money** | Invoices CRUD + print, paid/owed totals via `groupBy` aggregate, per-status filters, overdue badges. |
| **Productivity** | Workspace search across projects/tasks/team/invoices, Inbox with overdue/critical/expiring aggregation, Activity feed with filters, Reports (cashflow + project margins + tasks + activity), CSV export. |
| **Realtime** | SSE `/api/events/stream` with reconnect, `useRealtimeActivity` hook, live indicator dot in Timeline + Stories. |
| **PWA** | Full icon set (192/512/maskable + apple-touch 152/167/180), 6 iPhone splash screens, manifest with shortcuts, service worker `cortexx-v2` with offline fallback + auto-update prompt, iOS Add-to-Home-Screen install hint. |
| **Apps hub** | `/apps` route — modules grid matching the design's "CAPTURE + ALL APPS" layout, 9 CAPTURE actions with AI labels, 24 modules grouped by category, real-time badges. |
| **A11y** | `aria-label` on icon-only buttons, `aria-current=page` on active nav, focus-trap on modals, Escape-to-close on bottom sheets, screen-reader-friendly toasts. |
| **Performance** | `dueTime`/`dueDate`/`skip`/`hours`/`progress` validation hardened, 4 graceful-404 endpoints, dashboard `groupBy` aggregates, static asset cache headers (30d for icons, immutable for `/_next/static`), CI build cache. |
| **Deploy reliability** | Hardened deploy script: SSH retry 8x, hard-fail on build error, `pm2 delete + start` (fresh env), `/api/health` gate, system Postgres via apt (no docker dependency), authenticated git clone via workflow `GITHUB_TOKEN`. |
| **Tests** | First unit tests using `node:test` — 8 tests covering validation invariants. CI runs them between tsc + build. |

## 🛠 In flight

| Item | Status |
|---|---|
| **24 module stubs → real implementations** | All 24 modules have stub pages with planned-capability lists. Implementation incremental per module — see "Planned releases" below. |
| **Service worker update prompt** | Shipping reload-toast when a new SW is waiting. UX is in place; surface this more prominently next release. |
| **Real-time dashboard cross-tab sync** | SSE feeds the activity list; broader cross-tab BroadcastChannel sync (mirror of PWA approach) not yet wired. |
| **iOS PWA polish** | Splash screens + install hint shipped. Native Capacitor wrap not started (would let us submit to App Store — see "Parked"). |

## 🗺 Planned releases

### v1.1 — Communication
- `/messages` — per-project threads, @mentions, push via PWA notifications
- `/rfis` — Voice → AI transcription → structured RFI, ball-in-court routing, SLA tracking
- `/ask` — Cortex AI conversational agent grounded in workspace data

### v1.2 — Sales pipeline
- `/leads` — capture, enrichment, stage pipeline, convert-to-customer
- `/customers` — org + contacts, project history, cumulative invoicing
- `/quotes` — AI-drafted from brief, line items from cost catalog, accept→project
- `/client-view` — read-only branded project portal at a public URL

### v1.3 — Site operations
- `/schedule` — Gantt-style program across all projects, resource view, slippage
- `/site-diary` — auto-compiled from check-ins + activity, weather, PDF export
- `/photos` — geo-tagged, AI tagging, compare-over-time, PDF album export
- `/drawings` — versioned with pinned RFIs/snags, rev compare, markup
- `/snags` — defect register with photo → AI defect detection
- `/variations` — change orders with cost/time impact + client approval

### v1.4 — Money & ops
- `/pos` — Purchase orders, three-way match with deliveries + invoices
- `/sub-invoices` — CIS-aware subcontractor invoice processing, weekly run
- `/materials` — cost catalog, ordering, GRN, stock locations, waste tracking
- `/subs` — subcontractor register with insurance/qualification alerts
- `/equipment` — plant & tools asset register with service intervals
- `/cost-catalog` — unit-rate library with merchant trade prices
- `/mileage` — HMRC-compliant mileage capture with fuel-card matching

### v1.5 — People & time
- `/timesheets` — auto-populated from check-ins, weekly approval, payroll CSV
- `/check-in` — GPS-verified arrival/departure, induction confirmation
- `/live-status` — real-time map of all sites + who's where
- `/training` — ticket register (CSCS, IPAF, asbestos), expiry alerts

## 🐛 Known issues

| # | Issue | Severity | Notes |
|---|---|---|---|
| 1 | ~~Capture page only stores file metadata, not bytes~~ | ✅ Fixed | `/api/uploads` POST writes to `UPLOAD_DIR` (default `./uploads`, prod = `/var/lib/cortexx/uploads`); `/api/uploads/[name]` streams it back (auth-gated). `Document` has `url`/`size`/`mimeType`. `/capture` uploads then creates the doc; `/documents` shows thumbnails for images. 25 MB cap, MIME allowlist. |
| 2 | Voice RFI: audio captured, transcription still pending | Partial | `/capture?type=voice` now uses MediaRecorder to record, uploads the blob, attaches the URL to the RFI task description (and as an `audio` document on the project). Whisper-style transcription still needs an API key — parked for v1.1. |
| 3 | ~~Module stubs don't surface their "coming soon" status~~ | ✅ Fixed | `/apps` greys non-shipped modules (opacity 0.55) and renders a "SOON" pip. Real-data badges suppressed on coming-soon items so users don't expect data behind them. |
| 4 | Client-rendered pages → weak social previews | Partial | Root layout now exports `openGraph` + `twitter` metadata using `NEXT_PUBLIC_SITE_URL`, so unfurls work even for client-rendered routes. Full server-component refactor stays an open architecture decision (post-v1.5). |

## 🏗 Architecture decisions

1. **No docker on the VPS** — system Postgres via apt. We tried docker-Postgres; the VPS got wiped and we couldn't recover docker. System Postgres + peer auth + pm2 is simpler and one fewer moving part.
2. **Server components by default** — client components only where state, effects, or browser APIs are needed. Cuts JS bundle.
3. **`force-dynamic` on every GET API route** — all routes are auth-gated; Next.js's default caching would cache pre-auth responses.
4. **Service worker network-first for navigation** — never serve stale HTML. Static assets are stale-while-revalidate so they cache for ~30d but update in background.
5. **Cross-tab realtime via SSE only (not BroadcastChannel)** — SSE alone is sufficient since the server is the source of truth. BroadcastChannel would help on connection-loss only, and the trade-off (cache invalidation complexity) wasn't worth it yet.
6. **No design system / no Tailwind classes for the dashboard** — inline styles match the Claude design's prototype exactly. Refactoring to Tailwind happens once we stabilise the visual language (post-v1.5).

## 🅿️ Parked

| Item | Why parked |
|---|---|
| **iOS native build (Capacitor wrap)** | Out of scope for the web product. The cortexx-pwa sibling project has the Capacitor scaffold; cortexx (this repo) stays web-only for now. |
| **Push notifications** | Requires VAPID keys + service worker `push` event handling + per-user subscription storage. Useful once `/messages` ships. |
| **Multi-tenancy** | Currently single-tenant. The data model has no `organizationId`. If we want multi-tenant we'll need a migration and a row-level-security pass. |
| **Cortex AI agent** | The `/ask` route is a stub. Real implementation needs prompt construction with workspace context, citations, and a usage-quota layer. |
