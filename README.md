# Cortexx — The Construction OS

The construction OS that thinks with you. Built for UK SMB contractors.

[![PWA](https://img.shields.io/badge/PWA-ready-2563eb)](manifest.json)
[![iOS](https://img.shields.io/badge/iOS-Capacitor%206-1a73e8)](ios/README.md)
[![App Store](https://img.shields.io/badge/App%20Store-submission%20ready-10b981)](app-store/SUBMISSION.md)

![Cortexx](icon.svg)

## What's inside

- **80 phase modules** — Quotes, Projects, Tasks, Team, Money, Safety, RFIs, Snags, Permits, Drawings, Site Diary, Inspections, Timesheets, Mileage, Customers, Leads, AI estimator, vision OCR, voice memos, Vera autopilot, and 60 more
- **15 dashboard layouts** — Action-first, Status board, Calm, Bento, AI-forward, Field, Timeline, Books, Stories, Rings, Map, Focus, Executive, Broadsheet, Site Notice
- **41+ reactive backend tables** — localStorage-backed, with IndexedDB for photos
- **30+ AI flows** powered by Claude — estimator, briefing, decisions, OCR, parsing, chase drafting, report narration, health checks, transcription
- **Vera Stone** — autonomous CEO AI persona with 5-member leadership team
- **Real device APIs** — GPS check-in, camera, push notifications, file picker, share, print, backup/restore
- **PWA-installable** — works offline; precompiled JS bundle loads in <1 s on iPhone
- **iOS-ready** — Capacitor 6 scaffold + privacy manifest + App Store submission pack

## Quick start

```bash
# Local dev (no install needed)
open Cortexx.html

# Or with hot-edit JSX (loads Babel in browser)
open "Cortexx.html?dev=1"

# Or with the perf HUD visible
open "Cortexx.html?perf=1"
```

No build step. No server. No backend infrastructure required.

## Deploy

This is a static site. Drop the project folder into:

- **Vercel** — `vercel --prod` from the project folder (uses included `vercel.json`)
- **Netlify Drop** — drag folder to https://app.netlify.com/drop
- **GitHub Pages** — push to a repo, enable Pages on `/ (root)` of main
- **Cloudflare Pages** — connect the GitHub repo
- **Self-hosted** — `deploy.sh` provisions Nginx + LE on a Hostinger VPS

Full deploy guide: [`DEPLOY_NOW.md`](DEPLOY_NOW.md).

## iOS App Store

Capacitor 6 scaffold lives in `ios/`. From a Mac with Xcode:

```bash
cd ios
npm install
npm run ios   # builds web, syncs, opens Xcode
```

App Store submission runbook: [`SHIP_TO_APP_STORE.md`](SHIP_TO_APP_STORE.md) and [`app-store/SUBMISSION.md`](app-store/SUBMISSION.md).

## Project structure

```
.
├── Cortexx.html                 App entry (smart loader: prod or ?dev=1)
├── Cortexx Marketing.html       Landing page
├── Cortexx-standalone.html      Portable single-file build (1.7 MB)
├── privacy.html · terms.html · support.html   Legal pages
│
├── lib/                         JSX source (60 modules)
│   ├── backend.js / backend-extras.js   Reactive store + AI helpers
│   ├── perf-phase71.js / perf-phase81.js   Performance layers
│   ├── dashboards*.jsx          15 dashboard layouts
│   ├── tokens.jsx               Design tokens + icons
│   ├── tweaks-panel.jsx         Tweaks shell
│   ├── ios-frame.jsx            iOS 26 device frame
│   ├── boot.jsx                 React root bootstrap
│   ├── app-main.jsx             Shell, sheet routing
│   ├── app-{screens,sheets,utils}.jsx   Core screens
│   ├── screens-ops.jsx · screens-project.jsx
│   └── screens-phase2…80.jsx    79 phase modules
│
├── dist/                        Precompiled JS (production, immutable-cached)
│
├── ios/                         Capacitor 6 wrap
├── app-store/                   Submission pack (metadata, screenshots, icons)
├── .well-known/security.txt     Responsible disclosure
├── manifest.json · sw.js        PWA
├── icon-{192,512}.png · apple-touch-icon.png
├── robots.txt · sitemap.xml · vercel.json · deploy.sh
│
└── ROADMAP.md · SHIP_READY.md · DEPLOY_NOW.md · LAUNCH.md   Docs
```

## AI flows

All AI runs through `window.claude.complete` — but the entry point is now a **local-first shim** (`lib/llm-shim.js`) that routes to infrastructure you control:

1. **Server LLM** — `POST /api/llm` proxies to **Ollama** (default `llama3.2:3b`, `llava` for vision) on the VPS. No API keys.
2. **WebLLM in-browser** — Llama-3.2-1B via WebGPU (opt-in from Settings; runs fully on-device, offline-capable).
3. **Deterministic engine** — `CortexLocalAgent.respond()` reads live Brain state; never fails.

Configure via `server/.env`:
```
LLM_RUNTIME=ollama
OLLAMA_BASE=http://localhost:11434
OLLAMA_MODEL=llama3.2:3b
OLLAMA_VISION_MODEL=llava
```
Then on the VPS: `ollama pull llama3.2:3b && ollama pull llava`.

Health check: `GET /api/llm/health` reports which models are installed and ready.

In the prototype dev environment the shim detects the native `window.claude.complete` and leaves it alone (set `?local=1` or `CortexLLM.useLocal()` to force local).

- AI estimator — natural language → UK construction line items + total
- Daily briefing, decisions, 30-day strategy (Vera CEO persona)
- Receipt OCR + auto-categorisation
- Smart task parsing
- Invoice chase drafting
- Project health check
- Material forecast
- Schedule optimisation
- Document generation (RAMS, Method Statement, H&S Policy, Tender)
- Photo→Snag vision flow
- Voice memo transcription (post-hoc on iOS, live on Chrome)

## Vera autopilot

Vera Stone is the autonomous CEO (`lib/screens-phase39.jsx` & `40.jsx`):
- Generates leads from market intelligence
- Drafts chase emails for overdue invoices
- Health-checks every active project
- Forecasts material orders
- Schedules briefings on cron (06:00 / 09:00 / 14:00 / 16:00)

Plus 4 supporting personas: Marcus Pound (CFO), Pip Carter (Site Manager), Ada Whitfield (Compliance), River Ng (Sales Director).

## Performance

| Metric | Result |
|---|---|
| Cold start (production) | **192 ms** in iframe; ~600 ms on iPhone Safari |
| Cross-tab sync latency | < 5 ms via BroadcastChannel |
| Bundle size (dist/, gzipped) | ~280 KB |
| Lighthouse PWA score | 100/100 (target; verify locally) |

See [`PERF_PHASE_81.md`](PERF_PHASE_81.md) for the deep-dive.

## Build (keep lib/ and dist/ in sync)

`lib/*.jsx` is the source of truth; `dist/*.js` is the precompiled production bundle.
After editing anything in `lib/`, regenerate `dist/` so the two never drift:

```sh
# one-time
npm install --save-dev @babel/core @babel/cli @babel/preset-react

# recompile all modules (picks up new files automatically)
npx babel lib --out-dir dist --presets=@babel/preset-react --extensions ".jsx,.js"
```

The app defaults to loading `lib/` via in-browser Babel, so source edits are always
live. Append `?prod` to the URL to load the precompiled `dist/` path instead.

## Tech

- React 18 (UMD, dev build)
- In-browser Babel only in `?dev=1` mode (production loads precompiled `dist/*.js`)
- LocalStorage + IndexedDB (`backend.js` + `backend-extras.js`)
- Service Worker (offline + dist/ precache)
- BroadcastChannel (multi-tab sync)
- Capacitor 6 (iOS wrap)
- Claude API (server-proxied)

## License

Provided as-is. Use it, fork it, ship it.

## Author

Built with [Claude](https://claude.ai/) by Anthropic, in partnership with Adrian Stanca.
