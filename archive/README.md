# Cortexx — Consolidated Archive

Full source of legacy Cortexx-related repositories that were merged into
this monorepo on **2026-05-24**. All originals have been deleted from
GitHub; this is the single source of truth.

After the v1.1 legacy-port (May 26 2026), low-value archives were
pruned. The remaining 4 archives are kept as reference for any future
work that needs to dig into their unique data shapes or design patterns.

## Surviving archives (4)

| Directory | Original repo | Stack | What it has of value |
|---|---|---|---|
| `cortexx-pwa/` | `adrianstanca1/cortexx-pwa` | Standalone single-file PWA | Original design language, 80-phase roadmap, App Store submission pack. The design lineage of the current app. |
| `cortexbuild-field/` | `adrianstanca1/cortexbuild-field` | Expo React Native + tRPC + Drizzle | Unique data shapes (`actionPlans`, `conflictPending`, `enquiryPipelines`, `equipmentAssignments`) — v1.1 ported the top 4 |
| `cortexbuild-ultimate/` | `adrianstanca1/cortexbuild-ultimate` | Vite + Capacitor + Express | 8 AI-agent personas (CEO/CFO/Site Mgr/Compliance/Sales/Estimator/etc), advanced analytics dashboards, 121 Vitest tests — most of this is v2.0 horizon |
| `cortexbuild-web/` | `adrianstanca1/cortexbuild-web` | Vite + Express + MySQL | Team chat + conversation memory patterns; v1.1 ported these as the live `/chat` module |

## Cleaned-out archives

Deleted on 2026-05-26 as per the Explore-agent inventory:

| Directory | Why deleted |
|---|---|
| `claude-design/` | Already consumed by `cortexx-pwa/` |
| `cortexbuild-platform/` | Infra-only (Docker + nginx config), no feature code |
| `cortexbuild-unified/` | Failed monorepo unification attempt; README aspirational, 50+ TS2307 errors on tsc |
| `cortexbuildpro/` | Older version of `cortexbuild-field/` (duplicate) |
| `cortexbuildpro-ultimate/` | Single HTML file, no real content |

Git history preserves these if anyone needs to recover.

## Items ported in v1.1

See `CHANGELOG.md` (v1.1.0 — 26 May 2026) for the full list of features
extracted from these archives into the live Next.js app. The 10 items
shipped covered the highest-leverage code from the surviving 4 archives;
the remaining items are tracked under "v2.0 horizon" in `ROADMAP.md`.

## Excluded from archive

`node_modules/`, `dist/`, `.next/`, `build/`, and lock files were
excluded when these archives were created.
