# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

CortexBuild Field is a UK construction site management app: an Expo / React Native client (iOS, Android, web) plus an Express + tRPC API backed by PostgreSQL via Drizzle ORM. The codebase is a single Expo project — the mobile app, web build, and API server all live in one repo and share types via tRPC. Auth is **Supabase** (JWT verified server-side via `server/_core/supabase-auth.ts`); storage is **MinIO** (S3-compatible) proxied at `/storage/<key>` (`server/storage.ts`); LLM calls fan out through `server/_core/unified-ai.ts` (Ollama → Gemini → OpenRouter with circuit breaker; requires provider keys in env).

## Commands

```bash
pnpm install                    # install (pnpm 9, Node 22+)
pnpm dev                        # run API server + Metro bundler concurrently
pnpm dev:server                 # only the tRPC/Express server (tsx watch)
pnpm dev:metro                  # only Expo Metro on EXPO_PORT (default 8081)
pnpm ios | pnpm android         # native dev clients
pnpm build                      # esbuild server bundle -> dist/index.js
pnpm start                      # run built server (NODE_ENV=production)

pnpm check                      # tsc --noEmit
pnpm lint                       # expo lint (eslint-config-expo flat)
pnpm format                     # prettier --write .
pnpm test                       # vitest run
pnpm test -- tests/foo.test.ts  # single file
pnpm test -- -t "name"          # single test by name

pnpm db:push                    # drizzle-kit generate && migrate (needs DATABASE_URL)
```

`DATABASE_URL` is required for `db:push` and for the server to actually serve data — the server starts without one but every db helper short-circuits to a warning. `pnpm dev` finds an open port starting at `PORT` (default 3000) if it's busy.

## Architecture

### tRPC is the contract
The single source of truth for client/server is the `appRouter` in **`server/routers/index.ts`** (split domain routers under `server/routers/`). **`server/routers.ts`** re-exports for stable `@/server/routers` imports. The Expo client imports `AppRouter` from there via `@/server/routers` and calls it through `lib/trpc.ts`. **Do not add REST endpoints in parallel** — add a tRPC procedure under the relevant sub-router. The 11 sub-routers wired into `appRouter` are `auth`, `ai`, `companies`, `conflicts`, `documents`, `enquiries`, `equipment`, `files`, `finance`, `materials`, plus `system` from `_core`. Domain concepts like `projects`, `defects`, `dailyReports`, `rfis`, `tasks`, `inspections`, `timesheets`, etc. are **procedures inside** these routers, not separate files — grep for `<concept>:` in the relevant router (e.g. a `projects.list` query lives inside whichever router owns project data). Use:
- `publicProcedure` — no auth.
- `protectedProcedure` — `ctx.user` is guaranteed non-null (from `server/_core/trpc.ts`).
- `companyScopedProcedure` — preferred default for tenant data: takes a `companyId` input and validates the user's membership. New tenant-touching procedures should reach for this first.
- `adminProcedure` — requires `user.role === 'admin'`.
- `superAdminProcedure` — currently aliases `adminProcedure` (TOTP gate removed in `0016_remove_totp`). Kept as a distinct named export so a future second factor can be reintroduced without churning every call site; `tests/tenant-isolation.test.ts` still requires it to be explicitly allow-listed.

`tests/tenant-isolation.test.ts` enforces that every `protectedProcedure` is either actually `companyScopedProcedure` or explicitly listed in `PROTECTED_TENANT_GAPS` with a comment. Adding a new `protectedProcedure` without doing one of those fails CI.

tRPC v11 quirk: the `superjson` transformer must live inside `httpBatchLink`, not at the client root (see `lib/trpc.ts`). Don't move it.

