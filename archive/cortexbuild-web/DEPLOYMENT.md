# CortexBuild AI — VPS Deployment Guide

This guide covers deploying CortexBuild AI on a VPS using Docker, Docker Compose, and Nginx as a reverse proxy with automatic SSL via Let's Encrypt.

---

## Prerequisites

- A VPS running Ubuntu 22.04 LTS (minimum 2 CPU, 4 GB RAM, 40 GB SSD)
- A domain name pointed to your VPS IP address
- Docker and Docker Compose installed
- A Meta Developer account with WhatsApp Business API access
- An S3-compatible storage bucket (AWS S3, Cloudflare R2, Backblaze B2, etc.)

---

## 1. Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# Install Docker Compose plugin
sudo apt install docker-compose-plugin -y

# Verify
docker --version
docker compose version
```

---

## 2. Clone the Repository

```bash
git clone https://github.com/adrianstanca1/cortexbuild-pro.git
cd cortexbuild-pro
```

---

## 3. Configure Environment Variables

Create your `.env` file from the template:

```bash
cp .env.example .env
nano .env
```

Fill in all required values (see the table below).

| Variable | Description | Required |
|---|---|---|
| `DATABASE_URL` | MySQL connection string | Yes |
| `MYSQL_ROOT_PASSWORD` | MySQL root password | Yes |
| `MYSQL_PASSWORD` | MySQL app user password | Yes |
| `JWT_SECRET` | Session signing secret (min 32 chars) | Yes |
| `WHATSAPP_ACCESS_TOKEN` | Meta WhatsApp API access token | Yes |
| `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp phone number ID | Yes |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Webhook verify token | Yes |
| `BUILT_IN_FORGE_API_KEY` | Manus AI API key | Yes |
| `BUILT_IN_FORGE_API_URL` | Manus AI API URL | Yes |
| `S3_BUCKET` | S3 bucket name | Yes |
| `S3_REGION` | S3 region | Yes |
| `S3_ACCESS_KEY_ID` | S3 access key | Yes |
| `S3_SECRET_ACCESS_KEY` | S3 secret key | Yes |
| `S3_ENDPOINT` | S3 endpoint (for non-AWS) | No |

---

## 4. Configure Nginx

Edit the Nginx virtual host config to replace `YOUR_DOMAIN.com` with your actual domain:

```bash
sed -i 's/YOUR_DOMAIN.com/yourdomain.com/g' nginx/conf.d/cortexbuild.conf
```

---

## 5. Obtain SSL Certificate

Start Nginx temporarily for the ACME challenge:

```bash
# Temporarily comment out the SSL server block and start with HTTP only
docker compose up -d nginx

# Obtain certificate
docker compose run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email your@email.com \
  --agree-tos \
  --no-eff-email \
  -d yourdomain.com \
  -d www.yourdomain.com

# Restart with full SSL config
docker compose restart nginx
```

---

## 6. Build and Start the Application

```bash
# Build and start all services
docker compose up -d --build

# Check status
docker compose ps

# View logs
docker compose logs -f app
```

---

## 7. Run Database Migrations

```bash
# Run migrations inside the app container
docker compose exec app node -e "
const { drizzle } = require('drizzle-orm/mysql2');
const mysql = require('mysql2/promise');
// Migrations run automatically on startup via drizzle-kit
console.log('Migrations complete');
"
```

The application automatically applies pending migrations on startup.

---

## 8. Configure WhatsApp Webhook

1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Navigate to your App → WhatsApp → Configuration
3. Set the **Webhook URL** to: `https://yourdomain.com/api/webhook/whatsapp`
4. Set the **Verify Token** to the value of `WHATSAPP_WEBHOOK_VERIFY_TOKEN` in your `.env`
5. Click **Verify and Save**
6. Subscribe to the **messages** webhook field

---

## 9. Verify the Deployment

```bash
# Check the webhook endpoint responds
curl https://yourdomain.com/api/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=cortexbuild_verify_token&hub.challenge=test

# Should return: test

# Check the app is running
curl https://yourdomain.com/api/trpc/auth.me
```

---

## 10. Maintenance

### View logs
```bash
docker compose logs -f app        # Application logs
docker compose logs -f nginx      # Nginx access/error logs
docker compose logs -f mysql      # Database logs
```

### Update the application
```bash
git pull origin main
docker compose up -d --build app
```

### Backup the database
```bash
docker compose exec mysql mysqldump -u root -p${MYSQL_ROOT_PASSWORD} cortexbuild > backup_$(date +%Y%m%d).sql
```

### Restart services
```bash
docker compose restart app
docker compose restart nginx
```

---

## Architecture Overview

```
Internet
    │
    ▼
Nginx (80/443)
    │  SSL termination
    │  Rate limiting
    │  Static file caching
    ▼
Node.js App (3000)
    │  Express + tRPC
    │  WhatsApp webhook
    │  AI agent pipeline
    │  Scheduled reports
    ▼
MySQL (3306)          S3 Storage
    │                     │
    └─── Conversations     └─── Images
    └─── Messages          └─── Reports
    └─── Issues            └─── Documents
    └─── Memory
    └─── Reports
```

---

## Security Checklist

- [ ] `.env` file is not committed to version control
- [ ] MySQL is not exposed externally (no port mapping in docker-compose)
- [ ] Nginx rate limiting is configured
- [ ] SSL certificate is valid and auto-renewing
- [ ] `JWT_SECRET` is at least 32 random characters
- [ ] `WHATSAPP_WEBHOOK_VERIFY_TOKEN` is a unique secret value
- [ ] S3 bucket has appropriate access policies
- [ ] VPS firewall allows only ports 22, 80, 443

---

## Troubleshooting

**App fails to start:** Check `docker compose logs app` for errors. Most common cause is missing environment variables.

**WhatsApp webhook verification fails:** Ensure `WHATSAPP_WEBHOOK_VERIFY_TOKEN` in your `.env` matches the value entered in the Meta dashboard.

**Images not loading:** Verify S3 credentials and bucket permissions. The bucket should allow public read access for stored media URLs.

**Database connection error:** Ensure `DATABASE_URL` uses the Docker service name `mysql` as the host (not `localhost`).
