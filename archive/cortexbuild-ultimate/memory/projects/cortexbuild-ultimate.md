# CortexBuild Ultimate

## Elevator pitch

AI-Powered Unified Construction Management Platform for UK contractors. Enterprise multi-tenant SaaS combining 50+ modules with an 8-agent AI system.

## Version / status

- **v3.0.0** — health score reported at 100/100 (as of 2026-04-03)
- Production healthy: www.cortexbuildpro.com 200 OK, API `/api/health` 200 OK
- Last known commit: `b659461` — "fix(deploy): rebuild api image and align uploads mount"

## Stack (short)

React 19 + TS + Vite · Express + raw SQL + `pg` · PostgreSQL + `pg_vector` · Zustand · WebSocket · Ollama (local) · Docker on Hostinger VPS

## Schema scale

4,500+ lines · 85+ models · 55+ enums · 100+ indexes · full audit trail

## v3.0.0 feature set

NotificationCenter, NotificationPreferences, TeamChat, ActivityFeed, AdvancedAnalytics, ProjectCalendar. Plus WCAG 2.1 AA (95/100), 121+ tests, Zod validation.

## Module coverage

Project Management · Financial Reporting · RAMS · Safety · Teams · AI Assistant · BIM Viewer · CRM · + 50 more (all lazy-loaded in `src/App.tsx`)

## AI agents (8)

Specialized streaming agents with subagents for RFI analysis, Change Orders, etc. Architecture in `.agents/README.md`.

## Architecture essentials

- **Generic CRUD factory**: `server/routes/generic.js` — `makeRouter(tableName)` with column whitelist, audit, WS broadcast
- **Specialized routes**: `auth.js`, `oauth.js`, `ai.js` (Ollama streaming), `rag.js` (vector search), `bim-models.js` (IFC upload + clash detection)
- **Multi-tenancy**: org/company filters in every SQL
- **RBAC roles**: super_admin, company_owner, admin, project_manager, field_worker

## Deployment topology

- **VPS**: `root@72.62.132.43` — canonical production
- **Containers**: cortexbuild-{api, db, redis, nginx, ollama, prometheus, grafana}
- **Frontend deploy**: `./deploy/sync-code.sh` (rsync dist/)
- **API deploy**: `deploy/vps-sync.sh` (rebuild + up -d)
- **Uploads bind mount**: `/var/www/cortexbuild-ultimate/server/uploads → /app/uploads`

## Known dev environment

Node v24, npm 11.9, Python 3.9, Docker 28.5, Git 2.50

## Open work (from PLATFORM_SPEC.md — Phase 1 & deferred)

**Phase 1 (active)**

- Settings persistence (company, users endpoints)
- Teams sub-tabs UI (Skills / Inductions / Availability)
- Zod request validation on critical endpoints
- Error message sanitization in generic routes
- Progressive account lockout

**Deferred**

- MFA (TOTP), workflow automation engine, Stripe billing
- Procore / QuickBooks / Slack integrations wiring
- Drawing revision tracking (drawing_revisions table)
- Offline-first PWA for field apps
- Timeline/cost prediction ML models
- Document OCR pipeline, image defect detection
- API gateway with key management

## Recent notable session (2026-04-04)

Repo sync + Docker deploy repair. Found deploy drift on VPS; canonical repo was missing compose `build:`; VPS had wrong uploads mount. Landed fix in `b659461` — added `build: Dockerfile.api`, corrected uploads mount, forced `--build` in `vps-sync.sh`.

## Key files

- `src/App.tsx` — main router, 50+ lazy modules
- `src/hooks/useData.ts` — `makeHooks` CRUD hook factory
- `server/routes/generic.js` — CRUD factory + column whitelist
- `server/db.js` — PG pool
- `server/index.js` — Express entry + route registration
- `BIM_ARCHITECTURE.md` — 3D rendering + coordinate systems spec
- `docs/PLATFORM_SPEC.md` — canonical feature/roadmap doc
- `docs/superpowers/plans/` — step-by-step execution plans
