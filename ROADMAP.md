# Cortexx — Roadmap

Date: 6 Jun 2026 · Maintainer: Adrian Stanca

This is the **single source of truth** for what's done, what's in-flight, and what's planned. Every phase shipped to `lib/screens-phase*.jsx` is checked off. Everything below "now" is unbuilt.

---

## ✅ Phase 1 · Foundations (shipped)

| | Module | What it ships |
|---|---|---|
| ✅ | `lib/tokens.jsx`              | Design tokens (colors, fonts, icon library), shared atoms |
| ✅ | `lib/backend.js`              | Local-first reactive store, AI helpers, debounced persist |
| ✅ | `lib/backend-extras.js`       | Quotes, timesheets, materials, subs, docs, diary, change orders, snags, equipment |
| ✅ | `lib/ios-frame.jsx`           | iOS 26 device frame, status bar, nav bar, keyboard |
| ✅ | `lib/tweaks-panel.jsx`        | Tweaks shell + form controls |
| ✅ | `lib/perf-phase71.js`         | Debounced writes, memoised selectors |
| ✅ | `lib/perf-phase81.js`         | BroadcastChannel multi-tab sync + perf HUD |

## ✅ Phase 2 · Core screens (shipped, 80 phases)

5 tabs · 12+ dashboards · sheets · all routed through `lib/app-main.jsx`. Phase modules `lib/screens-phase2.jsx` through `lib/screens-phase80.jsx` cover:

| Domain | Phase modules |
|---|---|
| Quotes (AI estimator, line items, PDF) | 2, 3, 4, 11 |
| Projects (phases, progress, margin, photos) | 2, 4, 5, 6 |
| Tasks (smart parse, assign, due dates) | 5, 8 |
| Team (CSCS, training matrix, certificates) | 5, 7, 9 |
| Money (invoices, CIS, chases, mileage) | 4, 7, 11, 12, 17 |
| Safety (RAMS, permits, inspections, incidents) | 6, 7, 13, 14, 15 |
| Site ops (diary, weather, photos, voice) | 13, 16, 18, 75, 77 |
| Vision AI (photo→snag, receipt OCR) | 75, 76 |
| RFIs, change orders, drawings | 20, 21–30, 34 |
| Vera autopilot (CEO AI persona) | 39, 40, 41–50 |
| AI quote estimator, AI report narration | 2, 11, 73 |
| Voice memos with transcription | 77 |
| Onboarding, command palette, signatures | 32, 38, 41–50 |
| Notifications, audit log, print styles | 78, 79 |
| AddInspectionSheet (final orphan fix) | 80 |

## ✅ Phase 3 · Performance (shipped)

| | Item | Result |
|---|---|---|
| ✅ | Precompile JSX → dist/ | Cold start 1.6 s → 192 ms (88% faster) |
| ✅ | Smart loader (prod/dev branch) | `?dev=1` for hot-edit, default = production |
| ✅ | BroadcastChannel multi-tab sync | Tabs stay in sync within 5 ms |
| ✅ | Immutable cache headers (vercel.json) | First load downloads; reloads are 0-network |
| ✅ | Perf HUD (⌘⇧P) | FPS, heap, interactive time, sync count |
| ✅ | Service worker precaches dist/ | Reload-while-offline = instant |
| ✅ | Subscription RAF batching | Bulk mutations fire one render, not N |
| ✅ | Parallel module prefetch (6 Jun) | Boot ~30 s → ~12 s in dev — fetch all 85 modules concurrently, transform JSX via `Babel.transform()` (sync), inject inline. Falls back to serial path on cache miss. |

## ✅ Phase 4 · Ship-readiness (shipped)

