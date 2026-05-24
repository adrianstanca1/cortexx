# CortexBuild Ultimate

**AI-Powered Unified Construction Management Platform** — Enterprise-grade construction SaaS for UK contractors

[![Platform Health](https://img.shields.io/badge/Platform%20Health-100%2F100-success)](docs/100_100_ACHIEVEMENT.md)
[![Tests](https://img.shields.io/badge/Tests-121%2F121%20passing-success)](docs/CODE_REVIEW_REPORT.md)
[![Version](https://img.shields.io/badge/Version-3.0.0-blue)](CHANGELOG.md)
[![Accessibility](https://img.shields.io/badge/Accessibility-WCAG%202.1%20AA-success)](docs/ACCESSIBILITY_AUDIT.md)
[![License](https://img.shields.io/badge/License-Proprietary-red)](LICENSE)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue)](Dockerfile.api)

## Build for iPhone / App Store

```bash
./scripts/prep-ios.sh       # one-shot prep
open ios/App/App.xcodeproj  # then build/run from Xcode
```

See [docs/INSTALL-ON-IPHONE.md](docs/INSTALL-ON-IPHONE.md) for the three install paths and [docs/APPSTORE-DEPLOY.md](docs/APPSTORE-DEPLOY.md) for the full TestFlight pipeline.

## Quick Start

```bash
# 1. Install dependencies
npm install
cd server && npm install && cd ..

# 2. Configure environment
cp .env.example .env.local
# Edit .env.local with DB_URL, JWT_SECRET, etc.

# 3. Start database (Docker)
docker compose up -d

# 4. Reset database
cd server && npm run db:reset:local && cd ..

# 5. Start backend
pm2 start server/index.js --name cortexbuild-api

# 6. Start frontend
npm run dev
```

**Frontend:** http://localhost:5173 | **Backend:** http://localhost:3001

## Tech Stack

| Layer      | Technology                                  |
| ---------- | ------------------------------------------- |
| Frontend   | React 19 + TypeScript + Vite + Tailwind CSS |
| Backend    | Express.js + PostgreSQL 16 + Redis 7        |
| Auth       | JWT + Passport (OAuth)                      |
| Real-time  | WebSocket                                   |
| Testing    | Vitest + Playwright                         |
| Deployment | Docker + VPS (Hostinger)                    |

## Quick Command Reference

### Development

```bash
npm run dev           # Frontend dev server (:5173)
cd server && npm run dev  # Backend dev server (:3001)
```

### Testing

```bash
npm test                  # All unit tests (Vitest)
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report
npm run test:e2e         # Playwright E2E
npm run test:e2e:ui       # E2E with UI
```

### Build & Deploy

```bash
npm run build        # Production build
npm run lint         # ESLint
npm run lint:fix     # ESLint auto-fix
npm run verify:all  # Full pre-commit check
```

### Backend

```bash
cd server
npm run db:reset:local   # Rebuild local DB
npm start                 # Production (node)
```

## Key Commands

```bash
npm run dev           # Frontend dev (5173)
npm test             # Unit tests (Vitest)
npm run build        # Production build
npm run lint         # ESLint
npm run verify:all   # Full pre-commit check
```

## v3.0.0 Highlights

| Feature                | Description                            |
| ---------------------- | -------------------------------------- |
| **NotificationCenter** | Real-time notifications with filtering |
| **TeamChat**           | Real-time team messaging               |
| **ActivityFeed**       | Live activity stream                   |
| **AdvancedAnalytics**  | Business intelligence dashboards       |
| **ProjectCalendar**    | Month/Week/Day scheduling              |

## Modules

### Core Management

- Dashboard, Projects, Invoicing, Accounting, Financial Reports

### Operations

- Safety, Teams, Timesheets, Subcontractors, Plant, Materials, Daily Reports

### Quality & Compliance

- RAMS, CIS, Inspections, Risk Register, Punch List, RFIs, Change Orders

### Collaboration

- Documents, Meetings, Drawings, Calendar, CRM

### Intelligence

- AI Assistant (8 agents), Analytics, Tenders, Executive Reports

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (:5173)                          │
│   React 19 + TypeScript + Vite + TanStack Query + WebSocket    │
└──────────────────────────────┬──────────────────────────────────┘
                               │ REST + WebSocket
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Backend (:3001)                              │
│              Express.js + Passport + WebSocket                   │
└──────────────────────────────┬──────────────────────────────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
          ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   PostgreSQL    │  │     Redis      │  │    Ollama      │
│   (Database)   │  │   (Sessions)   │  │  (AI Inference) │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

### API Layer

Two modules with different behaviors:

- **`src/services/api.ts`** - Auto camelCase, throws on errors (preferred)
- **`src/lib/api.ts`** - Raw responses, used by notification center

### Database

Raw SQL migrations in `server/migrations/`. Generic CRUD via `makeRouter(tableName)`.

**Critical:** `company_owner` users have `organization_id = NULL`. Always use `COALESCE(organization_id, company_id)`.

## Keyboard Shortcuts

| Shortcut   | Action           |
| ---------- | ---------------- |
| `Ctrl+1-4` | Navigate modules |
| `Ctrl+K`   | Global search    |
| `Ctrl+B`   | Toggle sidebar   |
| `Shift+?`  | Show shortcuts   |

## Documentation

| Document                                               | Purpose                    |
| ------------------------------------------------------ | -------------------------- |
| [docs/README.md](docs/README.md)                       | Full documentation index   |
| [docs/API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md) | API reference              |
| [DEPLOYMENT_RUNBOOK.md](DEPLOYMENT_RUNBOOK.md)         | Production deployment      |
| [CONTRIBUTING.md](CONTRIBUTING.md)                     | How to contribute          |
| [AGENTS.md](AGENTS.md)                                 | Guide for AI coding agents |
| [CLAUDE.md](CLAUDE.md)                                 | Claude Code instructions   |

## Security

- JWT authentication on all API routes
- RBAC with 6 roles
- Column whitelisting (SQL injection prevention)
- Rate limiting on sensitive endpoints
- XSS protection in email templates

## Troubleshooting

```bash
# API health
curl http://127.0.0.1:3001/api/health

# Container status
docker ps | grep cortexbuild

# Restart API (no rebuild)
docker restart cortexbuild-api

# Check logs
docker logs cortexbuild-api --tail 50
```
