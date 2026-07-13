# CortexBuild Pro — Changelog

## v1.7.6 — 13 Jul 2026 — Role pack actions, document library, equipment scheduling and RAMS sign-off

### Added
- **Role pack quick actions** — each bundle dashboard now has action cards that create the most relevant record for that role:
  - Site Supervisor: raise a snag, add a site-diary note, start an equipment check.
  - Site Manager: create a RAMS/method statement, raise an RFI, log an inspection.
  - PM & Agent: create a task, send an announcement, log a risk.
  - Commercial: create a quote, create a variation/change order, log an invoice.
  `lib/bundles.ts` gained a typed `actions` array; `app/bundles/[slug]/page.tsx` renders modal forms and POSTs to the existing APIs. A `POST /api/site-diary` handler was added so diary notes persist as activity records.
- **Document library completion** — documents now support tags (JSONB), a PDF preview modal, expiry reminders via `/api/documents/expiring` and the existing cron job, and lightweight versioning (increment `version` on re-upload). New migration `20260713000001_add_document_tags`.
- **Equipment check scheduling** — `EquipmentCheck` now has `frequency`, `nextDueAt` and `lastCompletedAt`. The create/edit modal includes a frequency selector; passing/failing a check records completion and computes the next due date. New `/api/equipment-checks/overdue` endpoint and an Overdue filter chip on `/equipment-checks`. New migration `20260713000002_equipment_check_frequency`.
- **RAMS review/approval workflow** — RAMS documents now move through draft → reviewed → approved → active. Added `reviewedBy`, `reviewedAt`, `approvedBy`, `approvedBy` to the `Rams` model. The `/rams` page shows stage-specific actions (Submit for review / Approve / Approve & activate / Activate), and the PATCH API validates stage transitions and enforces reviewer/approver segregation. New migration `20260713000003_rams_review_approval`.

### Operations
- Added an encrypted environment vault (`age`) for the VPS: `.env.vault` holds all secrets, the age identity lives at `~/.config/cortexx/age.key`, and `npm run vault:decrypt` produces `.env`. See `VAULT.md`. This keeps credentials out of the repo while letting the encrypted vault be backed up/committed safely.

### Database
- Added migrations `20260713000001_add_document_tags`, `20260713000002_equipment_check_frequency`, `20260713000003_rams_review_approval` and applied them against PostgreSQL.

## v1.7.5 — 13 Jul 2026 — Documents, equipment checks, RAMS generator and role packs

### Added
- **File uploads in Documents library** — `app/documents/page.tsx` now lets you upload PDFs, photos and receipts via `/api/uploads`. Uploaded documents store the resolved URL, size and MIME type, and the existing S3/local storage adapter handles persistence.
- **Quick document templates** — create documents pre-typed as RAMS, method statement, risk assessment or checklist from the Documents modal.
- **Equipment checks** — new `EquipmentCheck` model, migration `20260713000000_add_equipment_checks`, and `/api/equipment-checks` CRUD routes. New `/equipment-checks` page with ready-to-use templates for scissor lifts, cherry pickers / MEWPs, telehandlers, harnesses, fall-arrest systems and ladders. Each template has pass/fail/NA items, notes, sign-off and project/equipment linkage.
- **RAMS generator** — new `lib/rams-templates.ts` with standard UK construction templates (work at height, manual handling, hot works, excavation, electrical work) and `/api/rams/generate` endpoint. The RAMS page now has a **Generate** button that produces a draft RAMS / method statement / risk assessment from a project + work description, with optional AI enhancement through the local LLM.
- **Role-based app bundles** — new `lib/bundles.ts` defines four packs: Site Supervisor, Site Manager, PM & Agent, and Commercial. New `/bundles` overview page, `/bundles/[slug]` dashboard, and `/api/bundles/[slug]/ask` endpoints. Each pack exposes its relevant pages and a dedicated AI agent with a tailored system prompt and workspace context.
- **IcUpload icon** added to `components/ui/Icons.tsx` for the upload affordance.
- **Edit capabilities** for the new data types: documents, equipment checks and RAMS docs now have an **Edit** action that opens the same modal pre-filled and updates via the existing `PUT`/`PATCH` endpoints.

### Changed
- **Apps directory** — added Equipment checks and Role packs to `/apps`.
- **RAMS page** — header now shows Generate + Add buttons; uses the shared `Modal`, `FormField`, `SegmentedControl` and `Button` primitives.
- **Documents page** — rebuilt create flow around the shared `Modal` component and added upload support.

