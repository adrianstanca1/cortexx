# CortexBuild Field — VPS Deployment Guide

This guide covers two deployment paths for the CortexBuild Field API server and web app:

- **Option A — Docker Compose** (recommended): containerised, reproducible, easy to update
- **Option B — PM2 + Nginx** (bare-metal): lighter, no Docker required

---

## Prerequisites

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| OS | Ubuntu 20.04 LTS | Ubuntu 22.04 LTS |
| RAM | 1 GB | 2 GB |
| CPU | 1 vCPU | 2 vCPU |
| Disk | 10 GB | 20 GB |
| Node.js | 20 LTS | 22 LTS |
| pnpm | 9+ | 9.12+ |

---

## 0. Optional — VPS scripts in this repo

From a clone on the server (or after copying the scripts):

| Script | Purpose |
|--------|---------|
| `bash scripts/vps-probe.sh` | Print OS, Node/pnpm/pm2/nginx/docker versions, listening ports, `pm2 status`, and `curl` to `http://127.0.0.1:3005/api/health`. Safe, read-only. |
| `sudo SKIP_CONFIRM=1 bash scripts/vps-bootstrap.sh` | Install nginx, Node.js 22 (NodeSource), enable pnpm via corepack, global pm2, and `postgresql-client` (for hand-crafted SQL migrations). Idempotent. Optional: `INSTALL_DOCKER=1`, `INSTALL_CERTBOT=1`, `ENABLE_UFW=1` (see script comments). |
| `sudo bash scripts/vps-install-nginx-site.sh <domain> <web_root> [api_port]` | From repo root: render `nginx/bare-metal-site.conf.example` into `/etc/nginx/sites-available/`, enable site, `nginx -t` + reload. Use **after** DNS points at the server; then `sudo certbot --nginx -d <domain>` for TLS. |

CI/CD normally provisions the app via [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml); use these when debugging the box or preparing a fresh VPS manually.

**Deploy workflow URLs:** post-deploy health checks default to `https://field.cortexbuildpro.com` (API) and `https://www.cortexbuildpro.com` (web). Set repository variables `HEALTH_API_BASE` and `HEALTH_WWW_BASE` (no trailing slash) when those differ.

If **www** is served from a document root that deploy does not discover (API updates but `cortexbuild-field-deploy.txt` on www stays on an old commit), set **`VPS_WWW_ROOT`** to that absolute path so the Expo web export is copied there every deploy.

If deploy **passes the API** checks but fails on the **www marker** (`cortexbuild-field-deploy.txt` does not match the merge SHA), typical causes are: (1) nginx `root` for www is not in the auto-discovered list — set `VPS_WWW_ROOT`; (2) a CDN in front of www is serving a cached file — purge cache for `cortexbuild-field-deploy.txt` or add short TTL / bypass rules for that path; (3) `HEALTH_WWW_BASE` points at a hostname that is not updated by this deploy — align it with the site CI publishes to.

---

## 1. Server Preparation

```bash
# Update packages
sudo apt update && sudo apt upgrade -y

# Install Node.js 22 via nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 22 && nvm use 22 && nvm alias default 22

# Install pnpm
npm install -g pnpm

# Install PM2 (Option B only)
npm install -g pm2

# Install Docker + Compose (Option A only)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
```

---

## 2. Clone and Install

```bash
# Clone the repository
git clone https://github.com/adrianstanca1/cortexbuild-field.git
cd cortexbuild-field

# Install dependencies
pnpm install --frozen-lockfile
```

---

## 3. Environment Variables

Create a `.env` file in the project root. **Never commit this file.**

```bash
cp .env.production.template .env
nano .env
```

Required variables:

```ini
# ── Database ─────────────────────────────────────────────────────────────────
# TiDB Serverless connection string (from TiDB Cloud dashboard)
DATABASE_URL=mysql://user:password@gateway01.eu-central-1.prod.aws.tidbcloud.com:4000/cortexbuild?ssl={"rejectUnauthorized":true}

# ── Server ────────────────────────────────────────────────────────────────────
NODE_ENV=production
# API listens on 3005 in production (see ecosystem.config.cjs). Point Nginx at 127.0.0.1:3005.
PORT=3005

# ── Auth / Session ────────────────────────────────────────────────────────────
# 64-char random hex string — run: openssl rand -hex 32
JWT_SECRET=REPLACE_WITH_64_CHAR_HEX_STRING
SESSION_SECRET=REPLACE_WITH_ANOTHER_64_CHAR_HEX_STRING

# ── OAuth (optional — only if using social login) ─────────────────────────────
OAUTH_GOOGLE_CLIENT_ID=
OAUTH_GOOGLE_CLIENT_SECRET=
OAUTH_CALLBACK_URL=https://YOUR_DOMAIN/oauth/callback

# ── Push Notifications (Expo) ─────────────────────────────────────────────────
# Leave blank to use Expo's free tier (no key required for basic push)
EXPO_ACCESS_TOKEN=

# ── Storage (S3-compatible) ───────────────────────────────────────────────────
# Used for file vault, drawing uploads, and PDF exports
STORAGE_ENDPOINT=https://s3.eu-west-2.amazonaws.com
STORAGE_BUCKET=cortexbuild-field
STORAGE_ACCESS_KEY=
STORAGE_SECRET_KEY=
STORAGE_REGION=eu-west-2

# ── Email / SMTP ──────────────────────────────────────────────────────────────
# Used for invite emails and credential expiry alerts
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=YOUR_SENDGRID_API_KEY
SMTP_FROM=noreply@cortexbuild.co.uk

# ── App URL ───────────────────────────────────────────────────────────────────
APP_URL=https://YOUR_DOMAIN
```

