# CLAUDE.md — cortexbuild-platform

Platform-tier monorepo consolidating CortexBuild construction-management services into a single shared codebase. It hosts the unified API (Express 4, covering projects, tasks, safety, inspections, defects, workers, timesheets, RFI, invoices, daily reports, drawings, documents, equipment, chat, notifications, AI, BIM, carbon, WhatsApp, webhooks, analytics, admin — 24 route groups) and the Next.js web dashboard that drives them. The target state is for all six prior CortexBuild apps (BuildTrack, BuildTrack-iOS, cortexbuild-field, cortexbuild-ultimate, cortexbuild-web, cortexbuildpro) to consolidate here; as of 2026-05-17 the API and web dashboard are running but the mobile app package (`apps/mobile/`) is not yet present.

## Workspace layout

```
cortexbuild-platform/
├── apps/
│   └── web/                    # Next.js 15 + React 19 dashboard (port 3007 via PM2)
│       ├── src/app/            # App Router pages (projects, tasks, safety, defects…)
│       ├── src/components/     # Shared UI: sidebar, EntityDetail, shadcn primitives
│       └── src/lib/api.ts      # axios instance + apiFetch; JWT from localStorage
├── packages/
│   ├── api/                    # Express API server (port 3006 via PM2)
│   │   └── src/
│   │       ├── routes/         # 24 route files; all protected by authMiddleware
│   │       ├── middleware/     # auth.ts, validate.ts, error.ts
│   │       ├── lib/            # logger.ts (Winston), pagination.ts
│   │       ├── websocket.ts    # ws-based room broadcast
│   │       ├── scheduler.ts    # node-cron (stub only — see Known issues)
│   │       └── server.ts       # Express + WebSocketServer entry point
│   ├── db/                     # Drizzle ORM schema + migrations + client
│   │   ├── src/schema.ts       # All 40+ table definitions + enums
│   │   ├── src/client.ts       # postgres.js pool, drizzle(queryClient)
│   │   ├── drizzle.config.ts   # dialect postgresql; schema ./src/schema.ts; out ./drizzle
│   │   └── drizzle/            # Migration SQL files (0000_calm_gorgon.sql)
│   └── shared/                 # Cross-package types, Zod schemas, constants
│       └── src/
│           ├── types.ts        # TypeScript union types for enums
│           ├── validations.ts  # Zod schemas (createProjectSchema etc.)
│           ├── permissions.ts  # MODULE_ACL + can() + requirePermission — referenced in route comments; runtime uses requireRole from api/middleware/auth instead
│           ├── ai-agents.ts    # AI agent config
│           └── constants.ts    # App-wide constants
├── ecosystem.config.cjs        # PM2 config for cortexbuild-platform-api only
├── docker-compose.yml          # NOT the canonical path — do not run (see Don't do)
├── .github/workflows/ci.yml    # CortexBuild CI
├── pnpm-workspace.yaml         # packages/* + apps/*
└── package.json                # Root orchestration scripts; devDeps only (intentional)
```

## Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node ≥22, ESM (`"type":"module"`) |
| Package manager | pnpm 9 (`packageManager` field pinned) |
| Build orchestration | Turbo 2 (`turbo.json`), TypeScript 5.5 |
| API framework | Express 4 + cors + helmet + compression + cookie-parser |
| ORM | Drizzle ORM 0.45 (postgres.js driver, pool of 10) |
| Database | PostgreSQL 16 (cortexbuild-postgres container :55432) |
| Cache | Redis 7 (ioredis; used by API but not yet in routes as of latest commit) |
| Auth | JWT (jsonwebtoken) access 24h + refresh 7d; bcrypt 12 rounds |
| Real-time | `ws` WebSocket server on `/ws`; room-based broadcast |
| Email | Resend (dep present; not yet wired in routes) |
| Background | node-cron scheduler (3 jobs; stubs only) |
| Web frontend | Next.js 15, React 19, Tailwind 3, shadcn/ui (Radix), TanStack Query 5, Zustand 5, Recharts, Framer Motion |
| Type-checking | `tsc --noEmit` across all packages |
| Testing | Vitest 3 (API package); no test files written yet |

