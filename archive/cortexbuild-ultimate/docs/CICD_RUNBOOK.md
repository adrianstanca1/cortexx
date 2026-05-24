# CI/CD & Deployment Runbook

**Last Updated:** 2026-04-24  
**Version:** 3.0.0

---

## Architecture Overview

```
Developer → Git Push → GitHub Actions → VPS (72.62.132.43)
                                              ↓
                         Host nginx :443/:80 → /api, /ws, /uploads → 127.0.0.1:3001 (API container)
                         Static SPA → /var/www/.../dist (or equivalent)
                                              ↓
                         Docker (typical): cortexbuild-api, cortexbuild-db, cortexbuild-redis,
                         cortexbuild-ollama, cortexbuild-prometheus, cortexbuild-grafana
                         (no nginx container — see docker-compose.yml note)
```

---

## Development Workflow

### 1. Commit Conventions

All commits MUST follow Conventional Commits format:

```
type(scope): description
```

| Type       | When to Use        | Example                                     |
| ---------- | ------------------ | ------------------------------------------- |
| `feat`     | New feature        | `feat(api): add bulk export endpoint`       |
| `fix`      | Bug fix            | `fix(auth): resolve JWT token expiration`   |
| `docs`     | Documentation      | `docs(session): record deployment status`   |
| `chore`    | Maintenance        | `chore(deps): upgrade react to 19.2`        |
| `refactor` | Code restructuring | `refactor(modules): extract sub-components` |
| `test`     | Tests              | `test(api): add rate limiter unit tests`    |
| `ci`       | CI/CD changes      | `ci(github): add deployment workflow`       |
| `perf`     | Performance        | `perf(build): enable code splitting`        |
| `build`    | Build system       | `build(vite): upgrade to 8.0`               |
| `revert`   | Revert commit      | `revert: "feat(api): add export endpoint"`  |

**Rules:**

- Type must be lowercase
- Scope is optional, in parentheses
- Description must start with lowercase letter
- No trailing period

### 2. Branch Strategy

```
main (production-ready)
├── feature/* (new features)
├── fix/* (bug fixes)
└── release/* (version bumps)
```

- All work branches from `main`
- Merge via squash to keep history clean
- Never commit directly to `main` from local — use PR

---

## Deployment Process

### Option A: Manual deploy scripts

Use repo scripts (there is no tracked root `deploy.sh`):

- `deploy/deploy-frontend.sh` — pull, build, permissions for `dist/`
- `deploy/deploy-api.sh` — image build, container replace, health checks
- `deploy/vps-sync.sh` — rsync + compose; set `VPS_PATH` to match the server (`/var/www/cortexbuild-ultimate` vs `/root/cortexbuild-ultimate`)

### Option B: GitHub Actions (primary)

Workflow: `.github/workflows/deploy.yml` — **Test & Build** then **Deploy to VPS** on push to `main` (or `workflow_dispatch`).

### HTTPS canary (no SSH)

Workflow: `.github/workflows/vps-https-canary.yml` — runs on a schedule (every 6 hours) and on **workflow_dispatch**. It only `curl`s `https://www.cortexbuildpro.com/api/health` and the apex domain, asserting the same JSON contract as CI. Use it to confirm the site stays up when **Deploy to VPS** fails with `dial tcp …:22: i/o timeout` (VPS firewall, provider network, or SSH not reachable from GitHub).

### Local sync (`deploy/vps-sync.sh`) and SSH agent

If Actions cannot SSH in, sync from a trusted machine that can reach the VPS:

1. Load your deploy key: `eval "$(ssh-agent -s)"` then `ssh-add ~/.ssh/id_ed25519_vps` (or `~/.ssh/gh_actions_ed25519` if that is what the server trusts).
2. Run `bash deploy/vps-sync.sh` (optional: `VPS_HOST` / `VPS_PATH` if your layout differs from defaults in the script).

Docker on the VPS should use **`--restart always`** for `cortexbuild-api` and Ollama (the embedded deploy script already sets this for the API).

