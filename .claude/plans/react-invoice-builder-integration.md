# Plan: Replace InvoiceSmart frontend with the Vercel React invoice builder

## Goal
Host the React invoice builder currently deployed at `https://react-invoice-builder-orvzyga8t-adrian-b7e84541.vercel.app` on this VPS as the new InvoiceSmart frontend at `https://invoicesmart.cortexbuildpro.com`, while keeping the existing InvoiceSmart Express API (`api.invoicesmart.cortexbuildpro.com`) and Postgres DB intact.

## Current state
- **Existing backend**: `/srv/host/invoicesmart/backend` — Express + TypeScript + Postgres 16, container `invoicesmart-backend`, exposed via Traefik at `api.invoicesmart.cortexbuildpro.com:3008`.
- **Existing frontend**: the backend also serves a static SPA from `backend/public/` (auth, invoices, clients, AI, reports).
- **Deployment pattern**: Docker Compose on the `traefik_web` network with Traefik labels, or file-provider routers for PM2/static apps.
- **Hardening already applied**: CORS allowlist, helmet, rate-limit, non-root container, backups, watchdog.

## Blocker / first step
The Vercel preview link is behind SSO, and a filesystem search did not find the React invoice builder source on this server. Before any deployment work can begin, the source must be provided in one of these ways:
1. **Git repo URL** (GitHub/GitLab/etc.) so I can clone it.
2. **Public Vercel preview link** (non-SSO) so I can inspect the build output and tech stack.
3. **File path on this server** where the project actually lives (current search suggests it is not under `/root`, `/srv`, `/opt`, or `/tmp`).

## Deployment approach (once source is available)

### 1. Source placement
Clone or copy the project into a new directory, e.g. `/srv/host/invoicesmart/frontend` or `/srv/host/invoicesmart/web`, separate from the backend source.

### 2. Determine the build stack
Inspect `package.json` to identify:
- React toolchain: Vite, Create React App, Next.js, etc.
- Base path / public URL configuration (`homepage`, `base`, `assetPrefix`).
- Existing API calls and environment variables (e.g. `REACT_APP_API_URL`, `VITE_API_URL`).

### 3. Point the frontend at the existing backend
- Set the production API base to `https://api.invoicesmart.cortexbuildpro.com`.
- Ensure requests include credentials if the existing JWT auth uses cookies.

### 4. Containerize and compose
- Add a `Dockerfile` under `/srv/host/invoicesmart/frontend` that builds the static bundle and serves it with a tiny server (nginx, serve, or a custom Node server).
- Add a new service to `/srv/host/invoicesmart/docker-compose.yml` (or a separate `docker-compose.frontend.yml`) joining the `traefik_web` network.
- Assign a stable IP in `traefik_web` if needed, or use Docker service discovery.
- Add Traefik labels:
  - Host rule: `Host(\`invoicesmart.cortexbuildpro.com\`)`
  - Entrypoint: `websecure`
  - TLS via `letsencrypt`
  - Service port matching the frontend container port.

### 5. Backend updates
- In `/srv/host/invoicesmart/backend/.env`, add `https://invoicesmart.cortexbuildpro.com` to `CORS_ORIGINS`.
- Rebuild/restart the backend container so the new origin is allowed.

### 6. DNS / routing
- `invoicesmart.cortexbuildpro.com` must resolve to the VPS (`72.62.132.43`). If it already does, Traefik will request/renew the LetsEncrypt cert automatically. If not, add the A record before switching traffic.

### 7. Migration of the static frontend
- Keep the backend’s `public/` fallback during cutover.
- Once the new frontend container is healthy and the cert is valid, the new frontend route takes precedence for `/` while the backend continues to serve `/api/*` and `/health`.

### 8. Verify and harden
- `curl https://invoicesmart.cortexbuildpro.com` returns the new frontend.
- `curl https://api.invoicesmart.cortexbuildpro.com/api/health` still works.
- Frontend can authenticate and fetch data from the API.
- CORS errors absent in browser.
- Add the new container to the watchdog health checks and backup scope if required.

## Open questions before implementation
1. Where is the source? (repo URL, public preview, or exact server path)
2. Does the React app expect a specific API contract, or can it be adapted to the existing InvoiceSmart API (`/api/auth`, `/api/invoices`, `/api/clients`, etc.)?
3. Should the old static frontend remain reachable at a fallback path, or be fully replaced?

## Files expected to change
- `/srv/host/invoicesmart/docker-compose.yml`
- `/srv/host/invoicesmart/backend/.env`
- New files: `/srv/host/invoicesmart/frontend/Dockerfile`, `/srv/host/invoicesmart/frontend/docker-compose.yml` (optional), and the cloned frontend source tree.
- Possibly `/docker/traefik/conf/invoicesmart.yml` if we use a file-provider router instead of Docker labels.
