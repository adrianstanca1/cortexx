---
name: invoicesmart-deployed-20260803
description: "InvoiceSmart production deployment stabilized with backups, watchdog coverage, and security fixes."
metadata: 
  node_type: memory
  type: project
  originSessionId: 07e0ac2d-aec7-44e3-9daf-0a8cedf11906
  modified: 2026-08-03T10:56:35.916Z
---

InvoiceSmart ("/srv/host/invoicesmart", public `api.invoicesmart.cortexbuildpro.com`) was reviewed and hardened on 2026-08-03.

Key operational changes:
- Added nightly DB backup: `/root/.hermes/scripts/invoicesmart_backup.sh` dumps `cortexbuild-postgres:invoicesmart` to `/opt/invoicesmart-backups/` with 30-day rotation; installed at `/etc/cron.daily/invoicesmart-backup`.
- Added InvoiceSmart to `/root/.hermes/scripts/cortexx_watchdog.sh`: public-edge check, container auto-repair, and backup freshness alert.
- Removed direct host `3008:3008` port binding; Traefik routes over the `traefik_web` Docker network.
- Set production `CORS_ORIGINS=https://api.invoicesmart.cortexbuildpro.com` and fail-closed empty allowlist.
- Added `host.docker.internal` to AI endpoint allowlists so Ollama works from the container.
- Fixed `generateInvoiceNumber` to use max suffix (avoids reuse after deletion), validated transaction `type`, made `initSchema` fatal on failure, and added real pagination to invoices/clients.
- Ran `npm audit fix` and rebuilt the Docker image; all 72 tests pass.

Verification commands:
- `bash /root/.hermes/scripts/cortexx_watchdog.sh --report`
- `bash /root/.hermes/scripts/invoicesmart_backup.sh`
- `cd /srv/host/invoicesmart/backend && FRESH_TEST_DB=1 npm test`
- `curl https://api.invoicesmart.cortexbuildpro.com/api/health`

**Why:** Previously InvoiceSmart had no backups and was not monitored; a container failure would have lost customer invoice data with no alert.
**How to apply:** Reuse the same backup/watchdog patterns for any future Dockerized Postgres sub-app under `/srv/host/`.