## Quick start

```bash
cd /root/cortexbuild-platform
pnpm install                        # one-off; frozen-lockfile in CI

# Development (runs API + web concurrently)
pnpm dev                            # packages/api tsx watch + apps/web next dev
pnpm dev:api                        # API only → http://localhost:3001 (dev default)
pnpm dev:web                        # Web only → http://localhost:3000

# Per-package commands
pnpm --filter ./packages/api run test      # vitest run (no test files yet → exits 0)
pnpm --filter ./apps/web run lint          # next lint
pnpm --filter ./apps/web run check         # tsc --noEmit
pnpm --filter ./packages/api run check     # tsc --noEmit
pnpm build                                 # pnpm -r run build (all packages)
pnpm build:api                             # packages/api tsc
pnpm build:web                             # apps/web next build
```

## Database

| Item | Value |
|------|-------|
| DB name | `cortexbuild_platform` |
| Host | `cortexbuild-postgres` Docker container, `127.0.0.1:55432` |
| User | `cortexbuild` |
| `DATABASE_URL` (PM2) | set in `ecosystem.config.cjs` env block; overrides any `.env` |
| Schema file | `/root/cortexbuild-platform/packages/db/src/schema.ts` |
| Migration tool | `drizzle-kit` (dev dep in `packages/db`) |
| Migrations dir | `packages/db/drizzle/` — one migration exists: `0000_calm_gorgon.sql` |
| Live table count | 46 tables (restored 2026-05-15; the migration file reflects schema at that point) |

```bash
# From repo root
pnpm db:generate    # drizzle-kit generate — create new migration from schema diff
pnpm db:migrate     # drizzle-kit migrate — apply pending migrations
pnpm db:push        # drizzle-kit push — push schema directly (no migration file; dev only)
pnpm db:studio      # Drizzle Studio GUI on :4983

# Verify DATABASE_URL actually in use by the running process:
cat /proc/$(pgrep -f 'packages/api')/environ | tr '\0' '\n' | grep DATABASE_URL
```

The PM2 `ecosystem.config.cjs` env block wins over any `.env` file in the project. Restart with `pm2 delete cortexbuild-platform-api && pm2 start /root/cortexbuild-platform/ecosystem.config.cjs --only cortexbuild-platform-api` to force re-read; `pm2 restart --update-env` does NOT re-read the ecosystem file.

## Health endpoints

The API exposes two health routes with different semantics:

| Path | Behaviour | Use for |
|------|-----------|---------|
| `GET /health` | Executes `SELECT 1`; returns HTTP 503 if DB unreachable | Deep liveness; nginx upstream health check |
| `GET /api/health` | Same DB check but always returns HTTP 200 with `{ postgres: false }` on failure | Liveness-only probe; won't pull a node out of rotation |

The split matters: probing `/api/health` to determine whether the service is healthy will return 200 even when the DB is down. Use `/health` for anything that should gate traffic. The web PM2 process (`cortexbuild-platform-web`) is a Next.js standalone server — no `/health` route; probe port 3007 directly.

## Running locally vs PM2 vs Docker

**PM2 is canonical for production on this VPS.**

```bash
NODE_OPTIONS="" pm2 list                              # verify both services online
NODE_OPTIONS="" pm2 logs cortexbuild-platform-api --lines 50
NODE_OPTIONS="" pm2 logs cortexbuild-platform-web --lines 50
NODE_OPTIONS="" pm2 save                              # always after start/restart
```

| Process | cwd | Entry | Port |
|---------|-----|-------|------|
| `cortexbuild-platform-api` | `/root/cortexbuild-platform/packages/api` | `npx tsx src/server.ts` | 3006 |
| `cortexbuild-platform-web` | `/var/www/cortexbuild-platform/web-server` | `node apps/web/server.js` (Next.js standalone) | 3007 |

