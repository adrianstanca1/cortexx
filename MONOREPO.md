# CortexBuild Pro — Monorepo

One product, three deployment targets, a single shared backend (`/api/*` on `cortexbuildpro.com`):

| App | Path | Stack | Role |
|-----|------|-------|------|
| **Web + API server** | `/` (Next.js `app/`, `server/`) | Next.js 16, Prisma/Postgres | Backend server + web admin dashboard |
| **Offline PWA** | `/` (`Cortexx.html` + `lib/` → `dist/`) | Vanilla JS (Babel-in-browser, no bundler) | Offline-first mobile web app |
| **Native** | `/expo` | Expo SDK 57 / React Native | iOS + Android app |

## Shared core

`packages/core` (`@cortexbuild/core`) is the **single source of truth** for the
cross-app API contract (auth, REST client, domain types). It is framework-agnostic:

- Consumed as ESM by **Next.js** and **Expo** (`import { createApiClient } from '@cortexbuild/core'`).
- Consumed as a browser global by the **SPA** (`window.CortexCore`, loaded via `<script>` — no bundler).
- Each app supplies its own token-storage backend (browser `localStorage`, Expo `SecureStore`, etc.).

### Linking
- Next.js + packages: npm **workspaces** (`packages/*`) at repo root.
- Expo: references the core via `"@cortexbuild/core": "file:../packages/core"` (kept as a
  standalone app with its own `node_modules` so Expo's Metro resolution is not broken by hoisting).

## Commands

```bash
# Web (Next.js + server)
npm run dev            # next dev
npm run build          # next build && precompile SPA (lib/ -> dist/)
npm run quality        # audit + lint + typecheck + test

# SPA
npm run spa:build      # build-dist.js (lib/ -> dist/)
npm run precompile:check

# Expo (native)
cd expo && npm install
npm run typecheck      # tsc --noEmit
npx expo start         # dev
npx expo export --platform web   # headless bundle check

# Shared core
cd packages/core && npm run typecheck

# Monorepo-wide (turbo)
npm run monorepo:build
npm run monorepo:typecheck
```

## Notes
- The SPA has **no bundler**: `lib/*.jsx` are compiled by `build-dist.js` (Babel) into
  `dist/*.js` and loaded as global `<script>` tags. `packages/core` is duplicated into the
  SPA's global scope via `window.CortexCore` only where needed; the SPA's own `lib/` remains
  the source for its screens.
- Node 22+ required (Capacitor CLI v8, Next.js 16).
- Do not add `expo` to the root `workspaces` array — npm hoisting breaks Expo's
  `node_modules/expo/AppEntry.js` entry resolution.
