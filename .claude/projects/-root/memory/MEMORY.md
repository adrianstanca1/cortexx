# Memory Index

<!-- One line per memory: - [Title](file.md) — hook -->
<!-- Keep this list pruned; delete memories that turn out to be wrong. -->

- [Field DB schema drift fix](mem_ms3t2b6h_8d82bd6dd1e8.md) — aligned drizzle schema to live camelCase DB columns instead of renaming the whole database.
- [Phase 1 credential hardening](mem_ms3t2gdk_f18bfa6fe56b.md) — removed plaintext secrets from config files; cron routes were resolved separately.
- [Phase 1 follow-up: cron routes live](mem_ms3upe74_acf63ff3d774.md) — `/api/cron/*` served by `cortexx-app-1`, re-enabled in `/etc/cron.d/cortexx-cron`, and verified returning 200; Traefik stale-socket 502 resolved.
- [Cortexx cron uses legacy DB](mem_ms3u5lzo_8b50558d87ba.md) — `/api/cron/*` handlers query the live legacy Express tables via raw `pg` because the Prisma model does not match production yet.
- [Traefik stale Docker socket](mem_ms3u5oj3_adbb70fec0b1.md) — if Docker routers all return 502 after a Docker daemon restart, restart `traefik-traefik-1` to pick up the current `/var/run/docker.sock` inode.
- [Claude capability files created](mem_ms3umvfs_bb5c09b07e45.md) — workspace + field app CLAUDE.md, `/health` slash command, SRE agent, deploy-field and backup-verify skills now live under `/root/.claude/`.
- [Backup pipeline S3 timeout fix](mem_ms3umzko_6783bdb6d9ec.md) — both Cortexx backup scripts wrap `rclone copy` in `timeout 120` so an unreachable S3 endpoint cannot block local backup markers.
- [Phase 2 hygiene cleanup done](mem_ms3up738_bd4919d0e030.md) — root `.git`, accidental JS/Expo project, debug leftovers, stale backup scripts, and shell RC backups removed.
- [S3 / admin DNS blockers](mem_ms3v0sdf_a1b2c3d4e5f6.md) — all server-side stabilization done; S3 replication and the branded admin URL need external credentials/DNS.
- [InvoiceSmart deployed and hardened 2026-08-03](mem_invoicesmart_deployed_20260803.md) — backups, watchdog coverage, CORS lockdown, and container hardening applied.
- [invoice-builder Phase 1 auth completed 2026-08-03](mem_invoicebuilder_phase1_completed_20260803.md) — invoice-builder-web now authenticates through InvoiceSmart backend; branded domain pending DNS.
- [invoice-builder Phase 2 completed 2026-08-03](mem_invoicebuilder_phase2_completed_20260803.md) — projects/quotes/variations backend + frontend deployed; branded domain pending DNS.
