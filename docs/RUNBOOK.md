# Cortexx — Production Runbook

Operational handover document for `cortexbuildpro.com`. Single-VPS
deployment on Hostinger; Next.js 16 + Postgres + Redis + pm2 cluster.

## Quick reference

| What | Where |
|---|---|
| Production URL | https://cortexbuildpro.com |
| GitHub repo | https://github.com/adrianstanca1/cortexx |
| VPS | `root@72.62.132.43` (Hostinger) |
| App directory | `/opt/cortexx` |
| Env file | `/opt/cortexx/.env.production` (chmod 600) |
| Logs | `pm2 logs cortexx` + `journalctl -u cron` |
| Health | https://cortexbuildpro.com/api/health · in-app `/status` |
| Status | https://cortexbuildpro.com/status |

## How to make changes

1. Open a PR against `main` (or push directly if trusted).
2. GitHub Actions runs:
   - **CI** (`.github/workflows/ci.yml`) — prisma format · lint ·
     tsc · 183 unit + 10 integration tests · `next build`
   - **Deploy** (`.github/workflows/deploy-vps.yml`) — on push to
     `main`, SSHes to the VPS, pulls + builds + migrates +
     `pm2 delete && start -i max`
3. **Health Monitor** (`.github/workflows/health-monitor.yml`)
   probes `/api/health` every 5 minutes from GitHub Actions.

Never modify the VPS by hand for anything that should survive a
redeploy — `deploy-vps.yml` is the source of truth and overwrites
`/opt/cortexx`, `/etc/cron.d/cortexx-*`, the nightly backup script,
and `.env.production` keys that the workflow knows about.

## Env vars (`.env.production` on the VPS)

| Key | Required? | Source |
|---|---|---|
| `DATABASE_URL` | ✅ | Built by deploy from `cortexx-db-password` |
| `NEXTAUTH_SECRET` | ✅ | GitHub repo secret |
| `NEXTAUTH_URL` | ✅ | Hardcoded to `https://cortexbuildpro.com` |
| `MULTITENANT_ENFORCED` | ✅ | Always `true` post-v1.0 |
| `REDIS_URL` | ✅ | `redis://127.0.0.1:6379` (local) |
| `VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` + `VAPID_CONTACT_EMAIL` | ✅ | GH repo secrets — web push |
| `ADMIN_EMAIL` + `ADMIN_PASSWORD` | ✅ | GH repo secrets — seed default user |
| `SEED_TOKEN` + `ALLOW_SEED` | ✅ | GH secret + `true` — guards `/api/seed` |
| `CRON_SECRET` | ✅ auto | Generated on first deploy (`openssl rand -hex 32`) |
| `STRIPE_SECRET_KEY` + 3× `STRIPE_PRICE_*` + `STRIPE_WEBHOOK_SECRET` | ❌ optional | Wire when ready; `/pricing` shows early-access banner if unset |
| `SENTRY_DSN` | ❌ optional | When unset, Sentry init no-ops; errors log to pm2 |
| `RESEND_API_KEY` + `EMAIL_FROM` | ❌ optional | When unset, `lib/email.ts` logs payloads instead of sending |
| `S3_BUCKET` + `S3_ENDPOINT` + `S3_ACCESS_KEY_ID` + `S3_SECRET_ACCESS_KEY` | ❌ optional | Unset → uploads go to local `/var/lib/cortexx/uploads` |
| `OLLAMA_BASE_URL` | ❌ optional | Default `http://localhost:11434`. Vision/text AI |

Adding/rotating a key:
```bash
gh workflow run vps-exec.yml --ref main \
  -f command='grep -v ^KEY= /opt/cortexx/.env.production > /tmp/e && echo "KEY=value" >> /tmp/e && mv /tmp/e /opt/cortexx/.env.production && chmod 600 /opt/cortexx/.env.production && pm2 restart cortexx'
```

## Cron jobs

System cron (`/etc/cron.d/cortexx-cron`):