---

## 4. Build

```bash
# Build the API server (outputs to ./dist/index.js)
pnpm build

# Build the Expo web app (outputs to ./dist/web)
npx expo export --platform web --output-dir dist/web
```

---

## Option A — Docker Compose Deployment

### 4A.1 SSL Certificates

```bash
# Install Certbot
sudo apt install certbot -y

# Obtain certificate (replace with your domain)
sudo certbot certonly --standalone -d app.cortexbuild.co.uk

# Copy certs to nginx/certs/
sudo cp /etc/letsencrypt/live/app.cortexbuild.co.uk/fullchain.pem nginx/certs/
sudo cp /etc/letsencrypt/live/app.cortexbuild.co.uk/privkey.pem nginx/certs/
sudo chmod 644 nginx/certs/*.pem
```

### 4A.2 Update nginx.conf Domain

Edit `nginx/nginx.conf` and replace `server_name _;` with your domain:

```nginx
server_name app.cortexbuild.co.uk;
```

### 4A.3 Start Services

```bash
docker compose up -d

# View logs
docker compose logs -f

# Check health
curl https://app.cortexbuild.co.uk/api/health
```

### 4A.4 Auto-Renew SSL

```bash
# Add cron job to renew and copy certs
(crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet && cp /etc/letsencrypt/live/app.cortexbuild.co.uk/*.pem /path/to/cortexbuild-field/nginx/certs/ && docker compose -f /path/to/cortexbuild-field/docker-compose.yml exec nginx nginx -s reload") | crontab -
```

---

## Option B — PM2 + Nginx (Bare-Metal)

### 4B.0 Site template (repo)

For a **single host** running PM2 on `127.0.0.1:3005` and static files under e.g. `/var/www/html`, use the checked-in template and installer (avoids copying the Docker-oriented `nginx/nginx.conf` verbatim):

```bash
# From repo root on the VPS (after vps-bootstrap.sh)
sudo bash scripts/vps-install-nginx-site.sh field.example.com /var/www/html
sudo certbot --nginx -d field.example.com
```

Template: [`nginx/bare-metal-site.conf.example`](./nginx/bare-metal-site.conf.example) — proxies `/api/`, `/oauth/`, and `/manus-storage/` to the Node process.

### 4B.1 Install Nginx (if not already)

```bash
sudo apt install nginx -y
```

### 4B.2 Choose a site config

**Recommended — per-site file (matches PM2 on port 3005):**

```bash
sudo bash scripts/vps-install-nginx-site.sh field.example.com /var/www/html
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d field.example.com
sudo nginx -t && sudo systemctl reload nginx
```

**Legacy — replace entire `nginx.conf` (Docker-oriented `upstream api`):**

Only use this if you run the API in Docker Compose on the same host as `nginx/nginx.conf` describes (`upstream api { server api:3000; }`).

```bash
sudo cp nginx/nginx.conf /etc/nginx/nginx.conf
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d app.cortexbuild.co.uk
sudo nginx -t && sudo systemctl reload nginx
```

### 4B.3 Start API with PM2

```bash
# Create logs directory
mkdir -p logs

# Start the API server
pm2 start ecosystem.config.cjs

# Save PM2 process list
pm2 save

# Enable PM2 auto-start on reboot
pm2 startup
# Follow the printed command (e.g. sudo env PATH=... pm2 startup systemd ...)
```

### 4B.4 Verify

```bash
pm2 status
curl http://127.0.0.1:3005/api/health
curl https://app.cortexbuild.co.uk/api/health
```

---

## 5. Apply Database Schema

The app uses TiDB Serverless. Run the schema migration once after deployment:

```bash
# Apply all tables (idempotent — safe to re-run)
node -e "
const mysql = require('mysql2/promise');
require('dotenv/config');
// Schema is applied automatically on first server start via Drizzle
console.log('Run: pnpm db:push to apply schema migrations');
"

pnpm db:push
```

---

## 6. Updating the App

```bash
# Pull latest code
git pull origin main

# Install new dependencies
pnpm install --frozen-lockfile

# Rebuild
pnpm build
npx expo export --platform web --output-dir dist/web

# Restart (Docker)
docker compose up -d --build

# Restart (PM2)
pm2 restart cortexbuild-field
```

