# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Reality check: README is aspirational

`README.md` describes the intended end-state (6 apps merged, 4 packages active, `pnpm dev`, `docker-compose up`, 100+ entities). Most of those claims **don't match what's actually on `main`**. Verify before acting on README content.

| README says | Reality |
|---|---|
| 4 packages: `server`, `web`, `mobile`, `shared` | Only `server` + `shared` live on `main`. `web` + `mobile` are parked on branch `wip/web-mobile-scaffold` because they reference ~50 page/component files that don't exist on disk. |
| "API on :3001" | The PM2 entry (`server.mjs`) runs on `:3333` (loopback-only since `7354631`). The tRPC server in `src/index.ts` has never been the PM2 entry. |
| `pnpm dev`, `pnpm e2e`, `docker-compose up -d` | These commands do not exist. See "Commands that actually work" below. |
| "schema.ts" at repo root | Actual path is `packages/server/src/schema.ts`. |
| Mobile + Web are merged & functional | They compile only at the file level; tsc fails for either with ~50 TS2307 cannot-find-module errors. |

## Two server runtimes — pick the right one

The repo ships **two unrelated Node servers** that read different code paths:

1. **`packages/server/src/server.mjs`** — auth-less REST surface, **the actual PM2 entry point** (`pm2 jlist | grep cortexbuild-unified-api`). Mounts `/api/users`, `/api/companies`, `/api/dashboard/stats`, etc. No JWT, no input validation beyond Zod-on-routers. Bound to `127.0.0.1:3333` (loopback) since the bind-exposure fix in `7354631` — do not bind to `*` without putting nginx + auth in front.
2. **`packages/server/src/index.ts`** — tRPC server, bundled by esbuild to `dist/index.js`. Has the 40-router `appRouter`, `protectedProcedure`/`companyScopedProcedure`, and module-level `JWT_SECRET` validation (fail-closed if env var unset or <32 chars; see `e556c6e`). Built by CI but **not** the PM2 entry. If you want to bring this online, swap `script` in `ecosystem.config.cjs` from `server.mjs` to `../dist/index.js` AND set `JWT_SECRET` in the `.env` file the config loads from.

Don't conflate the two. A change in one path doesn't affect the other.

## Commands that actually work

```bash
# Install (must be pnpm v11+ — see overrides gotcha below)
pnpm install

# Type check (CI's gating step; what main is held to)
pnpm --filter server check

# Build server bundle (esbuild → dist/index.js; runs tsc --noEmit first)
pnpm build

# Test (vitest --passWithNoTests — there are no real tests yet)
pnpm test

# Lint (ESLint v9 flat config; baseline is permissive)
pnpm lint

# Drizzle migrations
pnpm db:generate    # generate new migrations from schema.ts diffs
pnpm db:migrate     # apply pending migrations against DATABASE_URL
```

CI (`.github/workflows/cicd.yml`) has 4 jobs in order: `lint-and-typecheck`, `test-server`, `build`, `deploy`. The deploy step soft-skips when `VPS_SSH_KEY`/`VPS_HOST`/`VPS_USER` secrets are unset (see `ed7104e`) — fork PRs and first-time clones don't go red on missing deploy creds.

## Critical gotchas

These have all bitten in the last few sessions; each is captured in auto-memory at `/root/.claude/projects/-root/memory/` if more detail is needed.

