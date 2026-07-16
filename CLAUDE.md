# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Cortexx ("CortexBuild Pro") is a UK SMB construction-management app deployed live at **cortexbuildpro.com** (DNS points at this VPS). The repo holds two coexisting frontend stacks, an Express/Postgres backend, and an iOS (Capacitor) shell — read the architecture section before editing, because several conventions are non-obvious and have caused prod outages.

## Commands

```bash
npm run dev                 # Next.js dev server (app/)
npm run build               # next build && npm run precompile (also rebuilds dist/)
npm run start               # next start
npm run lint                # eslint . --max-warnings 100
npm test                    # node --test test/*.test.js  (the canonical test suite)
npm run test:integration    # tsx --test test/integration/*.test.js
npx tsx --test test/foo.test.js   # run a single test file
npm run quality             # audit:app + lint + tsc --noEmit + test  (run before shipping)
npm run precompile          # node build-dist.js  — rebuild dist/ from lib/
npm run precompile:check    # node build-dist.js --check  — byte-verify dist vs lib, exit 1 on drift
npm run db:generate         # prisma generate
npm run db:migrate          # prisma migrate deploy
npm run db:push             # prisma db push
npm run db:seed             # ts-node prisma/seed.ts
npm run e2e                 # Playwright (run e2e:install first)
npm run vault:decrypt       # ./scripts/decrypt-env.sh — decrypt .env.vault to .env
docker compose up -d        # bring up db + api + ollama + web (Caddy) on the VPS
```

Node >=22, npm >=10. `postinstall` runs `precompile` silently, so `npm install` rebuilds `dist/` automatically.

## Architecture

**Two frontend stacks share this repo — know which one you're touching:**

1. **The production SPA** (what cortexbuildpro.com actually serves). Entry is `Cortexx.html`, a smart loader: default loads precompiled `.js` from `dist/`; `?dev=1` loads `.jsx` from `lib/` and transforms in-browser via Babel; `?perf=1` shows the perf HUD. `lib/` holds ~148 JSX/JS modules (`app-main.jsx`, `app-screens*.jsx`, `dashboards-v*.jsx`, `backend.js`, `tokens.jsx`, …). IndexedDB stores photos; localStorage backs the reactive store (`Backend.db.*` collections). PWA via `sw.js` + `manifest.json`.

2. **The newer Next.js 16 app** (`app/`, `components/`, `prisma/`) using React 19, next-auth v5, Prisma 7, Tailwind v4. App-router under `app/` with route groups like `(auth)` and ~60 feature dirs that mirror the SPA's screens. This stack uses **Prisma** (`prisma/schema.prisma`).

**Backend (`server/`):** Express + PostgreSQL. `server/index.js` is the single entry; route modules live in `server/routes/` (banking, hmrc, iap, llm, payments, push, sync, portal, ledger, intelligence, agents). Multi-tenant via `workspace_id`. Auth is JWT (Bearer) + magic-link; realtime is Server-Sent Events per workspace (`channels` map in `index.js`). An Ollama service provides LLM inference with no external API keys. Note the backend uses a **raw SQL schema** (`server/db/schema.sql`, applied at volume init via docker-compose) — Prisma's `schema.prisma` is a *parallel model* for the Next.js stack, not the source of truth for the Express API.

**iOS:** Capacitor 8 at the repo root, scaffold in `ios/`. `ios:sync` → `cap copy && cap sync ios`. Canonical bundle id is `com.cortexbuild.app` (see `ios/capacitor.config.ts`). Several App-Store-blockers remain that require a Mac + Apple portal (provisioning profile, universal-links AASA, StoreKit IAP plugin) — see the project memory; they cannot be resolved from this Linux VPS.

## Build tooling — `lib/` → `dist/`

There is exactly ONE builder: `build-dist.js`. `npm run precompile` calls it, and `precompile` is what both `postinstall` and `npm run build` invoke, so every path produces identical output and `precompile:check` can never disagree with a real build.

- `lib/*.jsx` → Babel (classic runtime, comments stripped) → `dist/*.js`
- `lib/*.js` → copied verbatim → `dist/*.js` (already browser-ready)
- `lib/*.ts` and anything else → **NOT emitted**. Those are server-only modules; shipping them into `dist/` would publish server source on the live site. This is enforced deliberately.
- `dist/` is pruned: any orphan with no matching `lib/` source is deleted.

`lib/` contains both a `push.js` (SPA client) and `push.ts` (server) — only `.js`/`.jsx` ship to `dist/`. **After editing any `lib/*.js|jsx`, run `node build-dist.js` and commit the updated `dist/`** — otherwise prod serves stale code. `precompile:check` is the reliable drift detector (the old hash-cache version missed real drift).

## Deployment

`docker-compose.yml` brings up `db` (Postgres 16), `api` (Express), `ollama`, and `web` (Caddy static host + reverse proxy). Caddy serves `Cortexx.html` + `lib/` + `dist/` statically and proxies `/api/*` to `api:3001`; config in `Caddyfile`.