### Auth flow (dual-platform)
- **Native**: Supabase JS client obtains the JWT in-app; `app/oauth/callback.tsx` persists it to `expo-secure-store` (`SESSION_TOKEN_KEY`) and hydrates user via `/api/auth/me`.
- **Web**: client posts the Supabase JWT to `/api/auth/session`, which sets an HTTP-only cookie (`server/_core/oauth.ts`); `fetch` uses `credentials: "include"`.
- Both paths land in `sdk.authenticateRequest` (`server/_core/sdk.ts`), which calls `verifySupabaseJwt`, looks the user up by `openId` (Supabase `sub`), and lazily upserts if absent. `OWNER_OPEN_ID` is auto-promoted to `admin` on upsert. `SUPABASE_URL` must be set or every authed request fails at runtime.
- The remaining HTTP routes in `server/_core/oauth.ts` are `/api/auth/{logout,me,session}` only — `/api/oauth/{callback,mobile}` were removed in `5ec81d7`. Two SDK methods are dead in app code (only exercised by `tests/sdk.test.ts`): `sdk.exchangeCodeForToken` and `sdk.getUserInfo`. **`sdk.createSessionToken` is live** — `server/routers/auth.ts` (login) and `server/routers/index.ts:1125` call it. `sdk.authenticateRequest` dispatches by JWT alg header (`f8aad5c`): RS256 → `verifySupabaseJwt`; HS256 → `sdk.verifySession`. Both paths converge at `db.getUserByOpenId`. So local-password login (HS256 cookie) and Supabase JWT (RS256 bearer-or-cookie) both work; reject anything else as `Unsupported JWT algorithm`.
- `protectedProcedure` clients **must** handle `error.data.code === 'UNAUTHORIZED'` and route to login — there is no global redirect.

### Database (PostgreSQL via Drizzle)
- Schema: `drizzle/schema.ts` (Postgres-flavoured; ignore the MySQL examples in `server/README.md` — they predate the migration). Enums and types are exported alongside each table.
- Connection: `server/db.ts` lazily creates a `postgres-js` pool; if `DATABASE_URL` is missing, helpers warn and no-op so local UI work doesn't crash.
- Migrations live in `drizzle/*.sql` plus `drizzle/migrations/`. The `0001_cortexfield_pg.sql` and `0003_cortexfield_v2.sql` files contain the bulk of the domain schema — review them before hand-editing the generated migrations.
- New migrations require a matching `drizzle/meta/_journal.json` entry with monotonic `when` and contiguous `idx`. `tests/migration-journal-completeness.test.ts` enforces this — the SQL alone is not enough.
- Adding a NOT NULL column to `users` triggers a fixture backfill across ~40 hand-rolled test fixtures that mirror the User shape (no shared factory). A perl substitution against any existing user-shape field covers most files; narrow-typed mocks may need hand edits.

### Fixture backfill pattern

When adding a NOT NULL column to `users`, you must update every test file that constructs a `User` or `TrpcContext` fixture. There is no shared factory — each test file hand-rolls its user object. The most efficient workflow:

1. Run the migration: `pnpm db:generate && pnpm db:migrate`
2. `grep -rn "openId:" tests/ --include="*.test.ts" | head` — find all user fixture sites.
3. `grep -rn "function ctx(" tests/ --include="*.test.ts"` — find context helper functions.
4. Run `pnpm test` — compilation errors will point to every fixture that needs the new field.
5. Bulk-fix with `sed -i 's/role: "user",/role: "user",\n      new_column: "default_value",/g' tests/*.test.ts` where `new_column` is your field.
6. Narrow-typed mocks (e.g., `type AuthenticatedUser = { openId: string; email: string; role: "user" | "admin"; }`) need manual updates if the new field changes the discriminant.

Typical fixture shapes in tests:
- `ctx()` / `ctxFor()` / `ctxWithUser()` helpers return `TrpcContext` with `user` inside.
- Inline objects: `{ id: 1, openId: "user-1", name: "User 1", email: "u1@x.y", role: "user" }`
- JWT payloads in `sdk.test.ts` / `sdk-jwt.test.ts`: `{ openId, appId, name }`

Rule: **grep `openId:` in `tests/`** to find every user-shaped object. If you add `new_column` to `users` table, every hit needs updating.
- `drizzle.config.ts` requires `DATABASE_URL` at runtime (it throws otherwise). Set it in `.env` before running drizzle-kit.

