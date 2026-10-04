# CortexBuild Pro — production deployment

Production is the Next.js 16 standalone application at <https://cortexbuildpro.tech>, running in an isolated Docker Compose stack on the One.com VPS.

| Item | Production value |
|---|---|
| Repository | `https://github.com/adrianstanca1/cortexx` |
| Branch | `main` |
| VPS | `administrator@85.190.100.68` |
| Checkout | `/home/administrator/production/cortexx` |
| Compose file | `docker-compose.construction.yml` |
| Protected environment | `.env.construction` (mode 0600) |
| Loopback app endpoint | `http://127.0.0.1:3020` |
| Public health endpoint | `https://cortexbuildpro.tech/api/health` |

Do not use the retired `/opt/cortexx`, static HTML/Express, nginx, host-Postgres or PM2 deployment instructions. `docker-compose.yml`, `docker-compose.prod.yml`, `deploy.sh` and `deploy/backup.sh` describe historical stacks and are not the production path.

## Normal release path

1. Merge a reviewed PR to `main` only after the complete CI matrix passes.
2. `.github/workflows/deploy-vps.yml` starts after successful CI and pins the exact successful `main` SHA.
3. The workflow updates the protected VPS checkout, builds `Dockerfile.construction`, starts PostgreSQL/Redis/Ollama, applies Prisma migrations, runs the construction bootstrap, starts the Next.js app and waits for the health contract.
4. It installs the reviewed maintenance schedule, validates and reloads the shared Caddy ingress, then checks the public application and health endpoint.

Deployment refuses a dirty production checkout, a superseded SHA, an unverified CI commit, an unhealthy app or an unexpected ingress target. Prefer this workflow to an interactive server deployment because these release guards are part of the production contract.

Required GitHub Actions secrets are `VPS_SSH_PRIVATE_KEY` or `VPS_ROOT_PASSWORD`. Runtime secrets stay only in `/home/administrator/production/cortexx/.env.construction`; never copy their values into workflow inputs, issue text, logs or chat.

## Inspect production

Connect to the VPS and run read-only checks from the production checkout:

```bash
ssh administrator@85.190.100.68
cd /home/administrator/production/cortexx
git status --short --branch
docker compose --env-file .env.construction -f docker-compose.construction.yml ps
docker logs --since 15m cortexbuild-construction-app-1
curl -fsS http://127.0.0.1:3020/api/health
curl -fsS https://cortexbuildpro.tech/api/health
```

The public health payload must satisfy `scripts/check-construction-health.cjs`. Also verify login routing and the release checklist in `docs/RUNBOOK.md`; a green health endpoint alone is not full workflow validation.

## Manual recovery deployment

Use the GitHub deployment workflow whenever it is available. If an authorised operator must recover the stack manually, first confirm that the checkout is clean, the selected SHA is the intended `origin/main` release and that the same SHA has passed CI. Preserve the currently healthy app image before replacement.

The deployment sequence used by automation is:

```bash
cd /home/administrator/production/cortexx
docker compose --env-file .env.construction -f docker-compose.construction.yml build app tools
docker compose --env-file .env.construction -f docker-compose.construction.yml up -d db redis ollama
docker compose --env-file .env.construction -f docker-compose.construction.yml --profile tools run --rm --interactive=false tools
docker compose --env-file .env.construction -f docker-compose.construction.yml --profile tools run --rm --interactive=false tools npx tsx scripts/bootstrap-construction.ts
docker compose --env-file .env.construction -f docker-compose.construction.yml up -d app
curl -fsS http://127.0.0.1:3020/api/health | node scripts/check-construction-health.cjs
```

Do not blindly edit or reload the shared ingress. Follow the guarded ingress and public-verification steps in `.github/workflows/deploy-vps.yml`, or stop and restore service through the documented rollback procedure.

## Backups, rollback and troubleshooting

- Production backups and restore drills are installed with `bash ops/install-construction-backups.sh` and documented in `docs/CONSTRUCTION_RECOVERY.md`.
- Application maintenance schedules are installed with `bash ops/install-construction-app-crons.sh`.
- For an app-only regression, retain the database, restore the previously preserved healthy app image and recreate only the `app` service.
- For a database-affecting incident, restore into an isolated replacement stack and validate it before any traffic switch. Never overwrite the live database as an initial recovery step.
- Use the manual `DB Rescue — One.com construction stack` workflow only for its non-destructive `inspect`, `migrate-status` and `migrate-deploy` actions.

Full operations reference: [`docs/RUNBOOK.md`](docs/RUNBOOK.md). Recovery procedure and current RPO limits: [`docs/CONSTRUCTION_RECOVERY.md`](docs/CONSTRUCTION_RECOVERY.md).
