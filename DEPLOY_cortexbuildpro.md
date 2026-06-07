# Cortexx — Paste-Ready Deploy (cortexbuildpro.com)

Your box: **`root@72.62.132.43`** · domain **`cortexbuildpro.com`**

> Prereq: point DNS A-records `cortexbuildpro.com` **and** `www` → `72.62.132.43`
> before step 4 (TLS), or run the cert step again once DNS resolves.

---

## 1 · Put the code on the VPS

**From your local machine**, in the project folder:

```sh
ssh root@72.62.132.43 'mkdir -p /opt/cortexx'
scp -r Cortexx.html portal.html lib dist server docker-compose.yml deploy.sh \
    root@72.62.132.43:/opt/cortexx/
```

*(Or `git clone <your-repo> /opt/cortexx` on the box instead.)*

---

## 2 · Run the one-shot deploy

```sh
ssh root@72.62.132.43
cd /opt/cortexx
bash deploy.sh
```

`deploy.sh` is idempotent and does everything:
installs Docker + nginx + certbot · generates secrets into `server/.env` ·
builds Postgres + API · writes the nginx site (app + `/api` proxy + `/p/<token>`
portal rewrite + SSE tuning) · gets HTTPS · opens the firewall · prints your
webhook URLs.

---

## 3 · Add your AI key, then bounce the API

```sh
nano /opt/cortexx/server/.env      # set ANTHROPIC_API_KEY=sk-ant-...
cd /opt/cortexx && docker compose up -d
```

---

## 4 · Register the webhooks

The script prints these (the secret is auto-generated in `server/.env`):

```
WhatsApp callback : https://cortexbuildpro.com/api/webhooks/<SECRET>/whatsapp
WhatsApp verify   : <WA_VERIFY_TOKEN>
Email inbound     : https://cortexbuildpro.com/api/webhooks/<SECRET>/email
```

- **Meta → WhatsApp → Configuration**: Callback URL = the WhatsApp URL, Verify
  token = the printed value, subscribe to **messages**.
- **Email** (Mailgun/SendGrid inbound parse): POST inbound mail to the Email URL.

---

## 5 · Point the app at the API

Open `https://cortexbuildpro.com` → **Settings → Cloud sync**:
1. API endpoint = `https://cortexbuildpro.com` → **Test** → ✓ Reachable
2. Sign in — demo seed: `demo@cortexbuild.app` / `demo1234`
3. **Live sync** on → inbound WhatsApp/email leads stream in via SSE.

---

## 6 · Smoke test (the script prints these too)

```sh
curl -s https://cortexbuildpro.com/api/health
curl -s https://cortexbuildpro.com/api/portal/demo-brixton | head -c 120
# WhatsApp verify handshake (use values from server/.env):
curl "https://cortexbuildpro.com/api/webhooks/<SECRET>/whatsapp?hub.verify_token=<WA_VERIFY_TOKEN>&hub.challenge=ok123"
```

---

## Redeploy later

```sh
ssh root@72.62.132.43
cd /opt/cortexx && git pull          # or re-scp changed files
bash deploy.sh                       # rebuilds + reloads everything
```

Frontend-only changes (`lib/`, `Cortexx.html`) need no rebuild — just reload the page.

---

## If something's off

```sh
docker compose logs -f api     # triage / webhook / error logs
docker compose ps              # container status
nginx -t && systemctl reload nginx
certbot renew --dry-run        # TLS
```

Full reference: [`DEPLOY_VPS.md`](DEPLOY_VPS.md).
