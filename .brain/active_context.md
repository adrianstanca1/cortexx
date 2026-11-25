# Active Context

**Status:** v1.7.6 is the owner-selected canonical release; the public domain is down and the replacement is staged, not accepted.

## Verified 24 November 2026

- [x] Canonical release v1.7.6 selected by the owner; root package, lockfile and Compose version metadata are aligned.
- [x] Upstream `main` is `d409dad`, up to date at the last fetch. Local working tree has uncommitted edits and is not clean.
- [x] PR #476's CI matrix passed (20 passed, 1 skipped). This is not a blanket green status: GitHub still shows a Backup Verify SSH-authentication failure against retired host `85.190.100.68` (job `138209909667`).
- [x] The replacement stack is running on `85.190.122.27` — gateway, database, cache, Ollama and app healthy, Prisma migrations applied, `/api/health` OK (PR #476). **Staging evidence only.** Owner reports a verified database-and-uploads backup is ready, but it has not been transferred or restored on the replacement.
- [x] Health Monitor remains gated by `PRODUCTION_RETIRED=true`. Local changes now provide a manual, app-only rebuild for the One.com VPS behind `VPS_REBUILD_ENABLED=true`; Backup Verify targets that host behind `REPLACEMENT_VPS_BACKUP_VERIFY_ENABLED=true`. Neither workflow change is active on `main` until reviewed and pushed. The picomatch waiver was removed after the advisory was withdrawn. The outage and recovery chain remain tracked in issues #368, #370 and #473.

## Open

- [ ] `https://cortexbuildpro.tech` fails at the TLS handshake; its A record still points at the retired host `85.190.100.68`. The cutover to `85.190.122.27` waits on secure transfer and isolated validation of the owner-reported backup, full acceptance and an approved maintenance window (`docs/RUNBOOK.md`). Remove `PRODUCTION_RETIRED` only after cutover and successful production verification.

## Superseded

The earlier v1.4.0 deployment claim and "codebase fully synchronized" note describe superseded infrastructure and release history. They are not current deployment evidence; `server/package.json` still carries its historical 1.4.0 version.
