# invoice-builder-web Phase 1 auth integration completed

**Date:** 2026-08-03

## What was done

- Replaced the deleted Supabase project auth with the live InvoiceSmart Express backend for the React invoice builder at `/srv/host/invoice-builder-web`.
- Created `/srv/host/invoice-builder-web/src/lib/invoicesmart.ts` with an `apiFetch` helper, token helpers, and a typed user/session shape.
- Rewrote `/srv/host/invoice-builder-web/src/integrations/supabase/client.ts` as a compatibility shim that exposes `supabase.auth.signUp`, `signInWithPassword`, `signOut`, `getSession`, and `onAuthStateChange` backed by InvoiceSmart endpoints and `localStorage`.
- Updated `/srv/host/invoice-builder-web/src/pages/Auth.tsx` to map email/password form fields to InvoiceSmart `/api/auth/register` and `/api/auth/login` payloads.
- Adjusted `/srv/host/invoice-builder-web/src/components/AuthStatus.tsx` to display the InvoiceSmart user email.
- Added `VITE_INVOICESMART_API_URL=https://api.invoicesmart.cortexbuildpro.com` to `.env` and passed it through `docker-compose.yml` at Vite build time.
- Updated InvoiceSmart backend CORS in `/srv/host/invoicesmart/backend/.env` to allow the fallback host `https://invoice-builder.srv1262179.hstgr.cloud`.
- Rebuilt and redeployed the invoice-builder-web container.
- Removed backup `.bak` files created during the edits.

## Files changed

- `/srv/host/invoice-builder-web/src/lib/invoicesmart.ts` (new)
- `/srv/host/invoice-builder-web/src/integrations/supabase/client.ts` (rewritten)
- `/srv/host/invoice-builder-web/src/pages/Auth.tsx`
- `/srv/host/invoice-builder-web/src/components/AuthStatus.tsx`
- `/srv/host/invoice-builder-web/.env`
- `/srv/host/invoice-builder-web/docker-compose.yml`
- `/srv/host/invoicesmart/backend/.env`
- `/root/.claude/plans/invoice-builder-auth-integration.md` (status updated)

## Verification results

- Frontend registration creates a user in the InvoiceSmart database.
- Frontend login returns a JWT and redirects to the dashboard.
- Authenticated navigation (`RequireAuth`) works once the token is stored.
- Watchdog continued to report OK after the deployment.

## Next blockers / follow-up

- **Branded DNS:** add a public A record for `invoice-builder.cortexbuildpro.com` pointing to `72.62.132.43`, then add that origin to the InvoiceSmart backend CORS list and rebuild.
- **Phase 2:** map Supabase data tables (`companies`, `clients`, `projects`, `quotes`, `variations`) to InvoiceSmart models.
- **Phase 3:** port or replace Supabase edge functions (`agent`, `advisor`, `rams`, `smartops`, `tender-search`, `tenders`, `quote-bot`, `tax-bot`, `tenderbot`, `accounting`, `quotes`).
