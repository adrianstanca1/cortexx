# invoice-builder-web Phase 2 data mapping completed — 2026-08-03

## What was deployed

- InvoiceSmart Express backend (`/srv/host/invoicesmart`) was extended with three new data resources:
  - `projects` table + `/api/projects` CRUD routes
  - `quotes` table + `/api/quotes` CRUD routes, plus `POST /:id/send` and `POST /:id/convert` to invoice
  - `variations` table + `/api/variations` CRUD routes, plus `POST /:id/approve` and `POST /:id/convert-to-invoice`
- `/srv/host/invoice-builder-web/src/lib/invoicesmart.ts` gained typed API helpers for all three resources.
- Frontend pages were wired to the live API:
  - `src/pages/CRM.tsx` — projects now use `/api/projects` instead of `localStorage` (`as-projects`).
  - `src/pages/Quotes.tsx` — quotes now use `/api/quotes` instead of the draft-invoice workaround.
  - `src/pages/Variations.tsx` — variations now use `/api/variations` and projects from `/api/projects` instead of `localStorage`.
- Fixed a backend runtime bug in `/srv/host/invoicesmart/backend/src/routes/variations.ts` where `JSON.parse(base.items || '[]')` was called on an already-parsed JSONB object.
- Committed, merged, and pushed all changes:
  - `/srv/host/invoice-builder-web`: pushed to GitHub (`adrianstanca1/bill-master-flex-86`) after resolving remote Dependabot merge conflicts.
  - `/srv/host/invoicesmart/backend`: committed Phase 2 backend changes to its local `master` branch (no remote configured).
- Rebuilt and redeployed both containers from committed code; all healthy behind Traefik.

## Verification

- Frontend `npm run build` succeeded after deduplicating the `Project` API helper block.
- Backend `npm run build` succeeded.
- Docker images rebuilt with `--no-cache` and containers restarted.
- `curl https://invoice-builder.srv1262179.hstgr.cloud` returned HTTP 200.
- InvoiceSmart login endpoint returned a valid JWT.
- Database contains the new tables: `projects`, `quotes`, `variations`.
- `cortexx_watchdog.sh --report` returned OK for all systems.

## Files changed

- `/srv/host/invoicesmart/backend/src/db.ts`
- `/srv/host/invoicesmart/backend/src/app.ts`
- `/srv/host/invoicesmart/backend/src/routes/projects.ts` (new)
- `/srv/host/invoicesmart/backend/src/routes/quotes.ts` (new)
- `/srv/host/invoicesmart/backend/src/routes/variations.ts` (new)
- `/srv/host/invoicesmart/backend/src/openapi.yaml`
- `/srv/host/invoice-builder-web/src/lib/invoicesmart.ts`
- `/srv/host/invoice-builder-web/src/pages/CRM.tsx`
- `/srv/host/invoice-builder-web/src/pages/Quotes.tsx`
- `/srv/host/invoice-builder-web/src/pages/Variations.tsx`

## Remaining blockers / follow-up

- Branded domain `invoice-builder.cortexbuildpro.com` DNS A record was added and Traefik obtained a Let's Encrypt certificate on 2026-08-03. The site is now reachable at `https://invoice-builder.cortexbuildpro.com`.
- Phase 3 (Supabase edge-function parity: `agent`, `advisor`, `rams`, `smartops`, `tender-search`, etc.) remains open.
