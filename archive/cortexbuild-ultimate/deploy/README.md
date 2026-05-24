# CortexBuild Ultimate - Deployment Scripts

This directory contains production deployment and maintenance scripts.

## Quick Reference

| Script                           | Purpose                           | Usage                              |
| -------------------------------- | --------------------------------- | ---------------------------------- |
| `deploy.sh`                      | Frontend-only deployment          | `./deploy.sh`                      |
| `deploy/vps-sync.sh`             | Full stack deployment             | `./deploy/vps-sync.sh`             |
| `deploy/sync-code.sh`            | Git sync (code only)              | `./deploy/sync-code.sh`            |
| `deploy/recreate-nginx.sh`       | Fix nginx container mounts        | `./deploy/recreate-nginx.sh`       |
| `deploy/setup-production-env.sh` | Generate secure .env files        | `./deploy/setup-production-env.sh` |
| `deploy/health-check.sh`         | Comprehensive health verification | `./deploy/health-check.sh`         |
| `deploy/scripts/full-deploy.sh`  | Orchestrated full deployment      | `./deploy/scripts/full-deploy.sh`  |
| `deploy/scripts/rollback.sh`     | Rollback API/frontend/code        | `./deploy/scripts/rollback.sh`     |

---

## Deployment Workflows

### 1. Full Production Deploy (Recommended)

```bash
# Orchestrated deploy with health checks
cd ~/cortexbuild-ultimate
./deploy/scripts/full-deploy.sh

# Or manual step-by-step:
./deploy/deploy-api.sh      # 1. Deploy API (Docker)
./deploy/deploy-frontend.sh  # 2. Deploy frontend
```

### 2. Code-Only Sync (Fast)

When you've made code changes and want a quick sync without full Docker rebuild:

```bash
cd ~/cortexbuild-ultimate
./deploy/sync-code.sh
```

### 3. Frontend Only

For UI/styling changes only:

```bash
cd ~/cortexbuild-ultimate
./deploy/deploy-frontend.sh
```

### 4. Rollback

```bash
# List available backups
./deploy/scripts/rollback.sh --list

# Rollback API
./deploy/scripts/rollback.sh --api

# Rollback frontend
./deploy/scripts/rollback.sh --frontend

# Rollback code to previous commit
./deploy/scripts/rollback.sh --code HEAD~1
```

---

## Prerequisites

### SSH Key Setup

All scripts use SSH key authentication. Set up once:

```bash
# Generate SSH key (if you don't have one)
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_vps -C 'cortexbuild-deploy'

# Copy to VPS
ssh-copy-id -i ~/.ssh/id_ed25519_vps.pub root@72.62.132.43

# Add to ssh-agent
ssh-add ~/.ssh/id_ed25519_vps
```

### Test Connection

```bash
ssh -i ~/.ssh/id_ed25519_vps root@72.62.132.43
```

---

## Scripts

### deploy-api.sh - API Deployment (VPS Side)

**Purpose:** Builds Docker image and deploys API container on VPS.

**Location on VPS:** `/root/deploy-api.sh`

**Features:**

- Atomic deployment with rollback on failure
- Secret recovery from existing container
- Health contract verification
- Docker network auto-detection
- Backup before deploy
- Webhook notifications

**Usage (on VPS):**

```bash
ssh root@72.62.132.43
bash /root/deploy-api.sh
```

**Environment Variables:**

- `DEPLOY_WEBHOOK_URL` - Slack/Discord webhook for notifications
- `AUTO_ROLLBACK_ON_FAILURE` - Set to `false` to disable auto-rollback

---

### deploy-frontend.sh - Frontend Deployment (VPS Side)

**Purpose:** Builds frontend and syncs to VPS.

**Location on VPS:** `/root/deploy-frontend.sh`

**Features:**

- Pre-build validation (disk, memory)
- Backup before deploy
- CDN cache invalidation
- Nginx reload verification
- Rollback capability

**Usage (on VPS):**

```bash
ssh root@72.62.132.43
bash /root/deploy-frontend.sh
```

---

### sync-code.sh - Git Code Sync

**Purpose:** Sync git commits to VPS without full deployment.

**Use when:** You want to quickly sync code changes and let VPS rebuild.

**What it does:**

1. Compares local and VPS git commits
2. Shows commits that will be synced
3. Creates backup of current code
4. Pushes code via git fetch
5. Reinstalls dependencies if package.json changed
6. Rebuilds frontend
7. Restarts services
8. Runs health checks

**Usage:**

```bash
cd ~/cortexbuild-ultimate
./deploy/sync-code.sh
```

**Duration:** ~2-3 minutes

---

### recreate-nginx.sh - Fix Nginx Mounts

**Purpose:** Recreate nginx container with correct volume bindings.

**Use when:** Nginx is mounting from wrong path (e.g., `/root/cortexbuild-work/` instead of `/var/www/cortexbuild-ultimate/`)

**What it does:**

1. Stops nginx container
2. Removes container
3. Recreates with correct mounts from docker-compose.yml
4. Verifies file access
5. Runs health checks

**Usage:**

```bash
cd ~/cortexbuild-ultimate
./deploy/recreate-nginx.sh
```

---

### setup-production-env.sh - Environment Setup

**Purpose:** Generate secure `.env` files on VPS with random secrets.

**Use when:** Setting up fresh production environment or rotating secrets.

**What it does:**

1. Generates secure random secrets (JWT, session, deploy, DB password)
2. Prompts for configuration values
3. Creates `.env`, `server/.env`, and `.env.docker`
4. Sets secure permissions (600)
5. Restarts services

**Usage:**

```bash
cd ~/cortexbuild-ultimate
./deploy/setup-production-env.sh
```

**Important:** Save the generated secrets securely!

---

