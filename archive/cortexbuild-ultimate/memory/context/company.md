# Company / Team Context

## Product

**CortexBuild Ultimate** — Enterprise SaaS: AI-powered unified construction management for UK contractors. Multi-tenant, multi-module (50+), role-based. Domain = commercial, residential, industrial construction project management.

Public site: https://www.cortexbuildpro.com
Repo: `cortexbuild-ultimate` (canonical) ↔ `cortexbuild-ultimate-1` (staging copy)

## Team

Solo or near-solo build based on project docs. Adrian is the named developer. People file is blank — will populate as collaborators surface in messages/tickets/etc.

## Tools / stack

**Frontend**: React 19 + TypeScript + Vite; Tailwind + DaisyUI (migration in progress); Zustand state; WebSocket real-time; `web-ifc-three` for BIM viewer
**Backend**: Express.js on `:3001`; PostgreSQL via `pg` pool (raw SQL); `pg_vector` for RAG; JWT + Passport (Google/Microsoft OAuth); bcrypt
**AI**: Ollama (local) for inference; intent classifiers in `server/routes/ai-intents/`; 8 specialized AI agents in `.agents/`
**Testing**: Vitest (unit/integration, jsdom) + Playwright (E2E)
**Lint/Format**: ESLint + Prettier; Husky pre-commit hooks
**Infra**: Docker Compose — containers: `cortexbuild-api`, `cortexbuild-db`, `cortexbuild-redis`, `cortexbuild-nginx`, `cortexbuild-ollama`, `cortexbuild-prometheus`, `cortexbuild-grafana`
**Hosting**: Hostinger VPS at `72.62.132.43`; Vercel as secondary deploy target
**Observability**: Grafana dashboards, Prometheus alerts, Sentry error tracking, OpenTelemetry tracing

## Processes

- **Branch model**: `main` is the deployable branch; canonical repo is source of truth
- **Deploy**:
  - Frontend → `./deploy/sync-code.sh` (rsync `dist/` to VPS)
  - API → `deploy/vps-sync.sh` (rebuilds Docker API container with `docker-compose up -d --build`)
- **DB migrations**: Plain SQL files in `server/migrations/`, applied with `psql -f`
- **Pre-merge gates**: `npx tsc --noEmit` ✅, ESLint quiet ✅, `npm test` ✅, `npm run build` ✅
- **Superpowers pattern**: Multi-step plans with checkboxes in `docs/superpowers/plans/` — commits per step

## Integration roadmap (product-level)

**Pre-built**: Procore, BIM 360, PlanGrid, Fieldwire, QuickBooks, Xero, Slack, Microsoft Teams, Zapier
**Deferred**: Stripe billing, Procore/QuickBooks/Slack wiring, workflow automation engine

## Security posture

- SQL injection prevention via column whitelists in generic CRUD
- Path-traversal-safe file uploads (magic number validation)
- IDOR prevention via `organization_id` / `company_id` scoping everywhere
- Unauthorized resource access returns **404**, not 403 (anti-enumeration)
- Helmet, CORS, rate limiting

## Keyboard shortcuts (product)

Ctrl+1 Dashboard · Ctrl+2 Projects · Ctrl+3 Invoicing · Ctrl+4 Safety · Ctrl+K Search · Ctrl+B Sidebar · Shift+? Shortcuts
