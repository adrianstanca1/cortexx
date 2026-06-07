# CortexBuild Pro — Ops runbook

Production operations for the self-hosted stack. All free, all on your VPS.

## First deploy

```sh
git clone <your-repo> cortexx && cd cortexx
sh deploy-vps.sh cortexbuildpro.com you@email.com
```

Brings up `db + api + ollama + web` (Postgres, Express, local LLM, Caddy w/ auto-HTTPS).

## Auto-start on reboot (systemd)

So the stack comes back automatically after a VPS reboot or crash:

```sh
sudo cp deploy/cortexx.service /etc/systemd/system/cortexx.service
sudo sed -i "s|/opt/cortexx|$(pwd)|" /etc/systemd/system/cortexx.service
sudo systemctl daemon-reload
sudo systemctl enable --now cortexx
```

Check it:
```sh
systemctl status cortexx
journalctl -u cortexx -f
```

## Nightly backups

Free local `pg_dump`, gzipped, auto-pruned after 14 days.

Install the cron job (runs 03:00 daily):
```sh
(crontab -l 2>/dev/null; echo "0 3 * * * cd $(pwd) && sh deploy/backup.sh >> backups/backup.log 2>&1") | crontab -
```

Run one now:
```sh
sh deploy/backup.sh           # → backups/cortexx-YYYY-MM-DD-HHMM.sql.gz
```

Change retention:
```sh
RETAIN_DAYS=30 sh deploy/backup.sh
```

> Tip: for off-site safety, sync `backups/` to another host with `rsync` or `rclone`
> (free) on a second cron line. The dumps are plain gzipped SQL.

## Restore

```sh
sh deploy/restore.sh backups/cortexx-2026-06-06-0300.sql.gz
```

Prompts for confirmation, drops + recreates the schema, loads the dump, restarts the API.

## Day-to-day

```sh
docker compose ps                  # health of all 4 services
docker compose logs -f api         # API logs
docker compose logs -f ollama      # LLM (watch first-boot model pull)
docker compose restart api         # restart just the API after an env change
docker compose pull && docker compose up -d   # update base images
curl https://YOURDOMAIN/api/health
curl https://YOURDOMAIN/api/llm/health
```

## Update the app

```sh
git pull
docker compose up -d --build       # rebuilds the api image, restarts changed services
```

The `web` (Caddy) service serves the project directory directly, so frontend
changes (`Cortexx.html`, `lib/`, `dist/`) are live on next browser load — no rebuild.

## Swap the AI model

Bigger/smaller model, no code change — edit `server/.env`:
```sh
OLLAMA_MODEL=qwen2.5:7b            # higher quality, needs ~12GB RAM
# or keep llama3.2:3b              # light, runs on 8GB
docker compose restart api ollama
docker compose exec ollama ollama pull qwen2.5:7b
```
