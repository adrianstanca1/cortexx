# CLAUDE.md — cortexbuildpro

CortexBuild Pro: the construction-management SaaS mobile app — Expo /
React Native / NativeWind / Supabase. **iOS submission target**: this
is what ships to the App Store under bundle `space.manus.cortexbuildpro`
(record in App Store Connect). Sibling apps: `cortexbuild-field`
(field-worker variant on a different ASC record), `BuildTrack` (Expo
mobile of the BuildTrack stack).

A longer system design lives in `ARCHITECTURE.md` (May 9 — predates
this CLAUDE.md). This file is the operational layer for day-to-day
agent work; ARCHITECTURE.md is the design doc.

## Stack

- **Runtime**: Node ≥22, Expo SDK 55 (NOTE: ARCHITECTURE.md says 54;
  package.json pins `expo: ~55.0.23`. CLAUDE.md wins for current
  reality).
- **React Native**: 0.83.6, React 19.2
- **Navigation**: Expo Router (file-based) with `(tabs)` group
- **Styling**: NativeWind v4 (Tailwind 3.4 classes via `className`)
- **State**: Zustand v5 stores under `src/stores/`
- **Auth + DB**: Supabase JS v2.49 — `src/lib/supabase.ts` exports the
  client. Tokens in `expo-secure-store`.
- **Tests**: Jest 29 + jest-expo + Testing Library
  (`@testing-library/react-native`). 85 tests across `__tests__/`
  (stores + colors + helpers).
- **No backend code in this repo** — Supabase is the backend. Any
  custom server logic would live in Supabase Edge Functions (not
  currently used).

## Path aliases

`tsconfig.json` sets `@/* → ./src/*`. So `@/components/X`,
`@/stores/X`, `@/hooks/X` all resolve under `src/`. **The root has no
`components/` or `stores/` directories** — everything is under `src/`.
This is unusual for Expo Router projects but enforced everywhere here.

## How to run

```bash
# from /root/cortexbuildpro
npm install                  # one-off
npm start                    # expo start (interactive picker)
npm run web                  # expo start --web
npm run ios                  # expo start --ios (needs a Mac for runtime)
npm test                     # jest (85 tests, ~1.4s)
npm run test:coverage        # jest --coverage → coverage/
npm run lint                 # eslint . --ext .js,.jsx,.ts,.tsx
npx tsc --noEmit             # type check (must be 0 before pushing)
```

There's no PM2 process for this repo — it's a client-only Expo app.
Web export lands in `dist/` (already-built; can be deployed as static).

## Expo Router gotcha — file-vs-directory collisions

Each top-level domain has BOTH a listing file AND a directory:

```
app/
├── change-orders.tsx        # /change-orders listing
├── change-orders/           # /change-orders/[id] detail, /create form
├── daily-reports.tsx
├── daily-reports/[id].tsx
├── defects.tsx
├── defects/[id].tsx
├── defects/create.tsx
... and ~10 more
```

The `.tsx` file = listing route; the `/[id].tsx` and `/create.tsx`
files inside the directory = detail + create routes. They coexist
fine **as long as the directory does NOT have an `index.tsx`**. A
collision (both `foo.tsx` AND `foo/index.tsx`) silently picks one
and makes the other dead code. **Audit on every domain you add.**

Fixed 2026-05-13: `app/change-orders/index.tsx` was a 1-line "Coming
Soon" stub that was winning over the 51-line full implementation in
`app/change-orders.tsx`. Stub deleted; the directory remains for
`[id]` + `create` routes only.

## App routes (top-level)

```
app/(tabs)/              # 5-tab nav (dashboard, projects, tasks, safety, settings)
app/auth/                # login.tsx, signup.tsx
app/admin/               # admin tools
app/project/             # project detail screens
app/budget/              # budget mgmt
app/invoices/            # invoice list + detail
app/materials/           # materials & deliveries
app/equipment/           # equipment listing + detail
app/team/                # team management
app/timesheets/          # timesheet entry
app/rfis/                # RFI workflow
app/permits/             # permits + create
app/defects/             # defects + create + detail
app/drawings/            # drawings + create + detail
app/daily-reports/       # daily-report detail
app/punch-items/         # punch list
app/submittals/          # submittal workflow
app/site-photos/         # photo upload
app/change-orders/       # change-order detail
app/meetings/            # meetings + detail
app/delay-notes/         # delay notes
app/notifications/       # notification feed
... 70 routes total
```

## Auth flow

`src/lib/supabase.ts` creates the Supabase client. `app/auth/login.tsx`
+ `app/auth/signup.tsx` call into `useAuth()` (from `@/hooks/useAuth`)
which talks to Supabase. Session tokens persist to
`expo-secure-store`. App entry checks session on boot and routes to
`(tabs)` if authed, `auth/login` otherwise.

