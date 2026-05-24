#!/bin/bash
set -e
echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║        CortexBuild Ultimate — VPS Installer          ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

SERVER_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ROOT_DIR="$(cd "$SERVER_DIR/.." && pwd)"
ENV_FILE="$SERVER_DIR/.env"

# ── 1. Install PostgreSQL if needed ─────────────────────────
if ! command -v psql &>/dev/null; then
  echo "📦 Installing PostgreSQL 16..."
  apt-get update -qq
  apt-get install -y postgresql postgresql-contrib
  systemctl enable postgresql
  systemctl start postgresql
  echo "✅ PostgreSQL installed"
else
  echo "✅ PostgreSQL already installed ($(psql --version | head -1))"
fi

# ── 2. Create .env if not present ────────────────────────────
if [ ! -f "$ENV_FILE" ]; then
  cp "$SERVER_DIR/.env.example" "$ENV_FILE"
  # Generate a random JWT secret
  JWT_SECRET=$(openssl rand -hex 32)
  sed -i "s/cortexbuild_jwt_secret_change_this_in_production/$JWT_SECRET/" "$ENV_FILE"
  echo "✅ Created .env with random JWT secret"
else
  echo "✅ .env already exists"
fi

# ── 3. Load env vars ─────────────────────────────────────────
source "$ENV_FILE"
DB_NAME="${DB_NAME:-cortexbuild}"
DB_USER="${DB_USER:-cortexbuild}"
DB_PASSWORD="${DB_PASSWORD:-CortexBuild2024!}"

# ── 4. Create DB user and database ───────────────────────────
echo "🗄  Setting up PostgreSQL database..."
sudo -u postgres psql <<EOF
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$DB_USER') THEN
    CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';
  END IF;
END
\$\$;
SELECT 'CREATE DATABASE $DB_NAME OWNER $DB_USER'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$DB_NAME')
\gexec
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
EOF
echo "✅ Database '$DB_NAME' ready"

# ── 5. Run setup.sql ─────────────────────────────────────────
echo "🔧 Creating tables..."
PGPASSWORD="$DB_PASSWORD" psql -h localhost -U "$DB_USER" -d "$DB_NAME" -f "$SERVER_DIR/scripts/setup.sql"
echo "✅ Tables created"

# ── 6. Run seed.sql ──────────────────────────────────────────
echo "🌱 Seeding data..."
PGPASSWORD="$DB_PASSWORD" psql -h localhost -U "$DB_USER" -d "$DB_NAME" -f "$SERVER_DIR/scripts/seed.sql"
echo "✅ Data seeded"

# ── 7. Install Node dependencies ─────────────────────────────
echo "📦 Installing server dependencies..."
cd "$SERVER_DIR"
npm install --production
echo "✅ Dependencies installed"

# ── 8. Install PM2 globally ───────────────────────────────────
if ! command -v pm2 &>/dev/null; then
  echo "📦 Installing PM2..."
  npm install -g pm2
fi
echo "✅ PM2 available"

# ── 9. Start/restart server with PM2 ─────────────────────────
pm2 stop cortexbuild-api 2>/dev/null || true
pm2 start "$SERVER_DIR/index.js" --name cortexbuild-api --env production
pm2 save
pm2 startup | tail -1 | bash || true
echo "✅ API server started on port ${PORT:-3001}"

# ── 10. Build frontend ────────────────────────────────────────
echo "🔨 Building React frontend..."
cd "$ROOT_DIR"
npm install
npm run build
echo "✅ Frontend built to dist/"

# ── 11. Configure nginx ───────────────────────────────────────
NGINX_CONF="/etc/nginx/sites-available/cortexbuild"
cat > "$NGINX_CONF" <<'NGINXEOF'
# Host nginx in front of PM2 / Node on :3001 — timeouts avoid 504 on slow AI/DB routes.
server {
    listen 80;
    server_name _;

    client_max_body_size 100M;

    root /var/www/cortexbuild-ultimate/dist;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 75s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    location /ws {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 7d;
        proxy_send_timeout 7d;
    }

    location /uploads/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
NGINXEOF

ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/cortexbuild
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
echo "✅ nginx configured"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║              Installation Complete! 🎉               ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║  App:  http://$(hostname -I | awk '{print $1}')      "
echo "║  API:  http://localhost:3001/api/health              ║"
echo "║                                                      ║"
echo "║  Login credentials:                                  ║"
echo "║  Email: adrian@cortexbuild.co.uk                     ║"
echo "║  Pass:  CortexBuild2024!                             ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
