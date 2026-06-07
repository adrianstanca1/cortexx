#!/bin/sh
# CortexBuild Pro — one-command VPS deploy (100% free, self-hosted)
# ──────────────────────────────────────────────────────────────────
# Usage on a fresh Ubuntu/Debian VPS:
#
#   git clone <your-repo> cortexx && cd cortexx
#   sh deploy-vps.sh cortexbuildpro.com you@email.com
#
# (Pass no domain to deploy on plain HTTP against the server IP.)
# ──────────────────────────────────────────────────────────────────
set -e

DOMAIN="${1:-}"
EMAIL="${2:-admin@example.com}"

echo "════════════════════════════════════════════════════════════"
echo "  CortexBuild Pro — self-hosted deploy"
echo "════════════════════════════════════════════════════════════"

# ── 1. Install Docker if missing ──────────────────────────────────
if ! command -v docker >/dev/null 2>&1; then
	echo "[1/4] Installing Docker…"
	curl -fsSL https://get.docker.com | sh
else
	echo "[1/4] Docker present ✓"
fi

# ── 2. Generate secrets + .env (only once) ────────────────────────
if [ ! -f server/.env ]; then
	echo "[2/4] Generating server/.env with fresh secrets…"
	JWT=$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')
	HOOK=$(head -c 16 /dev/urandom | od -An -tx1 | tr -d ' \n')
	ENC=$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')
	cp server/.env.example server/.env
	# Replace placeholders with real generated secrets
	sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$JWT|"           server/.env 2>/dev/null || true
	sed -i "s|^WEBHOOK_SECRET=.*|WEBHOOK_SECRET=$HOOK|"  server/.env 2>/dev/null || true
	sed -i "s|^BANKING_ENC_KEY=.*|BANKING_ENC_KEY=$ENC|" server/.env 2>/dev/null || true
	sed -i "s|^NODE_ENV=.*|NODE_ENV=production|"         server/.env 2>/dev/null || true
	[ -n "$DOMAIN" ] && sed -i "s|^APP_URL=.*|APP_URL=https://$DOMAIN|" server/.env 2>/dev/null || true
	echo "      Secrets written. (Edit server/.env to add Stripe/VAPID/etc. later.)"
else
	echo "[2/4] server/.env exists — keeping your secrets ✓"
fi

# ── 3. Export the site address for Caddy (auto-HTTPS) ─────────────
if [ -n "$DOMAIN" ]; then
	export SITE_ADDRESS="$DOMAIN"
	echo "[3/4] HTTPS will be issued for $DOMAIN (Let's Encrypt, automatic)"
else
	export SITE_ADDRESS=":80"
	echo "[3/4] No domain given — serving plain HTTP on :80"
fi
# Persist for future `docker compose up` without re-running this script
grep -q '^SITE_ADDRESS=' .env 2>/dev/null || echo "SITE_ADDRESS=$SITE_ADDRESS" >> .env

# ── 4. Build + launch the whole stack ─────────────────────────────
echo "[4/4] Building and starting the stack (db + api + ollama + web)…"
docker compose up -d --build

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  ✓ CortexBuild Pro is live"
echo "════════════════════════════════════════════════════════════"
if [ -n "$DOMAIN" ]; then
	echo "  App:    https://$DOMAIN"
	echo "  API:    https://$DOMAIN/api/health"
else
	IP=$(hostname -I 2>/dev/null | awk '{print $1}')
	echo "  App:    http://$IP/"
	echo "  API:    http://$IP/api/health"
fi
echo ""
echo "  First boot: Ollama pulls llama3.2:3b (~2GB) in the background."
echo "  Check AI readiness:  docker compose logs -f ollama"
echo "  Check everything:    docker compose ps"
echo "════════════════════════════════════════════════════════════"
