# CortexBuild Ultimate — 4-Week Audit & Fix Roadmap

**Generated:** 2026-05-12  
**Repo:** `/root/cortexbuild-ultimate` | **Commits:** 577 | **Size:** 963MB  
**Stack:** Vite + React 19 + Tailwind 4 (frontend) | Express 5 + PostgreSQL + Redis (backend)  
**Last commit:** `40e0037` feat(ultimate): register project_phases generic route and migration  
**Git status:** Clean ✅

---

## Executive Summary

The project is in **better shape than expected**:  
- 256/256 tests passing ✅  
- 0 npm audit vulnerabilities ✅  
- 0 TypeScript errors ✅  
- `.env` is chmod 600 and untracked ✅  
- Husky pre-commit hooks active ✅

The **real debt** is architectural: the server is a 26KB CommonJS monolith with no CI build step, no API tests, and a major Zod version mismatch with the frontend.

---

## Top 5 Issues / Technical Debt

| # | Issue | Severity | Impact |
|---|-------|----------|--------|
| 1 | **Server is raw CommonJS, not built in CI** | 🔴 High | 26KB `index.js` monolith; no type safety; deploy workflow only builds frontend. Manual server restarts required. |
| 2 | **Zod v4 (root) vs Zod v3 (server) mismatch** | 🔴 High | Shared schemas between frontend/backend will throw runtime errors if swapped. |
| 3 | **No server API / integration tests** | 🟡 Medium | `server/test/` exists but root `npm test` only runs frontend Vitest. Backend changes are untested in CI. |
| 4 | **Deploy workflow does not restart server** | 🟡 Medium | `deploy.yml` builds frontend artifact; server code updates need manual PM2 restart on VPS. |
| 5 | **Server swallows `unhandledRejection` without exit** | 🟡 Medium | `process.on('unhandledRejection', ...)` logs but never exits. Memory leaks and corrupted state can persist silently. |

### Additional Findings

- **33 `console.log/warn/error` calls** in `server/index.js` — no structured logger (pino/winston).
- **15 TODO/FIXME/HACK/XXX** markers across `src/` and `server/`.
- **No Dockerfile** despite `.dockerignore` present. Not containerised.
- **`cd.yml.disabled`** — a disabled CI workflow left in repo.
- **Server build script = `node --check index.js`** — minimal validation only.
- **Redis client instantiated inline** in `index.js` with no connection pooling or health checks.
- **Outdated dependencies** (~20 patch/minor bumps available; ESLint v9→v10, Playwright 1.59→1.60, Capacitor 8.3.1→8.3.3).

---

## 4-Week Roadmap

### Week 1 — Stabilise & Secure

| Day | Task | Owner | Acceptance |
|-----|------|-------|------------|
| 1 | Add `server:build` step to `deploy.yml` (builds server bundle, copies to VPS, PM2 reload) | DevOps | Deploy restarts server automatically |
| 2 | Fix `unhandledRejection` handler: log + `process.exit(1)` after grace period (or use `terminate` lib) | Backend | `server/index.js` exits on unhandled rejection |
| 3 | Replace inline `console.log` with structured logger (`pino` or `winston`) + redact secrets | Backend | No raw `console.*` in server entry; logs JSON |
| 4 | Add healthcheck endpoint (`/health`) with DB + Redis readiness | Backend | `curl /health` returns 200/503 |
| 5 | Align Zod versions: bump server to `^4.4.3` (same as root) or lock root to `^3.24.0` | Backend | One Zod version; shared schemas compile |

### Week 2 — Test & Refactor

| Day | Task | Owner | Acceptance |
|-----|------|-------|------------|
| 6–7 | Split `server/index.js` into modular routes/middleware files (≤200 lines each) | Backend | `index.js` < 500 lines; routes in `routes/`, middleware in `middleware/` |
| 8 | Add server Vitest integration tests for auth, health, and core API routes | QA / Backend | `npm run test:server` passes in CI |
| 9 | Wire server tests into `cortexbuildpro-ci.yml` so they block merges | DevOps | CI fails on server test failure |
| 10 | Add `npm audit` step to CI (fail on high/critical) | DevOps | CI blocks PR with new vulnerabilities |

### Week 3 — Containerise & Modernise

| Day | Task | Owner | Acceptance |
|-----|------|-------|------------|
| 11–12 | Write `Dockerfile` for frontend (nginx) + `Dockerfile` for server (node:22-alpine) | DevOps | `docker build` succeeds for both |
| 13 | Write `docker-compose.yml` (app + postgres + redis + nginx) | DevOps | `docker compose up` spins full stack locally |
| 14 | Update `.env.example` and `server/.env.example` with all required keys | DevOps | New dev can `cp .env.example .env` and boot |
| 15 | Remove `cd.yml.disabled`; archive or delete dead scripts | Cleanup | No disabled files in `.github/workflows/` |

### Week 4 — Polish & Monitor

| Day | Task | Owner | Acceptance |
|-----|------|-------|------------|
| 16 | Bump patch/minor deps (Capacitor, Playwright, Tailwind, etc.) | Maintenance | `npm outdated` shows only majors left |
| 17 | Resolve 15 TODO/FIXME markers (or convert to GitHub issues) | Backend/Frontend | Zero `TODO`/`FIXME` in `src/` and `server/` |
| 18 | Add `dependabot.yml` auto-merge for patch updates | DevOps | Patch bumps auto-merge if CI passes |
| 19 | Document local dev flow in `README.md` (Docker + non-Docker) | Docs | New contributor can start in <10 min |
| 20 | Final regression: full CI run → deploy to staging → verify | QA | Staging smoke test passes |

---

## Quick Wins (Do This Week)

1. **`chmod 600 .env`** — already done ✅
2. **Add `npm run server:build && pm2 reload cortexbuild-server`** to `deploy.yml`**
3. **Add `process.exit(1)` inside `unhandledRejection` after a 5s grace period**
4. **Pin Zod to one version** across root + server `package.json`
5. **Run `npm update`** for patch/minor bumps (low risk, high value)

---

## Metrics to Track

| Metric | Baseline (today) | Week 4 Target |
|--------|------------------|---------------|
| Server `index.js` lines | ~450 (est.) | < 200 |
| Server test coverage | 0% | ≥ 40% |
| CI build time | ~5 min | < 7 min (with server tests) |
| `npm outdated` count | ~20 | ≤ 5 (majors only) |
| TODO/FIXME count | 15 | 0 |
| Deploy automation | Frontend only | Frontend + Server |

---

*End of roadmap.*
