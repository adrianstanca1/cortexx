# Operational scripts

Scripts in this folder support **local development**, **database seeding**, and **VPS / production** operations.

## VPS (production server)

| Script | When to use |
|--------|-------------|
| [`vps-probe.sh`](./vps-probe.sh) | Read-only diagnostics on the server (OS, ports, PM2, local `/api/health`). |
| [`vps-bootstrap.sh`](./vps-bootstrap.sh) | First-time Ubuntu packages: nginx, Node 22, pnpm, pm2, `postgresql-client`. Optional Docker, Certbot, UFW (see script header). |
| [`vps-install-nginx-site.sh`](./vps-install-nginx-site.sh) | Render [`nginx/bare-metal-site.conf.example`](../nginx/bare-metal-site.conf.example) into `/etc/nginx/sites-available/`, enable the site, `nginx -t` + reload. Run Certbot separately for TLS. |

Full context: [DEPLOY.md](../DEPLOY.md) and [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml).

## Other scripts

See [`../package.json`](../package.json) for `seed:superadmin`, `verify:superadmin`, `qr`, etc.
