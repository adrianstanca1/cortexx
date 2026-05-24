# Cortexx — Roadmap

Status as of **24 May 2026**.

> **Repository consolidation (24 May 2026):** All Cortexx-related repositories (`cortexbuild-ultimate`, `cortexbuild-field`, `cortexbuild-web`, `cortexbuildpro`, `cortexbuild-platform`, `cortexbuild-unified`, `cortexbuildpro-ultimate`, `cortexxxxxx`, `cortexx-pwa`) have been merged into this repository. Their full source code is preserved in `archive/`. All redundant repositories have been deleted from GitHub. This is now the **single source of truth** for the entire Cortexx platform.

Source of truth for what's shipped, in-flight, and planned. Maintained alongside the codebase, not in a separate tracker.

## ✅ Shipped

| Phase | What landed |
|---|---|
| **Foundation** | Next.js 14 App Router, Postgres + Prisma, NextAuth credentials, 4 migrations, idempotent seed, ErrorBoundary, themed 404 + loading, error reporting to `/api/errors`. |
| **Mobile shell** | 5-tab TabBar (Dashboard / Projects / + / Tasks / Team), hamburger DrawerMenu with active-page highlight, QuickActions bottom-sheet from + FAB (6 actions), UserMenu, AuthedShell wrapper. |
| **15 dashboards** | ActionFirst, StatusBoard, Calm, Bento, AIForward, Field, Timeline, Money/Books, Stories, Rings, SiteMap, Focus, **Executive** (v13, cash-first KPI grid for the founder seat), **Broadsheet** (v14, newspaper aesthetic), **Site notice** (v15, hazard-tape construction noticeboard) — all matching the Claude design (gradient hero, blueprint SVG, accent palette, etc). |
| **Project surfaces** | List + filters (active/archived), detail with Overview/Tasks/Team/Finance tabs, Kanban board, gallery, archive (soft-delete + restore). |
| **Task surfaces** | List + search + filters, bulk select (complete/reopen/delete), category badges, comments + count, due-time picker, edit modal, optimistic toggles. |
| **Team surfaces** | List with empty-state CTA, per-member profile, edit modal, hours tracking. |
| **Capture flow** | Camera photo upload, Voice RFI → task, Receipt scan, Incident report, Check-In with onSiteCount + activity log. |
| **Money** | Invoices CRUD + print, paid/owed totals via `groupBy` aggregate, per-status filters, overdue badges. |
| **Productivity** | Workspace search across projects/tasks/team/invoices, Inbox with overdue/critical/expiring aggregation, Activity feed with filters, Reports (cashflow + project margins + tasks + activity), CSV export. |
| **Realtime** | SSE `/api/events/stream` with reconnect, `useRealtimeActivity` hook, live indicator dot in Timeline + Stories. |
| **PWA** | Full icon set (192/512/maskable + apple-touch 152/167/180), 6 iPhone splash screens, manifest with shortcuts, service worker `cortexx-v2` with offline fallback + auto-update prompt, iOS Add-to-Home-Screen install hint. |
| **Apps hub** | `/apps` route — modules grid matching the design's "CAPTURE + ALL APPS" layout, 9 CAPTURE actions with AI labels, 24 modules grouped by category, real-time badges. |
| **Snags** | `/snags` — real defect register: `Snag` model + migration, full CRUD (`/api/snags`, `/api/snags/[id]`), status pipeline (open → in_progress → closed), priority + due date, optional photo attachment via the uploads backend, per-project filtering, activity events on raise/close. Drives the `/apps` snag badge. |
| **Photos** | `/photos` — project-filterable photo gallery built on the uploads backend. Adds an upload action that creates a `type=photo` `Document`; renders a 3-column grid with per-tile project chip; opens full-size in a new tab. |
| **Timesheets** | `/timesheets` — real weekly grid on top of the existing `/api/timeentries` backend (uses `week`/`year`/`approved` filters). Mon–Sun day grid per member with totals + status pip, per-entry approve toggle, "Approve week" bulk action, prev/next week navigation, add-entry bottom-sheet (member + project + date + hours with 0&lt;h≤24 validation), per-entry delete with confirm, "send to payroll" composes a mailto with daily breakdown. Drives the `/apps` timesheets badge. Ported from `archive/cortexbuild-field/app/timesheets.tsx` (Manus-built) to the Next.js stack. |
| **Training & CSCS** | `/training` — `Certification` model + migration, full CRUD (`/api/training`, `/api/training/[id]`), status buckets (valid / expiring within 60 days / expired) with KPI strip + filter chips, common-type dropdown (CSCS, IPAF, PASMA, SSSTS, SMSTS, Asbestos, First Aid, Working at Heights), optional TeamMember link with name auto-fill, per-card delete with confirm. Drives the `/apps` training badge (count of expiring + expired). Ported from `archive/cortexbuild-field/app/training.tsx` (Manus). |
| **RFIs** | `/rfis` — `Rfi` model + migration with per-project `RFI-001` sequence numbering, full CRUD (`/api/rfis`, `/api/rfis/[id]`), status pipeline (open → answered → closed), priority + ball-in-court (freeform with common-assignee datalist) + due date with overdue detection (red ring on card), response/answer flow with `respondedAt` timestamp, activity events on raise / answer / close / reopen. Detail bottom-sheet shows full question + response form + status cycling. Drives the `/apps` rfis badge (open count). Ported from `archive/cortexbuild-field/app/rfis.tsx` (Manus). |
| **Messages (Announcements)** | `/messages` — `Announcement` model + migration, full CRUD (`/api/announcements`, `/api/announcements/[id]`), 4 types (general / safety / urgent / update) with auto-pinning for safety + urgent, optional project scope (whole workspace or a specific project), pinned-first ordering, per-card pin toggle + delete with confirm. The Manus version was a broadcast board — landed here as the Messages module since threaded conversations were always v1.5+ work. Ported from `archive/cortexbuild-field/app/announcements.tsx` (Manus). |
| **Site diary** | `/site-diary` — no new model. `/api/site-diary?projectId=&date=` aggregates a single project-day from existing data: `TimeEntry` (hours + headcount), `Activity` (audit feed), `Snag` (raised + closed that day), `Document` (photos + RAMS uploaded). 6-cell KPI grid + sectioned timeline (Hours / Snags / Photos / Activity), prev/next day navigation + jump-to-today, share-to-email composes a plain-text report. Ported from `archive/cortexbuild-field/app/daily-report.tsx` (Manus) — aggregation approach instead of a separate diary model. |
| **Observations** | `/observations` (new route, separate from `/snags`). `Observation` model + migration, full CRUD (`/api/observations`, `/api/observations/[id]`), 4 types (positive / improvement / unsafe / near_miss) with emoji + colour coding, status (open / resolved) with `resolvedAt` timestamp, type and status filters, per-card resolve toggle + delete, activity events on log / resolve / reopen. Drives the `/apps` observations badge (counts unsafe + near-miss still open — the safety-critical subset). Ported from `archive/cortexbuild-field/app/observations.tsx` (Manus). |
| **Variations** | `/variations` — `Variation` model + migration with per-project `VAR-001` sequence numbering, full CRUD (`/api/variations`, `/api/variations/[id]`), status pipeline (draft → submitted → approved/rejected, reopen path), cost impact (£) + days impact tracked per variation with approved-totals aggregate in the header, "Email for approval" composes a mailto to the client with full breakdown, activity events on every status transition. Drives the `/apps` variations badge (draft + submitted count). Manus archive had no variations.tsx — designed from scratch following the snags/rfis pattern. |
| **Sales pipeline** | `/leads`, `/customers`, `/quotes` — three new modules with shared `Lead` / `Customer` / `Quote` models in one migration (`20260524000300_add_lead_customer_quote`). **/leads** has a 5-stage Kanban view (new → qualified → proposing → won/lost) with pipeline value aggregate in the header and one-click "Won — convert" that creates a Customer in a transaction and stamps `convertedAt`. **/customers** has search + active/archived toggle, per-row quote count, archive/unarchive + delete in the detail sheet, deep-link "Quotes for this customer" via `/quotes?customerId=`. **/quotes** has an in-modal line-item editor (description, qty, unit, unit price, auto-computed total), live VAT + grand-total preview, sequential `QTE-NNNN` numbering, status pipeline draft → sent → accepted/rejected with `sentAt` / `acceptedAt` / `rejectedAt` stamps, "Send by email" composes a mailto to the customer's contact email with full line-by-line breakdown and auto-marks sent. Drives the `/apps` leads badge (in-pipeline count). |
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
| **iOS native shell (Capacitor 6)** | Scaffold absorbed from cortexx-pwa into `ios/` — Capacitor 6 with camera/geolocation/voice-recorder/haptics/local+push notifications plugins wired, splash + status-bar themed `#06101e`, `PrivacyInfo.xcprivacy`, GitHub Actions iOS workflow in `ios/ci/`. App Store submission pack (icons, screenshots-generator, copy, SUBMISSION.md) in `app-store/`. Build adapter for Next.js (`next export` → `ios/www`) still TODO — see `ios/README.md` §1. |
| **Legal pages** | `/privacy`, `/terms`, `/support` ported as Next.js server components from the cortexx-pwa standalone HTML. Shared `LegalShell` keeps the visual language consistent. |
| **cortexx-pwa consolidation** | The sibling static-PWA repo's source is now in this codebase. Single-file PWA → `public/legacy/` (served at `/legacy/`, scoped SW so it doesn't fight the Next.js SW). The full `dist/` (60+ Babel-transpiled JS bundles: dashboards, screens-phase\*, app-main, boot, tokens, lib helpers) is included as the porting reference. PWA docs (DEPLOY_NOW, SHIP_READY, SHIP_TO_APP_STORE, PERF_PHASE_81, etc.) under `docs/pwa/`. Two repos collapsed into one. |

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
- ~~`/photos`~~ — ✅ shipped (gallery + uploads). AI tagging + compare-over-time still planned.
- `/drawings` — versioned with pinned RFIs/snags, rev compare, markup
- ~~`/snags`~~ — ✅ shipped (CRUD + status + photo). AI defect detection still planned.
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
| ~~**iOS native build (Capacitor wrap)**~~ | ✅ Unblocked — Capacitor 6 scaffold + App Store submission pack now live in this repo (`ios/`, `app-store/`). Last-mile work: adapt `ios/scripts/build-web.mjs` to run `next export` (or point Capacitor at the deployed `cortexbuildpro.com` via `server.url`) instead of copying the standalone PWA HTML. |
| **Push notifications** | Requires VAPID keys + service worker `push` event handling + per-user subscription storage. Useful once `/messages` ships. |
| **Multi-tenancy** | Currently single-tenant. The data model has no `organizationId`. If we want multi-tenant we'll need a migration and a row-level-security pass. |
| **Cortex AI agent** | The `/ask` route is a stub. Real implementation needs prompt construction with workspace context, citations, and a usage-quota layer. |
