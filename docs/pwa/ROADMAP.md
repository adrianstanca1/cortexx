# Cortexx — Roadmap

Date: 22 May 2026 · Maintainer: Adrian Stanca

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

### v1.1 — Polish & retention
- [ ] **Real crash reporting** — Sentry SDK or Apple's TestFlight crash log integration. Currently `window.onerror` is captured locally but not phoned home.
- [ ] **In-app onboarding tour** — replace the silent first-run with a 4-step guided tour (skip button + persistence flag).
- [ ] **Customer-facing client portal** — share-only project view at `/portal/<token>`; Phase 51-70 has skeletal version, needs polish.
- [ ] **CSV ledger export** — Xero / QuickBooks / Sage compatible (Pro tier). 70% built in `screens-phase11.jsx`; finish + UI test.
- [ ] **Multi-language** — UK English default; add cy-GB (Welsh) for fully UK coverage.

### v1.2 — Backend & multi-device sync
- [ ] **Cloud sync backend** — Cloudflare D1 + Durable Objects, OR Supabase. Replace BroadcastChannel transport with WebSocket for true multi-device realtime.
- [ ] **Auth** — magic-link email auth via Resend or AWS SES. Currently bypassed (local profile only).
- [ ] **Conflict resolution** — last-write-wins is enough for solo users; add CRDT-style merge for the team multi-user case.
- [ ] **End-to-end encryption** for cloud-synced data — user holds the key, we hold the ciphertext.

### v1.3 — Pro tier features
- [ ] **CIS300 monthly return** — calculate, validate, and submit to HMRC's online portal. Currently calculates correctly but doesn't auto-submit.
- [ ] **Bank reconciliation** — Plaid / TrueLayer integration.
- [ ] **Direct payment links** — Stripe + GoCardless for invoices.
- [ ] **Native push notifications** via APNs/FCM through `@capacitor/push-notifications`. Plugin wired but no backend yet.
- [ ] **In-app subscriptions** — StoreKit for iOS Pro tier (Apple takes 30%); Stripe for web (no Apple cut).

### v1.4 — AI agents
- [ ] **Vera autopilot v2** — currently 5 personas (CEO, CFO, Site Mgr, Compliance, Sales). Add Estimator persona that watches inbound leads and drafts a quote in <10 s.
- [ ] **Inbox triage** — connect IMAP/Gmail; AI categorises and auto-files invoices, quotes, customer enquiries.
- [ ] **WhatsApp integration** — receive customer enquiries via WA Business API → auto-create lead in Cortexx.
- [ ] **Photo-as-mention** — drop a photo into any chat, get AI-extracted next actions, snags, RFIs.

### v1.5 — Field productivity
- [ ] **NFC site check-in** — tap a tag at the site entrance, timesheet starts.
- [ ] **Bluetooth label printer** — print site labels (deliveries, RAMS posters) from app.
- [ ] **Offline Map** — download a job-site map for offline mark-up.

---

## ❌ Known issues / parked

| | Issue | Workaround |
|---|---|---|
| ❌ | Live voice transcription on iOS WKWebView | Audio records fine; transcription happens after via AI. Add `@capacitor-community/speech-recognition` for real-time. |
| ❌ | localStorage 5–10 MB quota | Photos auto-spill to IndexedDB; warn user at 80% capacity. |
| ❌ | No multi-user team sync (single-device only) | v1.2 ships this. Workaround: export JSON, import on team member's device. |
| ❌ | AI rate limits on free tier | Cap is per-user; we just surface a friendly error. |

---

## 🧱 Architecture decisions (record)

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
5. Bump `sw.js` `CACHE` version (e.g. `v2-3-002`) — otherwise users won't get your code.