---

## VPS Management

### SSH Access

```bash
ssh root@72.62.132.43
cd /var/www/cortexbuild-ultimate   # or: cd /root/cortexbuild-ultimate — match where the repo lives
```

### Common Commands

```bash
# Check all containers
docker ps --filter 'name=cortexbuild' --format '{{.Names}}: {{.Status}}'

# Restart API
docker restart cortexbuild-api

# View API logs
docker logs -f cortexbuild-api

# Rebuild API image
docker build -t cortexbuild-ultimate-api:latest -f Dockerfile.api .

# Restart with new image
docker stop cortexbuild-api && docker rm cortexbuild-api
REDIS_IP=$(docker inspect cortexbuild-redis --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}')
docker run -d --name cortexbuild-api \
  --network host \
  -v /var/www/cortexbuild-ultimate/server/uploads:/app/uploads \
  -e REDIS_HOST=127.0.0.1 \
  --env-file /var/www/cortexbuild-ultimate/.env \
  --restart unless-stopped \
  cortexbuild-ultimate-api:latest
# Match your real layout: bridge network uses `-p 127.0.0.1:3001:3001` + DB_HOST=postgres, etc.

# Pull latest code
git pull origin main

# Check nginx
nginx -t && nginx -s reload

# Check SSL certs
ls -la /etc/letsencrypt/live/cortexbuildpro.com/

# Renew SSL
certbot renew --force-renewal
```

---

## Environment Configuration

### VPS `.env` File

Typically `/var/www/cortexbuild-ultimate/.env` (or under `$VPS_PATH`).

**If the API runs via `docker compose` (bridge network)** — use Docker DNS names from `docker-compose.yml`:

```bash
DB_HOST=postgres
REDIS_HOST=redis
REDIS_URL=redis://redis:6379
CORS_ORIGIN=https://www.cortexbuildpro.com,https://cortexbuildpro.com
FRONTEND_URL=https://www.cortexbuildpro.com
JWT_SECRET=<32+ chars>
SESSION_SECRET=<32+ chars>
```

**If the API uses `--network host`** (common in `.github/workflows/deploy.yml`) — use loopback for DB/Redis published on the host:

```bash
DB_HOST=127.0.0.1
REDIS_HOST=127.0.0.1
# REDIS_URL optional; server builds redis://REDIS_HOST:6379 when unset
CORS_ORIGIN=https://www.cortexbuildpro.com,https://cortexbuildpro.com
```

**Critical:** `CORS_ORIGIN` must include every browser origin that calls the API (exact scheme + host + port). In **production** the server **exits** if `CORS_ORIGIN` is empty.

### Local Development `.env.local`

```bash
VITE_API_BASE_URL=http://localhost:3001
# Optional: WebSocket not same-origin as Vite (default is same host as the page)
# VITE_WS_URL=ws://localhost:3001
```

---

## CI/CD Troubleshooting

### ESLint Failures

**Problem:** CI fails on lint errors

**Fix:** The lint step is configured to fail on errors only, not warnings:

```yaml
# In .github/workflows/deploy.yml (Test & Build job)
- run: npx eslint src --ext .ts,.tsx --quiet
```

If new warnings are introduced, they won't block deploy. To make warnings block:

1. Change ESLint config `warn` to `error`
2. Update workflow

### Build Failures

**Common causes:**

1. TypeScript errors — run `npx tsc --noEmit` locally first
2. Missing dependencies — check `package.json` and `server/package.json`
3. Node version mismatch — VPS uses Node 22, local should match

**Fix:**

```bash
# Clear cache and reinstall
rm -rf node_modules server/node_modules
npm install
cd server && npm install && cd ..
npm run build
```

### Deploy Failures

**SSH Connection Issues:**

- Verify SSH key is added to GitHub Secrets as `VPS_SSH_KEY`
- VPS IP in workflow: `72.62.132.43`
- SSH user: `root`

**Permission Issues:**

