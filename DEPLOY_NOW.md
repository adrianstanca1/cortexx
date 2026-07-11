# Cortexx — Deploy now

Pick a lane. All three put your app online.

---

## Lane 1 · Vercel (fastest — 60 seconds)

You already have `vercel.json` set up. Two ways:

### A · Drag & drop (no CLI)

1. Go to **vercel.com/new** → log in.
2. Drag the **entire project folder** onto the dashboard.
3. Vercel auto-detects the static site, applies `vercel.json` headers, deploys.
4. Your URL appears: `cortexx-xxx.vercel.app`. Add your custom domain in **Settings → Domains**.

### B · CLI (better for iterative deploys)

```bash
npm i -g vercel          # one time
cd <project root>
vercel                   # walks you through linking; pick "Yes" to defaults
vercel --prod            # deploys to production URL
```

Subsequent deploys: `vercel --prod` from the project root, that's it.

---

## Lane 2 · Hostinger VPS (your existing cortexbuildpro.com)

The `deploy.sh` script is already configured for `cortexbuildpro.com`.

```bash
# From your laptop — package everything except dev cruft
zip -r cortexx-deploy.zip . \
  -x "*.git*" \
  -x "ios/*" \
  -x "app-store/*" \
  -x "screenshots/*" \
  -x "uploads/*" \
  -x ".design-canvas.state.json"

# Upload to VPS
scp cortexx-deploy.zip root@<vps-ip>:/tmp/

# SSH in
ssh root@<vps-ip>

# On the VPS:
cd /tmp && unzip cortexx-deploy.zip -d cortexx-upload && mv cortexx-upload /tmp/
bash /tmp/cortexx-upload/deploy.sh
```

The script will:
- Install Nginx + Certbot
- Configure HTTPS via Let's Encrypt for `cortexbuildpro.com`
- Set up service-worker no-cache headers (critical — wrong here = users stuck on old version)
- Open firewall
- Set up auto-renewal

For subsequent deploys, skip the first time setup:

```bash
rsync -av --delete --exclude='.git' --exclude='ios' --exclude='app-store' \
  ./ root@<vps-ip>:/var/www/cortexx/
ssh root@<vps-ip> "systemctl reload nginx"
```

---

## Lane 3 · Cloudflare Pages / Netlify (also free, also instant)

Same as Vercel — drag the project folder. Both honour the `manifest.json` and `sw.js` paths. You'll lose the custom header rules from `vercel.json` (Cloudflare/Netlify use their own configs); set the service-worker no-cache header manually in their dashboard.

---

## Lane 4 · Single-file demo (`Cortexx-standalone.html`)

Already bundled — open `Cortexx-standalone.html` and you have the whole app in one 1.7 MB file with zero external dependencies. Email it, drop it on Dropbox, share via Slack — it works offline forever from any device with a modern browser.

Use this for:
- Sales demos where you don't trust the customer's WiFi
- TestFlight beta-tester onboarding (paste the file URL in beta notes)
- Backup distribution channel if your CDN goes down

---

## After it's live — verify these things

```bash
# 1. Service worker is fresh on every load
curl -I https://cortexbuildpro.com/sw.js | grep -i cache-control
# expect: no-cache, no-store, must-revalidate

# 2. Manifest is reachable
curl -I https://cortexbuildpro.com/manifest.json

# 3. PWA install prompt fires on iOS Safari
#    - open in iPhone Safari, tap Share, scroll down for "Add to Home Screen"

# 4. Lighthouse PWA score
#    - desktop Chrome → DevTools → Lighthouse → PWA → Analyze
#    - target ≥ 90
```

If any of those fail, check `app-store/SUBMISSION.md` and `SHIP_TO_APP_STORE.md` — both list common gotchas.

---

## Which lane should you actually pick?

- **Just want it on the internet so users can install the PWA today?** → Lane 1 (Vercel drag-drop).
- **You own `cortexbuildpro.com` and want it on your own infrastructure?** → Lane 2 (Hostinger VPS).
- **Need a portable demo file?** → Lane 4 (already built — `Cortexx-standalone.html`).
- **You're going to iterate hard for the next week?** → Lane 1 with the CLI — `vercel --prod` after every change is ~5 seconds.

You can also do **all four**. Vercel for the public PWA, VPS for your branded domain, Cloudflare as a backup CDN, standalone file for sales calls. Costs nothing.

---

## iOS App Store deploy

That's separate from this doc and **requires a Mac with Xcode**. See `SHIP_TO_APP_STORE.md`. I cannot execute that step from here — it's hard-gated to macOS by Apple.
