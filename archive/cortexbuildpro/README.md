# CortexBuild Pro

Construction management SaaS platform — multi-tenant, subscription-tiered, white-label capable.

## Stack
- Expo Router + React Native (mobile-first)
- NativeWind / TailwindCSS
- Zustand (state)
- Supabase (auth + data)
- TypeScript

## SaaS Architecture (MVP)

### Multi-Tenancy
- `organisationStore` holds current org context
- Users belong to an org via `orgId`
- Projects scoped to `orgId` (future: RLS policy)

### Subscription Tiers
| Plan | Projects | Team | Storage | White-Label | API |
|------|----------|------|---------|-------------|-----|
| Free | 3 | 5 | 1GB | ❌ | ❌ |
| Pro | 20 | 50 | 10GB | ❌ | ❌ |
| Enterprise | ∞ | ∞ | 100GB | ✅ | ✅ |

### State Stores
- `authStore` — user, session, roles (persisted)
- `organisationStore` — org, plan, branding, settings (persisted)
- `projectStore` — local CRUD + Supabase sync (ephemeral)
- `taskStore` — local + async API wrapper (ephemeral)

### Route Guards
- `_layout.tsx` redirects unauthenticated users to `/auth/login`
- `admin/index.tsx` blocks non-admin roles
- Feature-gated screens (billing, audit, branding) check `canUseFeature()`

### Navigation
```
/(tabs)
  index      → Dashboard
  projects   → Project list
  tasks      → Tasks
  daily-reports
  more       → Extra modules

/auth
  login
  signup

/settings
  profile, org, billing, branding, security, audit, notifications, support, legal

/admin
  index      → Admin dashboard (admin-only)

/project/[id]
/task/[id]
/project/create
/rfi/*
```

## Commands
```bash
npm start       # Expo dev
npm run lint    # ESLint
npx tsc --noEmit # Type check
```

## Auth Persistence
- Zustand + `persist` middleware + AsyncStorage
- Session auto-refreshes via Supabase `onAuthStateChange`
- Sign-out clears auth + org stores

## Feature Flags (Plan Gates)
- `selectIsPro`, `selectIsEnterprise`, `canUseFeature(feature)`
- UI badges show locked features with required tier
