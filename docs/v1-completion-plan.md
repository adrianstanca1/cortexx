# Cortexx v1.0 — Completion Plan

**Target:** multi-tenant SaaS for UK construction contractors.
**Status as of 24 May 2026:** single-tenant app live at `https://cortexbuildpro.com`, 24+ modules with full CRUD, Auth.js v5, 122 unit tests, push notifications wired into 3 events, vision + voice + LLM all working. See `ROADMAP.md` for what's shipped.

This plan covers the work to get from "live for one company" to "v1.0 SaaS others can sign up for."

Sequenced by dependency — Phase 1 (multi-tenancy) is the keystone everything else builds on. Phases 2-6 can interleave once Phase 1 lands.

---

## Phase 1 — Multi-tenancy foundation `[~2 weeks]`

This is the keystone. Until this lands, none of the SaaS work makes sense.

### 1.1 Schema migration

Add `Organization` model + `organizationId` foreign key to every owned model. 41 of 44 models need it (User, Account, Session, VerificationToken are auth-layer and link to Organization via UserOrganization membership).

```prisma
model Organization {
  id        String   @id @default(cuid())
  slug      String   @unique               // url-safe org identifier
  name      String
  plan      String   @default("trial")     // trial / starter / pro / enterprise
  trialEndsAt DateTime?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  members   UserOrganization[]
  projects  Project[]
  // ... back-relations from every owned model
}

model UserOrganization {
  id             String       @id @default(cuid())
  userId         String
  organizationId String
  role           String       @default("member") // owner / admin / member / viewer
  joinedAt       DateTime     @default(now())
  user           User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  @@unique([userId, organizationId])
  @@index([userId])
  @@index([organizationId])
}
```

Every owned model gets:
```prisma
organizationId String
organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
@@index([organizationId])
```

Affected models (41): `Project, Task, TeamMember, Assignment, Invoice, TimeEntry, Activity, Comment, Document, Snag, Certification, Rfi, Announcement, Observation, Variation, Lead, Customer, Quote, SiteCheckIn, MileageEntry, CostItem, Subcontractor, Equipment, Material, PurchaseOrder, SubInvoice, Drawing, DrawingRevision, Milestone, Permit, Rams, Tender, Inspection, Meeting, Risk, ToolboxTalk, MaintenanceSchedule, Supplier, SafetyIncident, PushSubscription`. (`User` itself doesn't have an org — it's many-to-many via `UserOrganization`.)

### 1.2 Data backfill

One-shot migration that:
1. Creates the default org `Cortexbuild Pro` (slug `cortexbuildpro`, plan `pro`).
2. Inserts a `UserOrganization` for every existing User with role `owner`.
3. Sets `organizationId` on every existing owned row to the default org's id.

Two `.sql` migration files (one for the schema additions, one for the backfill). Run on a backed-up staging copy first.

### 1.3 Session shape + auth helpers

```typescript
// lib/auth.ts — extend session
session.user.activeOrganizationId  // current org in scope (cookie-persisted)
session.user.organizations         // [{ id, slug, name, role }]
```

`lib/requireAuth.ts` returns `{ user, orgId, role }` instead of just `session`. Routes call `await requireAuth()` and trust `orgId`.

Org switcher in the top nav lets a user with multiple memberships change scope; switching sets a cookie + invalidates `useDashboardData`.

### 1.4 Route migration `[the big one]`

Every list-GET, every detail-GET, every POST/PUT/DELETE on the ~120 routes gets the org filter:

```typescript
// Before
const tasks = await prisma.task.findMany({ where: { status } })

// After
const { orgId } = await requireAuth()
const tasks = await prisma.task.findMany({ where: { organizationId: orgId, status } })
```

