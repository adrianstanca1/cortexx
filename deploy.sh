#!/usr/bin/env bash
# Cortexx — one-shot VPS deploy for cortexbuildpro.com
# Run AS ROOT on the VPS (72.62.132.43), from the project root (/opt/cortexx).
#
#   ssh root@72.62.132.43
#   cd /opt/cortexx           # after you've put the code here (see step 1 below)
#   bash deploy.sh
#
# Idempotent: safe to re-run after `git pull` to redeploy.
set -euo pipefail

DOMAIN="cortexbuildpro.com"
WWW="www.cortexbuildpro.com"
EMAIL="Adrian.stanca1@gmail.com"
APP_DIR="/opt/cortexx"
SERVER_ENV="$APP_DIR/server/.env"

echo "▶ Cortexx deploy → $DOMAIN"
cd "$APP_DIR"

# ── 1. System deps ──────────────────────────────────────────
echo "▶ Installing system packages…"
apt-get update -y
apt-get install -y docker.io docker-compose-plugin nginx certbot python3-certbot-nginx openssl
systemctl enable --now docker

# ── 2. server/.env (created once, then preserved) ──────────
if [ ! -f "$SERVER_ENV" ]; then
  echo "▶ Creating server/.env with fresh secrets…"
  cp "$APP_DIR/server/.env.example" "$SERVER_ENV"
  JWT=$(openssl rand -hex 32)
  HOOK=$(openssl rand -hex 24)
  WAVERIFY=$(openssl rand -hex 16)
  sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$JWT|"                       "$SERVER_ENV"
  sed -i "s|^WEBHOOK_SECRET=.*|WEBHOOK_SECRET=$HOOK|"             "$SERVER_ENV"
  sed -i "s|^WA_VERIFY_TOKEN=.*|WA_VERIFY_TOKEN=$WAVERIFY|"       "$SERVER_ENV"
  sed -i "s|^APP_URL=.*|APP_URL=https://$DOMAIN|"                 "$SERVER_ENV"
  sed -i "s|^NODE_ENV=.*|NODE_ENV=production|"                    "$SERVER_ENV"
  sed -i "s|^DATABASE_URL=.*|DATABASE_URL=postgres://postgres@db:5432/cortexx|" "$SERVER_ENV"
  echo "  ⚠  EDIT $SERVER_ENV and set ANTHROPIC_API_KEY before AI features work."
else
  echo "▶ Keeping existing server/.env"
fi

# ── 3. Postgres + API via Docker ───────────────────────────
echo "▶ Building & starting containers…"
docker compose up -d --build
echo "▶ Waiting for API health…"
for i in $(seq 1 30); do
  if curl -fs localhost:3001/api/health >/dev/null 2>&1; then echo "  ✓ API healthy"; break; fi
  sleep 2
  [ "$i" = "30" ] && { echo "  ✗ API did not become healthy — check: docker compose logs api"; exit 1; }
done

# ── 4. nginx ───────────────────────────────────────────────
echo "▶ Writing nginx site…"
cat > /etc/nginx/sites-available/cortexx <<NGINX
server {
    listen 80;
    server_name $DOMAIN $WWW;
    root $APP_DIR;
    index Cortexx.html;

    location = /        { try_files /Cortexx.html =404; }
    location = /portal  { try_files /portal.html =404; }
    location ~* \.(html|js|jsx|css|png|svg|woff2?|json)\$ { try_files \$uri =404; }
    location ~ ^/p/(.+)\$ { rewrite ^/p/(.+)\$ /portal.html?pt=\$1 last; }

    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_read_timeout 3600s;
    }
}
NGINX
ln -sf /etc/nginx/sites-available/cortexx /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
echo "  ✓ nginx live on :80"

# ── 5. HTTPS ───────────────────────────────────────────────
echo "▶ Requesting/renewing TLS cert…"
certbot --nginx -d "$DOMAIN" -d "$WWW" --non-interactive --agree-tos -m "$EMAIL" --redirect || \
  echo "  ⚠ certbot failed (DNS not pointed yet?) — re-run once $DOMAIN → 72.62.132.43 resolves."

# ── 6. Firewall ────────────────────────────────────────────
if command -v ufw >/dev/null 2>&1; then
  ufw allow 22,80,443/tcp >/dev/null 2>&1 || true
fi

# ── 7. Report ──────────────────────────────────────────────
HOOK=$(grep '^WEBHOOK_SECRET=' "$SERVER_ENV" | cut -d= -f2)
WAVERIFY=$(grep '^WA_VERIFY_TOKEN=' "$SERVER_ENV" | cut -d= -f2)
cat <<DONE

────────────────────────────────────────────────────────────
✓ Cortexx deployed → https://$DOMAIN

Webhook URLs to register:
  WhatsApp callback : https://$DOMAIN/api/webhooks/$HOOK/whatsapp
  WhatsApp verify   : $WAVERIFY
  Email inbound     : https://$DOMAIN/api/webhooks/$HOOK/email

Smoke test:
  curl -s https://$DOMAIN/api/health
  curl -s https://$DOMAIN/api/portal/demo-brixton | head -c 120
  curl "https://$DOMAIN/api/webhooks/$HOOK/whatsapp?hub.verify_token=$WAVERIFY&hub.challenge=ok123"

App demo login: demo@cortexbuild.app / demo1234
Next: edit $SERVER_ENV → set ANTHROPIC_API_KEY, then: docker compose up -d
────────────────────────────────────────────────────────────
DONE
