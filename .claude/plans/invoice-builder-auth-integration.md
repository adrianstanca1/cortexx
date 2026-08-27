# Plan: Wire invoice-builder-web auth to InvoiceSmart backend (Phase 1)

## Status

**Phase 1 COMPLETED — 2026-08-03**

- Login and registration now work through the InvoiceSmart Express backend (`https://api.invoicesmart.cortexbuildpro.com`).
- The Supabase client shim in `src/integrations/supabase/client.ts` was rewritten to call InvoiceSmart auth endpoints and store the returned JWT in `localStorage`.
- Backup `.bak` files created during the edits were cleaned up.
- The app is reachable at the fallback domain `https://invoice-builder.srv1262179.hstgr.cloud` and the branded domain `https://invoice-builder.cortexbuildpro.com`. The branded DNS A record was added and Traefik obtained a Let's Encrypt certificate on 2026-08-03.
- Phase 2 DEPLOYED — 2026-08-03: backend tables and routes for `projects`, `quotes`, and `variations`; frontend `CRM.tsx`, `Quotes.tsx`, and `Variations.tsx` wired to the new InvoiceSmart endpoints. A backend `JSON.parse` bug on the `variations` route was fixed before deploy.
- Phase 3 (AI/edge-function mapping) remains open and is documented below.

## Context
The React invoice builder at `/srv/host/invoice-builder-web` was deployed and works as a static SPA, but login/registration fail because it points to a deleted Supabase project (`iflfeptxtrxdlvomkunx`). The existing InvoiceSmart Express API at `https://api.invoicesmart.cortexbuildpro.com` has working JWT auth (`/api/auth/register`, `/api/auth/login`, `/api/auth/me`).

## Goal of this phase
Make login and registration work by replacing Supabase auth with InvoiceSmart auth. All other Supabase/data features remain as-is for now (some will be non-functional until later phases).

## What will change

### 1. New API client module
Create `/srv/host/invoice-builder-web/src/lib/invoicesmart.ts`:
- `API_BASE_URL` from `import.meta.env.VITE_INVOICESMART_API_URL` (default `https://api.invoicesmart.cortexbuildpro.com`)
- `apiFetch(path, opts)` helper that:
  - prepends the base URL
  - injects `Authorization: Bearer <token>` from `localStorage.invoicesmart_token` if present
  - sets `Content-Type: application/json`
  - parses JSON responses and throws `{ message, status }` on HTTP errors
- `setToken(token)`, `getToken()`, `clearToken()` helpers

### 2. Replace Supabase auth in `src/integrations/supabase/client.ts`
Keep the file path to avoid changing every import, but rewrite it to expose a minimal compatible API:
- `supabase.auth.signUp({ email, password })` → `POST /api/auth/register`
- `supabase.auth.signInWithPassword({ email, password })` → `POST /api/auth/login`
- `supabase.auth.signOut()` → clear token + reload or navigate
- `supabase.auth.getSession()` → read token from localStorage, optionally validate shape
- `supabase.auth.onAuthStateChange(callback)` → simple event emitter wrapper around localStorage changes (or just fire once on mount)
- `supabase.auth` object should return shapes close enough that `Auth.tsx`, `RequireAuth.tsx`, and `AuthStatus.tsx` work with minimal changes.

This avoids touching many files; only the client shim changes.

### 3. Update environment configuration
- Add `VITE_INVOICESMART_API_URL=https://api.invoicesmart.cortexbuildpro.com` to `/srv/host/invoice-builder-web/.env`.
- Keep existing `VITE_SUPABASE_*` vars for now (used by types and non-auth code) but document that they are no longer functional.
- Update `docker-compose.yml` so the build receives the new env var at build time (Vite inlines `import.meta.env` at build time).

### 4. Update `Auth.tsx`
- Map signup fields to InvoiceSmart `register` payload (`email`, `password`).
- The current form only asks for email/password, so `first_name`, `last_name`, etc. will be omitted initially.
- On successful login/register, store the JWT and navigate as before.
- Toast errors from the API.

### 5. Update `RequireAuth.tsx` and `AuthStatus.tsx`
- Minimal or no changes if the auth shim exposes a compatible session/user shape.
- `AuthStatus` should display `session.user.email` from the token payload. Since the API returns `{ token, user: { id, email } }`, store the user object in `localStorage` or decode the JWT (no verification needed in browser; verification is server-side).

### 6. CORS update on InvoiceSmart backend
- Add `https://invoice-builder.srv1262179.hstgr.cloud` and eventually `https://invoice-builder.cortexbuildpro.com` to `CORS_ORIGINS` in `/srv/host/invoicesmart/backend/.env`.
- Rebuild/restart the backend container.

### 7. Build and redeploy
- `docker compose build --no-cache && docker compose up -d` in `/srv/host/invoice-builder-web`.
- Verify login/register via browser or curl.

## Out of scope for Phase 1
- Supabase data tables (`companies`, `clients`, `projects`, `quotes`, `variations`) remain non-functional.
- Supabase edge functions (`agent`, `advisor`, `rams`, `smartops`, `tender-search`, `tenders`, `quote-bot`, `tax-bot`, `tenderbot`, `accounting`, `quotes`) remain non-functional.
- These will be addressed in Phase 2 (data model mapping) and Phase 3 (AI/edge-function mapping).

## Files expected to change
- `/srv/host/invoice-builder-web/src/lib/invoicesmart.ts` (new)
- `/srv/host/invoice-builder-web/src/integrations/supabase/client.ts` (rewritten shim)
- `/srv/host/invoice-builder-web/src/pages/Auth.tsx` (payload mapping)
- `/srv/host/invoice-builder-web/src/components/AuthStatus.tsx` (maybe user shape)
- `/srv/host/invoice-builder-web/.env` (new API URL)
- `/srv/host/invoice-builder-web/docker-compose.yml` (env var passthrough)
- `/srv/host/invoicesmart/backend/.env` (CORS origin)
- `/root/.claude/plans/...` (this plan)

## Verification
- `POST /api/auth/register` via the new frontend creates a user in the InvoiceSmart DB.
- `POST /api/auth/login` returns a token and the dashboard becomes accessible.
- Watchdog continues to report OK.

## Status

**Phase 2 COMPLETED — 2026-08-03**

- Projects, quotes, and variations backend models/routes are live in the InvoiceSmart Express backend (`/srv/host/invoicesmart`).
- The invoice-builder-web frontend Dashboard, Quotes, and Variations tabs now read/write through the InvoiceSmart API instead of the deleted Supabase project.
- The shared `invoicesmart.ts` API client (`/srv/host/invoice-builder-web/src/lib/invoicesmart.ts`) was extended with the new endpoints.
- Remaining Supabase data calls and AI/edge-function calls were routed through InvoiceSmart where backend equivalents exist.
- The container at `/srv/host/invoice-builder-web` was rebuilt and redeployed; it is healthy behind Traefik on the fallback domain `https://invoice-builder.srv1262179.hstgr.cloud`.
- The branded domain `invoice-builder.cortexbuildpro.com` remains pending a public DNS A record.
- Phase 3 (any remaining AI/edge-function parity or native Supabase features not yet mapped) remains open.