### Frontend layout
- `app/` is **expo-router** file-based routing. `app/(tabs)/` has the five bottom-tab screens (Dashboard, Projects, Field, AI, More). Other top-level files are pushed routes. Native uses a `<Stack>`; web uses `<Slot/>` (see `app/_layout.tsx`).
- Cross-cutting providers wrap everything in `app/_layout.tsx`: `ThemeProvider` → `SafeAreaProvider` → `trpc.Provider` → `QueryClientProvider` → `CompanyProvider` → `SyncQueueProvider`. Add new global state inside this stack.
- Path aliases: `@/*` -> repo root, `@shared/*` -> `shared/*` (see `tsconfig.json`).
- Styling is **NativeWind 4** (Tailwind classes via `className`). `global.css` is imported once in `_layout.tsx`. The brand palette and tokens are defined in `theme.config.js` / `design.md`.

### Offline-first sync
`lib/sync-queue.tsx` persists mutations to AsyncStorage when offline and replays them when NetInfo reports connectivity. Anything that can be done in the field while offline (check-ins, defect creation, receipt scans, daily reports) should `enqueue()` rather than calling tRPC directly when `status !== 'online'`. The HORUS background-location buffer (`lib/background-location-task.ts`) flushes via `flushHorusBuffer()` on app foreground and posts to `/api/horus/ping` (a custom non-tRPC route in `server/_core/index.ts`).

### Multi-tenant company context
`lib/company-context.tsx` defines a six-level role hierarchy (`super_admin` > `company_admin` > `manager` > `supervisor` > `worker` > `viewer`) gated by `hasPermission(userRole, requiredRole)`. The DB user `role` column is just `'user' | 'admin'`; richer per-company roles are stored in `companyUsers` and surfaced through `/api/auth/me`. **Always check role at both client and server** — `protectedProcedure` only verifies authentication, not company role.