- Host nginx often runs as `www-data` or `nginx`; ensure `dist/` is readable
- If 502 errors after deploy, check nginx `proxy_pass` targets **`127.0.0.1:3001`** and that the API container is listening

**API Not Starting:**

```bash
# Check container status
docker ps -a | grep cortexbuild-api

# Check logs
docker logs cortexbuild-api --tail 50

# Common fix: rebuild image
docker build -t cortexbuild-ultimate-api:latest -f Dockerfile.api .
docker stop cortexbuild-api && docker rm cortexbuild-api
# Then run new container (see VPS Management above)
```

---

## SSL Certificate Management

### Current Setup

- **Provider:** Let's Encrypt via Certbot
- **Domains:** `cortexbuildpro.com`, `www.cortexbuildpro.com`
- **Auto-renewal:** Enabled (certbot cron)
- **Location:** `/etc/letsencrypt/live/cortexbuildpro.com/`

### Manual Rotation

If SSL key is compromised (e.g., committed to git):

```bash
# On VPS
certbot renew --force-renewal
nginx -s reload
```

### Verification

```bash
curl -sI https://cortexbuildpro.com | head -5
curl -sI https://www.cortexbuildpro.com | head -5
```

Both should return `HTTP/2 200`.

---

## Monitoring

### Health Checks

```bash
# API health
curl http://localhost:3001/api/health

# Frontend health
curl -I http://localhost:80

# Database health
docker exec cortexbuild-db pg_isready -U cortexbuild

# Redis health
docker exec cortexbuild-redis redis-cli ping
```

### Grafana Dashboards

- **URL:** http://72.62.132.43:3002
- **Credentials:** Admin / (set in `.env` as `GF_SECURITY_ADMIN_PASSWORD`)
- **Data Source:** Prometheus (auto-configured)

### Prometheus Targets

- **URL:** http://72.62.132.43:9090/targets
- Config file: `monitoring/prometheus.yml`

---

## Rollback Procedure

If a deploy breaks production:

```bash
# On VPS
cd /var/www/cortexbuild-ultimate

# Revert to previous commit
git reset --hard <previous-commit-hash>

# Rebuild API if backend changed
docker build -t cortexbuild-ultimate-api:latest -f Dockerfile.api .
docker restart cortexbuild-api

# Sync previous frontend
# (If dist/ was synced, re-rsync from previous commit)
git checkout <previous-commit-hash> -- dist/
rsync -avz --delete dist/ root@72.62.132.43:/var/www/cortexbuild-ultimate/dist/
```

---

## Known Gotchas

1. **Redis / DB hostnames** — `postgres` / `redis` work inside compose networks; **`127.0.0.1`** when the API uses **`--network host`** and DB/Redis publish on the host.
2. **Compose vs ad-hoc** — `deploy/deploy-api.sh` and CI may use **compose for postgres/redis** and **`docker run` for the API**; align `.env` with the network you actually use.
3. **`dist/` deploy** — rsync with `--delete` avoids stale assets; bump cache-bust if users see old UI.
4. **Node 22** — Match CI / VPS for builds.
5. **Postgres role** — Application user is **`cortexbuild`**, not `postgres`.
6. **Nginx** — Reference configs live in **`nginx/`** in this repo; production may merge into **`/etc/nginx/sites-enabled/`**. Scripts that run `docker-compose up -d nginx` are **out of date** unless an `nginx` service exists in compose.
7. **Token blacklist + Redis** — In production, if Redis errors during a blacklist **check**, revoked tokens are treated as still revoked (**fail closed**). Set **`TOKEN_BLACKLIST_FAIL_OPEN=true`** only if you accept fail-open during outages.

---

## Contact

- **Repository:** https://github.com/adrianstanca1/cortexbuild-ultimate
- **Production:** https://www.cortexbuildpro.com
- **VPS:** 72.62.132.43 (Hostinger)
- **Domain:** cortexbuildpro.com (DNS: Hostinger)