### Database
- New migration `prisma/migrations/20260713000000_add_equipment_checks` adds the `EquipmentCheck` table with project/equipment FKs and JSONB checklist items.

## v1.7.4 — 12 Jul 2026 — Training & qualifications editing

### Added
- **Reusable UI primitives** — new `Button`, `Modal`, `FormField`, and `SegmentedControl` components (`components/ui/*`) plus `lib/useMutation.ts` and `lib/withRoute.ts` for consistent forms, dialogs, and API route wrappers.
- **Certification category model** — `Certification` now has a `category` enum (`qualification` | `training` | `course` | `licence` | `safety`) and an optional link to a `TrainingCourse` catalog. New migration `20260712000001_add_certification_category_and_courses`.
- **Training course catalog** — new `TrainingCourse` table and `/api/training/courses` endpoints (list, create). Courses carry name, code, provider, category, validity days, and archive flag.
- **Full edit workflow on Training page** — `app/training/page.tsx` now supports creating, editing (pencil icon), deleting, status filtering, and category filtering. Uses the shared `CertificationDialog`.
- **Qualifications on team member detail** — `app/team/[id]/page.tsx` now lists all certifications/training for the operative/manager, shows status badges (valid / expiring / expired), and allows adding or editing records inline via the same dialog.
- **RBAC + rate-limit hardening** — `app/api/training/*` routes now use `withRoute` for auth/org context, enforce write/manage permissions, apply `enforceRateLimit`, emit audit logs, and validate member/course existence on create/update.
- **GET single certification** — `GET /api/training/[id]` returns a single record with member and course.

### Fixed
- **Team API certifications** — `GET /api/team` and `GET /api/team/[id]` now include `certifications` (sorted by expiry) so the member detail and any team-wide training views have the data they need.
- **Training route org scoping** — certification routes now run inside the tenancy context set by `withRoute`, so they respect the active organization once multi-tenancy is enforced.
- **Broadcast extension type safety** — `lib/broadcastExtension.ts` now only broadcasts activities that have an `id` and casts the Prisma extension result correctly.

### Verified
- `npm install` succeeded (872 packages, 0 vulnerabilities).
- `npx prisma migrate deploy` applied all 32 migrations against PostgreSQL 16.
- `npm run build` completed successfully (Next.js 16.2.9 + Turbopack).
- `npm test` passed: 216/216.
- `npm run lint`: 0 errors, 1 pre-existing warning in `app/activity/page.tsx` (ref update during render).

### Notes
- The `next.config.js` warning about `lib/storage.ts` tracing the whole project is pre-existing and unrelated to this vertical.
- Local dev environment created: Node 22.23.1 + PostgreSQL 16 + `.env` with `DATABASE_URL`.

## v1.7.3 — 12 Jul 2026 — Activity / broadcast / presence review

### Fixed
- **SSE cursor race** — `app/api/events/stream/route.ts` now polls `createdAt >= cursor` and deduplicates by activity id, so rows created in the same millisecond are neither dropped nor re-emitted. The seen-id map is pruned as the cursor advances.
- **Realtime hook re-seed** — `lib/useRealtimeActivity.ts` now keys re-seeding on the full list of activity ids, so a refetch that changes content without changing length/first-id is detected.

### Added
- **Live relative timestamps** — `app/activity/page.tsx` uses new `RelativeTime` component + `useRelativeTime` hook; "2m ago" updates every 30 seconds instead of freezing at mount time.
- **Activity icons rendered** — `components/ui/ActivityIcon.tsx` maps `iconType` to existing icon set; icons now appear under each avatar on the Activity feed.
- **DB index** — composite index `Activity(organizationId, createdAt)` added to `prisma/schema.prisma` plus migration `20260712000000_add_activity_org_created_at_index`.
- **Cross-tab activity fast-path** — `lib/useRealtimeActivity.ts` now also subscribes to `BroadcastChannel`, and `lib/broadcastExtension.ts` automatically broadcasts every `prisma.activity.create` from the server. Sibling tabs see new activities instantly instead of waiting for the 5 s SSE poll.
- **Robust SSE client** — `useRealtimeActivity` now uses exponential backoff with jitter, resets backoff on successful connection, and reconnects immediately when the tab becomes visible.
- **Infinite scroll + skeletons** — `app/activity/page.tsx` paginates with `PAGE_SIZE=25`, shows shimmer skeletons while loading, and has a "Load more" button.
- **Real-time presence indicator** — new `lib/usePresence.ts` and `components/ui/PresencePill.tsx` show how many other tabs are currently viewing the Activity screen, using `BroadcastChannel` peer discovery.

