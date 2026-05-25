# Changelog

## v1.0.0 — 25 May 2026

**The SaaS launch.** Cortexx is now a multi-tenant construction-management
platform that anyone can sign up for at https://cortexbuildpro.com.

### Multi-tenancy

- Every project, task, invoice, RFI, snag, RAMS doc, time entry, etc. is
  scoped to the owning workspace. Cross-tenant data leaks are blocked
  by the Prisma client extension at the query layer, not by trusting
  every route to remember the filter.
- 14-day Pro trial on every new workspace, no card required.
- Stripe billing for Starter (£29/mo) and Pro (£79/mo); Enterprise
  contact-sales.
- Per-workspace member management with four roles
  (owner / admin / member / viewer). Invitations via email with 7-day
  tokens; password-confirmed deletes for sensitive operations.
- Audit log on every workspace, viewable by admins. Logged on
  every member change, billing transition, 2FA enable/disable, and
  every delete across 40+ resources.

### Security

- Two-factor authentication (TOTP — compatible with Google Authenticator,
  Authy, 1Password, Bitwarden, etc.) with 10 single-use backup codes
  generated at enrolment.
- Rate limiting on every authenticated write endpoint (60 req/min/user).
- Strict-Transport-Security, X-Content-Type-Options, X-Frame-Options,
  Referrer-Policy, Permissions-Policy headers on every page response.
- Sentry error tracking with PII scrubbing (when SENTRY_DSN is set).
- Webhook signature verification + customer-id binding on every
  Stripe event.

### Reliability

- Weekly backup-restore verification cron — proves the nightly
  pg_dump backups are actually restorable. Failures auto-open a P0
  GitHub issue.
- Atomic database password rotation — deploy can't drift the DB
  password and the .env.production apart any more.
- Self-healing stuck Prisma migrations + a manual rescue workflow
  for the rare cases the auto-recovery doesn't catch.

### Storage

- S3 / object-storage adapter (compatible with Hetzner Object Storage,
  Cloudflare R2, AWS S3, MinIO, etc.). Defaults to local disk when
  the S3_* env vars are unset, so single-VPS deployments work the
  same as before. Required env vars are checked at boot.

### Performance

- Core Web Vitals tracking — CLS / FCP / INP / LCP / TTFB reported to
  `/api/metrics` via `navigator.sendBeacon`, 10% sample rate by default.
- Postgres full-text search columns + GIN indexes on Project, Task,
  Invoice, Document, Snag, RFI, Customer, Subcontractor.
- Bundle-size analyzer (`ANALYZE=true npm run build`) for finding
  client-bundle bloat.
- Service worker pre-caches dist/ for sub-second cold-starts on
  return visits.

### Mobile

- iOS Capacitor 6 release workflow (`release-ios.yml`) — tag with
  `v*-ios` to trigger an App Store TestFlight upload. Code signing,
  IPA archiving, dSYM upload all automated.
- Push notifications honour per-user category preferences
  (tasks / safety / invoices / announcements × push + email).

### Pages

- `/` — auth-aware landing; signed-out visitors see the marketing
  page, signed-in users go straight to `/dashboard`.
- `/marketing`, `/pricing`, `/help`, `/help/[slug]` — public pages
  for unauthenticated visitors.
- `/onboarding` — workspace creation wizard for new signups.
- `/invite/[token]` — accept-an-invite flow with state handling for
  signed-out / wrong-email / already-accepted / expired tokens.
- `/settings/{organization,security,audit-log,notifications}` — full
  workspace + per-user settings.
- `/legacy/` — the original 80-phase single-file PWA preserved for
  offline-capable demos.

### Numbers

- 49 Prisma models · 23 migrations · 136 API route handlers
- 67 app pages · 22 lib helpers
- 187 tests (177 unit + 10 cross-org integration), all green
- 0 TypeScript errors · 0 lint errors · 0 npm-audit vulns
- ~12 weeks of incremental commits from the foundation through v1.0

---

## Pre-v1.0 — May 2026

Prior releases shipped iteratively to a single in-house tenant
(`cortexbuildpro`) during the rebuild from the original 80-phase
PWA into the Next.js 16 SaaS architecture. Full history in
`ROADMAP.md` and `docs/v1-completion-plan.md`.

Key milestones:

- **Next.js 14 → 16 migration** (PR #23) + Auth.js v4 → v5 (PR #25)
  + React 18 → 19 cleanup (PR #24).
- **24 module surfaces**: RFIs, snags, RAMS, permits, observations,
  variations, tenders, training, time-sheets, drawings (incl. AI
  revision-diff), pos, sub-invoices, mileage, check-ins, safety
  incidents, toolbox talks, maintenance schedules, equipment,
  materials, customers, leads, quotes, inspections, meetings,
  risks.
- **AI features**: snag photo analysis (Moondream), document
  tagging (vision), drawing revision compare, photo compare,
  whisper.cpp voice transcription, Ollama text chat. All running
  on local model infrastructure — customer project data never
  leaves our hardware.
- **Real-time**: SSE `/api/events/stream` + `useRealtimeActivity`
  hook + cross-tab `BroadcastChannel` sync. Live indicator dot in
  10+ dashboard variants.
- **PWA**: 80 phase modules served at `/legacy/`, full icon /
  splash / manifest set, service worker, push notifications.
- **Repository consolidation** (24 May 2026): 9 previously
  separate Cortexx-related repos merged into this one with their
  history preserved in `archive/`.