The web PM2 process runs from the standalone build artefact at `/var/www/cortexbuild-platform/web-server/`, NOT from the source tree. After `pnpm build:web`, copy the standalone output there. The API PM2 process runs directly from source via `tsx` (no build step needed in prod mode).

**Docker Compose** (`docker-compose.yml`) is present but is not used on this VPS. It uses docker-internal hostnames (`postgres`, `redis`), maps the API to `:3001` (conflicting with `buildtrack-api`), and has no `env_file` for the production credential. Do not run `docker compose up`.

For local development, `pnpm dev` (API on :3001, web on :3000) is the fastest path.

## CI/CD

Workflow: **CortexBuild CI** (`.github/workflows/ci.yml`). Triggers on push to `main`/`develop` and PRs to `main`.

| Job | Depends on | Notes |
|-----|-----------|-------|
| `lint` | — | `pnpm lint \|\| true` — never fails CI |
| `check` | — | `pnpm check \|\| true` — never fails CI |
| `test` | — | `pnpm test \|\| true` — never fails CI; spins up postgres:16 + redis:7 services |
| `build` | lint, check | `pnpm build`; uploads `packages/api/dist/` and `apps/web/.next/standalone/` as artefacts |
| `deploy` | test, build | Only on `main`; SSH into VPS, runs `bash scripts/deploy.sh`. **Skips silently if `VPS_HOST` secret is not set** — the deploy job succeeds with `exit 0` in that case. |

CI gates are soft: all three quality jobs use `|| true`. A type error or test failure will not block merge. This is intentional for the current development phase but means CI green does not imply the code compiles or passes tests.

The `scripts/deploy.sh` is not present in the source tree as of latest read; the SSH step would fail if `VPS_HOST` is set and the script is missing. Current canonical deploy path: `cd /root/cortexbuild-platform && pnpm build:api && NODE_OPTIONS="" pm2 restart cortexbuild-platform-api && pm2 save`.

## Known issues / debt

1. **RBAC partially wired — 18 of 25 routes still unguarded.** `requireRole(...roles)` from `packages/api/src/middleware/auth.ts` is the canonical primitive and is called in: `admin`, `invoices`, `safety`, `timesheets`, `webhooks`, `whatsapp`. The 18 other route files (`ai`, `analytics`, `bim`, `carbon`, `chat`, `dailyReports`, `defects`, `documents`, `drawings`, `equipment`, `inspections`, `notifications`, `projects`, `reports`, `rfi`, `tasks`, `workers`, plus the unmounted `index`) only gate on `authMiddleware` — any logged-in user reaches every mutation. The `can()` / `requirePermission()` / `MODULE_ACL` triad in `packages/shared/src/permissions.ts` is still unused at runtime; the guarded routes reference `MODULE_ACL` only in comments documenting what role they enforce via `requireRole`. Wiring the remaining 18 is mechanical (3 lines per file).

2. **Body validation: 13 routes still use `validateBody(z.any())` on POST.** As of 2026-05-18 the following routes wire a real Zod schema from `packages/shared/src/validations.ts`: `admin`, `auth`, `defects`, `documents`, `inspections`, `invoices`, `projects`, `safety`, `tasks`, `timesheets`, `workers` (11 routes). The remaining unwired: `ai`, `analytics`, `bim`, `carbon`, `chat`, `dailyReports`, `drawings`, `equipment`, `notifications`, `reports`, `rfi`, `webhooks` (12, plus `index` which has no handlers). **Separate issue**: every PUT/PATCH still uses `validateBody(z.record(z.any()))`. A general fix needs partial-schema variants (e.g. `createTaskSchema.partial()` exported, or inline).

