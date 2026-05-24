#!/usr/bin/env bash
# Idempotent first-time packages for a bare Ubuntu VPS: nginx, Node.js 22,
# pnpm (corepack), pm2, postgresql-client (for migration scripts).
#
# Usage:
#   sudo bash scripts/vps-bootstrap.sh               # from a cloned repo
#
# Non-interactive (e.g. cloud-init):
#   sudo SKIP_CONFIRM=1 bash scripts/vps-bootstrap.sh
#
# Optional extras (set to 1 before invoking):
#   INSTALL_DOCKER=1     — install Docker Engine (get.docker.com); for local PG or compose.
#   INSTALL_CERTBOT=1    — apt install certbot + python3-certbot-nginx (TLS after Nginx site exists).
#   ENABLE_UFW=1         — allow SSH (port ${SSH_PORT:-22}), 80, 443; enable firewall (careful on non-22 SSH).
#
# Requires: Ubuntu 20.04+ (or Debian with apt); sudo unless already root.
set -euo pipefail

if [ "${SKIP_CONFIRM:-}" != "1" ] && [ -t 0 ]; then
  echo "This will apt-install nginx, Node 22 (NodeSource), pm2, postgresql-client."
  echo "Optional: INSTALL_DOCKER=1 INSTALL_CERTBOT=1 ENABLE_UFW=1 (see script header)."
  read -r -p "Continue? [y/N] " reply
  case "${reply}" in y|Y) ;; *) echo "Aborted."; exit 0 ;; esac
fi

if [ "$(id -u)" -eq 0 ]; then
  SUDO=""
else
  if ! sudo -n true 2>/dev/null; then
    echo "sudo access required. Run: sudo bash scripts/vps-bootstrap.sh"
    exit 1
  fi
  SUDO="sudo"
fi

export DEBIAN_FRONTEND=noninteractive
$SUDO apt-get update -qq
$SUDO apt-get install -y -qq ca-certificates curl gnupg nginx

if [ ! -f /etc/apt/sources.list.d/nodesource.list ]; then
  if [ "$(id -u)" -eq 0 ]; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  else
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  fi
fi
$SUDO apt-get install -y -qq nodejs

$SUDO corepack enable
$SUDO corepack prepare pnpm@9.15.9 --activate

$SUDO npm install -g pm2

$SUDO apt-get install -y -qq postgresql-client || true

if [ "${INSTALL_DOCKER:-}" = "1" ]; then
  if ! command -v docker >/dev/null 2>&1; then
    echo "Installing Docker (INSTALL_DOCKER=1)..."
    curl -fsSL https://get.docker.com | $SUDO sh
    $SUDO systemctl enable --now docker || $SUDO service docker start || true
  else
    echo "Docker already installed; skipping."
  fi
fi

if [ "${INSTALL_CERTBOT:-}" = "1" ]; then
  echo "Installing Certbot (INSTALL_CERTBOT=1)..."
  $SUDO apt-get install -y -qq certbot python3-certbot-nginx
fi

if [ "${ENABLE_UFW:-}" = "1" ]; then
  SSH_PORT="${SSH_PORT:-22}"
  echo "Configuring UFW (ENABLE_UFW=1): allow ${SSH_PORT}/tcp, 80, 443..."
  $SUDO ufw default deny incoming
  $SUDO ufw default allow outgoing
  $SUDO ufw allow "${SSH_PORT}/tcp"
  $SUDO ufw allow 80/tcp
  $SUDO ufw allow 443/tcp
  $SUDO ufw --force enable
  $SUDO ufw status verbose
fi

echo
echo "Bootstrap finished."
echo "Next: sudo bash scripts/vps-install-nginx-site.sh <your-domain> <web_root>"
echo "      Or rely on GitHub Actions deploy from .github/workflows/deploy.yml."
echo "      Then: pm2 start ecosystem.config.cjs (or let CI restart PM2)."
