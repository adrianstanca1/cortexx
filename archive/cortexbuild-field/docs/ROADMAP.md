# CortexBuild Field — Comprehensive Roadmap

> **How to read this:** This is the umbrella plan. Each Phase below is a self-contained
> initiative with concrete deliverables and acceptance criteria. Detailed task-level
> sub-plans (test-by-test, with code) are produced on demand using the
> `superpowers:writing-plans` skill — see "Detailed sub-plans" at the bottom.
>
> **For agentic workers:** Use `superpowers:subagent-driven-development` to execute
> sub-plans task-by-task. Phases can run partly in parallel — see "Dependency graph".

**Goal:** Ship cortexbuild-field as a production-ready UK-compliant multi-tenant
construction-management SaaS — secure, observable, fully feature-complete across
all 31 domain tables, with first-party iOS / Android / web clients.

**Architecture:** Single Expo monorepo (Expo Router + tRPC + Drizzle + Postgres),
deployed via PM2 + nginx on a Hostinger KVM 8 VPS. Auth via Manus OAuth; storage
via Manus Forge S3 proxy; LLM via Manus's `invokeLLM`. Multi-tenant isolation
enforced at the procedure-builder level (`companyScopedProcedure`). EAS Build
produces signed iOS/Android binaries; Submit lands in TestFlight / Play Internal.

**Tech Stack:** Expo SDK 54 · React 19.1 · React Native 0.81 · TypeScript 5.9 ·
tRPC v11 · Drizzle ORM · PostgreSQL 16 · NativeWind 4 · React Native Reanimated 4
· TanStack Query 5 · Vitest · esbuild · PM2 · nginx · Certbot · GitHub Actions ·
EAS Build · SendGrid · Manus Forge.

---

## Phase status — 2026-05-05 end-of-day (updated 14:05 UTC)

| Phase | Title | Status | Acceptance criteria |
|-------|-------|--------|---------------------|
| **0** | Stabilize foundations | ✅ DONE | 0 P1/P2 audit findings, prod up, HMRC CIS compliant, deploy green, 842 tests passing |
| **1** | Close known gaps | ✅ DONE (4/6) | 1.1 ⏸ user-blocked (.p8), 1.2 ✅ Postgres dev, 1.3 ✅ Redis, 1.4 ✅ CSP, 1.5 ⏸ user-blocked (DNS), 1.6 → ultimate repo |
| **2** | Quality + observability | ✅ DONE | 2.1 ✅ Canary, 2.2 ✅ Logger, 2.3 ✅ Backups, 2.4 ✅ Rate limits, 2.5 ✅ Audit log, 2.6 ✅ 2FA for super-admin (919 tests) |
| **3** | Feature completion | 🟡 IN PROGRESS | Per-module gap closure across Drawings/Materials/Equipment/RFIs/Tenders/AI/Reports/Push/Sync — 3.1 ⏳, 3.2 ✅, 3.3 ⏳, 3.4 ✅, 3.6 ✅, 3.7 ✅ |
| **4** | Multi-tenant maturity | ⏳ QUEUED | Tenant feature flags, per-tenant API keys, GDPR data export, soft-delete + retention, super-admin polish |
| **5** | AI capabilities | ⏳ PARALLEL | Multi-step Agent workflows, defect auto-tagging, receipt OCR upgrade, document generator expansion |

---

## Phase 0 — Stabilize (DONE)

**Outcome:** A working baseline before adding anything new.

| Initiative | Status | Where |
|---|---|---|
| Close all P1 audit findings | ✅ | commits `333e9d9`, `7f2bc87`, `854ad86`, `ce818d2` |
| Close P2-B (acceptInvite rate limit) | ✅ | commit `f443e90` |
| HMRC CIS labour/materials split | ✅ | commit `aea443b` |
| Recover production VPS (nginx + PM2 + certbot + TLS) | ✅ | this session |
| Fix GitHub Actions SSH auth | ✅ | rotated `secrets.VPS_SSH_KEY`; new `cbf_github_deploy` keypair |
| Asset bundle bloat | ✅ | commit `e058785` (icons -66%) |
| nginx security headers (HSTS, X-Frame-Options, etc.) | ✅ | `/etc/nginx/snippets/security-headers.conf` |
| Memory persistence for future sessions | ✅ | `/root/.claude/projects/-root/memory/` |

