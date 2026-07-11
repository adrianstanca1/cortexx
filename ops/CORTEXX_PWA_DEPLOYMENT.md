# VPS Deployment Guide — Cortexx PWA

## Setup (first-time)

### 1. SSH into your VPS
```bash
ssh root@your-vps-ip
```

### 2. Create web root
```bash
mkdir -p /var/www/cortexx-pwa
```

### 3. Run deployment script
```bash
cd /tmp
curl -O https://raw.githubusercontent.com/adrianstanca1/cortexx/main/ops/deploy-cortexx-pwa.sh
bash deploy-cortexx-pwa.sh
```

This will:
- ✅ Clone the repo
- ✅ Copy PWA files to `/var/www/cortexx-pwa`
- ✅ Configure nginx with gzip + caching + security headers
- ✅ Install SSL certificate (Let's Encrypt)
- ✅ Enable HTTPS redirect

### 4. Verify
```bash
curl -I https://app.cortexbuildpro.com
# Should return 200 OK
```

## DNS Setup

Add an A record to your domain DNS:

```
Host: app
Type: A
Value: <your-vps-ip>
TTL: 3600
```

Wait 5-10 minutes for DNS to propagate.

## Auto-updates

Add to crontab to auto-deploy on every GitHub push:

```bash
crontab -e

# Add this line:
0 3 * * * cd /opt/cortexx-pwa && git pull origin main && bash /opt/cortexx-pwa/ops/deploy-cortexx-pwa.sh >> /var/log/cortexx-deploy.log 2>&1
```

This pulls the latest code every day at 3 AM and redeploys.

## Monitoring

### Check deployment status
```bash
systemctl status nginx
curl -I https://app.cortexbuildpro.com
```

### View logs
```bash
# Access logs
tail -f /var/log/nginx/access.log | grep cortexx-pwa

# Error logs
tail -f /var/log/nginx/error.log

# Deployment logs (if auto-update enabled)
tail -f /var/log/cortexx-deploy.log
```

### Cold-start metrics
Visit https://app.cortexbuildpro.com and open DevTools (F12):

```javascript
// In console:
console.log('Cold-start:', window.__cortexxBoot, 'ms');
console.log('Dev mode:', window.__cortexxDevMode);
console.log('DB tables:', window.Backend?._repaired);
```

## Modes

### Production (default)
```
https://app.cortexbuildpro.com
```
Loads precompiled modules from `dist/`. Fast, no Babel.

### Development
```
https://app.cortexbuildpro.com?dev=1
```
Loads JSX from `lib/` and compiles via Babel. For debugging.

## SSL Certificate Renewal

Let's Encrypt certs expire after 90 days. Certbot auto-renews them:

```bash
# Check renewal status
certbot certificates

# Manual renewal
certbot renew --dry-run
certbot renew
```

## Rollback

If a deployment breaks:

```bash
cd /opt/cortexx-pwa
git log --oneline -5
git reset --hard <commit-hash>
bash ops/deploy-cortexx-pwa.sh
```

## Performance

| Metric | Target |
|--------|--------|
| Time to interactive | <3s |
| Cold-start (prod) | ~2-3s |
| Repeat load | <500ms |
| JS bundle size | ~8.2 MB (uncompressed) |
| After gzip | ~2.1 MB |
| LCP (Largest Contentful Paint) | <2.5s |

Monitor real user metrics:
```javascript
// In Cortexx.html DevTools:
performance.getEntriesByType('navigation')[0].loadEventEnd - performance.getEntriesByType('navigation')[0].fetchStart
```

## Support

- **Domain issues:** Check A record in DNS, wait 5-10 min
- **SSL errors:** Run `certbot renew` or check `/var/log/letsencrypt/`
- **App not loading:** Check `curl -v https://app.cortexbuildpro.com` for 404s or 5xx errors
- **Stuck on loading:** Append `?dev=1` to load from `lib/` (slower but more debuggable)

See main README.md for architecture details.
