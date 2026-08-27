# Host config mirrors

This directory contains **copies** of files that live outside `/root` on the
production VPS. They are mirrored here so the `hermes-agent-os` repo can version
the operational configuration that was modified during the stabilization work.

| Mirror path | Canonical path on server | Purpose |
|-------------|--------------------------|---------|
| `opt/cortexx/lib/legacyDb.ts` | `/opt/cortexx/lib/legacyDb.ts` | Raw `pg` pool for legacy Express schema |
| `opt/cortexx/app/api/cron/*/route.ts` | `/opt/cortexx/app/api/cron/*` | Cron handlers rewritten for legacy DB |
| `opt/cortexx/Caddyfile` | `/opt/cortexx/Caddyfile` | Public reverse-proxy rules |
| `opt/cortexx/docker-compose.yml` | `/opt/cortexx/docker-compose.yml` | Docker stack definition |
| `etc/cron.d/cortexx-cron` | `/etc/cron.d/cortexx-cron` | Daily cron schedule |
| `etc/cron.daily/cortexx-backup` | `/etc/cron.daily/cortexx-backup` | Canonical DB backup script |
| `root/.hermes/scripts/cortexx_db_replicate.sh` | `/root/.hermes/scripts/cortexx_db_replicate.sh` | Hermes replication + Telegram fallback |
| `docker/traefik/conf/*.yml` | `/docker/traefik/conf/*.yml` | Traefik file-provider routers |
| `cortexbuild-field/*.md` | `/root/cortexbuild-field/*.md` | Field app documentation |
| `cortexbuild-field/*.ts`/`*.js`/`*.json`/`*.yml` | `/root/cortexbuild-field/*` | Field app configuration files |

> **Do not edit these mirrors directly.** Edit the canonical file on the
> server, then re-copy the mirror and commit.

Secrets (`.env` files, cron env, rclone credentials) are intentionally **not**
mirrored or committed.