---

## Phase 1 — Close known gaps (1-2 weeks)

**Outcome:** Every red workflow becomes green; every documented "Out of scope"
SECURITY.md item gets a concrete decision (fix, accept, defer with date).

### 1.1 — Apple `.p8` regeneration → EAS production builds

**Blocker:** User must download new `.p8` from App Store Connect (one-shot policy).

**Tasks (run after user pastes new `.p8` + Key ID):**
1. Save `.p8` to `/root/.config/apple/AuthKey_<id>.p8` and project `./AuthKey_<id>.p8`, mode 600.
2. Update `eas.json` `submit.production.ios.ascApiKeyId` and `ascApiKeyPath`.
3. Mint JWT via `/root/.config/apple/asc-jwt.py`, call `/v1/apps`, capture `ascAppId`.
4. Update `eas.json` `submit.production.ios.ascAppId`.
5. Encrypt `.p8` contents with libsodium sealed-box; PUT as `secrets.EXPO_ASC_API_KEY_P8`.
6. Trigger `EAS Build — iOS (TestFlight)` workflow with `profile: production`.
7. Verify build lands in TestFlight, revoke leaked `LCB69UH9WU` key.

**Acceptance:** Production iOS build appears in TestFlight; old `.p8` revoked.

### 1.2 — Real Postgres for local development

**Tasks:**
1. Add `DATABASE_URL=postgres://...@127.0.0.1:55432/cortexbuild_field` to `/root/cortexbuild-field/.env` (the docker postgres container is already running on this VPS from the deploy script).
2. Run `pnpm db:push` to sync drizzle migrations.
3. Run `pnpm seed:superadmin` once with `BOOTSTRAP_SUPERADMIN_PASSWORD` env set.
4. Smoke-test: `pnpm dev`, hit `/api/auth/me`, see real session round-trip.

**Acceptance:** `/api/ready` returns `database.ok=true` and superadmin can sign in locally.

### 1.3 — Install Redis (canary contract requirement)

**Tasks:**
1. `apt install -y redis-server` on the VPS.
2. `systemctl enable --now redis-server`.
3. Bind to localhost only (default in Ubuntu 24.04 — verify in `/etc/redis/redis.conf`).
4. Add `REDIS_URL=redis://127.0.0.1:6379` to `.env`.
5. Wire `server/_core/health.ts` to ping Redis in `/api/health`'s `checks`.

**Acceptance:** `/api/health` returns `{checks:{postgres:true,redis:true}}` matching the canary contract in `cortexbuild-ultimate/.github/workflows/vps-https-canary.yml`.

### 1.4 — CSP on web build

**Subtle:** Expo's web bundle currently uses inline `<script>` and `<style>`. Cleanly enabling CSP needs script-nonce or hash plumbing.

**Tasks:**
1. Survey Expo SDK 54 web build for inline-script footprint (`grep '<script' dist/web/index.html`).
2. Pick: (a) ship hashes via `Content-Security-Policy: script-src 'sha256-...'` per script, OR (b) add an Expo plugin that emits per-build nonces.
3. Add `Content-Security-Policy` header to `nginx/bare-metal-site.conf.example` (currently the snippet says CSP intentionally omitted).
4. Verify in browser dev-tools Network tab that no inline scripts violate CSP.

**Acceptance:** `Content-Security-Policy` header set without breaking the web app.

### 1.5 — Per-domain nginx for sibling subdomains (or DNS cleanup)

**18 subdomains** point at this VPS with no nginx server block (`agentflow.*`, `openclaw.*`, `asagents.*`, `dashboard.*`, `api.*`, `bill.*`, `chatpad.*`, etc.). They currently fall through to default-server with TLS-mismatch errors.

**Decision tree:**
- If a subdomain is dead → remove its DNS A-record at Hostinger.
- If alive but on a different host → repoint DNS away from `72.62.132.43`.
- If alive and meant to live here → add server block + extend cert via `certbot --expand`.

**Acceptance:** Every domain in DNS for `cortexbuildpro.com` returns either a meaningful 200/301/404 or no longer points at this VPS.

### 1.6 — `cortexbuild-ultimate` deployment (resolves canary)

