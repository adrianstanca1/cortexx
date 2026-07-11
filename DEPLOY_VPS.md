# Cortexx — VPS Deploy Runbook

End-to-end checklist to get the **frontend + API + Postgres + AI webhooks** live on
a single Linux VPS (tested shape: Hostinger/Ubuntu 22.04, 1 vCPU / 2 GB is enough).

Result: `https://your-domain` serves the app, `https://your-domain/api/*` is the
backend, and inbound **WhatsApp + email** become leads automatically.

---

## 0. Prerequisites

- A VPS with root SSH and a domain's DNS A-record pointed at its IP.
- An `ANTHROPIC_API_KEY` (server-side AI + triage).
- (Optional) Meta WhatsApp Business API access for the WA webhook.

```sh
ssh root@YOUR_VPS_IP
apt update && apt install -y docker.io docker-compose-plugin git nginx certbot python3-certbot-nginx
```

---

## 1. Get the code onto the VPS

Either clone your repo or upload the project folder:

```sh
# option A — git
git clone https://github.com/YOU/cortexx.git /opt/cortexx

# option B — upload from your machine
scp -r ./Cortexx.html ./lib ./portal.html ./server ./docker-compose.yml root@YOUR_VPS_IP:/opt/cortexx
```

---

## 2. Configure environment

```sh
cd /opt/cortexx/server
cp .env.example .env
nano .env
```

Set at minimum:

```ini
DATABASE_URL=postgres://postgres@db:5432/cortexx   # matches docker-compose
JWT_SECRET=<openssl rand -hex 32>
ANTHROPIC_API_KEY=sk-ant-...
APP_URL=https://your-domain
NODE_ENV=production

# AI agents (v1.4)
WEBHOOK_SECRET=<openssl rand -hex 24>              # appears in the webhook URL
WA_VERIFY_TOKEN=<pick-any-string>                  # give the SAME value to Meta
DEFAULT_WORKSPACE_ID=00000000-0000-0000-0000-000000000001   # the seeded demo workspace
```

Generate strong secrets:
```sh
echo "JWT_SECRET=$(openssl rand -hex 32)"
echo "WEBHOOK_SECRET=$(openssl rand -hex 24)"
```

---

## 3. Bring up Postgres + API (Docker)

From the project root (where `docker-compose.yml` lives):

```sh
cd /opt/cortexx
ANTHROPIC_API_KEY=sk-ant-... docker compose up -d --build
```

This:
- starts Postgres, auto-loads `server/db/schema.sql` then `seed.sql`
- builds + starts the API on `localhost:3001`

Smoke-test the API:
```sh
curl -s localhost:3001/api/health
# → {"status":"ok","ts":...,"streams":0}
```

> Compose passes its own env to the `api` service. To use your `server/.env`
> values (WEBHOOK_SECRET etc.) either add them under `api.environment` in
> `docker-compose.yml`, or run the API with `--env-file server/.env`.

---

## 4. Nginx — serve frontend + proxy API + webhooks

```sh
nano /etc/nginx/sites-available/cortexx
```

```nginx
server {
    listen 80;
    server_name your-domain www.your-domain;

    # ── Frontend (static) ──────────────────────────────
    root /opt/cortexx;
    index Cortexx.html;

    # App + portal are plain files
    location = /            { try_files /Cortexx.html =404; }
    location = /portal      { try_files /portal.html =404; }
    location ~* \.(html|js|jsx|css|png|svg|woff2?|json)$ { try_files $uri =404; }

    # Client-portal short links:  /p/<token>  →  portal.html?pt=<token>
    location ~ ^/p/(.+)$ {
        rewrite ^/p/(.+)$ /portal.html?pt=$1 last;
    }

    # ── API proxy ──────────────────────────────────────
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Required for the SSE realtime stream (/api/stream)
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_read_timeout 3600s;
    }
}
```