3. **WhatsApp endpoints mitigated by role gate (not by schema fix).** `routes/whatsapp.ts` now gates `/contacts` and `/contacts/:id/messages` with `requirePlatformAdmin = requireRole('admin', 'super_admin')`. Regular tenant users can't reach the global WhatsApp inbox, so the immediate cross-tenant leak is contained. The underlying schema gap (no `company_id` column on `whatsapp_contacts` / `whatsapp_conversations` / `whatsapp_messages`) remains as a follow-up: add the column, backfill via `project_tag` / `wa_id` mapping, then replace the role gate with the standard `companyId`-filter pattern used in `routes/projects.ts`. The webhook-mount wiring bug (parent router applies `authMiddleware`, so WhatsApp's external callbacks can't reach `/webhook`) is tracked separately.

4. **JWT stored in `localStorage`.** `apps/web/src/lib/api.ts` reads and writes `localStorage.getItem('cortexbuild_token')`. This is XSS-vulnerable; the sibling projects (buildtrack-web) use httpOnly cookies. Consider migrating to httpOnly cookies on the API side.

5. **Scheduler is stubs only.** `packages/api/src/scheduler.ts` registers 3 cron jobs (09:00 daily, Monday 08:00, 1st of month midnight) but each handler body is `logger.info(...)` only — no emails, no billing actions, no reports generated.

6. **Resend wired as dependency but unused.** `resend` is in `packages/api/package.json` dependencies; no route imports or calls it. Email notifications (invitations, password reset, daily report reminders) are not implemented.

7. **Single migration file.** Only `0000_calm_gorgon.sql` exists in `packages/db/drizzle/`. Schema changes after the 2026-05-15 DB restoration have been applied via `drizzle-kit push` (no migration file created). Running `drizzle-kit migrate` against a fresh DB will not produce the current live state. Generate a new snapshot migration to close the gap before adding further tables.

8. **broadcast() wired only in projects and tasks.** The 22 other route groups (safety, defects, invoices, etc.) mutate data without emitting any WebSocket events. Clients subscribed to a room will not receive live updates for those entities.

## Don't do

- **Do not run `docker compose up`** from this directory. The compose file uses docker-network hostnames (`postgres`, `redis`) that do not resolve on the host, maps the API to `:3001` (conflicts with `buildtrack-api`), and lacks production credentials. The PM2 path is canonical.
- **Do not `pm2 restart --update-env cortexbuild-platform-api`** when you have edited `ecosystem.config.cjs` — PM2 does not re-read the file on restart. Use `pm2 delete cortexbuild-platform-api && pm2 start /root/cortexbuild-platform/ecosystem.config.cjs --only cortexbuild-platform-api && pm2 save`.
- **Do not add runtime dependencies to the root `package.json`**. The root has only `devDependencies` (`turbo`, `typescript`, `@types/node`). This is intentional — workspace packages declare their own deps. Adding a runtime dep at root makes it invisible to pnpm workspace hoisting rules and breaks the dependency graph.
- **Do not use `pnpm db:push` against the live DB** without first generating a migration with `pnpm db:generate`. Push overwrites the schema without a migration record, making rollback impossible.
- **Do not call `broadcast()` inside a try/catch that swallows errors silently** without at least logging. The current pattern in `projects.ts` / `tasks.ts` catches and discards broadcast errors — acceptable for now but hides WebSocket issues in production.
- **Do not probe `/api/health` to determine DB health.** It returns HTTP 200 even when `postgres: false`. Use `/health` (bare, not under `/api/`) for that.

## Cross-references

- Workspace overview: `/root/CLAUDE.md` "Subprojects" and "Running services".
- DB host details: `cortexbuild-postgres` Docker container `:55432`; six databases total — see workspace CLAUDE.md "Two PostgreSQL instances".
- Nginx vhosts: `/etc/nginx/sites-enabled/` — look for `cortexbuild-platform` entries.
- PM2 dump: `/root/.pm2/dump.pm2` — `cortexbuild-platform-api` (entry 8) and `cortexbuild-platform-web` (entry 4).
- Logs: `/var/log/pm2/platform-api-err.log`, `/var/log/pm2/platform-api-out.log`, `/var/log/pm2/platform-web-err.log`, `/var/log/pm2/platform-web-out.log`.