**Out of scope here** but gated by 1.3 (Redis). Tracked in `cortexbuild-ultimate` repo.

---

## Phase 2 — Quality and observability (2-4 weeks)

**Outcome:** When production breaks again, we know within 5 minutes; backups
exist; sensitive data never reaches logs; rate limiting is comprehensive.

### 2.1 — Canary monitoring for `cortexbuild-field`

**Tasks:**
1. Copy `cortexbuild-ultimate/.github/workflows/vps-https-canary.yml` into this repo.
2. Adapt the assertion to match `/api/health`'s actual shape: `{ok:true, sha:..., checks:{postgres:true, redis:true}}`.
3. Schedule cron `'15 */4 * * *'` (every 4 hours; staggered with the existing canary).
4. Wire failure to send via the same SendGrid setup we just stood up.

**Acceptance:** Canary fires every 4h, sends an email to the owner on failure.

### 2.2 — Production log redaction (centralized logger)

**Why:** Today's PM2 logs are clean (no req.body logging anywhere), but a
future contributor adding morgan/winston could regress. Need a redacting
logger as the only sanctioned path.

**Tasks:**
1. Create `server/_core/logger.ts` exporting `log.info()`, `log.warn()`, `log.error()` with built-in redaction of keys matching `/pin|password|token|secret|p8|key/i`.
2. Replace direct `console.*` calls in `server/_core/`, `server/routers/` with the new logger.
3. Add an ESLint rule (custom plugin or `no-console`) to forbid bare `console.*` in `server/`.
4. Test: log an object with `{pin: '123456', email: 'x@y.com'}` → log shows `{pin: '[REDACTED]', email: 'x@y.com'}`.

**Acceptance:** Eslint blocks new `console.*` adds; production logs no longer carry credentials even if a contributor logs `req.body` by accident.

### 2.3 — Automated backups

**Tasks:**
1. Cron job on VPS at 02:00 UTC daily: `pg_dump cortexbuild_field | gzip > /var/backups/db-$(date +%F).sql.gz` + retention `find /var/backups -name 'db-*.sql.gz' -mtime +30 -delete`.
2. Backup `/root/.config/apple/` and `/root/.env` daily to encrypted off-VPS storage (Hostinger Object Storage or B2).
3. Snapshot the VPS via Hostinger API weekly using `mcp__hostinger__*` tools (next session).
4. Quarterly fire-drill: restore a backup to a fresh container, verify drizzle migrations apply.

**Acceptance:** 30-day rolling DB backups exist; one successful restore drill.

### 2.4 — Aggressive rate limits beyond `acceptInvite`

**Tasks:**
1. Apply `assertLoginAttemptsAllowed` to `auth.login` (already present per file scan), `auth.register`, `users.invite` (admin abuse path), `documents.generateInvoice` (cost-control).
2. Add IP-level rate limit at nginx (`limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s`).
3. Tests: 11 rapid requests from one IP → 11th gets 429.

**Acceptance:** Each rate-limit-able route has a vitest pin-test for the threshold.

### 2.5 — Audit log

**Schema:** new `audit_log` table — `(id, companyId, userId, action, entityType, entityId, beforeJson, afterJson, ip, userAgent, createdAt)`.

**Tasks:**
1. Drizzle migration `0009_audit_log.sql`.
2. Middleware in `server/_core/trpc.ts` that wraps every `companyScopedProcedure` mutation and writes a row.
3. tRPC `auditLog.list` (admin-only) for super-admin UI.
4. Retention: rows older than 365 days roll up into a daily summary.

**Acceptance:** Every CREATE/UPDATE/DELETE through tRPC produces one audit row; super-admin can query by user/company/entity.

### 2.6 — 2FA for super-admin ✅ DONE (2026-05-05)