### Platform integrations
- **LLM**: `invokeLLM(...)` in `server/_core/llm.ts` (thin wrapper over `unifiedInvoke` in `server/_core/unified-ai/`). Provider chain Ollama → Gemini → OpenRouter; needs `GEMINI_API_KEY` and/or `OPENROUTER_API_KEY` (and optionally `OLLAMA_BASE_URL`) — without any of them every call fails. Use `response_format: { type: 'json_schema' }` for flat shapes; for nested arrays/objects fall back to `json_object` and `JSON.parse` (see `server/README.md`). Always call from server-side procedures.
- **Storage**: `storagePut(key, bytes, contentType)` in `server/storage.ts` returns `{ key, url: '/storage/<key>' }` (MinIO-backed, S3-compatible). Persist the key in DB; the `/storage/...` URL is served via signed redirect by `registerStorageProxy`. There is intentionally no delete helper.
- **Voice/image gen**: `server/_core/voiceTranscription.ts` (Whisper) and `server/_core/imageGeneration.ts`.
- **Owner notifications**: `notifyOwner({ title, content })` in `server/_core/notification.ts`, also exposed as `trpc.system.notifyOwner` — use for ops alerts only, not user-facing messaging.
- **Push notifications**: `sendPushToUsers(userIds, eventType, payload)` and `sendPushToUserByName(name, eventType, payload)` in `server/_core/pushNotifications.ts`. The required `eventType` is a literal union from `shared/notification-events.ts` — that registry is the single source of truth. New event types must be appended there AND wired to a call site in the same PR; the gate filters by `users.pushPreferences` before any token lookup, so a muted user generates zero Expo traffic. `PushResult.degraded === true` flags fail-open (gate couldn't read prefs) so callers can distinguish from "everyone allowed because nobody muted".
- **Push error alerting**: `recordPushError({ key, message })` in `server/_core/push-error-counter.ts` is wired into every push-pipeline failure (DB read, token lookup, Expo network/HTTP/protocol, dead-token deactivation). Crosses a per-key threshold inside a rolling window → `notifyOwner` fires once per cooldown. Defaults: 10 errors / 5 min / 30-min cooldown. Tunable via env (`PUSH_ERROR_THRESHOLD` / `PUSH_ERROR_WINDOW_MS` / `PUSH_ERROR_COOLDOWN_MS`). State is exposed read-only at `/api/metrics` for ops scraping.
- **Push gate failure mode**: `PUSH_GATE_FAIL_MODE` env var controls what `filterByPreferences` does when it can't read `users.pushPreferences`. Default `'open'` allows everyone (preserves "missed assignments aren't recoverable, over-notifying is"). `'closed'` drops everyone (preserves explicit mutes during sustained outage). `'auto'` fails open by default but consults the `gate.read` burst counter — switches to fail-closed during the alert cooldown window.
- **Push prefs cache (graceful degradation)**: `server/_core/push-prefs-cache.ts` is a Redis-backed last-known-prefs store, written on every successful gate read and consulted **only** when the DB read fails. The cache hit-rate doesn't matter for normal operation (DB is source of truth); the value is that during a Postgres outage the gate can still honour explicit mutes for users it cached recently. `pushTokens.updatePreference` invalidates after a successful UPDATE so changes propagate without waiting for TTL. Disabled when `REDIS_URL` is unset (silent no-op). TTL `PUSH_PREFS_CACHE_TTL_SECONDS` (default 3600); circuit-breaker window `PUSH_PREFS_CACHE_CIRCUIT_MS` (default 60000).

### Bundle ID is fixed
`app.config.ts` derives both iOS bundle and Android package from `space.manus.cortexbuild.field.t20260425152033`, and the OAuth deep-link scheme (`manus20260425152033`) is derived from the same timestamp. Don't change these — they're tied to the App Store Connect record and existing OAuth registrations.

## Conventions and gotchas

- **`server/_core/`, `lib/_core/`, `shared/_core/` are framework-level** — don't modify them when adding features. Add tables to `drizzle/schema.ts`, queries to `server/db.ts`, procedures to **`server/routers/index.ts`** (or a new file under `server/routers/` merged into `appRouter` there). The exception is when you're genuinely extending the framework primitives themselves (e.g. adding a new procedure builder like `companyScopedProcedure` alongside `publicProcedure` / `protectedProcedure` / `adminProcedure` in `server/_core/trpc.ts`) — those edits belong in `_core/` because that's where the procedure builders live. The rule blocks coupling features to framework, not principled framework additions.
- **Database-unavailable error posture**: a procedure that needs the DB and finds `getDb()` returned null must `throw dbUnavailable()` from `server/_core/errors.ts`, not a plain `Error('Database unavailable')`. The helper produces a `TRPCError({code:'SERVICE_UNAVAILABLE'})` so the client can match on `err.data?.code` and the message comes from a single source of truth. `'Database unavailable'` string literals in `throw new Error(...)` or `throw new TRPCError({code:'INTERNAL_SERVER_ERROR'})` are forbidden — Sentry/ops would treat them as P1 incidents indistinguishable from real bugs.
- **Drizzle table-name introspection in tests**: use the public `getTableName(table)` from `drizzle-orm` rather than `Symbol.for('drizzle:Name')`. The latter is internal and breaks on Drizzle minor upgrades.
- The drizzle PG dialect uses `serial`, `varchar`, `timestamp`, `decimal` (string at runtime). Money columns are `decimal(...)` and round-trip as strings — convert at the edge, not deep in components.
- The server registers `/api/health`, `/api/ready`, `/api/horus/ping`, OAuth routes (`registerOAuthRoutes`), the storage proxy (`registerStorageProxy`), and tRPC at `/api/trpc`. All custom HTTP routes must start with `/api/` so the gateway can route them.
- `pnpm test` runs **server-side** vitest only (auth, mappers, finance, permits, sync-queue) — there is no React Native test runner configured. `__tests__/sync-queue.test.ts` runs under the same vitest config as `tests/`.
- `pnpm check` is what CI gates on (see `.github/workflows/deploy.yml`); run it before pushing.
- Production deploy: GitHub Actions on push to `main` builds the server with esbuild and runs `expo export --platform web`, then deploys to a VPS where PM2 (`ecosystem.config.cjs`) runs `dist/index.js` on port 3005 behind Nginx. iOS builds are separate (`.github/workflows/eas-build-ios.yml`, EAS profiles in `eas.json`). Bare-metal deploy details are in `DEPLOY.md`; iOS/TestFlight in `IOS_BUILD_GUIDE.md`.