### Documented
- **Legacy presence scripts** — added `docs/presence-legacy.md` explaining that `dist/presence.js` / `dist/presence-ui.js` are not loaded by the current Next.js app and noting options for revival or removal.

## v1.7.2 — 8 Jun 2026 — Deep clean & gap fix

### Fixed
- **Offline PWA gap (real bug)** — the service worker precache list was missing **27 modules** that the app actually loads (`crash`, `observability`, `push`, `e2ee`, `cis300`, `banking`, `i18n`, `riddor`, `retention`, `iap`, `hmrc` + phase screens 82–99). Offline/installed users would lose those features. SW `MODULE_NAMES` + `PLAIN_JS` now mirror `Cortexx.html` exactly (111 modules, identical sets). Cache → `v3-1-011`.
- **deploy conflict** — `deploy.sh` (old nginx + certbot) collided with the current Caddy `web` service in `docker-compose.yml` (both bind :80). Rewrote `deploy.sh` as a thin forwarder to the canonical `deploy-vps.sh` — one implementation, all existing doc links still valid, no port conflict.

### Audited clean (no issues)
- 0 stale JSX dist files (all 91 checked in 2 batches).
- 0 broken module refs in the loader (111/111 resolve).
- 179 sheet renderers — every component defined, 0 orphan `setSheet` keys.
- 11 server routes — all mount, all files present, all export correctly, 0 unused.

## v1.7.1 — 8 Jun 2026 — Refine & de-dupe

### Cleanup
- **Removed dead code** — deleted unused `MiniScreen` helper in `screens-phase51-70.jsx` (defined, never rendered); verified all other 182 screen/sheet components are referenced.
- **Removed clutter** — 7 stray dev screenshots from project root, outdated `COMMIT.md` (v1.3 notes), duplicate `COMMIT_COMMANDS.sh` (superseded by `push.sh`), transient `DEPLOYMENT_STATUS.md`.
- **Synced lib ↔ dist** — fixed 4 stale plain-JS dist files (`backend`, `backend-extras`, `retention`, `backend-v17`) + `cloud-sync`; removed stale `dist/app-main.js` and `dist/app-sheets.js` (were shadowing live v1.7 routes/menu) so the loader uses current source.
- **Audit** — 0 duplicate component definitions across 113 lib modules; 0 orphaned dist code.

### Known redundancy (flagged, not auto-removed)
- `deploy.sh` (nginx + certbot) conflicts with the current Caddy-based `docker-compose.yml` and is referenced by 7 docs. `deploy-vps.sh` is canonical. Consolidation pending owner decision.

## v1.3 — 6 Jun 2026

### Frontend (lib/)
- **Local LLM shim** (`llm-shim.js`) — 3-tier router replaces `window.claude.complete`: server LLM (Ollama/OpenAI-compat) → in-browser WebLLM (Llama-3.2-1B via WebGPU) → deterministic engine. Works fully offline.
- **Payment links** (`screens-phase101.jsx`) — Stripe + GoCardless + UK bank-transfer link generation, persisted to invoice records.
- **Bank reconciliation** (`screens-phase102.jsx`) — CSV parser for 8 UK bank formats, fuzzy-match scoring engine (amount + reference + client name + date proximity), three-step upload→review→reconcile flow.
- **CIS300 monthly return** (`cis300.js` + `screens-phase103.jsx`) — UK CIS rules (30%/20%/0% deduction by verification status), HMRC CISReturns v2.0 XML output, accountant CSV.
- **End-to-end encryption** (`e2ee.js`) — AES-256-GCM, PBKDF2 250k iterations, canary-based passphrase verification (security bug caught + fixed in QA).
- **Push notifications** (`push.js` + `screens-phase103.jsx`) — Web Push (VAPID) + Capacitor native passthrough; SW handles `push` + `notificationclick`.
- **Open Banking client** (`banking.js`) — TrueLayer-compatible, server-side OAuth flow, transaction shape matches Bank Rec input.
- **In-app subscriptions** (`iap.js` + `screens-phase108.jsx`) — StoreKit (Capacitor) + Stripe Checkout subscription (web), server-side receipt validation.
- **HMRC CIS300 submit** (`hmrc.js` + extended `screens-phase103.jsx`) — GovTalkMessage wrapper, async polling, full HMRC Transaction Engine flow.
- **Crash reporting** (`crash.js`) — Sentry-compatible, ~5KB, in-memory breadcrumbs.
- **Observability** (`observability.js` + `screens-phase109.jsx`) — auto-instrumentation (clicks/nav/fetch/console), spans, Core Web Vitals (TTFB/FCP/LCP/INP/CLS), live inspector screen.
- **Retention ledger** (`retention.js` + `screens-phase107.jsx`) — UK construction retention model (PC + defects period), per-project aggregates, upcoming-release timeline.
- **RIDDOR / F2508 reporting** (`riddor.js` + `screens-phase106.jsx`) — UK RIDDOR 2013 classification (6 categories), validates payload, printable PDF, HSE portal handoff.
- **i18n scaffold** (`i18n.js`) — dependency-free with `t()`, `Intl` format helpers (en-GB default).
- **Subscription screen** (`screens-phase108.jsx`) — 3 plans (Pro monthly £24 / yearly £220 / Team £80), restore, manage/cancel.
- **AI engine screen** (`screens-phase100.jsx`) — mode picker, server LLM health probe, on-device WebLLM enable, test prompt.

