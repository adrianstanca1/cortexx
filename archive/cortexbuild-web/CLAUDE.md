# CLAUDE.md — cortexbuild-web

Vite React SPA + Express/tRPC Node API in one repo, backed by **MySQL**
(the only MySQL project in the BuildTrack/CortexBuild ecosystem; the
others run on Postgres). Started life as a WhatsApp agent — see the
WhatsApp routes still present (`/api/webhook/whatsapp`) and the
`whatsapp-agent-pro` name in `package.json`. Now serves a broader
construction-management dashboard.

## Stack

- **Runtime**: Node 22+, Express 5 (no version pin in package.json
  but the tsx/esbuild build assumes ESM Node)
- **Frontend**: Vite + React + TypeScript, mounted under `client/`
- **API**: Express + tRPC v11 (`@trpc/server/adapters/express`), mounted
  at `/api/trpc`
- **ORM**: Drizzle with `drizzle-orm/mysql-core` schema, `mysql2`
  driver
- **DB**: MySQL 8 via `DATABASE_URL` (Docker Compose pattern in
  `docker-compose.yml`; production uses host-network `cortexbuild-mysql`)
- **Auth**: OAuth (Manus) via `registerOAuthRoutes` in
  `server/_core/oauth.ts`. JWT cookie `COOKIE_NAME` (see
  `shared/const.ts`).
- **Build**: `pnpm build` does `vite build` for the client + `esbuild`
  bundles the server to `dist/index.js`
- **Tests**: Vitest 25 tests across 3 files (`server/agent.test.ts`,
  `server/auth.logout.test.ts`, `shared/const.test.ts`).

## Git oddity — default branch is `Cortexbuildpro`

Not `main`, not `master` — the canonical default is `Cortexbuildpro`
(capital C). `origin/HEAD` points there. If you `git checkout main`
you'll get nothing. Use `Cortexbuildpro` for all PRs.

## How to run

```bash
# from /root/cortexbuild-web
pnpm install                # one-off (it's pnpm, not npm)
pnpm dev                    # tsx watch on server/_core/index.ts
pnpm check                  # tsc --noEmit
pnpm test                   # vitest run (25 tests, ~1.6s)
pnpm build                  # vite build (client) + esbuild (server) → dist/
pnpm start                  # NODE_ENV=production node dist/index.js
pnpm db:push                # drizzle-kit generate + migrate (needs DATABASE_URL)
```

## Live service

- **PM2 process**: `cortexbuild-web-api` (id 0), fork mode
- **Port**: `:3002` (per `/root/CLAUDE.md` PM2 inventory)
- **Health**: `curl http://127.0.0.1:3002/api/health` → `{status: "ok", version: "1.0.0", service: "cortexbuild-web"}`
- **Hostname**: served by nginx vhost — see `nginx/conf.d/` in repo

After any source edit + `pnpm build`, restart PM2:

```bash
NODE_OPTIONS="" pm2 restart cortexbuild-web-api
NODE_OPTIONS="" pm2 save     # IMPORTANT — see /root/CLAUDE.md
```

(There's no `postbuild` auto-restart hook like buildtrack-web has —
consider adding one if this becomes a frequent edit target.)

## Server architecture

```
server/
├── _core/
│   ├── index.ts            # main entrypoint; sets up Express, mounts routes
│   ├── oauth.ts            # OAuth login + /api/oauth/callback
│   ├── trpc.ts             # tRPC server bootstrap
│   ├── context.ts          # tRPC context builder (auth-aware)
│   ├── vite.ts             # dev: vite middleware; prod: serveStatic
│   ├── db.ts               # Drizzle client (mysql2 pool)
│   └── ...
├── routers.ts              # appRouter wiring
├── services/               # WhatsApp, OpenAI, scheduled reports, etc.
└── storage.ts              # MinIO proxy (same pattern as cortexbuild-field)
```

**Mount order in `server/_core/index.ts`**:

1. JSON / urlencoded parsers
2. WhatsApp webhook routes (GET + POST `/api/webhook/whatsapp`)
3. File upload route (`POST /api/upload`)
4. `/api/health` JSON probe
5. `registerOAuthRoutes(app)` (OAuth callbacks)
6. tRPC at `/api/trpc/*`
7. `serveStatic(app)` (Vite static + SPA fallback)

