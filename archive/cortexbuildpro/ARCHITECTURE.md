# CortexBuild Pro — Architecture & Platform Plan

## Overview

**CortexBuild Pro** is a cross-platform construction management SaaS built with Expo + React Native. It targets contractors, foremen, safety officers, and site managers who need real-time project coordination, task tracking, incident reporting, and team management — all from a mobile-first interface.

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Framework | Expo SDK 54 + React Native 0.81 |
| Navigation | Expo Router (file-based, tabs + stacks) |
| Styling | NativeWind (Tailwind CSS for RN) |
| State | Zustand (lightweight, TypeScript-native) |
| Backend | Supabase (PostgreSQL + Auth + Realtime + Storage) |
| Auth | Supabase Auth (email/password, extensible to SSO) |
| Icons | @expo/vector-icons (Ionicons) |
| Type Safety | TypeScript 5.9 (strict mode) |
| Build | EAS (Expo Application Services) |

---

## Directory Structure

```
cortexbuildpro/
├── app/                          # Expo Router file-based routes
│   ├── (tabs)/                   # Tab layout group
│   │   ├── _layout.tsx           # 5-tab navigation config
│   │   ├── index.tsx             # Dashboard (stats, quick actions, feed)
│   │   ├── projects.tsx          # Project list with status filters
│   │   ├── tasks.tsx             # Task list with priority filters
│   │   ├── safety.tsx            # Safety incident tracker
│   │   └── settings.tsx          # User settings, theme, sign out
│   ├── auth/
│   │   ├── login.tsx             # Email/password login
│   │   └── signup.tsx            # Registration
│   ├── project/
│   │   ├── [id].tsx              # Project detail (tasks, budget, location)
│   │   └── create.tsx            # New project form
│   ├── task/
│   │   ├── [id].tsx              # Task detail
│   │   └── create.tsx            # New task form
│   └── _layout.tsx               # Root stack + StatusBar theming
├── src/
│   ├── components/               # 10 reusable UI primitives
│   │   ├── ThemedText.tsx        # Typography with variants
│   │   ├── Button.tsx            # 4 variants, loading state
│   │   ├── Input.tsx             # Label + error support
│   │   ├── Card.tsx              # Surface container with shadow
│   │   ├── Badge.tsx             # Status/severity labels
│   │   ├── Avatar.tsx            # Initials + image fallback
│   │   ├── Header.tsx            # Screen header with back nav
│   │   ├── EmptyState.tsx        # Zero-state illustration
│   │   ├── ThemeToggle.tsx       # Light/Dark/System switch
│   │   └── LoadingScreen.tsx     # Branded loading state
│   ├── hooks/
│   │   ├── useAuth.ts            # Supabase auth lifecycle + sign-in/out
│   │   └── useTheme.ts           # System-aware theme with colour palette
│   ├── stores/                   # Zustand state modules
│   │   ├── authStore.ts          # User + session
│   │   ├── themeStore.ts         # Theme mode + resolution
│   │   ├── projectStore.ts       # CRUD + selection
│   │   ├── taskStore.ts          # CRUD + project/status filters
│   │   ├── safetyStore.ts        # Incident CRUD + open count
│   │   ├── teamStore.ts          # Team member management
│   │   └── notificationStore.ts  # Inbox + unread count
│   ├── types/
│   │   └── index.ts              # Core domain types (Project, Task, SafetyIncident, etc.)
│   ├── lib/
│   │   ├── supabase.ts           # Supabase client config
│   │   └── api.ts                # Generic typed API wrapper (fetch/insert/update/delete)
│   ├── services/
│   │   └── notifications.ts      # Local notification service (push-ready)
│   ├── utils/
│   │   ├── colors.ts             # Light/dark colour palettes
│   │   └── helpers.ts            # formatCurrency, formatDate, debounce, generateId, etc.
│   ├── constants/
│   │   └── index.ts              # App name, version, storage keys, defaults
│   └── styles/
│       └── global.css            # Tailwind directives
├── assets/                       # Icons, splash, favicon
├── app.json                      # Expo config (newArch, edge-to-edge, EAS project)
├── eas.json                      # Build profiles + App Store Connect credentials
├── tailwind.config.js            # Brand colours, NativeWind preset
├── tsconfig.json                 # Strict mode + path aliases (@/*)
└── babel.config.js               # Expo preset + NativeWind plugin
```

---

## Core Domain Model

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Organisation   │◄────│    Project      │◄────│     Task        │
│  (multi-tenant) │     │  ├─ status       │     │  ├─ priority     │
│  ├─ plan tier   │     │  ├─ budget      │     │  ├─ assignee    │
│  └─ slug        │     │  ├─ location    │     │  └─ due date    │
└─────────────────┘     │  └─ timeline    │     └─────────────────┘
                        └─────────────────┘              │
                               │                        │
                               ▼                        ▼
                        ┌─────────────────┐     ┌─────────────────┐
                        │ SafetyIncident  │     │   TeamMember    │
                        │  ├─ severity    │     │  ├─ role        │
                        │  ├─ status      │     │  ├─ trade       │
                        │  └─ reporter    │     │  └─ rate         │
                        └─────────────────┘     └─────────────────┘
