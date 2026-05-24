# Cortexx — Consolidated Archive

This directory contains the full source code of all previously separate Cortexx-related repositories, merged into this single repository on 2026-05-24.

All repositories have been deleted from GitHub. This is now the single source of truth.

## Archived Repositories

| Directory | Original Repo | Stack | Description |
|---|---|---|---|
| `cortexbuild-ultimate/` | `adrianstanca1/cortexbuild-ultimate` | Vite + Capacitor + Express | AI-powered unified construction management platform — 84 feature modules, 121 tests, billing, MFA, iOS docs |
| `cortexbuild-field/` | `adrianstanca1/cortexbuild-field` | Expo React Native | Mobile field app — site inspections, daily reports, drawings, materials, equipment |
| `cortexbuild-web/` | `adrianstanca1/cortexbuild-web` | Vite + Express | WhatsApp agent, chat inbox, conversations, issue tracker |
| `cortexbuildpro/` | `adrianstanca1/cortexbuildpro` | Expo + Supabase | Native iOS/Android mobile app |
| `cortexbuild-platform/` | `adrianstanca1/cortexbuild-platform` | Monorepo (web + api + db) | Platform monorepo scaffold |
| `cortexbuild-unified/` | `adrianstanca1/cortexbuild-unified` | Monorepo stub | Unified monorepo packages scaffold |
| `cortexbuildpro-ultimate/` | `adrianstanca1/cortexbuildpro-ultimate` | Vite React | Simple SPA scaffold |

## Key Assets to Promote

The following files from the archive are candidates for integration into the live Next.js app:

### From `cortexbuild-ultimate/`
- `src/components/modules/` — 84 feature modules (BIM4D, CIS, RAMS, Tenders, AI Vision, etc.)
- `server/routes/` — 60+ API route handlers
- `docs/` — API docs, App Store deployment guide, CI/CD runbook, platform spec
- `ios/` — Capacitor iOS project (alternative to the one in cortexx-pwa)

### From `cortexbuild-field/`
- `app/(tabs)/` — Expo tabs for field app
- `server/routers/` — tRPC routers
- `docs/` — Field app roadmap and superpowers

### From `cortexbuild-web/`
- `client/src/pages/` — Chat inbox, conversations, issue tracker, image gallery
- `server/` — Express API server

### From `cortexbuildpro/`
- `src/` — React Native screens and navigation
- `docs/` — Architecture docs

## Notes

- `node_modules/`, `dist/`, `.next/`, `build/`, and lock files are excluded from the archive.
- The live production app at `cortexbuildpro.com` runs from the `app/`, `components/`, `lib/`, and `prisma/` directories at the root of this repository.