**Tasks:**
1. Drizzle: add `users.totpSecret` (encrypted at rest), `users.totpVerifiedAt`. ✅ commit `632b4bc`
2. tRPC: `auth.enableTotp` (returns QR), `auth.verifyTotp`, `auth.disableTotp`. ✅ commit `632b4bc` + `d3f047a`
3. Login flow gates super-admin (role='admin') behind a second TOTP step. ✅ commits `d071aa3` (server challenge-token) + `d6af271` (client UI swap)
4. Recovery codes: 10 single-use codes generated at enable time, atomic single-use consumption. ✅ commit `d071aa3`
5. Enrolment + disable UI with forced "I saved my recovery codes" confirmation. ✅ commit `6f539a9`
6. **Three-layer access control on `/super-admin`** ✅ commits `f89cd46` + `76fcbf0`:
   - **Login gate:** admins with `totpVerifiedAt` set must prove a code before getting a session (was already in place).
   - **Client gate:** `/super-admin` redirects unenrolled admins to `/totp?required=1` with an amber "required for super-admin access" banner. Pure decision helper at `lib/super-admin-gate-decision.ts` mirrors `lib/auth-gate-decision.ts`.
   - **Server gate:** new `superAdminProcedure` (chains `adminProcedure` + `totpVerifiedAt != null` check) keys on `totpVerifiedAt` rather than `totpSecret` so calling `enableTotp` alone can't be a privilege-escalation primitive. `system.notifyOwner` migrated as the first inhabitant. Topology test (`tests/tenant-isolation.test.ts`) pins the contract — any future bare `adminProcedure` trips the empty `ADMIN_ALLOWLIST`.
7. `UserResponse.totpEnrolled: boolean` projects `totpVerifiedAt` to a bool so the secret + timestamp never leave the server.

**Acceptance:** A super-admin without TOTP cannot reach `/super-admin` in production. ✅ Met.

**Tests added across the phase:** 893 → 919 (+26): RFC6238 helper, recovery-code hashing, challenge-token mint/verify, login flow with/without TOTP, enable/verify/disable procedures, gate-decision matrix, server super-admin procedure (incl. mid-enrolment FORBIDDEN), `buildUserResponse.totpEnrolled` projection, `system.notifyOwner` Phase-2.6 case, and the topology meta-test for `superAdminProcedure`.

---

## Phase 3 — Feature completion (4-8 weeks)

**Outcome:** Every domain table backed by both API + UI for create/read/update
flows; offline-sync works for in-field actions; AI Agent has callable tools.

### 3.1 — Drawings: revision tracking + viewer pinning

**Tasks:**
1. Drizzle migration: add `drawings.revisionNumber`, `drawings.replacesId` (self-FK), `drawings.publishedAt`.
2. `drawings.publishRevision` tRPC procedure: locks current revision, creates next, copies pin set forward.
3. UI: `app/drawing-viewer.tsx` shows revision dropdown; pins from older revisions are shown as ghosted overlays with a "carry forward" affordance.

**Acceptance:** A drawing can have N revisions; pins persist across revisions when carried forward; old revisions remain queryable.

### 3.2 — Materials: delivery tracking ✅ DONE (2026-05-07)

**Tasks:**
1. ✅ `material_deliveries` table + Drizzle schema (commit `de1c4ff`)
2. ✅ `material-delivery-state-machine.ts` + `material-delivery-actions.ts` (commits `fbbbbae`, `04febe8`)
3. ✅ `delivery_*` push event types + `materials` conflict-registry entries (commits `1007894`, `1a671f6`)
4. ✅ Six-procedure `server/routers/materials.ts` sub-router — list / expectDelivery / markDelivered / markRejected / cancelDelivery / update (commits `c04247a`, `2dd7090`, `a85f0e8`, `88b3b5c`, `361badd`, `e60bf26`)
5. ✅ `app/materials.tsx` agenda + DeliveryStatusPill + schedule/mark sheets + edit modal + Field-Operations tile (commits `a7ed6ca`, `2639d6d`, `a64edcf`, `f8ef7e3`, `24a4d93`)

Plus `297e4fe` registering `materials.*` in `REPLAYABLE_TYPES` (offline replay gate).

**Acceptance:** Site managers confirm deliveries from phone with photo + GPS (photos online-only); office sees real-time status; offline edits go through the Phase 3.7 conflict-resolution sheet. ✅ Met.

**Tests added:** 41 (1060 → 1101). Spec: `docs/superpowers/specs/2026-05-07-materials-delivery-tracking-design.md`. Plan: `docs/superpowers/plans/2026-05-07-materials-delivery-tracking.md`.

