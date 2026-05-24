#!/bin/bash
set -e
cd /root/cortexbuild-web
pnpm run build
rsync -av --delete dist/public/ /var/www/cortexbuild-web/
systemctl reload nginx
echo "Frontend deployed successfully!"