- **pnpm v11 reads `overrides:` from `pnpm-workspace.yaml`, NOT `package.json`'s `pnpm.overrides`.** The old `package.json` location is silently ignored — no warning, no error. The current `pnpm-workspace.yaml` has `overrides.esbuild: '^0.25.0'` which is load-bearing for the Dependabot esbuild fix. Don't move it back.
- **`engines.pnpm: >=11.0.0` + `packageManager: pnpm@11.1.1`** as of `1a315e8` (2026-05-13). The previous `>=10.0.0` + `pnpm@9.15.0` combo was mutually exclusive and broke CI in `25832422979` with `ERR_PNPM_UNSUPPORTED_ENGINE`. If you touch either field, keep them in sync at v11+.
- **Build-script approval uses `allowBuilds:` in `pnpm-workspace.yaml`, NOT the deprecated `onlyBuiltDependencies`** (canonicalised in pnpm v11 — see DEPS_BUILD_CONFIG_KEYS in pnpm source). Current value: `allowBuilds: { esbuild: true }` (commit `89ecf36`). Without this, pnpm v11 fatals with `ERR_PNPM_IGNORED_BUILDS: esbuild@0.25.x` because esbuild's postinstall script can't download the platform binary. Don't change the field name back.
- **Workflow `pnpm/action-setup@v6` MUST NOT pin `version:` explicitly** — let it auto-detect from `packageManager`. Pinning both creates a conflict the action errors on. Pre-2026-05-13 the workflow had `with: version: 10` which fought `packageManager: pnpm@9.15.0`. Now removed in `7cc1ec4`.
- **esbuild prefers literal `.js` over sibling `.ts` when bundling.** TS-with-ESM imports like `import * as schema from "./schema.js"` resolve to `schema.ts` at type-check, but esbuild reads the literal `.js` if it exists. There was a checked-in `schema.js` that broke the bundle until it was deleted in `e7f6126`. Don't recreate `.js`/`.mjs` siblings to `.ts` files in `src/`.
- **`tsconfig.json` deliberately has NO `composite` or `declaration*` flags.** They were removed in `e556c6e` because the aggregated `AppRouter` type can't be serialized to `.d.ts` without referencing internal `node_modules/.pnpm/...` paths (TS2742). The repo doesn't use project references anyway, so composite mode was a no-op except for triggering those errors.
- **PM2 reads `.env` via a tiny parser embedded in `ecosystem.config.cjs`** (see `a90d237`). The `.env` file is chmod 600 + gitignored. To rotate `JWT_SECRET` or add another runtime env var, edit `.env` and `pm2 restart cortexbuild-unified-api --update-env`. Don't add the secret to the committed `ecosystem.config.cjs`.

## When adding a tRPC router

`packages/server/src/routers/index.ts` declares **40 standalone sub-routers** (`authRouter`, `projectRouter`, …) AND the top-level `appRouter` at the end. Until `e556c6e`, `appRouter` was a misnamed `mapRouter` containing one procedure; the other 39 routers were dead exports. The repo's first-ever green CI shipped with a non-functional API surface. To add a router:

1. Declare it: `export const fooRouter = router({ ... })`.
2. **Wire it into `appRouter`** at the end of the same file: `foo: fooRouter`.
3. Use `protectedProcedure` (or `companyScopedProcedure` / `adminProcedure`) by default. `publicProcedure` is only correct for auth-bootstrap (login/register/reset) or operationally-required public paths — and those need explicit in-body defense (allow-list, rate limit, token, return-null-on-unauth).

## Parked work — `wip/web-mobile-scaffold`

Contains `packages/web` and `packages/mobile` with all repair work (App.tsx HTML-entity decode, tsconfig `jsx: react-jsx`, tRPC v11 transformer fix, vite-env.d.ts, ESLint flat config). The branch is **7 commits behind main on security fixes** as of `b13f730`; before reviving, rebase onto main or merge main into it. Conflicts likely in `package.json`, `pnpm-workspace.yaml`, `.github/workflows/cicd.yml`, and the server router file.

## Known structural debt (not blocking)

- `server.mjs` exposes `/api/users`, `/api/companies`, `/api/dashboard/stats` etc. **with zero authentication**. Bound to loopback is the current mitigation; if it ever needs external reach, put nginx with auth in front, do NOT just rebind to `0.0.0.0`.
- `register` mutation returns `{ token: "", user }` — empty token; callers can't tell success from failure.
- Auth router throws generic `Error` instead of `TRPCError` (surfaces as 500 to clients).
- ~14 `as any` casts in `packages/server/src/routers/index.ts` on Drizzle inserts/updates — paper over `$inferInsert` not matching `passthrough()` Zod shapes. Type-debt cleanup territory.

## Workspace context

This repo lives under `/root/cortexbuild-unified/` on a multi-project box. The parent `/root/CLAUDE.md` documents the workspace layout (other subprojects, PM2 services, nginx vhosts, backup pipeline). Read that first when working across repos.
