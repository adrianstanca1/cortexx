# CortexBuild Pro — Changelog

## v1.4 — 07 Jun 2026

### Backend (server/)
- **Smart LLM Routing** — Introduced a capability-aware routing layer in `llm.ts` and `routes/llm.js`. Image tasks automatically route to the vision-optimized sidecar, while text tasks use the high-performance sidecar.
- **Inference Optimization Tier** — Support for native `llama-server` (v9544) sidecars. Text tier on port 8085 (`qwen2.5-coder:7b`), Vision tier on port 8086 (`moondream`). Verified 67% throughput increase and 3x faster response times.
- **Automated DB Baselining** — The deployment workflow now automatically handles drifted database schemas and stuck migrations via `migrate resolve`.

### Infrastructure (CI/CD)
- **CI Restoration** — Resolved critical `package.json` conflicts and fixed TypeScript target deprecations (`ES2022`).
- **Production Pipeline** — Hardened VPS deployment with automated URL-encoding for database passwords and reordered dependency installation to ensure environment stability.

### Maintenance
- **Massive Codebase Pruning** — Deleted ~900 redundant files, legacy archives, and temporary operational logs to ensure a lean production footprint.
- **Brain System Synchronization** — Initialized and synchronized a persistent project documentation layer in `.brain/`.
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