### health-check.sh - Comprehensive Health Verification

**Purpose:** Verify all services are healthy.

**Features:**

- Multi-environment checks (Production, Local, VPS)
- SSL/TLS certificate monitoring
- Database connectivity tests
- Docker container health
- Security headers verification
- Performance benchmarks
- JSON output for monitoring systems

**Usage:**

```bash
# Human-readable output
./deploy/health-check.sh

# JSON output (for monitoring)
./deploy/health-check.sh --json

# Verbose output
./deploy/health-check.sh --verbose
```

---

### full-deploy.sh - Orchestrated Deployment

**Purpose:** Coordinates API + Frontend deployment with rollback on failure.

**Options:**

- `--api-only` - Deploy API only
- `--frontend-only` - Deploy frontend only
- `--skip-health` - Skip post-deploy health checks
- `--skip-build` - Skip build step (use existing)

**Usage:**

```bash
./deploy/scripts/full-deploy.sh
./deploy/scripts/full-deploy.sh --api-only
./deploy/scripts/full-deploy.sh --skip-health
```

---

### rollback.sh - Rollback Script

**Purpose:** Rollback API, frontend, or code to previous versions.

**Options:**

- `--api` - Rollback API container
- `--frontend` - Rollback frontend files
- `--code [commit]` - Rollback code to git commit
- `--list` - List available backups

**Usage:**

```bash
./deploy/scripts/rollback.sh --list
./deploy/scripts/rollback.sh --api
./deploy/scripts/rollback.sh --frontend
./deploy/scripts/rollback.sh --code HEAD~1
```

---

## Security Best Practices

### 1. Never Commit Secrets

All `.env*` files are in `.gitignore`. Never commit:

- Database passwords
- JWT secrets
- API keys
- SMTP credentials

### 2. Use SSH Keys

All scripts use SSH key authentication. Never use password auth in scripts.

### 3. Rotate Secrets Regularly

Run `setup-production-env.sh` periodically to rotate secrets.

### 4. Backup Before Deploy

All deployment scripts create backups automatically:

- Code backups: `/var/backups/cortexbuild-code-YYYYMMDD_HHMMSS.tar.gz`
- API container backups: Keep last 5 as Docker images
- Frontend backups: `/var/backups/cortexbuild-frontend/frontend-YYYYMMDD-HHMMSS/`

### 5. Rollback Procedure

If deployment fails:

```bash
# SSH to VPS
ssh -i ~/.ssh/id_ed25519_vps root@72.62.132.43

# List backups
ls -la /var/backups/cortexbuild-*

# Manual rollback (if script fails)
./deploy/scripts/rollback.sh --list
./deploy/scripts/rollback.sh --api
```

---

## Troubleshooting

### SSH Connection Failed

```bash
# Check SSH key is loaded
ssh-add -l

# Add key to agent
ssh-add ~/.ssh/id_ed25519_vps

# Test connection
ssh -i ~/.ssh/id_ed25519_vps root@72.62.132.43
```

### Build Failed

```bash
# Check TypeScript errors
npm run typecheck

# Check linting
npm run lint

# Clean and rebuild
rm -rf node_modules dist
npm install
npm run build
```

### Health Check Failed

```bash
# SSH to VPS
ssh -i ~/.ssh/id_ed25519_vps root@72.62.132.43

# Check container status
docker ps

# View API logs
docker logs cortexbuild-api --tail 50

# View nginx logs
docker logs cortexbuild-nginx --tail 50

# Test API directly
curl http://localhost:3001/api/health
```

### Nginx Not Serving Files

```bash
# Check mounts
docker inspect cortexbuild-nginx --format '{{range .Mounts}}{{.Source}} -> {{.Destination}}{{"\n"}}{{end}}'

# Verify files exist
docker exec cortexbuild-nginx ls -la /var/www/cortexbuild-ultimate/dist/

# Recreate container
./deploy/recreate-nginx.sh
```

---

## Production URLs

| Service    | URL                                       |
| ---------- | ----------------------------------------- |
| Main Site  | https://www.cortexbuildpro.com            |
| API Health | https://www.cortexbuildpro.com/api/health |
| Grafana    | http://72.62.132.43:3002                  |
| Prometheus | http://72.62.132.43:9090                  |
| VPS Direct | http://72.62.132.43                       |

---

## VPS Information

| Item             | Value                           |
| ---------------- | ------------------------------- |
| IP Address       | 72.62.132.43                    |
| SSH User         | root                            |
| SSH Key          | `~/.ssh/id_ed25519_vps`         |
| Deployment Path  | `/var/www/cortexbuild-ultimate` |
| Docker Network   | cortexbuild                     |
| API Container    | cortexbuild-api                 |
| DB Container     | cortexbuild-db                  |
| Redis Container  | cortexbuild-redis               |
| Ollama Container | cortexbuild-ollama              |

---

## Monitoring

### Health Check Cron Setup

```bash
# Add to crontab on LOCAL machine for daily checks
0 6 * * * cd ~/cortexbuild-ultimate && ./deploy/health-check.sh --json >> ~/logs/health-check-$(date +\%Y\%m\%d).log 2>&1

# Or run from VPS crontab
0 6 * * * /var/www/cortexbuild-ultimate/deploy/health-check.sh --json >> /var/log/health-check-daily.log 2>&1
```

### Resource Monitoring

On VPS, monitor resources:

```bash
# Real-time container stats
watch -n 1 'docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"'

# Disk usage
df -h
docker system df

# Memory
free -h
```

---

## Support

For issues or questions:

1. Check logs: `docker logs -f cortexbuild-api`
2. Review runbook: `DEPLOYMENT_RUNBOOK.md`
3. Check architecture: `ARCHITECTURE.md`
4. Run health check: `./deploy/health-check.sh --verbose`
