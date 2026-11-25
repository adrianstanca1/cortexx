# System Architecture

**Date:** 2026-06-07; production claims superseded 24 November 2026
**Application:** Cortexx (product name CortexBuild Pro), release v1.7.6
**Infrastructure:** one.com Cloud Servers. The replacement host `85.190.122.27` has the Compose stack up; the public DNS record for `cortexbuildpro.tech` still points at the retired host `85.190.100.68`, so the domain does not serve HTTPS. Current state lives in `STATUS.md`; migration and acceptance gates in `docs/RUNBOOK.md`.

## Inference stack

| Service | Port | Model | Role |
| :--- | :--- | :--- | :--- |
| **Ollama** | 11434 | llama3.2:3b | Base / Fallback |
| **Native Text** | 8085 | qwen2.5-coder:7b | High-throughput Code/Text |
| **Native Vision** | 8086 | moondream | Real-time SNAG/Photo Analysis |

That layout was recorded on the retired host; confirm it on the replacement before relying on it.

## Deployment pipeline

- **CI**: `.github/workflows/ci.yml` contains lint, accessibility lint, typecheck, unit tests, PostgreSQL integration, browser/WCAG, `dist/` integrity, data-model drift and dependency-audit checks. PR #476's matrix passed (20 passed, 1 skipped); GitHub also shows a Backup Verify SSH failure against the retired host on `main`.
- **CD**: deploy procedures are in `docs/RUNBOOK.md`. Production acceptance has **not** been reached — the domain outage, the unverified restore chain and the cutover are tracked in issues #368, #370 and #473.
- **Operations**: Health Monitor remains gated by `PRODUCTION_RETIRED=true`. The manual replacement-VPS app rebuild and Backup Verify are separately gated by `VPS_REBUILD_ENABLED=true` and `REPLACEMENT_VPS_BACKUP_VERIFY_ENABLED=true`; these local workflow changes are not active on `main` until reviewed and pushed.
