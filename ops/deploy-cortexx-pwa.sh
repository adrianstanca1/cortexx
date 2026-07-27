#!/bin/bash
# Deploy Cortexx PWA to VPS
# Run this on your VPS as: bash deploy-cortexx.sh

set -e

REPO="https://github.com/adrianstanca1/cortexx.git"
APP_DIR="/opt/cortexx-pwa"
DOMAIN="app.cortexbuildpro.com"
PORT=3011

echo "🚀 Deploying Cortexx PWA to $DOMAIN..."

# 1. Clone/pull repo
if [ ! -d "$APP_DIR" ]; then
  echo "📦 Cloning repo..."
  git clone $REPO $APP_DIR
else
  echo "📦 Updating repo..."
  cd $APP_DIR
  git fetch origin
  git reset --hard origin/main
fi

cd $APP_DIR

# 2. Copy PWA files to web root
WEB_ROOT="/var/www/cortexx-pwa"
mkdir -p $WEB_ROOT

echo "📄 Copying PWA files..."
cp Cortexx.html $WEB_ROOT/index.html
cp -r dist $WEB_ROOT/
cp -r lib $WEB_ROOT/ 2>/dev/null || true
cp manifest.json $WEB_ROOT/ 2>/dev/null || true
cp -r public $WEB_ROOT/ 2>/dev/null || true

# 3. Set permissions
chown -R www-data:www-data $WEB_ROOT
chmod -R 755 $WEB_ROOT

# 4. Update nginx config
echo "⚙️  Configuring nginx..."
cat > /etc/nginx/sites-available/cortexx-pwa << EOF
server {
    listen 80;
    server_name $DOMAIN;
    root $WEB_ROOT;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript;
    gzip_min_length 1000;

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Service worker — no cache
    location = /sw.js {
        expires -1;
        add_header Cache-Control "public, max-age=0, must-revalidate";
    }

    # HTML — network-first via SW
    location / {
        try_files \$uri /index.html;
        expires -1;
        add_header Cache-Control "public, max-age=0, must-revalidate";
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
}
EOF

# 5. Enable site and test config
ln -sf /etc/nginx/sites-available/cortexx-pwa /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx

# 6. SSL (Let's Encrypt)
if ! [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
  echo "🔒 Setting up SSL..."
  certbot certonly --webroot -w $WEB_ROOT -d $DOMAIN --agree-tos -m admin@cortexbuildpro.com --non-interactive
  
  # Update nginx for HTTPS
  sed -i "s/listen 80;/listen 443 ssl http2;\n    listen 80;\n    server_name $DOMAIN;\n\n    # Redirect HTTP to HTTPS\n    if (\$scheme != \"https\") {\n        return 301 https:\/\/\$server_name\$request_uri;\n    }\n\n    ssl_certificate \/etc\/letsencrypt\/live\/$DOMAIN\/fullchain.pem;\n    ssl_certificate_key \/etc\/letsencrypt\/live\/$DOMAIN\/privkey.pem;/" /etc/nginx/sites-available/cortexx-pwa
  nginx -t
  systemctl reload nginx
fi

echo "✅ Deployment complete!"
echo "🌐 Visit: https://$DOMAIN"
echo ""
echo "📊 Check logs:"
echo "  tail -f /var/log/nginx/access.log | grep cortexx"
echo ""
echo "🔄 Auto-update (add to crontab):"
echo "  0 3 * * * cd $APP_DIR && git pull && bash deploy-cortexx.sh"
