# Legacy static PWA — preserved at `/legacy/`

This directory holds the **static single-file PWA build** of Cortexx that used
to live in the sibling [`cortexx-pwa`](https://github.com/adrianstanca1/cortexx-pwa)
repository. As part of the May 2026 consolidation it has been folded into this
repo so there's a single source of truth.

## What's here

| File | What it is |
|---|---|
| `index.html` | Originally `Cortexx.html`. A single-file Cortexx app — every screen, every dashboard, every sheet — that boots client-side and stores everything in `localStorage` + IndexedDB. No backend required. |
| `Cortexx-standalone.html` | The **fully-inlined 1.7 MB single-file PWA** — every JS bundle, every CSS rule, every Babel-transpiled phase module bundled into one file. Works offline forever after first load. Carries every one of the 80 phase modules from the Claude Design canvas (see `docs/pwa/PERF_PHASE_81.md`). |
| `Cortexx-deploy.html` | Production-deploy variant of the standalone build (1.6 MB) — same surface as `Cortexx-standalone.html` minus the dev-mode loader branch. Used as the iOS app-shell asset. |
| `marketing.html` | The marketing/landing page (originally `Cortexx Marketing.html`). Also promoted to `/marketing` and `/` (for signed-out visitors) at the Next.js root. |
| `mobile-dashboard.html` | Standalone mobile dashboard preview (kept under the original filename `Cortexx Mobile Dashboard.html` as well so the in-app links keep working). |
| `dist/` | Babel-transpiled JS bundles loaded by `index.html`: `boot.js`, `app-main.js`, `dashboards*.js`, `screens-phase*.js`, `tokens.js`, etc. About 60 files. |
| `lib/` | Vanilla-JS PWA primitives (storage helpers, computed accessors, UI atoms). |
| `sw.js` | The legacy PWA service worker. Its registration scope is `/legacy/`, so it does **not** conflict with the top-level Next.js `sw.js` at `/sw.js`. |
| `manifest.json` | The legacy PWA web manifest. |
| `icon-*.png`, `icon.svg`, `apple-touch-icon.png` | Icons for the legacy PWA. |

## How to use it

- **Live demo / fallback URL**: serve it at `https://cortexbuildpro.com/legacy/`.
  Everything is relative-pathed inside, so it just works.
- **Capacitor iOS build**: `ios/scripts/build-web.mjs` originally copied
  `Cortexx.html` into `ios/www/index.html`. That script can now point at
  `public/legacy/index.html` if you want to ship the standalone PWA as the
  iOS app shell. See `ios/README.md` for the alternative (point Capacitor at
  the deployed Next.js URL).
- **Reference for porting**: when a Next.js page is being built to replace a
  screen, the original implementation can be diffed against the bundle here.
  PR #2 (`/snags`, `/photos`) and #3 (v13 Executive dashboard) used this
  pattern.

## Don't edit these files

The legacy bundle is a snapshot. New features should be built as Next.js
routes under `app/`, not by editing the static HTML. If the legacy version is
diverging in a way that matters, port the changes to the React/Next code
and update the snapshot in one go.