| | Item | Result |
|---|---|---|
| ✅ | PWA install on iOS (apple-touch-icon, status bar, splash) | Add to Home Screen works |
| ✅ | Manifest shortcuts (Task / Scan / AI / Check in) | 3D-touch app icon shows quick actions |
| ✅ | Deeplink handler (`?action=task\|receipt\|ai\|...`) | PWA shortcuts open the right sheet |
| ✅ | Legal pages: privacy.html, terms.html, support.html | UK GDPR-aware; ready for App Store URLs |
| ✅ | robots.txt, sitemap.xml, .well-known/security.txt | SEO + responsible disclosure |
| ✅ | iOS Capacitor 6 scaffold (`ios/`) | Mac-ready; one npm install + cap add ios away |
| ✅ | iOS 17+ privacy manifest (`PrivacyInfo.xcprivacy`) | All Required Reason APIs declared |
| ✅ | Info.plist permissions for every Web API | NSCameraUsageDescription, NSMicrophone, etc. |
| ✅ | App Store submission pack (`app-store/`) | SUBMISSION.md runbook + metadata + screenshots |
| ✅ | 1024 marketing icon (no transparency) | Apple's exact requirement |
| ✅ | 5 hero screenshots at 1320×2868 | iPhone 6.9" required size |
| ✅ | Single-file portable build (`Cortexx-standalone.html`) | 1.7 MB, works offline forever |

---

## 🚧 In-flight (this week)

| | Item | Owner | Notes |
|---|---|---|---|
| 🚧 | Push to GitHub (`adrianstanca1/cortexx-pwa`) | Adrian | Repo created but empty; needs `git push` from local clone |
| 🚧 | Deploy to `cortexbuildpro.com` | Adrian | `deploy.sh` ready for Hostinger VPS; or one-click via Vercel |
| 🚧 | iOS Archive + TestFlight upload | Adrian | Needs a Mac; runbook in `ios/README.md` |
| 🚧 | App Store Connect submission | Adrian | Listing copy in `app-store/metadata.txt`; runbook in `app-store/SUBMISSION.md` |

---

## 🎯 Next (planned, not started)

### v1.1 — Polish & retention ✅ COMPLETE
- [x] **Crash reporting** — `lib/crash.js` ships a Sentry-compatible drop-in (~5KB, in-memory breadcrumbs, `window.onerror` + `unhandledrejection` capture) paired with `lib/observability.js` (auto-instrumented clicks/nav/fetch/console + Core Web Vitals TTFB/FCP/LCP/INP/CLS). Live inspector at `screens-phase109.jsx`. ✅
- [x] **In-app onboarding tour** — first-run now chains welcome → name → 5-step guided tour (skip button + `cortexx_toured` persistence). ✅
- [x] **Customer-facing client portal** — standalone `portal.html` with tokenised read-only view, quote approval, message-back; contractor sees replies in Client Messages. ✅
- [x] **CSV ledger export** — Xero / QuickBooks / Sage / Generic profiles, UK VAT-aware (standard / zero / CIS reverse charge), period filters, live preview. `screens-phase93.jsx`. ✅
- [x] **Retention ledger** — UK construction retention model (PC release + defects period), per-project aggregates, upcoming-release timeline. `lib/retention.js` + `screens-phase107.jsx`. ✅
- [x] **RIDDOR / F2508 reporting** — UK RIDDOR 2013 classification (6 categories), payload validation, printable PDF, HSE portal handoff. `lib/riddor.js` + `screens-phase106.jsx`. ✅
- [x] **i18n scaffold** — dependency-free `t()` + `Intl` format helpers, en-GB default (`lib/i18n.js`). Welsh (cy-GB) parked — English-only per product decision. ✅

