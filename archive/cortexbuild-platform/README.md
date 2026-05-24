# 🏗️ CortexBuild Platform v2.0.0

**Unified Construction Management Platform** — all your construction tools, merged into one monorepo.

[🌐 Live](https://cortexbuildpro.com) | [📖 Docs](https://github.com/adrianstanca1/cortexbuild-platform/wiki) | [🐛 Issues](https://github.com/adrianstanca1/cortexbuild-platform/issues)

---

## 🎯 What Is This?

This repository consolidates **all 6 CortexBuild projects** into a single unified platform with a shared database, shared types, and one unified codebase.

| Before | After |
|--------|-------|
| BuildTrack (Expo mobile) | → `apps/web` + `apps/mobile` (future) |
| BuildTrack-iOS (SwiftUI) | → Consolidated into iOS feature set |
| cortexbuild-field (Expo field app) | → Field module in unified API |
| cortexbuild-ultimate (Express + Vite) | → Core API + Web dashboard |
| cortexbuild-web (WhatsApp agent) | → WhatsApp module in unified API |
| cortexbuildpro (Expo SaaS app) | → Subscription/tenant layer |

---

## 🏗️ Architecture

```
cortexbuild-platform/
├── packages/
│   ├── shared/          # Types, constants, AI configs, permissions, validations
│   ├── db/              # Drizzle ORM → PostgreSQL (79 unified tables)
│   └── api/             # Express.js unified API (auth, CRUD, WebSocket, AI)
├── apps/
│   └── web/             # Next.js 15 + Tailwind + shadcn/ui (future: mobile/)
├── docker-compose.yml   # Postgres 16, Redis 7, MinIO, nginx
├── turbo.json           # Monorepo task orchestration
└── pnpm-workspace.yaml  # Workspace config
```

---

## 🗄️ Schema Map

| Module | Tables |
|--------|--------|
| **Auth** | `users`, `companies`, `company_members`, `sessions`, `invitations`, `push_tokens`, `push_subscriptions` |
| **Projects** | `projects`, `project_images`, `project_workers`, `tasks`, `cost_codes` |
| **Safety** | `safety_incidents`, `inspections`, `defects`, `permits` |
| **People** | `workers`, `team_members`, `timesheets`, `daily_reports` |
| **Finance** | `invoices`, `rfis` |
| **Documents** | `documents`, `drawings`, `drawing_pins`, `rag_embeddings` |
| **Equipment** | `equipment`, `bim_models`, `carbon_estimates` |
| **Communication** | `chat_channels`, `chat_messages`, `chat_channel_members`, `notifications`, `notification_preferences`, `whatsapp_contacts`, `whatsapp_messages` |
| **AI** | `ai_conversations`, `ai_messages` |
| **System** | `activity_log`, `sessions`, `webhooks`, `subscriptions`, `settings`, `autoimprove_schedules` |

---

## 🚀 Quick Start

```bash
# Clone
git clone https://github.com/adrianstanca1/cortexbuild-platform.git
cd cortexbuild-platform

# Install (pnpm 9+)
pnpm install

# Set up env
cp .env .env.local
# Edit DATABASE_URL, JWT_SECRET, etc.

# Start everything
docker-compose up -d

# Run migrations
pnpm db:migrate

# Dev mode
pnpm dev        # API (:3001) + Web (:3000)
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 15 + React 19 + Tailwind CSS + shadcn/ui |
| **Mobile** | Expo SDK 54 + React Native + NativeWind *(planned)* |
| **API** | Express.js 4 + tRPC 11 + Zod |
| **ORM** | Drizzle ORM 0.45 |
| **Database** | PostgreSQL 16 + Redis 7 |
| **Auth** | JWT + bcryptjs + TOTP + session management |
| **AI** | 11 specialised agents (GPT-4o, Claude, Gemini, Ollama) + SSE streaming |
| **Storage** | MinIO (S3-compatible) |
| **Dev** | pnpm workspaces + Turbo + TypeScript 5.5 |
| **Deploy** | Docker Compose + nginx + PM2 |

---

## 🔌 API Endpoints

| Module | Base Path |
|--------|-----------|
| Auth | `POST /api/auth/{login,register,refresh,me,change-password}` |
| Projects | `GET|POST|PUT|DELETE /api/projects` |
| Tasks | `GET|POST|PUT|DELETE /api/tasks` |
| Safety | `GET|POST|PUT|DELETE /api/safety` |
| Inspections | `GET|POST|PUT|DELETE /api/inspections` |
| Defects | `GET|POST|PUT|DELETE /api/defects` |
| Workers | `GET|POST|PUT|DELETE /api/workers` |
| Timesheets | `GET|POST|PUT|DELETE /api/timesheets` |
| RFI | `GET|POST|PUT|DELETE /api/rfi` |
| Invoices | `GET|POST|PUT|DELETE /api/invoices` |
| Daily Reports | `GET|POST|PUT|DELETE /api/daily-reports` |
| Drawings | `GET|POST|PUT|DELETE /api/drawings` |
| Documents | `GET|POST|PUT|DELETE /api/documents` |
| Equipment | `GET|POST|PUT|DELETE /api/equipment` |
| Chat | `GET|POST|PUT|DELETE /api/chat` |
| AI | `POST /api/ai/chat/stream`, `GET /api/ai/agent-status` |
| BIM | `GET|POST|PUT|DELETE /api/bim` |
| Carbon | `GET|POST|PUT|DELETE /api/carbon` |
| WhatsApp | `GET|POST /api/whatsapp/webhook`, `GET /api/whatsapp/contacts` |
| Webhooks | `GET|POST|PUT|DELETE /api/webhooks` |
| Notifications | `GET|PUT /api/notifications` |
| Reports | `POST /api/reports/{invoice,rfi,daily-report,safety-incident,project}/pdf` |
| Admin | `GET /api/admin/users`, `GET /api/admin/stats` |
| Analytics | `GET /api/analytics/{dashboard,activity}` |
| WebSocket | `ws://host/ws?token=JWT` |

---

## 🤖 AI Agents (11)

- 🏗️ **Construction Domain** — building codes, materials, structural
- 🛡️ **Safety Compliance** — OSHA/HSE, hazard analysis
- 💰 **Cost Estimation** — unit costs, labour rates, budgeting
- 📋 **Project Coordinator** — scheduling, critical path
- ⚖️ **Contracts Lawyer** — JCT/NEC, payment terms
- ✅ **Quality Control** — punch lists, NCR
- 📊 **Valuations** — interim certificates, cash flow
- 👷 **Team Management** — CSCS, SSSTS, workforce allocation
- 🌱 **Carbon Advisor** — embodied carbon, EPD
- 🏢 **BIM Specialist** — clash detection, 4D
- 💬 **WhatsApp Site Agent** — conversational field logging

---

## 📁 Consolidated Projects

| Legacy Project | Source | Merged Into |
|----------------|--------|-------------|
| `BuildTrack` | `/root/BuildTrack` | Apps/Web mobile-first, Supabase → unified DB |
| `BuildTrack-iOS` | `/root/BuildTrack-iOS` | Feature set in apps/mobile (planned) |
| `cortexbuild-field` | `/root/cortexbuild-field` | Field module, tRPC routes, Drizzle schema |
| `cortexbuild-ultimate` | `/root/cortexbuild-ultimate` | Core API, AI agents, PDF reports, notifications |
| `cortexbuild-web` | `/root/cortexbuild-web` | WhatsApp module, MySQL schema → PostgreSQL |
| `cortexbuildpro` | `/root/cortexbuildpro` | Tenant/subscription layer, Expo mobile |

---

## 📄 License

MIT — CortexBuild Ltd.

Built with ❤️ by StancaInvest
