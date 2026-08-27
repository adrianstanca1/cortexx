# CortexBuild Field — Project Guide

This is the **CortexBuild Field** mobile + web app: a React Native/Expo
application with a tRPC API server, Drizzle ORM, and Postgres backend.

## Quick orientation

| Path | What it is |
|------|------------|
| `app/` | Expo Router screens (mobile + web) |
| `server/` | Express + tRPC API server |
| `server/_core/index.ts` | HTTP server entry point (CORS, deploy webhook, OAuth callbacks) |
| `server/db.ts` | Postgres pool setup |
| `drizzle/schema.ts` | Drizzle schema (31+ tables) |
| `drizzle.config.ts` | Drizzle-kit config |
| `ecosystem.config.cjs` | PM2 production config (port 3005) |
| `docker-compose.yml` | Alternative Docker deployment (currently unused on this VPS) |

## Production deployment on this VPS

The app is served by **PM2** (not Docker) and exposed to the internet through a
**Traefik file-provider router**:

- `field.cortexbuildpro.com` → Traefik → `http://127.0.0.1:3005`
- Router config: `/docker/traefik/conf/field.yml`
- PM2 process: `cortexbuild-field`

### Deploy / update

```bash
cd /root/cortexbuild-field
pnpm install
pnpm build
pm2 reload cortexbuild-field --update-env
```

The GitHub Actions workflow in `.github/workflows/deploy.yml` can also SSH in
and run these steps automatically.

### Environment variables

Production env lives in `/root/cortexbuild-field/.env` (gitignored). A template
is at `.env.production.template`. Required values include:

- `DATABASE_URL` — live Postgres DB (host DB on this VPS)
- `OAUTH_SERVER_URL` — Manus OAuth public service; currently
  `https://api.manus.im`
- `ALLOWED_ORIGINS` — comma-separated CORS allowlist; should include
  `https://field.cortexbuildpro.com`
- `DEPLOY_SECRET` — bearer token for `POST /api/deploy` webhook
- `JWT_SECRET` / `JWT_ISSUER` / `JWT_AUDIENCE`
- `S3_*` — file-storage credentials

## Database schema drift — IMPORTANT

The live Postgres database has **camelCase column names** (e.g. `openId`,
`companyId`). The original Drizzle schema expected snake_case. The project now
uses `casing` disabled in `drizzle.config.ts` and camelCase identifiers in
`drizzle/schema.ts` to match the live DB.

### Safe workflow for schema changes

1. Back up first:
   ```bash
   pg_dump -Fc -d "$DATABASE_URL" > /tmp/cortexbuild-field-pre-$(date +%s).dump
   ```
2. Run a dry generation:
   ```bash
   pnpm drizzle-kit generate
   ```
3. **Review the generated SQL** in `drizzle/*.sql` before applying.
4. Apply only when confident:
   ```bash
   pnpm drizzle-kit migrate
   ```

Never run `pnpm db:push` blindly on the production database — it will generate
and execute migrations immediately. On a live customer DB, always review first.

## Deploy webhook

`POST /api/deploy` in `server/_core/index.ts` triggers:

```bash
cd /root/cortexbuild-field && git pull && pnpm install && pnpm build && pm2 reload cortexbuild-field --update-env
```

The request is authenticated with `DEPLOY_SECRET` using a constant-time
comparison. The build runs in a detached background process and the endpoint
returns `202 Accepted` immediately so the HTTP request does not block.

## CORS

`server/_core/index.ts` uses an explicit `ALLOWED_ORIGINS` allowlist. In
production the server refuses credentials for any origin not in the list.
Update `.env` to add new trusted web origins.

## OAuth

The server exchanges authorization codes with the Manus public OAuth service:

```
OAUTH_SERVER_URL=https://api.manus.im
```

The token-exchange path uses the gRPC-style route
`/webdev.v1.WebDevAuthPublicService/ExchangeToken`.

## Health check

```bash
curl https://field.cortexbuildpro.com/api/health
```

Expect `200 OK`.

## Logs

```bash
pm2 logs cortexbuild-field
tail -f /root/cortexbuild-field/logs/api-error.log
```

## Testing / type-check / lint

```bash
pnpm test      # vitest
pnpm check     # tsc --noEmit
pnpm lint      # expo lint
```

## Security reminders

- Keep `.env` gitignored and mode `0600`.
- If `DEPLOY_SECRET` or `JWT_SECRET` is rotated, run
  `pm2 reload cortexbuild-field --update-env`.
- The Caddy/Nginx/Traefik edge should never expose `.env`, `.git/`, `server/*`,
  or `*.ts` source files.