---

## 7. Mobile App Distribution

The native iOS/Android app is distributed via Expo EAS Build (not deployed to VPS):

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Configure EAS
eas build:configure

# Build APK (Android)
eas build --platform android --profile production

# Build IPA (iOS — requires Apple Developer account)
eas build --platform ios --profile production
```

Alternatively, use the **Publish** button in the Manus Management UI to trigger an EAS build automatically.

---

## 8. Health Checks and Monitoring

| Endpoint | Expected Response |
|----------|------------------|
| `GET /api/health` | `{"ok":true,"timestamp":...}` |
| `GET /api/trpc/timesheets.list` | tRPC response (requires auth) |

**Recommended monitoring:** Set up [UptimeRobot](https://uptimerobot.com) (free) to ping `/api/health` every 5 minutes and alert on downtime.

---

## 9. Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `ECONNREFUSED` on 3005 | API not started | `pm2 start ecosystem.config.cjs` or `docker compose up -d` |
| `502 Bad Gateway` | API crashed | Check `pm2 logs` or `docker compose logs api` |
| `Database not available` | Wrong `DATABASE_URL` | Verify TiDB credentials and SSL params |
| Push notifications not delivered | Missing `EXPO_ACCESS_TOKEN` | Add token from expo.dev dashboard |
| Credential expiry job not running | Server restarted | Job auto-starts on server boot; check `pm2 logs` |
| SSL cert expired | Certbot not renewing | Run `sudo certbot renew` manually |

---

## 10. Security Checklist

- [ ] `JWT_SECRET` and `SESSION_SECRET` are 64+ character random strings
- [ ] `.env` file is not committed to git (check `.gitignore`)
- [ ] Firewall only exposes ports 80, 443, and 22 (`ufw allow 80,443,22/tcp`)
- [ ] SSH key-based authentication enabled, password auth disabled
- [ ] `DATABASE_URL` uses SSL (`ssl={"rejectUnauthorized":true}`)
- [ ] Nginx `server_name` set to your actual domain
- [ ] Certbot auto-renewal configured
- [ ] PM2 or Docker restart policy configured for auto-recovery

---

## 11. MinIO Storage Provisioning (one-time)

CortexBuild Field uses MinIO as an S3-compatible object store for file uploads. It runs in Docker on the VPS, bound to loopback only.

### 11.1 Disk prep

```bash
sudo mkdir -p /var/lib/minio/data
sudo chown 1000:1000 /var/lib/minio/data
```

### 11.2 Root credentials

```bash
sudo touch /etc/minio.env
sudo chmod 600 /etc/minio.env
sudo nano /etc/minio.env
```

Contents (generate strong passwords):

```ini
MINIO_ROOT_USER=minio-root-32-char-random
MINIO_ROOT_PASSWORD=minio-root-64-char-random
```

### 11.3 Boot MinIO

From the repo root:

```bash
docker compose -f docker-compose.minio.yml up -d
# Wait for healthy
docker compose -f docker-compose.minio.yml ps
```

### 11.4 Create bucket and service account

```bash
# Install mc (MinIO client) if not present
wget https://dl.min.io/client/mc/release/linux-amd64/mc -O /usr/local/bin/mc
chmod +x /usr/local/bin/mc

# Alias
mc alias set local http://127.0.0.1:9000 $(grep MINIO_ROOT_USER /etc/minio.env | cut -d= -f2) $(grep MINIO_ROOT_PASSWORD /etc/minio.env | cut -d= -f2)

# Create bucket
mc mb local/cortexbuild-field

# Create service account for the app
mc admin user svcacct add local $(grep MINIO_ROOT_USER /etc/minio.env | cut -d= -f2) --name field-app
# Record the returned access key + secret key.
```

### 11.5 Wire app environment

Edit `/var/www/cortexbuild-field/.env` (or wherever the production `.env` lives):

```ini
S3_ENDPOINT=http://127.0.0.1:9000
S3_BUCKET=cortexbuild-field
S3_ACCESS_KEY_ID=<service-account-access-key>
S3_SECRET_ACCESS_KEY=<service-account-secret-key>
S3_REGION=us-east-1
S3_FORCE_PATH_STYLE=true
```

```bash
chmod 600 /var/www/cortexbuild-field/.env
```

### 11.6 Restart and smoke test

```bash
pm2 restart cortexbuild-field
# Wait a few seconds for boot
sleep 3

# Health check
curl -s https://field.cortexbuildpro.com/api/health | jq .checks.minio
# Expected: true

# Upload smoke test (using an auth cookie from a real session)
curl -X POST https://field.cortexbuildpro.com/api/trpc/files.upload \
  -H "Content-Type: application/json" \
  -b "session=..." \
  -d '{"json":{"name":"smoke.txt","mimeType":"text/plain","size":5,"data":"aGVsbG8="}}'

# Verify the file is reachable
curl -L https://field.cortexbuildpro.com/manus-storage/<storageKey>
```