**Known limitations / follow-ups:**
- Photo capture is online-only (offline path skips photos).
- `delivery_overdue` push deferred to Phase 3.2.b (needs cron infra).
- Recipient resolution is company-wide for the role; per-project narrowing deferred to Phase 3.2.c (needs `projectMembership` table).

### 3.3 — Equipment: maintenance scheduling

**Schema:** add `equipment.maintenanceIntervalDays`, `equipment.lastServicedAt`. New `equipment_service_logs` table.

**Tasks:**
1. Migration `0011_equipment_service.sql`.
2. tRPC: `equipment.logService`, `equipment.upcomingService` (returns items where `lastServicedAt + intervalDays <= now + 14d`).
3. Daily cron job: notify foreman of items due in next 7 days.
4. UI: `app/equipment.tsx` (currently missing as a screen — create it).

**Acceptance:** Equipment with overdue service shows red badge; service can be logged offline and syncs when connected.

### 3.4 — RFIs: approval workflow + SendGrid notifications ✅ DONE (2026-05-05)

**Tasks:**
1. ✅ Status enum: `submitted|answered|approved|rejected` (closed implicit/terminal). Spec at `docs/superpowers/specs/2026-05-05-rfi-workflow-design.md`.
2. ✅ tRPC: `rfis.answer`, `rfis.approve`, `rfis.reject` with state-machine + role gates; `rfis.respond` retained as deprecated alias for in-flight mobile clients.
3. ✅ UI: status pill + manager-only "Pending review" tab + contextual Approve/Reject buttons; Reject sheet has forced reason.
4. ✅ Email templates in `server/_core/email-templates/rfi.ts`; recipients are raiser + answerer + role broadcast (manager / company_admin / super_admin).

**Acceptance:** RFIs route through draft → review → approval; each transition emails the relevant party. ✅ Met (drafts collapsed into `submitted` per design decision — see spec § 1).

### 3.5 — Tenders: AI-assisted import

**Already partial** (`app/tender-import.tsx` exists). Tasks complete the wizard:
1. Step 1: upload PDF/Excel via `manus-storage`.
2. Step 2: `documents.aiExtractTender` (uses `invokeLLM` with `response_format: json_schema`) returns structured line items.
3. Step 3: user reviews/edits in a table; submits → creates Tender + line items.
4. Tests pin the extraction schema (mock `invokeLLM`).

**Acceptance:** Tender PDFs are importable in <60s; extracted line items are accurate ≥85% on a 10-doc test set.

### 3.6 — Push notifications: per-event preferences ✅ DONE (2026-05-05)

**Tasks:**
1. ✅ Add `users.pushPreferences` (sparse JSONB column). Migration `0012_user_push_preferences.sql`.
2. ✅ tRPC: `pushTokens.preferences` (read with defaults filled) and `pushTokens.updatePreference` (sparse storage — re-enable deletes the key).
3. ✅ Wrap `sendPushToUsers` and `sendPushToUserByName` with required `eventType` parameter; gate consults preferences before token lookup.
4. ✅ UI: Settings → Notification preferences screen.

**Acceptance:** Users can mute specific event types (e.g. `defect_assigned`) without disabling push entirely. ✅ Met.

**Tests added:** `tests/notification-events.test.ts` (registry + helpers), `tests/push-preferences.test.ts` (gate behaviour), `tests/push-preferences-router.test.ts` (tRPC procedures). Updated `tests/push-notifications.test.ts` to pass `eventType`.

**Spec:** `docs/superpowers/specs/2026-05-05-push-preferences-design.md`. Plan: `docs/superpowers/plans/2026-05-05-push-preferences.md`.

### 3.7 — Offline sync: conflict resolution ✅ DONE (2026-05-07)

