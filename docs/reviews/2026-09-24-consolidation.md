# CortexBuild consolidation — 24 September 2026

## Canonical production line

adrianstanca1/cortexx is the single active source of truth for CortexBuild Pro.
Release baseline: **v1.5.0**.

The root web/API application remains the production product. The offline PWA and
expo/ native client remain first-class deployment surfaces sharing the same
backend contract.

## Product lineage reviewed

- cortexbuild-pro — archived predecessor. Its PWA/iOS/auth work is superseded
  by the consolidated cortexx history.
- cortexx-pwa — archived predecessor. Its PWA/iOS/portal work was explicitly
  merged into cortexx in the earlier consolidation commits.
- cortexbuild-field — newer Expo construction client. Business modules are
  represented in the canonical web/API surface; its native implementation is
  preserved as an archived source snapshot in this repository.
- BuildTrack — separate Expo construction prototype. Its useful mobile source
  is preserved as an archived snapshot for future native-parity work.
- buildtrack-web, buildtrack-api, BuildTrack-iOS, constructtime_pro,
  openclaw-mobile — already archived legacy experiments.
- cortexx-deploy and cortexbuildpro.com — obsolete deployment/site repositories
  superseded by the current deployment assets in cortexx.
- cortex-mobile-ai — not part of the construction product and intentionally
  left separate.

## Branch consolidation policy

Only product work that is newer or materially different is merged into the
production line. Superseded experimental/deployment/log branches are retained
as recovery tags before their branch refs are removed. Dependabot branches are
not blindly merged; the canonical lockfile is refreshed and validated instead.

## Release fixes in v1.5.0

- construction offline-sync reliability and tenant isolation hardening
- isolated full-web Docker deployment and health verification
- clean-install ESLint flat-config fix
- non-breaking npm security refresh; critical Next.js advisory removed
- full production build validated from a clean install
- repository lineage and duplicate-project cleanup

## Validation target

The release must pass clean install, application integrity audit, ESLint,
TypeScript, 299 Node tests, dist sync, Next.js production build, Docker
configuration validation, and a construction deployment smoke test.