### v1.2 — Backend & multi-device sync
- [x] **Cloud sync backend** — Express + PostgreSQL in `server/`. Realtime via SSE (`/api/stream`) replaces BroadcastChannel-only. One-command `docker compose up`. ✅
- [x] **Auth** — magic-link request/verify (`/api/auth/magic/*`) + password. Frontend Cloud Sync screen (`screens-phase94.jsx`) signs in and toggles live sync. ✅
- [x] **Conflict resolution** — last-write-wins via per-record `_rev` clock in `mergeRemote`; stale remote pulls never clobber fresh local edits. Server-backed portal inbox merges into Client Messages. ✅
- [x] **End-to-end encryption** for cloud-synced data — user holds the key, we hold the ciphertext. AES-256-GCM, PBKDF2 250k iterations, canary-ciphertext passphrase verification (silent wrong-passphrase bug caught + fixed in QA). `lib/e2ee.js` + `server/routes/banking.js` token-at-rest encryption. ✅
- [x] **Typed server schema** — 14 new PostgreSQL tables (receipts, cis_subs, cis_payments, timesheets, diary_entries, snags, change_orders, rfis, subs, materials, documents_meta, equipment, notifications, activity_log) with `data JSONB` forward-compat columns; generic `/api/:collection` routes to typed tables with camelCase↔snake_case mapping. ✅

### v1.3 — Pro tier features ✅ COMPLETE
- [x] **CIS300 monthly return** — UK CIS rules (30/20/0% deduction by verification status), HMRC CISReturns v2.0 XML, accountant CSV. Full HMRC submit via GovTalkMessage envelope + async polling. `lib/cis300.js` + `lib/hmrc.js` + `screens-phase103.jsx` + `server/routes/hmrc.js`. ✅
- [x] **Bank reconciliation** — CSV parser for 8 UK bank formats + fuzzy-match scoring (amount + reference + client + date proximity), three-step upload→review→reconcile. Plus Open Banking pull via TrueLayer-compatible `lib/banking.js` + `server/routes/banking.js`. `screens-phase102.jsx`. ✅
- [x] **Direct payment links** — Stripe Payment Links + GoCardless Billing Requests + UK bank-transfer details, persisted to invoice records. `screens-phase101.jsx` + `server/routes/payments.js`. ✅
- [x] **Native push notifications** — Web Push (VAPID) + Capacitor native passthrough; SW handles `push` + `notificationclick`. `lib/push.js` + `server/routes/push.js` + `push_subscriptions` table. ✅
- [x] **In-app subscriptions** — StoreKit (Capacitor) + Stripe Checkout subscription (web), server-side receipt validation, billing portal, webhook + `iap_entitlements` table. 3 plans (Pro £24/mo · £220/yr · Team £80). `lib/iap.js` + `screens-phase108.jsx` + `server/routes/iap.js`. ✅

### v1.4 — AI agents
- [x] **Vera autopilot v2 / Estimator** — `Backend.vera.autoEstimateNewLeads` drafts a real quote (line items + total) for every new/qualified lead, advances it to "quoted". On the Vera screen as "Auto-quote new leads". ✅
- [x] **Inbox triage** — paste an email/transcript → AI categorises (lead/invoice/enquiry/…) and auto-files the record. Server `/api/triage` + inbound `/api/webhooks/:secret/email`. ✅
- [x] **WhatsApp integration** — server webhook `/api/webhooks/:secret/whatsapp` (Meta verify handshake + message receipt) auto-creates a lead from inbound WA messages. ✅
- [x] **Photo-as-mention** — drop a site photo, AI vision extracts tasks/snags/RFIs you file in one tap (`Backend.vision.extractActions`). ✅

### v1.5 — Field productivity
- [x] **NFC site check-in** — write a project's check-in URL to a cheap NFC tag (Web NFC on Android, copy-URL/QR fallback elsewhere); workers tap at the gate and the OS opens the link → confirm dialog → timesheet entry (`method:'nfc'`, GPS-stamped). Live "On site now" attendance board derives from clockEntries. `screens-phase96/97.jsx`. ✅
- [x] **Bluetooth label printer** — print delivery labels, asset/tool tags, RAMS/hazard A5 posters & scannable QR check-in labels via native print (any AirPrint/PDF), with optional Web Bluetooth thermal pairing on Android. Ships a from-scratch QR encoder (`lib/qrcode.js`) — RS validated against QR spec vectors + full encode→decode round-trip verified. `screens-phase98.jsx`. ✅
- [x] **Offline Map** — real slippy map (OpenStreetMap tiles) per project, pan/zoom, markup layer (pins/freehand/text) saved to the `siteMaps` collection (syncs via backend), and offline tile-pack download via the Cache API (verified caching real tiles). `screens-phase99.jsx` + `site_maps` table. ✅

