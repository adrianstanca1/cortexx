#!/usr/bin/env bash
# Cortexx — one-shot Hostinger VPS installer for cortexbuildpro.com
# Usage on VPS:  bash deploy.sh
set -euo pipefail

DOMAIN="cortexbuildpro.com"
ROOT="/var/www/cortexx"

echo "▶ Updating packages…"
apt update -qq
apt install -y -qq nginx certbot python3-certbot-nginx ufw rsync

echo "▶ Preparing web root…"
mkdir -p "$ROOT"

# If you ran `scp -r ./cortexx/* root@server:/tmp/cortexx-upload/` first,
# this rsyncs it into place. Otherwise drop the files into $ROOT manually.
if [ -d /tmp/cortexx-upload ]; then
  rsync -a /tmp/cortexx-upload/ "$ROOT/"
  rm -rf /tmp/cortexx-upload
fi

chown -R www-data:www-data "$ROOT"
chmod -R 755 "$ROOT"

echo "▶ Writing nginx site…"
cat > /etc/nginx/sites-available/cortexx <<NGINX
server {
  listen 80;
  listen [::]:80;
  server_name $DOMAIN www.$DOMAIN;
  root $ROOT;
  index index.html Cortexx.html;

  # Security headers
  add_header X-Content-Type-Options "nosniff";
  add_header X-Frame-Options "SAMEORIGIN";
  add_header Referrer-Policy "strict-origin-when-cross-origin";

  # Service worker MUST NOT be cached
  location = /sw.js {
    add_header Cache-Control "no-cache, no-store, must-revalidate";
    expires 0;
  }
  location = /manifest.json {
    add_header Cache-Control "public, max-age=3600";
  }

  # JSX modules — moderate cache (you'll redeploy often)
  location /lib/ {
    expires 5m;
    add_header Cache-Control "public, must-revalidate";
  }

  # Icon/static
  location ~* \.(svg|png|jpg|jpeg|webp|ico|woff2?)$ {
    expires 7d;
    add_header Cache-Control "public, immutable";
  }

  # Spaces in filenames (Cortexx Marketing.html)
  location / {
    try_files \$uri \$uri/ =404;
  }

  # Gzip
  gzip on;
  gzip_types text/html text/css application/javascript application/json image/svg+xml;
  gzip_min_length 1024;
}
NGINX

ln -sf /etc/nginx/sites-available/cortexx /etc/nginx/sites-enabled/cortexx
rm -f /etc/nginx/sites-enabled/default

echo "▶ Testing & reloading nginx…"
nginx -t
systemctl reload nginx

echo "▶ Opening firewall…"
ufw allow 'Nginx Full' || true
ufw allow OpenSSH || true
yes | ufw enable || true

echo "▶ Getting HTTPS certificate (needs DNS pointing $DOMAIN → this server)…"
certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" \
  --non-interactive --agree-tos -m "admin@$DOMAIN" --redirect || \
  echo "⚠ Cert step skipped — make sure DNS A record points to this server, then run: certbot --nginx -d $DOMAIN -d www.$DOMAIN"

echo "▶ Setting up auto-renewal…"
systemctl enable --now certbot.timer

echo ""
echo "✅ Cortexx is live at https://$DOMAIN"
echo "   Marketing: https://$DOMAIN/Cortexx%20Marketing.html"
echo "   App:       https://$DOMAIN/Cortexx.html"
echo ""
echo "🔒 Next: lock down SSH"
echo "   1) Set up SSH keys on your laptop:  ssh-keygen -t ed25519"
echo "   2) Copy to server:                   ssh-copy-id root@$(curl -s ifconfig.me)"
echo "   3) Edit /etc/ssh/sshd_config:        PasswordAuthentication no"
echo "                                         PermitRootLogin prohibit-password"
echo "   4) Reload:                           systemctl reload sshd"