Enable + reload:
```sh
ln -sf /etc/nginx/sites-available/cortexx /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

---

## 5. HTTPS (Let's Encrypt)

```sh
certbot --nginx -d your-domain -d www.your-domain --non-interactive --agree-tos -m you@your-domain
```

Certbot rewrites the nginx block for port 443 and auto-renews.

---

## 6. Register the webhooks

Your inbound endpoints (note the secret in the path):

```
WhatsApp:  https://your-domain/api/webhooks/<WEBHOOK_SECRET>/whatsapp
Email:     https://your-domain/api/webhooks/<WEBHOOK_SECRET>/email
```

### WhatsApp (Meta Business API)
1. Meta App → WhatsApp → Configuration → **Callback URL** = the WhatsApp URL above.
2. **Verify token** = the `WA_VERIFY_TOKEN` from your `.env`.
3. Meta sends `GET …/whatsapp?hub.verify_token=…&hub.challenge=…`; the server
   echoes the challenge → **Verified**.
4. Subscribe to the **messages** webhook field.

Test it:
```sh
curl "https://your-domain/api/webhooks/<WEBHOOK_SECRET>/whatsapp?hub.verify_token=<WA_VERIFY_TOKEN>&hub.challenge=12345"
# → 12345
```

### Email (Mailgun / SendGrid Inbound Parse / Cloudflare Email Workers)
Point the inbound-parse POST at the Email URL above. The body should include
`from`, `subject`, and `text` (or `body`). Each message is triaged and filed as a
lead in `DEFAULT_WORKSPACE_ID`.

Simulate one:
```sh
curl -X POST https://your-domain/api/webhooks/<WEBHOOK_SECRET>/email \
  -H 'content-type: application/json' \
  -d '{"from":"jane@example.com","subject":"Kitchen extension","text":"Hi, after a quote for an 18sqm rear extension in Hackney, budget ~£40k."}'
# → 200 OK ; a new lead appears in the app once you pull/sync
```

---

## 7. Point the app at the API

Open the app → **Settings → Cloud sync**:
1. API endpoint = `https://your-domain` → **Test** (expects ✓ Reachable).
2. Sign in (magic link or password — demo seed: `demo@cortexbuild.app` / `demo1234`).
3. Toggle **Live sync** on. Inbound webhook leads now stream in via SSE.

---

## 8. Smoke-test checklist

```sh
# API up
curl -s https://your-domain/api/health | grep ok

# Public client portal (seeded token)
curl -s https://your-domain/api/portal/demo-brixton | head -c 200

# WhatsApp verify handshake
curl -s "https://your-domain/api/webhooks/<SECRET>/whatsapp?hub.verify_token=<WA_VERIFY_TOKEN>&hub.challenge=ok123"

# Frontend loads
curl -sI https://your-domain/ | grep 200
```

- [ ] `/api/health` returns `status: ok`
- [ ] App loads over HTTPS, no mixed-content warnings
- [ ] Cloud sync screen shows **Reachable** + signs in
- [ ] `/p/demo-brixton` opens the client portal
- [ ] WhatsApp verify returns the challenge
- [ ] A simulated email/WhatsApp creates a lead

---

## 9. Update / redeploy

```sh
cd /opt/cortexx
git pull                      # or re-scp changed files
docker compose up -d --build  # rebuild API if server/ changed
systemctl reload nginx        # if nginx config changed
```

Frontend changes (anything in `lib/` or `Cortexx.html`) are picked up on the next
browser load — no rebuild needed (the app loads `lib/` via in-browser Babel).

---

## 10. Operations

```sh
docker compose logs -f api          # API logs (triage, webhooks, errors)
docker compose logs -f db           # Postgres
docker compose restart api          # bounce the API
docker compose down                 # stop everything (data persists in the volume)
```

**Backups** — dump the Postgres volume nightly:
```sh
docker compose exec -T db pg_dump -U postgres cortexx | gzip > /opt/backups/cortexx-$(date +%F).sql.gz
```

**Hardening** — `ufw allow 22,80,443/tcp && ufw enable`; keep `5432` closed to the
world (compose only needs it internally — remove the `ports: 5432` mapping in
`docker-compose.yml` for production so Postgres isn't internet-exposed).
