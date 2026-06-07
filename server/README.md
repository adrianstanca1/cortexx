# Cortexx Backend

Real production backend — **Express + PostgreSQL**, multi-tenant, JWT auth, **local LLM** (Ollama), server-side AI proxy, hash-chained audit log. **100% free, self-hostable software — no SaaS bills.**

The frontend works fully **without** this (localStorage + IndexedDB). Add this backend when you need: multi-device sync, multi-user workspaces, local AI inference, and a durable audit trail.

## Deploy to your own VPS — one command (free)

```sh
git clone <your-repo> cortexx && cd cortexx
sh deploy-vps.sh cortexbuildpro.com you@email.com    # domain + email for auto-HTTPS
# …or, no domain (plain HTTP on the server IP):
sh deploy-vps.sh
```

This installs Docker (if needed), generates secure secrets into `server/.env`, and brings up the **entire stack** with `docker compose up -d`:

| Service | Image | Role | Cost |
|---|---|---|---|
| `db` | postgres:16-alpine | Database (schema + seed auto-load) | free |
| `api` | ./server (Node 20) | REST + sync + webhooks + auth | free |
| `ollama` | ollama/ollama | Local LLM — pulls `llama3.2:3b` on first boot | free |
| `web` | caddy:2-alpine | Static app + reverse proxy + **automatic HTTPS** | free |

No managed database, no API keys, no per-call AI costs. Everything runs on the VPS you already pay for. Caddy issues a Let's Encrypt cert automatically when you pass a domain.

```sh
docker compose ps               # health of all 4 services
docker compose logs -f ollama   # watch the model pull (~2GB, one-time)
curl https://YOURDOMAIN/api/health
curl https://YOURDOMAIN/api/llm/health   # confirms the LLM is ready
```

## Architecture

```
┌─────────────┐     HTTPS/JWT      ┌──────────────┐     ┌────────────┐
│  Cortexx    │ ◄────────────────► │  Express API │ ──► │ PostgreSQL │
│  (frontend) │   /api/:collection │  server/     │     │            │
└─────────────┘                    └──────────────┘     └────────────┘
       │                                  │
   localStorage                      Ollama (local LLM)
   (offline cache)               http://ollama:11434 — no API key
```

## Schema

`server/db/schema.sql` — native tables for the hot path (projects, tasks, team, invoices, quotes) + 14 typed v1.3 tables (receipts, timesheets, snags, rfis, …) + integration tables (push_subscriptions, bank_connections, iap_entitlements, hmrc_submissions) + a `documents_store` JSONB table mirroring the ~36 lighter frontend collections. Plus `ai_history`, `audit_log` (hash-chained), `photos`, `portal_*`, `magic_links`.

## Run locally

### One command (Docker) — recommended

```sh
# from the project root — no API key needed (uses local Ollama)
docker compose up
# → Postgres + API + Ollama + Caddy come up; schema + seed auto-load
#   App on http://localhost   ·   API on http://localhost/api/health
```

The compose stack auto-applies `db/schema.sql` then `db/seed.sql`, so you get a
demo workspace immediately. Demo login: **demo@cortexbuild.app** / **demo1234**.
A live share token `demo-brixton` is seeded — try `GET /api/portal/demo-brixton`.

### Manual (your own Postgres)

```sh
cd server
cp .env.example .env        # fill in DATABASE_URL, JWT_SECRET, ANTHROPIC_API_KEY
npm install
createdb cortexx
npm run migrate             # psql -f db/schema.sql
npm run seed                # optional demo data
node index.js
# → Cortexx API on :3001
```

## Deploy the API

> **Full VPS runbook:** see [`DEPLOY_VPS.md`](../DEPLOY_VPS.md) — one-box deploy of
> frontend + API + Postgres + AI webhooks with nginx, HTTPS, and the WhatsApp/email
> webhook registration steps.

**Railway / Render / Fly.io** (managed Postgres + Node):
1. Push `server/` to a repo
2. Add a PostgreSQL plugin
3. Set env: `DATABASE_URL`, `ANTHROPIC_API_KEY`, `JWT_SECRET`
4. Run the migration: `npm run migrate`
5. Deploy