**Critical**: the SPA fallback at the end MUST filter `/api/*` paths.
A regression here was fixed on 2026-05-13 — see `server/_core/vite.ts`
comment for the full reasoning. Without that filter, unmatched
`/api/*` paths return `<!doctype html>...` with a 200 status, breaking
every fetch-based client. The fix returns `{error: "Endpoint not
found", path: "..."}` with a JSON 404 for unmatched API paths.

## Drizzle schema

`drizzle/schema.ts` uses `drizzle-orm/mysql-core` types: `int`,
`mysqlEnum`, `mysqlTable`, `text`, `timestamp`, `varchar`, `boolean`,
`json`, `bigint`, `float`. **Don't import from `drizzle-orm/pg-core`
by reflex** — the other CortexBuild projects use Postgres but this
one is MySQL.

Migrations live in `drizzle/migrations/` with a journal in
`drizzle/meta/_journal.json`. `pnpm db:push` regenerates + applies.

## Env contract

`.env.example` is the source of truth. The important ones:

- `DATABASE_URL=mysql://user:pass@host:3306/db` — the entire DB
  layer warns and no-ops without this (see `server/db.ts`).
- `JWT_SECRET` (min 32 chars) — required for OAuth.
- `OAUTH_SERVER_URL`, `VITE_OAUTH_PORTAL_URL`, `VITE_APP_ID`,
  `OWNER_OPEN_ID` — Manus OAuth wiring.
- `WHATSAPP_ACCESS_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID` — WhatsApp
  Business Cloud. Without these, `/api/webhook/whatsapp` POST handler
  logs the missing-credentials warning.
- `BUILT_IN_FORGE_API_KEY` — AI/forge integration.
- `MINIO_*` block — object storage (matches cortexbuild-field).

## Tests

```bash
pnpm test            # vitest run (25 tests, ~1.6s)
```

Only 3 test files exist:

- `server/agent.test.ts` — 18 tests (WhatsApp client graceful fallback,
  inbox processor, vision AI, etc.)
- `server/auth.logout.test.ts` — auth flow tests (tRPC procedure level,
  not HTTP)
- `shared/const.test.ts` — constants invariants

No integration / HTTP-level tests. Adding supertest would let us
regression-test the SPA-fallback / API-404 split.

## Known issues / debt

- **SPA-fallback `/api/*` regression**: now fixed (2026-05-13) but the
  pattern is easy to break. Anyone changing `serveStatic` in
  `server/_core/vite.ts` should preserve the `/api/*` JSON-404 branch.
- **`whatsapp-agent-pro` lineage**: package.json still names the
  package `whatsapp-agent-pro`. The WhatsApp routes are still wired
  but most of the surface has shifted to construction-management
  dashboards via the tRPC `appRouter`. Worth a rename for clarity.
- **No `postbuild` PM2 restart hook**: unlike buildtrack-web where
  `pnpm build` auto-restarts PM2, here you must restart manually.
- **`pnpm db:push` requires `DATABASE_URL`** at runtime (drizzle-kit
  throws otherwise). Set it in `.env` before running.
- **No lint script** in `package.json` — only `check` (tsc) +
  `format` (prettier). Adding `eslint` would catch the unused-import /
  any patterns that have crept in.
- **6 `console.*` calls in `client/src/`** — modest but worth a pass
  with proper logging if observability matters.
- **Default branch is `Cortexbuildpro`** (capital C, no master/main) —
  call out in any onboarding.

## Cross-references

- Sibling projects: `cortexbuild-field` (the Expo construction-mgmt
  client; this is the web variant), `cortexbuild-platform` (the
  newer monorepo replacement, see `/root/cortexbuild-platform/`)
- Workspace overview: `/root/CLAUDE.md` "Subprojects" + "Running services"
- DEPLOYMENT.md (May 9) — VPS deploy via docker-compose
- Docker Compose stack: `docker-compose.yml` — MySQL + the app