**No httpOnly cookies, no custom REST API** — this is a pure Supabase
client. Multi-tenant boundaries are enforced by Supabase Row-Level
Security policies on the Postgres side.

## iOS shipping (the long-standing blocker)

- **Bundle ID**: `space.manus.cortexbuildpro` — tied to an ASC record.
  Don't rename. EAS profiles in `eas.json`.
- **ASC API key**: `AuthKey_S7PSXPJ963.p8` in repo root (same key
  used across the BuildTrack-iOS family — see workspace memory
  `reference_ios_bundle_inventory`).
- **EAS quota: depleted**. The `.github/workflows/eas-ios.yml` push
  trigger is DISABLED (commit `3487304 ci(eas): disable push trigger
  — EAS credits depleted; keep manual dispatch only`). Manual
  dispatch only until June 1 reset.
- **Alternative ship path**: native macos-15 GitHub Actions runner
  with manual signing (P12 + provisioning profile) — see
  `.github/workflows/xcode-ios.yml`. This is the unblock path while
  EAS is dead. Last few commits chronicle the P12 / auto-signing /
  ASC-API-key wrestling that got it working.
- **Current blocker**: ASC API key regeneration needed (per workspace
  memory `project_cortexbuildpro`). Until that's done, even the
  macos-15 path can't auto-upload to TestFlight.

## Testing

```bash
npm test                     # jest --config jest.config.js (85 tests, ~1.4s)
npm run test:coverage        # adds --coverage; output in coverage/
```

Tests live in `__tests__/`:

```
__tests__/
├── colors.test.ts             # color palette + utility functions
├── helpers.test.ts            # date / format / validation helpers
└── stores/
    ├── authStore.test.ts      # zustand store transitions
    ├── projectStore.test.ts
    ├── taskStore.test.ts
    ├── safetyStore.test.ts
    ├── teamStore.test.ts
    ├── rfiStore.test.ts
    ├── drawingStore.test.ts
    ├── dailyReportStore.test.ts
    ├── notificationStore.test.ts
    └── themeStore.test.ts
```

`__mocks__/` has stubs for `react-native`, `nativewind`, and
`expo-module` so jest doesn't need a full native bridge.

**There are no component-render tests.** The current coverage is
store-logic + utility-function only. A future hardening pass could
add render tests via `@testing-library/react-native` (already in
devDependencies).

## Conventions

- **`@/` always resolves to `src/`** — never to root. Don't create
  root-level `components/` etc.; they wouldn't be found.
- **No Alert.alert calls in source** — the codebase is unusually
  disciplined; keep it that way. Use toast / inline error patterns
  instead. (Web-only concern: per the workspace memory,
  `Alert.alert` is a no-op on RN Web.)
- **No console.* in non-test source** — 0 hits in `app/`,
  `src/components/`, `src/stores/`, etc. Use proper logging via a
  dedicated logger if you need observability.
- **Stores follow the zustand `create` pattern** without `persist`
  (sessions are Supabase-tracked, not store-persisted).
- **Color palette + theme tokens** in `src/constants/` — referenced
  via `@/constants`. Don't hardcode colors.

## Production overrides (package.json)

`overrides` block pins transitive deps to fix breakage:

- `postcss: >=8.5.10`, `tar: >=7.5.11`, `node-forge: >=1.4.0`,
  `yaml: >=2.8.3` etc. — security fixes
- `react-native-worklets: 0.7.4` — pinned compatibility
- `@xmldom/xmldom: ~0.8.10` — fixes DOMParser prebuild error
  (commit `e48f466`)

Don't remove these without testing — each was added in response to a
concrete build break.

## Known issues

- **EAS quota depleted** — see Shipping section above.
- **ARCHITECTURE.md predates the Expo SDK 55 upgrade** — it claims
  SDK 54. This CLAUDE.md is the current reality.
- **`src/` directory structure** is unusual for Expo Router and trips
  up engineers who assume root-level convention. Keep the
  `tsconfig.json` paths block in sync.
- **No CI deploy target** in this repo (it's a mobile app — there's
  no PM2 / server). Deploys are via EAS submit OR the macos-15 GHA
  workflow.
- **Web export exists in `dist/`** but no nginx vhost serves it on
  this box. If you want a web preview, run `npm run web` and open
  Metro's local URL.

## Cross-references

- ARCHITECTURE.md — older system-design doc (SDK 54 vintage)
- Workspace overview: `/root/CLAUDE.md` "Subprojects" + "Running services"
- iOS shipping playbook: `/root/.claude/projects/-root/memory/reference_ios_stack_playbook.md`
- ASC bundle inventory: `/root/.claude/projects/-root/memory/reference_ios_bundle_inventory.md`
- Sibling apps: cortexbuild-field/CLAUDE.md (field worker variant),
  BuildTrack-iOS/CLAUDE.md (native SwiftUI variant)
