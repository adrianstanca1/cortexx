# CortexBuild Pro — Changelog

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
