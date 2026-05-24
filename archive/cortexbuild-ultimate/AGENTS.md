# AGENTS.md

Guide for AI coding agents working on CortexBuild Ultimate.

## Quick Reference

- **Stack**: React 19 + TypeScript + Vite (frontend) | Express 4 + PostgreSQL 16 + Redis 7 (backend)
- **Import alias**: `@` → `src/` in frontend code
- **State**: React Context (Auth, Theme) + TanStack Query via `useData.ts` hooks. Zustand is a dependency but NOT used.
- **DB**: Raw SQL migrations in `server/migrations/`, NOT Prisma. The `prisma/` directory is reference only.
- **Auth**: JWT in localStorage (`cortexbuild_token` key). Use `getToken()` from `src/lib/auth-storage.ts` — NOT direct localStorage access.

## Critical Rules

1. **`db.js` exports pool directly**: `const pool = require('./db')` — destructuring `const { pool }` yields `undefined`
2. **Server `.env` loads from `server/` subdirectory** (i.e. `require('dotenv').config({ path: join(__dirname, '.env') })`), not project root. When adding new server routes in subdirectories (e.g. `server/routes/reports/`), use `../../db` and `../../middleware/auth`.
3. **`organization_id = NULL`** for `company_owner` users — always handle NULL explicitly with `COALESCE(organization_id, company_id)`
4. **Never `docker-compose up`** on the VPS — it's broken. Use `docker start <name>` or deploy scripts.
5. **Never edit `/var/www/cortexbuild-ultimate/`** directly — use deploy scripts on the VPS at `/root/`.
6. **Tables without `updated_at`**: projects, invoices, rfis, tenders, companies, cost_forecasts — don't add `updated_at = NOW()` in UPDATE queries.
7. **Invoice statuses**: `draft`, `sent`, `paid`, `overdue`, `disputed` — NOT `pending` or `unpaid`.

## API Layer

Two competing API modules with different behaviors:

- **`src/services/api.ts`** (`apiFetch`): Auto-converts snake_case → camelCase, throws on HTTP errors, `fetchAll()` unwraps `{ data, pagination }`. Use this for new code.
- **`src/lib/api.ts`** (`apiRequest`): Returns `{ ok, status, data, error }`, no key conversion, throws only on network errors. Used by notification center only.

Generic CRUD routes return `{ data: Row[], pagination }`. Custom routes return their own shapes.

## AI Agents

8 specialized agents in `server/lib/agents/`:

- `construction-domain-agent.js` — building codes, BS, Eurocode, structural, materials
- `safety-compliance-agent.js` — OSHA/HSE, hazard analysis, PPE, incident investigation
- `cost-estimation-agent.js` — unit costs, labour rates, equipment rates, budgeting
- `project-coordinator-agent.js` — scheduling, critical path, resource allocation, milestones
- `contracts-agent.js` — JCT/NEC contracts, payment terms, bonds, warranties, liquidated damages
- `defects-agent.js` — punch lists, NCR, quality control, snagging, practical completion
- `valuations-agent.js` — interim certificates, PC sums, cash flow forecasting, payment notices
- `team-management-agent.js` — CSCS/CPCS/SSSTS/SMSTS, IR35, workforce allocation

Routing: `server/routes/ai-intents/ai-intent-classifier.js` → `server/routes/ai.js` switch → `agenticQuery()` in `server/lib/unified-ai-client-v2.js`.

SSE streaming: `POST /api/ai/chat/stream` — real token streaming via Ollama/OpenRouter.

Agent status: `GET /api/ai/agent-status`.

## PDF Reports (server-side)

Server-side jsPDF generation in `server/routes/reports/`:

- `invoice.js` → `POST /api/reports/invoice/:id/pdf`
- `rfi.js` → `POST /api/reports/rfi/:id/pdf`
- `daily-report.js` → `POST /api/reports/daily-report/:id/pdf`
- `safety-incident.js` → `POST /api/reports/safety-incident/:id/pdf`
- `project.js` → `POST /api/reports/project/:id/summary/pdf`

Frontend: `src/components/ui/ReportExportButton.tsx`, `ReportExportDropdown.tsx`, `ReportPreviewModal.tsx`.

## Notification Infrastructure

Push + Email + Slack in `server/routes/notifications/`:

- `email-notifications.js` — SendGrid (logs in dev if no API key)
- `slack.js` — webhook per org (connect, test, broadcast)
- `preferences.js` — user settings (email_on, push_on, slack_on, types)