### Backend (server/)
- **`routes/payments.js`** — Stripe Payment Links + GoCardless Billing Requests + UK bank-transfer details.
- **`routes/push.js`** — VAPID Web Push send + `push_subscriptions` table (auto-created).
- **`routes/banking.js`** — TrueLayer OAuth, AES-256-GCM token-at-rest encryption, auto-refresh, accounts→transactions pull.
- **`routes/iap.js`** — Apple `verifyReceipt` proxy, Stripe Checkout subscription, billing portal, webhook with `iap_entitlements` table.
- **`routes/hmrc.js`** — GovTalkMessage envelope, Transaction Engine submission + polling + cleanup, `hmrc_submissions` audit table.
- **`routes/llm.js`** — Ollama / OpenAI-compatible LLM proxy.
- **`routes/agents.js`** — Webhook endpoints (`/triage`, `/whatsapp`, `/email`).
- **14 new typed tables** in `schema.sql` — `receipts`, `cis_subs`, `cis_payments`, `timesheets`, `diary_entries`, `snags`, `change_orders`, `rfis`, `subs`, `materials`, `documents_meta`, `equipment`, `notifications`, `activity_log`. All carry `data JSONB` for forward compatibility.
- **Generic CRUD rewrite** — `/api/:collection` routes to proper typed tables for the 20-collection NATIVE set, falls back to `documents_store` JSON catch-all. CamelCase ↔ snake_case mapping (`cisSubs ↔ cis_subs`, etc.).
- **Route order bug fixed** — specific routers mounted before generic `/api/:collection` (was shadowing webhook endpoints).

### Build / loader
- **Parallel module prefetch** in `Cortexx.html` loader — fetches all 85 modules concurrently, transforms JSX via `Babel.transform()` (sync), injects inline as plain JS. Boot time dropped from ~30s → ~12s in dev mode.
- **dist/ self-sync** — `package.json postinstall: npm run precompile` runs Babel CLI automatically on every `npm install`. Loader gracefully falls back to `lib/*.jsx` via lazy-loaded Babel if `dist/X.js` 404s.
- **`tools/build-dist.html`** — zero-Node fallback builder (in-browser compile + zip download).
- **Service worker** — added `push` + `notificationclick` handlers; cache bumped `v3-1-005`.

### Bug fixes
- **Dashboard load failure** — duplicate `[submitting]` `useState` declaration in `screens-phase103.jsx` was crashing Babel parse. Removed duplicate HMRC state block + dead render panel referencing missing `submitAndPoll` method.
- **E2EE wrong-passphrase silent accept** — replaced naive round-trip verification with canary ciphertext stored on first unlock; subsequent unlocks must decrypt the canary (AES-GCM auth tag enforces this).
- **Token-name mismatch across 6 files** — `T.surface` / `T.line` / `T.bg` corrected to `T.bg2` / `T.hair` / `T.bg1` (53 replacements). Buttons + cards now render with proper backgrounds and borders.
- **Express route shadowing** — specific routers (LLM/payments/push/banking/IAP/HMRC/agents) were mounting AFTER `/api/:collection` and getting shadowed. Reordered.

### Environment
- `server/.env.example` now documents: `STRIPE_SECRET_KEY`, `GOCARDLESS_*`, `BANK_*`, `VAPID_*`, `TRUELAYER_*`, `BANKING_ENC_KEY`, `APPLE_SHARED_SECRET`, `STRIPE_WEBHOOK_SECRET`, `HMRC_GATEWAY_*`, `HMRC_VENDOR_ID`, `OLLAMA_*`.

### Files touched
~50 files. New: 11 lib modules, 8 phase screens, 7 server routes, 1 tools page, 1 changelog. Modified: schema, loader, SW, env, package.json, STATUS.md.