```

### Data Types

- **Project** — `planning | active | on_hold | completed | cancelled`
- **Task** — `todo | in_progress | review | done` × `low | medium | high | critical`
- **SafetyIncident** — `near_miss | minor | major | critical` × `open | investigating | resolved | closed`
- **TeamMember** — Roles: `admin | manager | foreman | worker`
- **Notification** — `task | incident | project | system`

---

## Navigation Architecture

```
Root Stack
├── (tabs) ────────────── Tab Layout (5 tabs)
│   ├── Dashboard        / (index)
│   ├── Projects         /projects
│   ├── Tasks            /tasks
│   ├── Safety           /safety
│   └── Settings         /settings
│
├── auth/login           Modal (slide_from_bottom)
├── auth/signup          Modal (slide_from_bottom)
├── project/[id]         Detail (slide_from_right)
├── project/create       Modal (slide_from_right)
├── task/[id]            Detail (slide_from_right)
└── task/create          Modal (slide_from_right)
```

---

## Theme System

- **3 modes**: Light / Dark / System (auto)
- **Runtime palette**: 10 semantic colours (background, surface, text, primary, success, warning, danger, info, border, textSecondary)
- **Storage**: `cbp-theme-mode` (SecureStore, wired in future)
- **StatusBar**: Auto-adjusts based on resolved theme
- **NativeWind**: Tailwind classes + runtime colours for dynamic styling

---

## State Management (Zustand)

| Store | Purpose | Persist? |
|-------|---------|----------|
| `authStore` | User, session, loading | No (handled by Supabase) |
| `themeStore` | Mode + resolved theme | Yes (SecureStore) |
| `projectStore` | Projects list + selection | No (API-driven) |
| `taskStore` | Tasks + computed filters | No (API-driven) |
| `safetyStore` | Incidents + open count | No (API-driven) |
| `teamStore` | Members + roles | No (API-driven) |
| `notificationStore` | Inbox + unread count | No (API-driven) |

---

## Authentication

- **Provider**: Supabase Auth
- **Methods**: Email + password (SSO-ready: Google, Apple)
- **Session**: Auto-refresh, persisted via Supabase
- **User metadata**: `full_name`, `avatar_url`, `role`
- **Hooks**: `useAuth()` — full auth lifecycle + signIn/signUp/signOut

---

## API Layer

`src/lib/api.ts` provides typed wrappers:

```typescript
apiFetch<T>(table, { select, eq, order, limit, single })
apiInsert<T>(table, payload)
apiUpdate<T>(table, id, payload)
apiDelete(table, id)
```

All Supabase-backed with `autoRefreshToken` and session persistence.

---

## EAS Configuration

| Profile | Use |
|---------|-----|
| `development` | Local dev client builds |
| `preview` | Internal distribution (TestFlight/Play Console) |
| `production` | App Store + Play Store (auto-incremented build numbers) |

**iOS Submit**: Apple App Store Connect API key configured (`.p8` key, Team ID, Issuer ID). Replace `ascAppId` with live App ID when ready.

---

## Current Stats

- **~2,800 lines** of TypeScript/TSX
- **10 reusable components**
- **7 Zustand stores**
- **8 domain types**
- **10 screen routes** (tabs + auth + detail + create)
- **Full theming** (light/dark/system)
- **Offline-ready architecture** (Supabase local persistence + optimistic UI)

---

## Next Steps for Full SaaS

### Phase 1 — Backend Integration
1. Deploy Supabase project (or connect to existing)
2. Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`
3. Create database schema with Row Level Security (RLS)
4. Wire `api.ts` calls into screens (replace demo data)
5. Add realtime subscriptions for live updates

### Phase 2 — Feature Completion
- [ ] Project map with geolocation markers
- [ ] Task Kanban board (drag-and-drop)
- [ ] Safety incident photo capture
- [ ] Team invite flow (email + QR code)
- [ ] Notification inbox with push (Expo Notifications)
- [ ] Offline sync queue with conflict resolution
- [ ] Report generation (PDF export)
- [ ] Time tracking / timesheets
- [ ] Budget vs actual cost tracking
- [ ] Material inventory module

### Phase 3 — SaaS Operations
- [ ] Organisation onboarding + subdomain routing
- [ ] Subscription tiers (Stripe integration)
- [ ] RBAC permissions matrix
- [ ] Audit logging for compliance
- [ ] Admin dashboard (web portal)
- [ ] Multi-language support (i18n)
- [ ] Accessibility audit (WCAG 2.1 AA)
- [ ] E2E testing (Maestro / Detox)

### Phase 4 — Scale
- [ ] Supabase connection pooling
- [ ] CDN for asset delivery
- [ ] Analytics (PostHog / Mixpanel)
- [ ] Crash reporting (Sentry)
- [ ] CI/CD pipeline for automated EAS builds
- [ ] App Store / Play Store listing optimisation