Frontend: `src/hooks/usePushNotifications.ts` — Web Push API subscription management.

New tables: `push_subscriptions`, `notification_preferences`, `slack_integrations` (migration 065).

## Auth Hardening (migration 066)

- **2FA/TOTP**: `POST /api/auth/2fa/setup|verify|disable|validate` — otplib + qrcode
- **Invite links**: `POST/GET /api/auth/invite/:token`, accept, list, cancel — 7-day expiry
- **Session management**: `GET/DELETE /api/auth/sessions` — list/revoke per device
- **Password policy**: min 8 chars, upper+lower+number+special
- **Login throttling**: 5 fails/15min → 15min lockout via Redis

New tables: `users_totp`, `invitations`, `user_sessions`.

## Backend Patterns

- **Generic CRUD**: `makeRouter(tableName)` in `server/routes/generic.js` — add columns to `ALLOWED_COLUMNS`, register in `server/index.js`
- **Route order matters**: Register specific paths (`/tenders/ai`) before wildcards (`/tenders`) in `server/index.js`
- **WebSocket**: Authenticated on `/ws?token=JWT`. Rooms: `user:${userId}`, `project:${projectId}`. `broadcastDashboardUpdate` only fires for 7 whitelisted tables.
- **Migrations**: Forward-only numbered SQL in `server/migrations/`. Apply: `bash server/scripts/run-migrations.sh` on VPS, or `npm run db:migrate` locally.
- **Auth middleware**: `authMiddleware` for any authenticated user, `checkPermission(module, action)` for role-based access
- **Roles**: `super_admin`, `company_owner`, `admin`, `project_manager`, `field_worker`, `client`

## Frontend Patterns

- **Entry**: `src/main.tsx` → `src/App.tsx` (69 lazy-loaded modules, switch-based routing)
- **Design system**: `src/components/daisyui/` — DaisyUI primitives with barrel `index.ts`
- **Validations**: `src/lib/validations.ts` — Zod schemas for RFI, change orders, daily reports, safety reports, notifications
- **PWA**: `src/hooks/usePWA.ts` registers service worker; `public/sw.js` handles offline
- **Module pattern**: Each module in `src/components/modules/` uses `useData.ts` hook factory for CRUD

## Commands

```bash
# Frontend
npm run dev              # Dev server :5173 (proxies /api → :3001)
npm run build            # tsc -b && vite build → dist/
npm run check            # typecheck + lint + test (all must pass)
npm test                 # Vitest (happy-dom, 23 test files, 198 tests)
npx vitest run src/test/X.test.ts  # Single test file

# Frontend verification
npm run verify:routes   # Verify all server route files load (node --check)
npm run verify:all       # verify:routes && check (full pre-commit pass)

# Backend (in server/)
npm run dev              # nodemon on :3001
npm start                # Production (runs db init script + index.js)

# Local DB
npm run db:migrate       # Run migrations (calls run-migrations.sh)
npm run db:reset:local   # Reset local database

# Deploy (on VPS at /root/)
bash /root/deploy-api.sh        # Docker rebuild + health check
bash /root/deploy-frontend.sh  # npm ci + build + chown

# Database on VPS
docker exec cortexbuild-db psql -U cortexbuild -d cortexbuild -c "\dt"   # List tables
bash /root/cortexbuild-ultimate/server/scripts/run-migrations.sh       # Apply migrations
```

## Testing

- **Unit**: Vitest with `happy-dom`. Setup: `src/test/setup.ts`. Globals enabled (no imports for `describe/it/expect`).
- **Mock patterns**: Always mock `useData` hooks and `sonner` toast. `vi.mock()` must be at module top level, NOT inside `beforeEach()`.
- **ESLint**: Flat config (`eslint.config.js`), only checks `src/` — server has no linter.
- **Commit**: Conventional Commits enforced via Husky `commit-msg` hook. Format: `type(scope): description`.

## Debugging

```bash
# API health
curl -s http://127.0.0.1:3001/api/health

# Container status on VPS
docker ps --format "table {{.Names}}\t{{.Status}}" | grep cortexbuild

# API logs on VPS
docker logs cortexbuild-api --tail 50

# Redis on VPS
docker exec cortexbuild-redis redis-cli ping

# Type check
npx tsc --noEmit

# Route verification (all 51 route files)
npm run verify:routes
```
