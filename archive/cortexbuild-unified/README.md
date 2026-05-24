# CortexBuild Unified 🏗️

**One app to rule them all.** Unified construction-tech platform merging all 6 repositories into a single monorepo with a shared backend, web dashboard, and Expo mobile app.

| App | Merged Into | Status |
|-----|-------------|--------|
| BuildTrack (Expo) | 📱 `packages/mobile` + shared schema | ✅ Merged |
| BuildTrack-iOS (SwiftUI) | 📱 `packages/mobile` (Expo alternative) | ✅ Merged |
| cortexbuild-ultimate (Next.js + Express) | 🔗 `packages/server` + `packages/web` | ✅ Merged |
| cortexbuild-field (Next.js + tRPC) | 🔗 `packages/server/router/field/*` | ✅ Merged |
| cortexbuild-web (minimal HTML) | 🔗 `packages/web` (full rewrite) | ✅ Merged |
| cortexbuildpro (Expo SaaS) | 📱 `packages/mobile` + `packages/server` | ✅ Merged |

## 🏗️ Architecture

```
cortexbuild-unified/
├── packages/
│   ├── server/         # Unified Express + tRPC API (Node 22, Drizzle, Postgres)
│   ├── web/            # Vite + React + Tailwind admin dashboard
│   ├── mobile/         # Expo Router + NativeWind cross-platform app
│   └── shared/         # Zod schemas + types shared across all packages
├── schema.ts           # Single source of truth: 42 tables
├── FEATURE_MATRIX.md   # Migration traceability
└── deploy.sh           # One-command VPS deployment
```

## 🚀 Quick Start

```bash
# Clone
git clone https://github.com/adrianstanca1/cortexbuild-unified.git
cd cortexbuild-unified

# Install (uses pnpm workspaces)
pnpm install

# Start API + Web + Mobile (concurrently)
pnpm dev

# Or individually:
cd packages/server && pnpm dev      # API on :3001
cd packages/web && pnpm dev          # Web on :5173
cd packages/mobile && pnpm ios       # iOS Simulator
cd packages/mobile && pnpm android  # Android Emulator
```

## 📦 What's Merged

### BuildTrack Features → Mobile
- ✅ Project tracking, RFI routing, defect management
- ✅ Inspections with photo markup (camera + drawing)
- ✅ Punch list with NFC tap-to-check
- ✅ AI chat & Converge voice agent

### cortexbuild-ultimate Features → Server + Web
- ✅ Multi-company / multi-project scoping
- ✅ 100+ field entities (tasks, invoices, materials, equipment, etc.)
- ✅ Full CRM pipeline with stages, quotes, POs
- ✅ Budget management with cost forecasting
- ✅ Gantt chart + calendar + Kanban
- ✅ BIM viewer + 3D model integration
- ✅ AI assistant with real-time SSE streaming
- ✅ Email/SMS/WhatsApp integrations

### cortexbuild-field Features → Server + Mobile
- ✅ GPS check-ins with geofencing (`ST_DWithin`)
- ✅ Signature capture on timesheets
- ✅ Mobile-optimized field reports
- ✅ Worker location history on map

## 🛢 Unified Schema (42 tables)

**Users & Auth**: `users`, `companies`, `company_users`  
**Projects**: `projects`, `project_members`, `project_invites`  
**Field Ops**: `tasks`, `daily_reports`, `timesheets`, `check_ins`, `materials`, `equipment`  
**Quality**: `defects`, `inspections`, `punch_items`, `permits`  
**Documents**: `rfis`, `drawings`, `documents`, `files`, `submittals`, `change_orders`  
**Finance**: `invoices`, `purchase_orders`, `budgets`, `cost_forecasts`  
**Safety**: `incidents`, `risk_register`, `hazards`  
**Team**: `meetings`, `certifications`, `trainings`  
**AI**: `ai_conversations`, `ai_messages`  
**Platform**: `notifications`, `activity_feed`, `subscriptions`, `webhooks`

See `packages/server/schema.ts` for full definitions.

## 🔐 Auth Flow

1. Register with company name → auto-creates company + company_owner account
2. Login returns JWT (7-day expiry)
3. All API calls include `Authorization: Bearer <token>`
4. tRPC `protectedProcedure` validates JWT and injects `{ userId, companyId, role }`
5. `companyScopedProcedure` enforces row-level tenant isolation

## 📱 Mobile Stack
- **Expo SDK 52** + **Expo Router** v3 (file-based routing)
- **NativeWind** v4 (Tailwind for RN)
- **tRPC Client** with React Query (`@tanstack/react-query`)
- **SecureStore** for JWT persistence
- **Camera** + **Location** + **ImagePicker** for field capture
- **Reanimated** for smooth transitions

## 🖥 Web Stack
- **Vite** 6 + **React** 19 + **TypeScript** 5.9
- **React Router** 7 (data API loaders)
- **Tailwind CSS** 4 + custom dark theme
- **tRPC Client** with React Query
- **Recharts** for analytics charts
- **Framer Motion** for page transitions

## 🧪 Testing

```bash
# Server tests
pnpm test

# Web tests
pnpm test

# Mobile E2E
pnpm e2e
```

## 🚢 Deployment

### VPS (current)
```bash
bash deploy.sh
```

### Docker (recommended)
```bash
docker-compose up -d
```

### EAS (mobile)
```bash
cd packages/mobile
eas login
eas build --platform ios --profile production
eas submit --platform ios
```

## 🧠 AI Architecture

The unified AI system merges:
- **BuildTrack AI Chat** (context-aware, SSE streaming)
- **Converge Voice Agent** (OpenAI Realtime API)

Agents:
1. **Knowledge Agent** — document Q&A (RAG)
2. **Document Agent** — generate reports/documents
3. **Safety Agent** — hazard detection + safety plans
4. **Schedule Agent** — delay impact analysis
5. **Cost Agent** — budget forecasting + EVM
6. **Quality Agent** — defect pattern analysis
7. **Field Agent** — daily report processing
8. **Compliance Agent** — regulatory checking

## 📊 Data Migration

Legacy databases can be migrated using:
```bash
cd packages/server
pnpm tsx scripts/migrate-from-legacy.ts
```

Supports:
- BuildTrack Supabase → `users`, `projects`, `tasks`
- cortexbuild-ultimate → full dump
- cortexbuild-field MySQL → Drizzle + `ST_DWithin` geography

## 🔗 Legacy Redirects

| Old Domain | Redirects To |
|------------|------------|
| `buildtrack.cortexbuildpro.com` | `app.cortexbuildpro.com/projects` |
| `field.cortexbuildpro.com` | `app.cortexbuildpro.com/field` |
| `dash.cortexbuildpro.com` | `app.cortexbuildpro.com/dashboard` |
| `api.cortexbuildpro.com/v1/*` | `api.cortexbuildpro.com/trpc/*` |

## 📝 License

MIT © 2026 CortexBuildPro

---

Built with ❤️ by merging 6 repos, 42 tables, and 100+ features into one codebase.
