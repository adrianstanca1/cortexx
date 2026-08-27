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
PORT=3000

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

### 4B.1 Install and Configure Nginx

```bash
sudo apt install nginx -y

# Copy the nginx config
sudo cp nginx/nginx.conf /etc/nginx/nginx.conf

# Obtain SSL cert
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d app.cortexbuild.co.uk

# Test and reload
sudo nginx -t && sudo systemctl reload nginx
```

### 4B.2 Start API with PM2

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

### 4B.3 Verify

```bash
pm2 status
curl http://localhost:3000/api/health
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
pm2 restart cortexbuild-api
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
| `ECONNREFUSED 3000` | API not started | `pm2 start ecosystem.config.cjs` or `docker compose up -d` |
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