**Traefik owns host ports 80/443** (host-network, at `/docker/traefik`, docker provider, `letsencrypt` resolver, `websecure` entrypoint). The `web` Caddy service must join traefik via the docker-provider labels already in compose (`traefik.http.routers.cortexx…`, service port 80) — it must **not** publish 80/443 itself. Publishing those ports is why an earlier nginx setup 404'd.

## Secrets

Secrets live in the age-encrypted `.env.vault` (tracked in repo). Decrypt with `npm run vault:decrypt` (→ `./scripts/decrypt-env.sh`); the age key lives at `~/.config/cortexx/age.key` (gitignored). Vault holds `DATABASE_URL`, `NEXTAUTH_*`, `VAPID_*`, `POSTGRES_PASSWORD`, Stripe, GitHub token. Decrypt writes the gitignored root `.env`, which docker compose auto-loads for `${VAR}` substitution. `.env.production` is gitignored — never commit real secrets.

## Non-obvious gotchas (each has caused a real prod incident)

- **`/api/health` must be registered above the auth-protected `/api/:collection` route.** If a catch-all auth route shadows it, the healthcheck returns 401, the container is marked unhealthy, and deploy never converges.
- **Integration routers (`server/routes/{banking,hmrc,iap,llm,payments,push}.js`) must be mounted behind `integrationAuth`, not raw.** They export a plain `express.Router()` and were once mounted unauthenticated. The public allowlist (`INTEGRATION_PUBLIC` in `index.js`) is exactly: `GET /banking/callback` (TrueLayer OAuth redirect), `POST /iap/webhook` (Stripe — signature-verified internally), `GET /push/vapid` (public key). Everything else needs a Bearer token.
- **Stripe webhook needs the raw body.** `express.raw({type:'*/*'})` is registered on `/api/iap/webhook` *before* the global `express.json()` parser — don't reorder.
- **Postgres auth is `scram-sha-256` on the docker network (hardened 2026-07-14).** The compose db `environment` sets `POSTGRES_PASSWORD` (from the vault via root `.env`) + `POSTGRES_HOST_AUTH_METHOD: scram-sha-256` for fresh volume inits. The *existing* `cortexx_pgdata` volume predates that env (which only applies on fresh init), so it was hardened **live**: `ALTER USER postgres PASSWORD …`, then the `pg_hba.conf` line `host all all 172.16.0.0/12 trust` was changed to `scram-sha-256` + `SELECT pg_reload_conf()` (both persist in the volume). The api's `DATABASE_URL` now carries the password. `local` + `127.0.0.1` pg_hba lines stay `trust` so the in-container healthcheck (`pg_isready` via socket) and admin `psql` still work passwordless. To rotate: change the password in the vault, `vault:decrypt`, `ALTER USER postgres PASSWORD`, recreate the api. 5432 is `expose`-only — not internet-published.
- **Caddy edits require a container recreate, not just a reload.** The `Caddyfile` is a *file* bind mount (`./Caddyfile:/etc/caddy/Caddyfile:ro`); editors save via atomic rename, which changes the inode, so the container keeps the old inode and `caddy reload` reports "config is unchanged". After editing `Caddyfile`, run `docker compose up -d --no-deps --force-recreate web` (or `docker cp` the file in then reload). The deny rules must live inside their own `handle @blocked { respond 404 }` block placed *before* the catch-all `handle` — a top-level `respond @blocked 404` gets reordered after the catch-all by Caddy's default directive order and never matches.
- **Caddy must not cache `/lib/*` and `/dist/*` (or `/sw.js`) as immutable.** App code there isn't content-hashed; pinning it would keep returning browsers on old (including security-fixed) code for up to a year. The `Caddyfile` sets `no-cache, must-revalidate` for those paths + `/sw.js` and reserves `immutable` for genuinely static hashed assets only.
- **Server `.ts` modules never ship to `dist/`.** A previous `babel lib --out-dir dist --copy-files` step published 35 server-only `.ts` files (db/auth/rbac/redis/tenancy) live at `cortexbuildpro.com/dist/*.ts` — a source disclosure. Don't reintroduce `--copy-files`.
- **Never mount the repo root into the web container.** Earlier `./:/srv/app:ro` + Caddy's catch-all `file_server` exposed `.env`, `.env.vault`, `.git/`, `server/*`, `*.ts` over HTTPS. The compose `web` service now bind-mounts only the served assets (dist, lib, public, the HTML files, manifest, sw.js, icons), and the `Caddyfile` denies the rest. If you add a new served asset, add its bind mount to compose too.

## CI

`.github/workflows/` runs `ci.yml` (lint/type/test on PR), plus `deploy-vps.yml`, `release-ios.yml`, `backup-verify.yml`, and several VPS/db debug workflows. Dependabot config is present (`.github/dependabot.yml`).