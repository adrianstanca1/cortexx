# CortexBuild Pro — replacement VPS rebuild

The designated server is the One.com Cloud Server at `85.190.122.27` (`cloud-server-10717540`), logging in as `administrator`. The previous Hostinger VPS is retired and is not a deployment, backup, or recovery target.

| Item | Replacement value |
|---|---|
| Repository | `https://github.com/adrianstanca1/cortexx` |
| Branch | `main` |
| Host | `administrator@85.190.122.27` |
| Checkout | `/home/administrator/production/cortexx` |
| Compose file | `docker-compose.construction.yml` |
| Protected environment | `.env.construction` (mode 0600) |
| App loopback endpoint | `http://127.0.0.1:3020` |
| Public health endpoint | `https://cortexbuildpro.tech/api/health` |

## Current deployment state

PR #476 records the replacement Compose stack healthy, including its app, database, cache and browser gateway. This is staging only: the source database/uploads backup has not been transferred or restored there, and `cortexbuildpro.tech` still points to the retired host. Do not treat this as production acceptance or change DNS.

## Rebuild the app on the replacement VPS

The supported rebuild is `.github/workflows/deploy-vps.yml`. It is manual-only and will run only from the current `main` tip when the repository variable `VPS_REBUILD_ENABLED` is set to `true` and the protected GitHub environment `replacement-vps` approves the deployment.

Before enabling it, configure the `replacement-vps` environment with required trusted reviewers and restrict its allowed deployment branches to `main`. Add these as environment secrets only (not repository secrets), using a fresh, key-only deploy identity and the host key verified through the One.com console:

- `REPLACEMENT_VPS_REBUILD_SSH_PRIVATE_KEY`
- `REPLACEMENT_VPS_REBUILD_KNOWN_HOSTS`

Do not reuse a former-host key, trust a runtime `ssh-keyscan`, or paste credentials into chat. Dispatch only after CI passes for the exact `main` SHA. The workflow refuses a dirty server checkout and any Prisma schema/migration change; it preserves the current app and gateway images, rebuilds and restarts those two services only, and checks the local health contract. A failed rebuild restores the previous Compose configuration and image tags and verifies the previous health contract.

The workflow does not restore production data, run migrations or bootstrap, restart the database, or change DNS. For schema or migration changes, restore and validate the reported source backup in isolation first and follow [`docs/RUNBOOK.md`](docs/RUNBOOK.md). Rebuilds are not permission to cut over production traffic.

## Read-only checks on the replacement VPS

```bash
ssh administrator@85.190.122.27
cd /home/administrator/production/cortexx
git status --short --branch
docker compose --env-file .env.construction -f docker-compose.construction.yml ps
curl -fsS http://127.0.0.1:3020/api/health
```

Never print `.env.construction` or owner credentials. The public HTTPS endpoint remains a separate cutover check and must not be used to infer readiness while DNS still points to the retired host.

## Data, backups and cutover

The owner reports that a verified database-and-uploads backup is ready, but it has not been securely transferred or independently restored on the replacement. Complete the isolated restore, data-integrity comparisons, workflow acceptance, fresh backup/restore drill and rollback rehearsal in [`docs/RUNBOOK.md`](docs/RUNBOOK.md) before any maintenance-window cutover. Keep the former production data untouched until the replacement is accepted.
