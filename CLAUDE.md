# CortexBuild Pro — Server Operations Guide

This `/root` workspace is a live multi-app production VPS. It hosts the
CortexBuild Pro platform and several related services behind a shared
Traefik reverse proxy.

## Architecture at a glance

```
Internet → Traefik (host network, :443) → Docker containers / PM2 apps
                    ↓
         File-provider routers in /docker/traefik/conf/*.yml
                    ↓
    Docker apps  |  PM2 apps  |  Host services
    ───────────  |  ────────  |  ─────────────
    cortexx-web  |  cortexbuild-field (:3005)
    cortexx-api  |
    cortexx-admin|
    cortexx-db   |
    n8n          |
```

Traefik runs in host-network mode (`traefik-traefik-1`) and mounts
`/var/run/docker.sock`. It discovers services two ways:

1. **Docker provider** — reads labels on containers in attached networks.
2. **File provider** — watches `/docker/traefik/conf/*.yml` live (no restart
   needed when adding a router).

## Key directories

| Path | Purpose |
|------|---------|
| `/opt/cortexx` | Main Cortexx SaaS (Next.js + Express API stack) |
| `/root/cortexbuild-field` | Field ops mobile/desktop app (Drizzle + Hono/Fastify) |
| `/docker/traefik/conf` | Traefik file-provider routers |
| `/srv/host` | Static/hosted sub-apps (buildtrack, invoicesmart, management, agency, adrianstanca) |
| `/root/.hermes/scripts` | Hermes-managed automation scripts |
| `/var/backups/cortexx` | Hermes pipeline: host Postgres / Docker DB dumps |
| `/opt/cortexx-backups` | Canonical nightly Docker DB dumps + S3 replication |

## Public apps and how they are served

| Domain | Where it lives | How to check |
|--------|----------------|--------------|
| `cortexbuildpro.com` | `cortexx-web-1` (Caddy static + `/api/*` proxy) | `curl https://cortexbuildpro.com/api/health` |
| `field.cortexbuildpro.com` | PM2 `cortexbuild-field` on `127.0.0.1:3005` | `curl https://field.cortexbuildpro.com/api/health` |
| `admin.cortexbuildpro.com` | `cortexx-admin-1` (Next.js on :3000) | `curl https://admin.cortexbuildpro.com` |
| `n8n` workflow domain | `n8n` container on host port `5678` | `docker ps` / `curl http://127.0.0.1:5678` |

To add a new public app, either:

- **Docker container**: add Traefik labels to the compose service, or
- **PM2 / host port**: create a file-provider router in
  `/docker/traefik/conf/<app>.yml` pointing at `http://127.0.0.1:<port>`,
  then `docker exec traefik-traefik-1 traefik reload` is **not required** —
  Traefik watches the directory automatically.

Example file-provider router:

```yaml
http:
  routers:
    myapp:
      rule: "Host(`myapp.cortexbuildpro.com`)"
      entryPoints: [websecure]
      service: myapp
      tls: { certResolver: letsencrypt }
  services:
    myapp:
      loadBalancer:
        servers:
          - url: "http://127.0.0.1:3010"
```

## Common ops commands

```bash
# Cortexx Docker stack
cd /opt/cortexx
docker compose ps
docker compose logs -f api
docker compose up -d --build app

# Field app (PM2)
pm2 list
pm2 logs cortexbuild-field
pm2 reload cortexbuild-field --update-env

# Traefik file provider
cat /docker/traefik/conf/field.yml
ls /docker/traefik/conf

# Databases
docker exec cortexx-db-1 psql -U postgres -d cortexx -c '\dt'
sudo -u postgres psql -h 127.0.0.1 -d cortexx -c '\dt'   # legacy host DB

# Backups
ls -lt /var/backups/cortexx
ls -lt /opt/cortexx-backups
bash /etc/cron.daily/cortexx-backup
bash /root/.hermes/scripts/cortexx_db_backup.sh

# Watchdog
/root/.hermes/scripts/cortexx_watchdog.sh --report
```

## Cron / watchdog map

| File | What it does | Checks / acts on |
|------|--------------|------------------|
| `/etc/cron.d/cortexx-watchdog` | Every 5 min | Runs `cortexx_watchdog.sh` |
| `/etc/cron.d/cortexx-cron` | Daily | POSTs to `/api/cron/*` with `CRON_SECRET` |
| `/etc/cron.daily/cortexx-backup` | Nightly | Dumps Docker DB to `/opt/cortexx-backups`, replicates to S3 |
| `/etc/cron.d/cortexx-replica` | Nightly | Replicates latest Hermes `.dump` to S3/Telegram |

The watchdog script lives at `/root/.hermes/scripts/cortexx_watchdog.sh`.
It checks public edges, Docker container health (with auto-restart), host
Postgres/Redis, disk/memory, and backup freshness. It returns non-zero
when failures are detected.

## Known gotchas

- **Traefik stale Docker socket**: if the Docker daemon restarts,
  `/var/run/docker.sock` inode changes. The bind mount inside the running
  Traefik container can point to a stale socket, causing every Docker-router
  to return `502 Bad Gateway`. Fix: `docker restart traefik-traefik-1`.
- **Cortexx cron uses legacy DB schema**: the `/api/cron/*` Next.js routes in
  `/opt/cortexx` intentionally query the legacy Express DB tables (`invoices`,
  `push_subscriptions`, `users`, `workspaces`) via raw `pg`, not the future
  Prisma model.
- **Field app DB drift**: the field app (`cortexbuild-field`) uses Drizzle
  against a live Postgres DB. Do **not** blindly run `db:push`; review the
  generated migration SQL first because the live DB already has customer
  data.

## Security notes

- Never commit `/root/.env`, `server/.env`, or `/etc/cron.d/*.env` files.
- All sensitive env files on this box are now set to mode `0600`
  (`/root/.agentmemory/.env`, `/opt/cortexx/.env.vault`, rclone, Hermes, etc.).
- Rotate leaked provider tokens using the checklist at
  `/root/.claude/CREDENTIALS_ROTATION_CHECKLIST.md`.
- The Caddyfile in `/opt/cortexx` explicitly blocks `/.env*`, `/.git*`,
  `/server/*`, `*.ts`, etc. from being served to the public internet.

## Currently disabled / awaiting external input

- **S3 off-site replication**: scripts are patched to skip S3 when credentials
  are empty, so nightly backups still run locally and Hermes falls back to
  Telegram. To restore S3, add valid credentials to
  `/root/.config/rclone/aws.env` and re-run
  `/etc/cron.daily/cortexx-backup`.
- **`admin.cortexbuildpro.com` DNS**: no public A record exists yet. The admin
  container is healthy and reachable at `https://admin.srv1262179.hstgr.cloud`.
  To finish the branded URL, add an A record pointing `admin.cortexbuildpro.com`
  to `72.62.132.43` at your DNS provider.