### v1.6 — Local-first AI (shipped, off-roadmap) ✅ COMPLETE
- [x] **Local LLM swap** — `window.claude.complete` replaced by a 3-tier router (`lib/llm-shim.js`): server LLM (Ollama `llama3.2:3b` / `llava` for vision, or any OpenAI-compatible runtime) → in-browser WebLLM (Llama-3.2-1B via WebGPU, opt-in) → deterministic engine reading live Brain state. Never fails, never hangs, no third-party API key required. `server/routes/llm.js` + `lib/local-agent.js`. ✅
- [x] **AI engine settings screen** — tier picker (Auto / Local / Cloud), live `/api/llm/health` probe, on-device WebLLM enable, test prompt. `screens-phase100.jsx`. ✅
- [x] **AI agent webhooks** — `/api/triage`, `/api/webhooks/:secret/email`, `/api/webhooks/:secret/whatsapp`. `server/routes/agents.js`. ✅

---

## ❌ Known issues / parked

| | Issue | Workaround |
|---|---|---|
| ❌ | Live voice transcription on iOS WKWebView | Audio records fine; transcription happens after via AI. Add `@capacitor-community/speech-recognition` for real-time. |
| ❌ | localStorage 5–10 MB quota | Photos auto-spill to IndexedDB; warn user at 80% capacity. |
| ✅ | ~~No multi-user team sync~~ | **Fixed in v1.2** — Express + PostgreSQL backend, SSE realtime, magic-link auth, last-write-wins conflict resolution. |
| ❌ | AI rate limits on free tier | **Mitigated in v1.6** — local LLM tier means no per-user cap when self-hosted; cloud tier still surfaces a friendly error. |

---

## 🧱 Architecture decisions (record)

- **Local-first AI (v1.6)**: `window.claude.complete` routes server LLM → WebLLM → deterministic, in that order. Decision: a free, self-hostable app can't depend on a metered third-party API; the deterministic tier guarantees the AI surface never returns an error even fully offline.
- **Local-first**: every byte of business data lives on-device; we sync optionally. Decision: privacy + works-offline-always trumps perfect cross-device.
- **No build step for development**: `?dev=1` URL flag loads JSX directly with Babel in browser. Decision: lowers the bar for non-frontend devs to contribute; production gets the precompiled `dist/`.
- **In-browser React 18 via UMD (not bundled)**: keeps Cortexx.html as a single-page HTML file with no Vite/webpack toolchain. Decision: simpler ops; trade-off is ~120 KB of dev-build React shipped (vs ~40 KB prod build).
- **`window.claude.complete` proxy**: AI calls go through a server-side proxy, never expose an API key. Decision: client-side keys are never safe for a public app.
- **Capacitor over React Native**: keeps the same codebase between web PWA and iOS native. Decision: smaller team can ship one app, not three (web + iOS Swift + Android Kotlin).
- **Privacy manifest declares only what we use**: Required Reason APIs are declared precisely (no over-claiming). Decision: defensible at App Store review and at audit.

---

## How to contribute to this roadmap

1. Open `ROADMAP.md` (this file).
2. Find your item — under "Next" if planned, or add a new sub-bullet.
3. As you finish, move it up to "Shipped" and tick the box.
4. Update `SHIP_READY.md` if your change affects the bundle.
5. Bump `sw.js` `CACHE` version (e.g. `v3-1-006`) — otherwise users won't get your code.
6. Keep `dist/` in sync — `npm install` auto-runs `npm run precompile` (postinstall hook). No-Node fallback: open `tools/build-dist.html`. The loader also falls back to `lib/*.jsx` via Babel if `dist/X.js` 404s.