Use a one-shot codemod (`ts-morph`) to add the `organizationId` filter to every Prisma query — same minimum-diff strategy as the Next 16 params codemod. Then hand-review the diff for any query that needs special handling (the public `/api/client-view/[token]` endpoint stays unscoped because the token itself is org-scoped via the project's `organizationId`).

### 1.5 Cross-org isolation tests

A dedicated test suite that:
1. Creates org A and org B with seed data.
2. Signs in as a user in org A.
3. Hits every list endpoint, asserts zero org B records leak.
4. Hits every detail endpoint with an org B record id, asserts 404.
5. Hits every POST/PUT/DELETE with org B record ids in the body, asserts 403 or 404.

~30 tests, runs in CI. This is the single most important test suite for SaaS.

### 1.6 Row-level security (defence in depth)

Postgres RLS policies on every owned table:

```sql
ALTER TABLE "Project" ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation ON "Project"
  USING ("organizationId" = current_setting('app.current_org_id')::text);
```

Prisma middleware sets `app.current_org_id` on every connection. Belt-and-braces: even if a route forgets the WHERE clause, RLS blocks the leak.

---

## Phase 2 — SaaS onboarding & billing `[~2 weeks]`

### 2.1 Sign-up flow

- `/register` (already exists) creates a User AND a default Organization in one transaction. User becomes `owner` of their org.
- `/onboarding` — 3-step post-signup wizard: workspace name → invite teammates → first project.
- `/invite/[token]` — accepts an invitation token, creates UserOrganization for the existing/new user.

### 2.2 Invitation system

```prisma
model OrganizationInvite {
  id             String   @id @default(cuid())
  organizationId String
  email          String
  role           String   @default("member")
  token          String   @unique
  expiresAt      DateTime
  acceptedAt     DateTime?
  invitedById    String
  createdAt      DateTime @default(now())
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
}
```

Email sent via transactional provider (see Phase 4.1). Token-based, 7-day expiry.

### 2.3 Org settings page

`/settings/organization` — owners + admins only:
- Workspace name + slug
- Branding (logo, accent colour) — used in public client-view + PDF exports
- Members table (invite / change role / remove)
- Plan & billing (deep-link to Stripe portal)
- Danger zone (delete org, transfer ownership)

### 2.4 Billing — Stripe integration

- `stripe` + `@stripe/stripe-js` dependencies
- Three plans: Starter (£29/mo, 5 users), Pro (£79/mo, 20 users), Enterprise (custom)
- 14-day trial on signup
- Stripe Checkout for new subscriptions, Customer Portal for plan changes
- Webhook handler at `/api/webhooks/stripe` updates `Organization.plan` + `Organization.subscriptionStatus`
- Plan limits enforced server-side (max users, max projects on Starter, etc.)
- Soft block on limit exceeded: read-only mode for the org until upgrade

### 2.5 Role-based access control (RBAC)

Four roles per-org: `owner`, `admin`, `member`, `viewer`.

| Action | owner | admin | member | viewer |
|---|---|---|---|---|
| Read all data | ✅ | ✅ | ✅ | ✅ |
| Create projects, tasks, etc. | ✅ | ✅ | ✅ | ❌ |
| Edit anything | ✅ | ✅ | own only | ❌ |
| Manage members | ✅ | ✅ | ❌ | ❌ |
| Billing | ✅ | ❌ | ❌ | ❌ |
| Delete org | ✅ | ❌ | ❌ | ❌ |

Helper `requireRole(['owner', 'admin'])` on every mutating route. Centralised in `lib/rbac.ts`.

---

## Phase 3 — Hardening `[~2 weeks]`

### 3.1 Integration test suite

Today: 122 unit tests (parsers + validators). Missing: integration tests against a real database.

Add `test/integration/` using `node:test` + a test Postgres container (or sqlite in-memory). One file per resource, covering:
- Create + read + update + delete
- Org isolation (already in Phase 1.5)
- Permission enforcement (RBAC)
- Activity + push side effects

Target: 200+ integration tests, runs in CI parallel with unit tests.

### 3.2 Error tracking

Self-hosted Sentry is heavy. Recommended: **GlitchTip** (Sentry-API compatible, MIT-licensed, runs in a single Docker container on the VPS) OR **Sentry SaaS** free tier (5k events/mo).

- `@sentry/nextjs` package
- Captures unhandled errors in server + client
- Source maps uploaded in CI for stack symbolication
- Existing `/api/errors` collector wraps Sentry for clients without JS support
- PII scrubber to keep customer data out of error reports
- Daily digest email of top errors

### 3.3 Rate limiting

`lib/rateLimit.ts` exists but only applied to `/api/ask`. Generalise:
- IP+user rate limit on every write endpoint (POST/PUT/DELETE) — 60 req/min default
- Stricter limits on `/api/auth/register`, `/api/auth/password`, `/api/push/subscribe` — 5 req/min
- Returns 429 with `Retry-After` header
- Backed by an in-memory LRU (good enough for single-VPS) or Redis (Phase 5.3)

### 3.4 Backup verification

Daily pg_dump cron exists. Add a weekly verification cron:
1. Pick the most recent backup
2. Restore to a temp database `cortexx_verify`
3. Run a smoke query (`SELECT COUNT(*) FROM "Project"` etc.)
4. Drop the temp DB
5. Email/Slack on failure

Plus a one-time documented restore drill (timed, with screenshots) before v1.0 launch.

### 3.5 Audit log

New `AuditEvent` model (immutable, append-only):

```prisma
model AuditEvent {
  id             String   @id @default(cuid())
  organizationId String
  userId         String?
  action         String   // "project.delete", "invoice.update", etc.
  resourceType   String
  resourceId     String
  metadata       Json     // before/after diff, IP, user-agent
  createdAt      DateTime @default(now())
  @@index([organizationId, createdAt])
}
```

Centralised `auditLog()` helper in `lib/audit.ts` called from every mutating route. Separate from `Activity` (which is user-facing); audit is for compliance/forensics. Admin-only audit log viewer at `/settings/audit-log`.

### 3.6 Two-factor authentication (TOTP)

- `otplib` package for TOTP generation/verification
- `User.totpSecret` (encrypted) + `User.totpEnabledAt`
- `/settings/security` page: enable 2FA → QR code → confirm code → backup codes shown
- Login flow: after password, prompt for TOTP if enabled
- Backup codes (10× single-use, hashed in DB)
- Recovery flow if codes lost (admin action)

### 3.7 Security headers + CSP

In `proxy.ts` or next.config.js:
- `Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; ...`
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(self), microphone=(self), geolocation=(self)`

Test with `https://securityheaders.com` → target A+ rating.

---

## Phase 4 — Feature completeness `[~2 weeks]`

### 4.1 Email notifications

Transactional email via **Resend** (cheap, dev-friendly) or **Postmark** (premium deliverability).

`lib/email.ts` with `sendEmail({ to, template, data })`. React Email templates in `emails/`:
- `WelcomeEmail` — new user signup
- `InviteEmail` — org invitation
- `PasswordResetEmail` — already in NextAuth flow, just template it
- `OverdueInvoiceEmail` — daily digest of overdue invoices
- `WeeklyDigestEmail` — opt-in weekly summary
- `PushFallbackEmail` — fires if push delivery fails AND user has email opt-in

### 4.2 Per-user notification preferences

```prisma
model NotificationPreference {
  id      String  @id @default(cuid())
  userId  String  @unique
  // Per category, per channel
  tasksPush       Boolean @default(true)
  tasksEmail      Boolean @default(false)
  safetyPush      Boolean @default(true)
  safetyEmail     Boolean @default(true)
  invoicesPush    Boolean @default(true)
  invoicesEmail   Boolean @default(true)
  announcementsPush  Boolean @default(true)
  announcementsEmail Boolean @default(false)
  weeklyDigest    Boolean @default(true)
  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

`/settings/notifications` UI section (above the existing push toggle) — checkboxes per category, push + email columns. `sendPush()` and `sendEmail()` check prefs before delivery.

### 4.3 Background jobs / scheduler

Today: zero scheduled work. Need:
- Daily overdue-invoice scan → push + email to project PMs
- Daily backup verification (Phase 3.4)
- Daily backup pruning (already in deploy)
- Hourly stale-push-subscription cleanup
- Weekly digest emails (opt-in)
- Hourly cert/RAMS expiry warning scan

Options:
- **node-cron** in-process (lightweight, no extra infra; restart-vulnerable)
- **BullMQ + Redis** (durable, retryable, but adds Redis dep)
- **systemd timers** on the VPS (most ops-friendly, calls `curl https://cortexbuildpro.com/api/cron/<job>` with a shared secret)

**Recommended:** systemd timers + `/api/cron/[job]` endpoints gated by `CRON_SECRET` header. Simplest, observable via journalctl, survives pm2 restarts.

### 4.4 Global search upgrade

Current `/search` does separate per-table LIKE queries. Replace with **Postgres FTS** (full-text search):

```sql
ALTER TABLE "Task" ADD COLUMN search tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,''))) STORED;
CREATE INDEX idx_task_search ON "Task" USING GIN(search);
```

Add `search` columns to: Project, Task, Invoice, Snag, Rfi, Document, Customer, Subcontractor. Unified `/api/search?q=` queries all of them in parallel, returns ranked results grouped by type. Sub-50ms even on 100k+ rows.

### 4.5 File storage migration to S3

Today: uploads live on the VPS at `/var/lib/cortexx/uploads/`. Single point of failure, no replication, can't scale horizontally.

Migrate to **Hetzner Object Storage** (S3-compatible, cheap, EU-hosted — relevant for UK construction data residency) or **Cloudflare R2** (no egress fees).

- `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`
- `/api/uploads` POST returns a presigned PUT url; client uploads directly to S3
- `/api/uploads/[name]` redirects to a presigned GET url (auth-gated, 5-min expiry)
- One-shot script migrates existing local files to S3 + updates Document.url
- Local fallback retained for `OFFLINE_DEV=1` workflow

---

## Phase 5 — Performance & scale `[~1 week]`

### 5.1 Bundle size budget

- CI step that reports first-load JS size per route
- Fail the build if any route exceeds 250kB first-load
- `@next/bundle-analyzer` for diagnosis
- Tree-shake dynamic imports for heavy libraries (pdfkit, web-push)

### 5.2 Core Web Vitals tracking

- `web-vitals` package collects LCP/INP/CLS in production
- Sent to `/api/metrics` (sampled at 10%)
- Dashboard at `/settings/performance` for admins
- Alerts on regression (>20% week-over-week)

### 5.3 Redis cache + pm2 cluster mode

Move from in-memory (single-worker) to Redis-backed for:
- Rate limit counters
- Session lookups (per-request DB hit today)
- Hot read caches (org settings, plan limits)

Once Redis is in place, switch pm2 from fork (single worker) to cluster mode (4 workers, auto-balanced). 4× throughput on the existing VPS.

### 5.4 Query optimisation pass

- `prisma generate --no-engine` + dev-mode `?prisma_debug=1` to log slow queries
- N+1 hunt: every list endpoint, verify includes are batched
- Add covering indexes for hot paths (`@@index([organizationId, status, dueDate])` on Task, etc.)
- EXPLAIN ANALYZE on the 10 slowest queries; benchmark before/after

### 5.5 CDN for static assets

- Cloudflare in front of cortexbuildpro.com (free tier)
- Cache `/_next/static/*` indefinitely (already immutable)
- Cache `/icon-*.png`, `/manifest.json` for 30 days
- Bypass cache for `/api/*` and auth-gated pages
- Bonus: DDoS protection + bot mitigation

---

## Phase 6 — Mobile distribution `[~2 weeks, mostly Apple wait time]`

### 6.1 Capacitor wrapper polish

The `ios/` directory already has the Capacitor 6 scaffold + App Store submission pack. Remaining:
- Verify `server.url` mode points at `https://cortexbuildpro.com` and refreshes correctly
- iOS-native push via APNs (Capacitor `@capacitor/push-notifications`) — separate from web push; needs APNs cert in Apple Developer account
- Safe-area-aware bottom nav (avoid the home-indicator overlap on notched devices)
- iPad split-view layout pass
- App icon + splash screens at all required sizes (already scaffolded)

### 6.2 TestFlight pipeline

GitHub Actions workflow `release-ios.yml`:
- Triggers on `v*-ios` git tag
- Runs on `macos-latest`
- `cd ios && pod install && xcodebuild -archivePath build/Cortexx.xcarchive ...`
- `xcrun altool --upload-app --type ios ...` uploads to TestFlight
- Apple secrets in GitHub: `APPLE_ID`, `APP_STORE_CONNECT_API_KEY`, `APP_STORE_CONNECT_ISSUER_ID`
- Internal testers added via App Store Connect; 5-day TestFlight cycle before App Store submission

### 6.3 App Store review submission

- Privacy policy + terms (`/privacy` + `/terms` already exist; verify against App Store guidelines)
- App Privacy disclosures in App Store Connect (data collected, tracking, etc.)
- Demo account credentials for review team
- Screenshots: iPhone 15 Pro Max + iPad Pro 12.9" in light + dark mode
- App description + keywords + categorisation
- Expected review time: 24-48h for first submission

### 6.4 Post-approval

- App Store listing live + indexed
- "Get on the App Store" badge on marketing site
- Promote in onboarding email to new SaaS users

---

## Phase 7 — Polish & launch `[~1 week]`

### 7.1 Design consistency audit

- Every modal: same close X position, same border radius, same backdrop
- Every form: same input style, same error/success colours, same button hierarchy
- Every empty state: illustration + headline + CTA
- Every loading state: skeleton screens (not spinners) where possible
- Dark + light themes (currently dark-only; add light for daytime field use)

### 7.2 User-facing documentation

- `docs/help/` — markdown help articles served at `/help/[slug]`
- "Getting started" — 5-minute walkthrough
- Per-module how-tos (snags, RFIs, timesheets, etc.)
- Keyboard shortcuts reference
- Embedded in-app help button in the top nav

### 7.3 Marketing site

Separate Next.js app at `www.cortexbuildpro.com` (or `/` of the same domain with the app moved to `app.cortexbuildpro.com`):
- Hero + value prop + screenshots
- Feature pages
- Pricing
- Customer logos / case studies (when available)
- Blog (MDX-based)
- Sign-up CTA → deep link to `/register`

### 7.4 Pricing & launch

- Pricing page live with the three plans + feature matrix
- Stripe checkout flow tested end-to-end on a real card (then refunded)
- "Founding customer" discount code: first 10 SaaS signups get 50% off year one
- Launch posts: LinkedIn (UK construction industry), Reddit r/construction (UK), Twitter/X
- ProductHunt launch (Tuesday-Thursday optimal)

### 7.5 v1.0 release announcement

- Tag `v1.0.0` on the repo
- Public changelog
- Email existing users (currently just yourself + invited teammates)
- Update ROADMAP.md → "Post-launch" sections become "v1.1" plans

---

## Out of scope for v1.0

These are explicitly punted to v1.1+:

- **Internationalisation (i18n)** — English-only for v1.0. UK + Ireland market first.
- **Native Android app** — iOS first; Capacitor Android wrap is technically free but the App Store + Play Store reviews are two separate workstreams.
- **Public API + webhooks for customers** — internal API exists, but documenting + versioning + rate-limiting it as a customer-facing surface is a project of its own.
- **SSO / SAML** — enterprise plan requirement; punt until enterprise customers ask.
- **White-label / partner reseller** — niche.
- **AI chat that takes actions** — `/ask` is read-only LLM today; an agent that creates tasks / sends RFIs etc. is v2.0 work.
- **Offline-first mobile** — current PWA caches static assets; full offline-write + sync is a major architecture change.

---

## Cumulative timeline

| Phase | Weeks | Cumulative |
|---|---|---|
| 1. Multi-tenancy | 2 | 2 |
| 2. SaaS onboarding & billing | 2 | 4 |
| 3. Hardening | 2 | 6 |
| 4. Feature completeness | 2 | 8 |
| 5. Performance & scale | 1 | 9 |
| 6. Mobile distribution | 2 (mostly Apple wait) | 11 |
| 7. Polish & launch | 1 | 12 |

**Realistic v1.0 launch: ~12 weeks of focused work.** Phases 3-6 can interleave to a degree, so a tight 10 weeks is achievable with no detours.

## Sequencing notes

- **Phase 1 must land before everything else.** Building auth, billing, RBAC, or any new feature on the single-tenant data model means re-doing it after multi-tenancy lands.
- **Phase 3 (hardening) should run in parallel with Phase 2 (SaaS), not after it.** Tests catch SaaS-flow bugs while they're being written; bolting tests on later is harder.
- **Phase 6 (mobile) should kick off in week 8.** Apple review is the long pole — the more iterations you can get in before launch, the safer.
- **Phase 7 (launch) is the only phase that genuinely depends on everything else being done.**
