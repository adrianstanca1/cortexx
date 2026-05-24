#!/usr/bin/env bash
# Install Nginx site for PM2 API (127.0.0.1:PORT) + static Expo web root.
#
# Usage:
#   sudo bash scripts/vps-install-nginx-site.sh field.example.com /var/www/html
#   sudo bash scripts/vps-install-nginx-site.sh field.example.com /var/www/html 3005
#
# Requires: nginx installed; run vps-bootstrap.sh first on a fresh VPS.
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root: sudo bash scripts/vps-install-nginx-site.sh <domain> <web_root> [api_port]"
  exit 1
fi

DOMAIN="${1:-}"
WEB_ROOT="${2:-}"
API_PORT="${3:-3005}"
SITE_NAME="cortexbuild-field"
CONF_SRC="$(cd "$(dirname "$0")/.." && pwd)/nginx/bare-metal-site.conf.example"
CONF_DST="/etc/nginx/sites-available/${SITE_NAME}.conf"

if [ -z "$DOMAIN" ] || [ -z "$WEB_ROOT" ]; then
  echo "Usage: sudo bash scripts/vps-install-nginx-site.sh <primary_domain> <web_root> [api_port]"
  echo "Example: sudo bash scripts/vps-install-nginx-site.sh field.cortexbuildpro.com /var/www/html"
  exit 1
fi

if [ ! -f "$CONF_SRC" ]; then
  echo "Missing template: $CONF_SRC"
  exit 1
fi

mkdir -p "$WEB_ROOT"

sed -e "s|@@PRIMARY_DOMAIN@@|${DOMAIN}|g" \
    -e "s|@@WEB_ROOT@@|${WEB_ROOT}|g" \
    -e "s|@@API_PORT@@|${API_PORT}|g" \
    "$CONF_SRC" > "$CONF_DST"

if [ -f /etc/nginx/sites-enabled/default ]; then
  rm -f /etc/nginx/sites-enabled/default
fi

ln -sf "$CONF_DST" "/etc/nginx/sites-enabled/${SITE_NAME}.conf"

nginx -t
systemctl reload nginx

echo "Installed ${CONF_DST} and reloaded nginx."
echo "HTTP:  http://${DOMAIN}/"
echo "Next: sudo certbot --nginx -d ${DOMAIN}   # after DNS points here (adds TLS)"
echo "Or use HTTP-only for testing (not for production)."
