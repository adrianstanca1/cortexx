# CortexBuild Pro — production runbook

Production is the isolated Docker Compose construction stack on the One.com VPS.

## Quick reference

| What | Where |
|---|---|
| Production URL | https://cortexbuildpro.tech |
| GitHub repo | https://github.com/adrianstanca1/cortexx |
| VPS | One.com · `administrator@85.190.100.68` |
| Production checkout | `/home/administrator/production/cortexx` |
| Compose file | `docker-compose.construction.yml` |
| Env file | `/home/administrator/production/cortexx/.env.construction` (0600) |
| App container | `cortexbuild-construction-app-1` |
| Database container | `cortexbuild-construction-db-1` |
| App loopback | `http://127.0.0.1:3020` |
| Health | https://cortexbuildpro.tech/api/health |
| Recovery guide | `docs/CONSTRUCTION_RECOVERY.md` |

Do not use the retired `/opt/cortexx`, host-Postgres or PM2 procedures for this production deployment.

## Release flow

1. Open a PR against `main`.
2. CI must pass the build/typecheck, integration, iOS, audit/security and browser/PWA matrix.
3. `.github/workflows/deploy-vps.yml` deploys the exact successful `main` SHA.
4. The deploy workflow:
   - verifies the exact SHA passed CI;
   - updates `/home/administrator/production/cortexx`;
   - creates `.env.construction` only if missing;
   - generates a missing `CRON_SECRET` without printing it;
   - builds the app/tools images;
   - starts PostgreSQL, Redis and Ollama;
   - runs Prisma migrations and bootstrap;
   - starts the app;
   - waits for `/api/health`;
   - installs the app-maintenance cron schedule;
   - verifies public ingress.
5. Keep the previous healthy app image tagged before a manual production cutover.

## Production environment

Required runtime keys live in the 0600 `.env.construction` file.

| Key | Purpose |
|---|---|
| `POSTGRES_PASSWORD` | PostgreSQL container password |
| `DATABASE_URL` | `postgresql://construction:…@db:5432/construction?schema=public` |
| `NEXTAUTH_SECRET` / `AUTH_SECRET` | Auth.js signing/encryption |
| `JWT_SECRET` | Mobile/native bearer authentication |
| `CRON_SECRET` | Bearer secret for `POST /api/cron/*` |
| `NEXTAUTH_URL` / `AUTH_URL` | `https://cortexbuildpro.tech` |
| `REDIS_URL` | `redis://redis:6379` |
| `OLLAMA_BASE_URL` | `http://ollama:11434` |
| `VAPID_*` | Optional web-push delivery |
| `RESEND_API_KEY` / `EMAIL_FROM` | Optional transactional email |
| `STRIPE_*` | Optional billing |

Never put secret values in workflow-dispatch inputs, GitHub issue text, logs or chat messages. For local-only production secrets such as `CRON_SECRET`, update the protected env file on the VPS and recreate the app container.

## App maintenance cron jobs

Install/update from a reviewed production checkout:

```bash
bash ops/install-construction-app-crons.sh
```

The installer preserves unrelated user cron entries and installs:

| Server time | Job |
|---|---|
| 06:00 daily | overdue invoices |
| 06:30 daily | permit / RAMS / certification / document expiry warnings (14-day horizon) |
| 03:00 Sunday | prune stale push subscriptions |

Cron invokes `$HOME/bin/construction-app-cron.sh`. The wrapper reads `CRON_SECRET` from the protected production env at runtime, so the bearer token is not stored in crontab.

Manual smoke:

```bash
$HOME/bin/construction-app-cron.sh overdue-invoices
$HOME/bin/construction-app-cron.sh expiry-warnings
$HOME/bin/construction-app-cron.sh prune-push
```

Logs: `$HOME/logs/construction-app-cron.log`.

### Bounded load smoke gate

Run this against a local server or an approved staging deployment before a release:

```bash
npm run load:smoke
LOAD_TEST_URL=https://staging.example.test/api/health npm run load:smoke
```

The dependency-free runner sends 30 requests with concurrency 5 and fails on a
p95 latency above 1,000 ms or an error rate above 1%. Configure the bounds with
`LOAD_TEST_REQUESTS`, `LOAD_TEST_CONCURRENCY`, `LOAD_TEST_TIMEOUT_MS`,
`LOAD_TEST_MAX_P95_MS`, and `LOAD_TEST_MAX_ERROR_RATE`. It defaults to
`http://127.0.0.1:3000/api/health` and refuses to target the CortexBuild Pro
production hostname unless `ALLOW_PRODUCTION_LOAD_TEST=1` is deliberately set
for an approved run.

For shared staging, run the `Staging load smoke` GitHub Actions workflow and
provide its health URL. The workflow uses the same thresholds, has a five-minute
job limit, serializes runs, and retains the production-host safeguard.

## Backup and restore verification

Install/update:

```bash
bash ops/install-construction-backups.sh
```

Current schedule:
- 02:15 daily — database + uploads backup.
- 02:45 Sunday — isolated restore verification.

Managed backups are under `$HOME/backups/construction`. The verifier checks checksums, restores into an isolated PostgreSQL container, reads canonical table counts, extracts uploads, then removes the disposable restore resources.

See `docs/CONSTRUCTION_RECOVERY.md` for the tested recovery procedure and current limits. Local restore verification and a 30-day encrypted GitHub Actions artifact are implemented. Optional PostgreSQL WAL archiving and isolated PITR tooling are documented in `docs/CONSTRUCTION_PITR.md`; production activation and encrypted off-site WAL verification remain separate operator work.

## Safe database rescue

Use the manual `DB Rescue — One.com construction stack` workflow. Supported actions are intentionally non-destructive:
- `inspect`
- `migrate-status`
- `migrate-deploy`

The retired workflows that deleted Prisma migration rows or manipulated host Postgres/PM2 are intentionally removed.

## Ad-hoc diagnostics

Use `.github/workflows/vps-exec.yml` only for commands safe to appear in workflow logs. Prefer aggregate counts and health/status commands. Do not print credentials or row-level PII.

Useful commands on the VPS:

```bash
cd /home/administrator/production/cortexx
docker compose --env-file .env.construction -f docker-compose.construction.yml ps
docker logs --since 15m cortexbuild-construction-app-1
curl -fsS http://127.0.0.1:3020/api/health
docker system df
```

## Rollback

For an app-only regression:
1. Keep the current database unchanged.
2. Re-tag the previously preserved healthy app image as `cortexbuild-construction-app:latest`.
3. Recreate only the app service with `docker compose … up -d --no-deps app`.
4. Verify `/api/health`, auth boundaries and browser smoke.

For a database-affecting incident, restore into an isolated replacement stack first. Do not overwrite the live database until the restore is verified and a controlled cutover is planned.

## Release verification checklist

Before calling a production release complete:
- repo clean and synchronized with `origin/main`;
- no open release PRs;
- CI matrix green;
- production container healthy with zero unexpected restarts;
- `/api/health` database/app/disk/memory checks green;
- unauthenticated protected APIs return 401;
- public login renders without browser/page errors;
- production dependency audit has no known runtime vulnerabilities;
- latest construction backup verifies successfully;
- recent app logs contain no fatal/unhandled/Prisma runtime errors.