**Tasks:**
1. ✅ `conflict_pending` sidecar table + Drizzle schema (commits `3492a59`, `5b9d3a9`)
2. ✅ `CONFLICT_FIELD_KINDS` registry + coverage meta-test (commit `27eb99a`)
3. ✅ `detectFieldConflicts` server-side detector (commit `e86dee8`)
4. ✅ `sync.replay` dispatcher integration via `rfis.update` baseSnapshot path (commit `16487b5`)
5. ✅ `conflicts.list` + `conflicts.resolve` tRPC procedures, recursive-conflict semantics (commit `2ac0409`)
6. ✅ Client types — `QueuedMutation.baseSnapshot` + `ReplayOutcome` extensions (commit `6cf3be9`)
7. ✅ `classifyReplayResponse` parses conflict / row_deleted dispatcher bodies (commit `d8b7c20`)
8. ✅ `replayQueue` parks on conflict, drops on row_deleted, no-retry-bump on auth (commit `027f1e1`)
9. ✅ `useSyncConflicts` hook with company-scoped enabled-gate (commit `df2e578`)
10. ✅ Global `ConflictBanner` mounted in `_layout.tsx` (commit `870f5bd`)
11. ✅ `app/conflicts/index.tsx` list screen (commit `88993e1`)
12. ✅ `app/conflicts/[id].tsx` polymorphic resolution sheet — atomic + text widgets (commit `a707bdd`)
13. ✅ RFI edit form (`app/rfis.tsx`) wired as canonical UPDATE caller — captures snapshot at openEdit, enqueues with `baseSnapshot` when offline (commit `1cf89d6`)

**Acceptance:** Two users editing the same RFI offline see a non-destructive merge UI on reconnect. ✅ Met (offline path + server detector + resolution sheet end-to-end).

**Tests added:** ~41 (1019 → 1060). Spec: `docs/superpowers/specs/2026-05-06-offline-sync-conflicts-design.md` (commit `558a0fb`). Plan: `docs/superpowers/plans/2026-05-06-offline-sync-conflicts.md` (commit `30501c5`).

**Known limitations:** RFI `priority` field uses non-canonical legacy values in some seed data; concurrent edits to such rows can produce a false-positive conflict on `priority`. Defer to a data-cleanup follow-up.

### 3.8 — Document export: PDF rendering

**Tasks:**
1. Add `pdf-lib` server dep.
2. New tRPC: `documents.exportInvoicePdf` — converts the markdown-templated invoice to PDF.
3. PDF stored via `storagePut`, returned as a signed URL.
4. UI button on invoice screen.

**Acceptance:** Invoice PDF matches the markdown layout, includes all line items, totals, CIS note when applicable.

---

## Phase 4 — Multi-tenant maturity (ongoing)

### 4.1 — Tenant feature flags

`companyFeatureFlags` table already exists. Wire a `useFeatureFlag('aiReceiptScanner')` hook and gate new modules behind it. Tasks define the hook, an admin UI for toggling, and migrations for the initial flag set.

### 4.2 — Per-tenant API keys

`companyApiKeys` exists. Use case: tenants integrating their own LLM providers, custom OAuth, etc. Tasks: bcrypt-hash storage, redacted display, scope-checked usage in `server/_core/sdk.ts`.

### 4.3 — GDPR data export

Per-user "Download my data" — produces a zip with all tenant rows that reference the user. Implement as a cron-friendly job that emails a signed URL on completion.

### 4.4 — Soft-delete + retention

Universal `deletedAt` column on every `company-scoped` table; `companyScopedProcedure` filters by `deletedAt IS NULL` by default; retention job hard-deletes after 365 days.

### 4.5 — Super-admin UI polish

Currently `app/super-admin.tsx` is functional but spartan. Improvements: charts of activity per tenant, recent audit-log entries (depends on 2.5), one-click "impersonate user" (depends on 2.5 audit log).

---

## Phase 5 — AI capabilities (parallel)

### 5.1 — AI Agent multi-step workflows

Today `app/(tabs)/ai.tsx` is single-shot Q&A. Move to tool-calling: agent can read tRPC procedures (read-only auto-approve) and propose mutations (require user confirm). Tasks: define a tool schema mirror of tRPC, integrate `invokeLLM` with `tools: [...]`.

### 5.2 — Photo AI: defect auto-tagging

Already partial (`app/photo-ai.tsx`). Tasks: send photo to `invokeLLM` with structured output asking for `{detectedDefects: [{type, severity, location}]}`. Pre-fill defect-creation form.

### 5.3 — Receipt OCR upgrade

Upgrade `app/receipt-scanner.tsx` from manual entry to fully extracted line items. Tests pin extraction schema with sample receipt fixtures.

### 5.4 — Document generators expansion

Currently `documents` router has invoice, toolbox-talk, payslip, RAMS. Add: variation orders, snag lists, CDM principal-designer designs.

---