| When | Endpoint | What |
|---|---|---|
| 06:00 daily | `POST /api/cron/overdue-invoices` | Promote past-due invoices to `overdue` + push notify |
| 06:30 daily | `POST /api/cron/expiry-warnings` | Push notify on permits / RAMS / certs expiring in ≤7d |
| 03:00 Sunday | `POST /api/cron/prune-push` | Garbage-collect dead `PushSubscription` rows |

Daily backup (`/etc/cron.daily/cortexx-backup`): `pg_dump cortexx`
into `/opt/cortexx-backups/cortexx-<UTC>.sql.gz`. Retains 30 days.

GitHub Actions schedules:
- **Health Monitor** — every 5min, hits `/api/health`
- **Backup Verify** — Sundays 04:00 UTC, restores newest backup
  to a `cortexx_verify` schema and runs smoke queries
- **Backup-verify failure** opens a P0 GitHub issue automatically

## Common operations

### Roll back a bad deploy

`deploy-vps.yml` doesn't keep an N-1 build on the VPS by default.
Roll back at the git layer:
```bash
git revert <bad-sha>
git push origin main   # triggers a fresh deploy
```
If the bad deploy left the DB in a broken state, run the
**db-rescue** workflow with action `resync-password` first.

### Run an ad-hoc command on the VPS

```bash
gh workflow run vps-exec.yml --ref main \
  -f command='pm2 jlist | jq -r ".[] | .pm2_env.status"' \
  -f timeout_s=30
```
Output mirrored to the `vps-exec-logs` branch (PII-redacted).
**Never** SELECT rows from PII tables (User / TeamMember / Customer
/ Subcontractor) — counts only — since the branch is public.

### See production logs

```bash
gh workflow run vps-exec.yml --ref main \
  -f command='pm2 logs cortexx --nostream --lines 50'
```

### Force a fresh deploy

```bash
gh workflow run deploy-vps.yml --ref main
```

### Recover from password drift (DB rejects deploy auth)

```bash
gh workflow run db-rescue.yml --ref main -f action=resync-password
```

### Debug a stuck migration

```bash
gh workflow run migrate-debug.yml --ref main
```

## Incident triage

1. **App down** → check `/api/health` from outside the VPS first
   (`curl -k https://cortexbuildpro.com/api/health`). If 5xx,
   `gh workflow run vps-exec.yml ... 'pm2 status'`.
2. **DB down** → `db-rescue.yml` with `action=inspect` shows
   connection state. Postgres runs as a docker container — `docker
   ps` to confirm.
3. **All pm2 workers errored** → most common cause is missing env.
   Check pm2 logs first: `pm2 logs cortexx --err --lines 30`.
4. **Cron not running** → `journalctl -u cron --since "1 hour ago"`.
   If `/etc/cron.d/cortexx-cron` is missing, re-run deploy.

## Capacity envelope

- **VPS**: 8 vCPU, 32 GB RAM, 387 GB disk
- **pm2**: 8 workers (one per vCPU), ~220 MB RSS each
- **Postgres**: single-node, no replication
- **Redis**: local only, no persistence beyond AOF rewrite
- **Headroom**: ~28 GB free RAM, ~351 GB free disk at current load

If workers stay above 70% CPU sustained, the next step is moving
Postgres to a managed instance (Hetzner Cloud / Supabase Pro) and
running 2× VPS behind a load balancer.

## Domain ownership / DNS

- Apex + `www`: cortexbuildpro.com (A record points to the VPS IP)
- TLS: Let's Encrypt via `certbot` — auto-renew via system cron
- nginx config: `/etc/nginx/sites-enabled/cortexbuildpro.com`

## Tags + release cadence

- `v1.0.0` — SaaS launch
- `v1.0.1` — post-launch polish (pm2 cluster + Redis + CSP)
- `v1.0.2` — design parity + safety
- `v1.1.0` — legacy-archive port (10 features)

Tagging is manual. Bump CHANGELOG, `git tag -a v1.x.y -m "..."`, push.

## On-call expectations (when there are paying customers)

- Health Monitor failures page the on-call engineer
- backup-verify failures auto-open a P0 issue
- Stripe webhook signature failures should also alert (TODO when
  paid plans go live)
- Target uptime: 99.5% (sufficient for SMB construction tier)
