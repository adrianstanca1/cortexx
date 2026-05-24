# Tasks

## Active

- [ ] **Teams sub-tabs UI** — Skills / Inductions / Availability tabs inside Teams module
  - Source: `docs/PLATFORM_SPEC.md` Phase 1
- [ ] **Zod request validation on critical endpoints** — add Zod schemas to sensitive routes
  - Source: `docs/PLATFORM_SPEC.md` Phase 1
- [ ] **Error message sanitization in generic routes** — stop leaking internals from `server/routes/generic.js`
  - Source: `docs/PLATFORM_SPEC.md` Phase 1

## Waiting On

## Someday

<!-- Deferred features from docs/PLATFORM_SPEC.md — promote to Active when ready -->

- [ ] **Workflow visual builder UI** — engine + routes shipped (072 migration); add drag-and-drop authoring on top
- [ ] **Procore / QuickBooks / Slack integrations** — wire up the pre-built framework
- [ ] **Drawing revision tracking** — `drawing_revisions` table + UI
- [ ] **Offline-first PWA for field apps**
- [ ] **Timeline / cost prediction ML models**
- [ ] **Document OCR pipeline**
- [ ] **Image defect detection**
- [ ] **API gateway with key management**

## Done

- [x] **MFA (TOTP)** — `070_add_mfa.sql`, `server/lib/mfa.js`, `MfaChallenge.tsx`, `SettingsMfa.tsx` (closed 2026-04-27, per `SESSION.md` 2026-04-26 handoff)
- [x] **Workflow automation engine (foundation)** — `072_add_workflows.sql`, `server/lib/workflow/*`, `server/routes/workflows.js`; visual builder remains in Someday (closed 2026-04-27)
- [x] **Stripe billing integration (scaffold)** — `071_add_subscriptions.sql`, `074_billing_webhook_idempotency.sql`, `075_subscriptions_org_unique.sql`, `stripe-client.js`, `billing.js`, `billing-webhook.js`, `BillingPage.tsx` (closed 2026-04-27; live keys + UI promotion still required)
- [x] **Progressive account lockout** — `068_add_lockout_columns.sql` adds `failed_attempts` + `locked_until`; route enforcement in place via `066_auth_hardening.sql` (closed 2026-04-27)
- [x] **Settings persistence** — `server/routes/company.js` exposes `PUT /api/company`, `POST/PUT/DELETE /api/company/users(/:id)` (closed 2026-04-27)
- [x] **2026-04-04 codebase-errors plan** — plan file removed from `docs/superpowers/plans/`; lint zeroed (`f9e22b1`), realtime test stabilized (`b83c67a`), build green across 30+ commits since (closed 2026-04-27)