**Your Hostinger VPS:**
```sh
apt install -y postgresql nodejs npm
sudo -u postgres createdb cortexx
psql cortexx -f server/db/schema.sql
cd server && npm install
# Use pm2 to keep it alive:
npm i -g pm2
DATABASE_URL=... ANTHROPIC_API_KEY=... JWT_SECRET=... pm2 start index.js --name cortexx-api
pm2 save && pm2 startup
# Proxy /api through nginx to localhost:3001
```

nginx block to add:
```nginx
location /api/ {
  proxy_pass http://localhost:3001;
  proxy_set_header Host $host;
}
```

## Wire the frontend

Include `lib/cloud-sync.js` after `lib/backend.js` in `Cortexx.html`, then:
```js
// after login
await cortexxCloud.login('https://cortexbuildpro.com', email, password);
// every Backend.db write also calls cortexxCloud.push(...)
```
To make every write sync, the `mk()` table factory in `backend.js` calls `window.cortexxCloud?.push(collection, op, id, data)` after persisting locally. Offline writes queue in localStorage and replay on reconnect.

## REST API

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/register` | New workspace + user |
| POST | `/api/auth/login` | Returns JWT |
| GET | `/api/:collection` | List records |
| POST | `/api/:collection` | Create |
| PUT | `/api/:collection/:id` | Update |
| DELETE | `/api/:collection/:id` | Remove |
| POST | `/api/ai` | Claude proxy (key stays server-side) |
| POST | `/api/audit` | Append hash-chained audit entry |
| GET | `/api/health` | Liveness + active stream count |

### Passwordless auth
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/magic/request` | Email a 15-min magic link (returns devLink in dev) |
| POST | `/api/auth/magic/verify` | Exchange a magic token for a JWT |

### Realtime
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/stream?token=<jwt>` | Server-Sent Events; pushes `{type:'change'\|'portal_message'\|'portal_approval'}` for your workspace |

### Sync
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/sync/pull?since=<ISO>` | All records changed since a timestamp (full hydrate) |
| POST | `/api/sync/bulk` | Replay an offline write queue `{ops:[{collection,op,id,data}]}` |

### Client portal — PUBLIC (token-scoped, no JWT)
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/portal/:token` | Read-only project snapshot (project, invoices, updates) |
| POST | `/api/portal/:token/message` | Client sends a note → contractor inbox + SSE |
| POST | `/api/portal/:token/approve` | Client approves quote → flips project to active |

### Contractor-side portal inbox (JWT)
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/portal-inbox` | List client messages + approvals |
| POST | `/api/portal-inbox/:id/read` | Mark read |
| POST | `/api/portal-inbox/:id/reply` | Reply to a client message |
| POST | `/api/projects/:id/share` | Issue a share token → `{token, url:/p/<token>}` |

### Ledger export
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/ledger.csv?format=xero\|qb\|sage\|generic&vat=standard\|zero\|cis&from=&to=&sales=1&purchases=1` | Stream accountant-ready CSV (UTF-8 BOM + CRLF) |

All data routes require `Authorization: Bearer <jwt>` and are scoped to the user's workspace. Portal routes are deliberately public but locked to one project by an opaque, revocable token.

## Hardening (v1.1)

- **helmet** security headers on every response
- **express-rate-limit** — 30/15min on auth, 300/min on API, 60/min on public portal
- **Input validation** + 409 on duplicate email, 400 on missing fields
- **Central error handler** + `/api` 404 — no stack traces leak to clients
- **Graceful shutdown** — drains connections + closes the pool on SIGTERM/SIGINT
- **SSE keep-alive** pings every 25s so proxies don't drop the stream

## Security

- Passwords bcrypt-hashed (cost 10)
- JWT 30-day expiry
- Every query scoped by `workspace_id` (tenant isolation)
- AI key never reaches the client
- Audit log hash-chained (tamper-evident)
- Set a strong `JWT_SECRET` in production
