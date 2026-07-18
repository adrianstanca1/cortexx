# Architecture

CortexBuild Pro ("Cortexx") is a UK SMB construction-management SaaS. One backend, three
deployment targets. For the operational conventions that prevent prod outages, see `CLAUDE.md`;
this file is the structural map.

## The three deployment targets (one backend)

```
                         ┌─────────────────────────────────────┐
   Browser (PWA)  ─────▶ │  cortexbuildpro.com  (Caddy static)  │
   iOS / Android  ─────▶ │   • Cortexx.html + lib/ + dist/      │
                         │   • proxies /api/* ──┐               │
                         └──────────────────────┼───────────────┘
   Next.js admin  ─────▶ │  app/ (Next.js 16)   │  /api/*       │
                         └──────────────────────┼───────────────┘
                                                ▼
                         ┌─────────────────────────────────────┐
                         │  Express + PostgreSQL  (server/)     │
                         │  • generic /api/:collection CRUD     │
                         │  • auth, SSE realtime, magic-link    │
                         │  • integration routers (bank/hmrc/   │
                         │    iap/llm/payments/push)            │
                         │  • Ollama LLM (no external keys)     │
                         └─────────────────────────────────────┘
```

| Target | Source | Purpose | Data layer |
|--------|--------|---------|-----------|
| **Offline PWA** | `Cortexx.html` + `lib/*.jsx` → `dist/` | What the live site serves; works offline via `sw.js` | raw SQL (`server/db/schema.sql`) |
| **Next.js web admin** | `app/`, `components/`, `prisma/` | Richer admin UI, React 19 + next-auth v5 | Prisma (`prisma/schema.prisma`) |
| **Native iOS/Android** | `expo/` + Capacitor 8 (`ios/`) | App-store shell over the same SPA | raw SQL (shared `/api/*`) |

## Why the split

- The **PWA** is the production front door — vanilla JS, Babel-in-browser, offline-first. It is
  not bundled; `lib/` *is* the source and `dist/` is its precompiled mirror (`build-dist.js`).
- **Next.js** is the admin console — a separate, framework-driven stack that uses Prisma for types.
- **Expo/Capacitor** wraps the PWA as a native shell; it talks to the same `/api/*`.

All three share the **single Express backend** and the **raw-SQL schema**. Prisma is a typed
mirror for Next.js only — it is *not* the backend's source of truth (see `docs/DATA_MODEL_DRIFT.md`).

## Where things live

- **Backend:** `server/index.js` (entry) + `server/routes/*.js` (feature routers) + `server/security.js`
  (CRUD denylist) + `server/logger.js` (structured logging).
- **SPA screens:** `lib/` (118 screen modules) → `dist/` (114 precompiled). `lib/sheet-registry.jsx`
  is the declarative nav map (`cortexxNav(key)` → `setSheet(key)` → `{sheet===key}` block).
- **CI:** `.github/workflows/ci.yml` runs the build-sync, drift, smell, nav-registry, lint, and
  test gates. See `CONTRIBUTING.md` for the guard commands.