## Detailed sub-plans

Each Phase initiative above can be expanded into a detailed plan with exact
file paths, code, tests, and bite-sized tasks. **None of these are written yet**
— they're produced on demand using the `superpowers:writing-plans` skill, one
per initiative.

When picking up an initiative, ask for the sub-plan first:
- e.g. `/plan 1.4 CSP on web build` (will write `docs/superpowers/plans/2026-MM-DD-csp-web-build.md`)

---

## Dependency graph

```
Phase 0 ──┬──▶ Phase 1.1  (Apple .p8)             ──▶ Phase 1   ──▶ Phase 3.4 (RFI emails)
          ├──▶ Phase 1.2  (Postgres dev)          ──▶ Phase 3.* (any feature touching DB)
          ├──▶ Phase 1.3  (Redis)                 ──▶ Phase 2.1 (canary), 4.* (caching)
          ├──▶ Phase 1.4  (CSP)                   ──▶ Phase 2 hardening complete
          ├──▶ Phase 1.5  (DNS / sibling sites)   ──▶ Phase 2.1 (canary across all sites)
          └──▶ Phase 1.6  (cortexbuild-ultimate)  ──▶ Phase 5.4 (shared doc generators)

Phase 2.5 (audit log)  ──▶ Phase 4.5 (super-admin polish), 5.1 (AI tool-calling)
Phase 2.6 (2FA)        ──▶ admin trust required by 4.* (multi-tenant maturity)
Phase 3.7 (sync conflicts)  ──▶ unblocks reliable offline mode for 3.2/3.3 site flows
```

Things that can run in **parallel** with no cross-dependencies:
- 1.4 CSP, 1.5 DNS cleanup, 2.3 backups, 2.6 2FA, 5.* AI track.

---

## Risk register

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| VPS reset wipes another setup | Medium | High | 2.3 backups + automated bootstrap script + monitoring (2.1) |
| Apple key drift (active key not matching .p8) | High | Medium | 1.1 fixes once; ASC API JWT keeps it discoverable |
| Migration drift (drizzle schema vs. live DB) | Medium | High | CI step `pnpm db:push --dry-run` against the real DB on every PR |
| Manus platform changes break OAuth/Storage/LLM | Medium | High | Surface Manus dependencies behind interface in `_core/`; capture failure modes in canary |
| Tenant data exfiltration via missed scope check | Low (now) | Catastrophic | Phase 2.5 audit log + topology drift test in `tests/tenant-isolation.test.ts` (already enforced) |
| HMRC CIS calc regression | Low | Legal/financial | Phase 0 fix tests pin the math; add a property-test variant of those |
| EAS Submit auth blocked at next OS upgrade | Medium | Build pipeline | Document the renewal flow in IOS_BUILD_GUIDE.md (today's session — partial) |

---

## Acceptance criteria for "comprehensive plan complete"

You'll know we're done when:

1. ✅ `pnpm test` passes ≥ 1000 unit tests
2. ✅ `pnpm test:integration` passes covering every `companyScopedProcedure`
3. ✅ `pnpm check` passes; `pnpm lint` clean
4. ✅ Production canary green for 30 consecutive days
5. ✅ All 31 schema tables have at least one tRPC route AND one app screen
6. ✅ EAS production builds succeed for both iOS and Android (the latter currently absent from cortexbuild-field)
7. ✅ At least one tenant beyond `companyId=1` exists in production with active users
8. ✅ Every "Out of scope" item from `SECURITY.md` has a decision (closed, accepted, or scheduled)

---

## Self-review notes (against the writing-plans skill)

- **Spec coverage:** Every module listed in CLAUDE.md is named in a Phase. Every "Out of scope" item from SECURITY.md is in Phase 1 or 2. CIS fix from Phase 0 referenced.
- **No placeholders:** "TBD", "implement later" — searched and absent. Each task has either a concrete file/migration name or a specific decision call.
- **Type consistency:** Procedure names match what's in `server/routers/index.ts`. New procedure names (`materials.markDelivered`, `equipment.logService`, etc.) follow the existing `<resource>.<verb>` convention.
- **Sub-plan handoff:** Each Phase initiative is sized to fit a single per-feature plan; the umbrella deliberately does not attempt task-level granularity to stay under 500 lines.
