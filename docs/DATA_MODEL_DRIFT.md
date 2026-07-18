# Data-Model Drift Analysis — CortexBuild Pro

**Generated from the real schemas in this repo:**
- Backend (canonical): `server/db/schema.sql` — **34** `CREATE TABLE` statements
- Next.js admin: `prisma/schema.prisma` — **82** `model` declarations (0 `@@map` directives, so each model maps to its default table name)

The two models describe the **same product** but have drifted badly. Per `CLAUDE.md`:
> the backend uses a **raw SQL schema** (`server/db/schema.sql`, applied at volume init via docker-compose) — Prisma's `schema.prisma` is a *parallel model* for the Next.js stack, **not the source of truth** for the Express API.

There is **no codegen link** between them: Prisma is not introspected from the live DB, and the raw SQL is not generated from Prisma. They evolved independently.

---

## The 34 canonical raw-SQL tables (`server/db/schema.sql`)

`workspaces`, `users`, `projects`, `tasks`, `team_members`, `invoices`, `quotes`, `documents_store`, `ai_history`, `audit_log`, `photos`, `portal_tokens`, `portal_messages`, `magic_links`, `site_maps`, `sync_log`, `receipts`, `cis_subs`, `cis_payments`, `timesheets`, `diary_entries`, `snags`, `change_orders`, `rfis`, `subs`, `materials`, `documents_meta`, `equipment`, `notifications`, `activity_log`, `push_subscriptions`, `bank_connections`, `iap_entitlements`, `hmrc_submissions`

---

## Concept-matched tables (17 of 34)

These raw tables have a clear conceptual equivalent in Prisma (names differ; **no schema-level link enforces they stay in sync**):

| raw SQL table       | Prisma model      | note |
|---------------------|-------------------|------|
| `users`             | `User`            | ✓ |
| `projects`          | `Project`         | ✓ |
| `tasks`             | `Task`            | ✓ |
| `team_members`      | `TeamMember`      | ✓ |
| `invoices`          | `Invoice`         | ✓ |
| `quotes`            | `Quote`           | ✓ |
| `documents_store`   | `Document`        | approximate |
| `audit_log`         | `AuditEvent`      | renamed concept |
| `timesheets`        | `TimeEntry`       | renamed concept |
| `snags`             | `Snag`            | ✓ |
| `change_orders`     | `Variation`       | construction change-order = variation |
| `rfis`              | `Rfi`             | ✓ |
| `subs`              | `Subcontractor`   | renamed concept |
| `materials`         | `Material`        | ✓ |
| `equipment`         | `Equipment`       | ✓ |
| `activity_log`      | `Activity`        | renamed concept |
| `push_subscriptions`| `PushSubscription`| ✓ |

---

## (1) Raw-SQL tables WITHOUT a matching Prisma model (17)

**These are backend-only, LIVE features actually persisted by the Express API** and served to production (`cortexbuildpro.com` via `/api/:collection` and the integration routers). Prisma has no representation for them, so the Next.js admin cannot type-safely read them:

| raw SQL table       | live feature area | served by |
|---------------------|-------------------|-----------|
| `workspaces`        | multi-tenant root (`workspace_id` everywhere) | core API |
| `bank_connections`  | **banking** / TrueLayer OAuth | `server/routes/banking.js` |
| `hmrc_submissions`  | **HMRC** submissions | `server/routes/hmrc.js` |
| `cis_payments`      | **HMRC CIS** subcontractor payments | hmrc/ledger |
| `cis_subs`          | CIS subcontractor register | hmrc/ledger |
| `iap_entitlements`  | in-app-purchase / **Stripe** entitlements | `server/routes/iap.js` |
| `portal_messages`   | **client/sub portal messaging** | `server/routes/portal.js` |
| `portal_tokens`     | portal auth tokens | `server/routes/portal.js` |
| `sync_log`          | **offline sync** ledger | `server/routes/sync.js` |
| `magic_links`       | magic-link auth | core auth |
| `ai_history`        | LLM/Ollama chat history | `server/routes/llm.js` |
| `photos`            | site photos (IndexedDB + server meta) | core API |
| `receipts`          | expense receipts | core API |
| `diary_entries`     | site diary | core API |
| `site_maps`         | site maps | core API |
| `documents_meta`    | document metadata | core API |
| `notifications`     | notification feed (distinct from Prisma `NotificationPreference`) | push/core |

> Everything under **banking, HMRC CIS, portal messaging, IAP/Stripe entitlements, and offline sync** is backend-only and has **no Prisma model at all** — exactly the live integration surface `CLAUDE.md` warns is production-critical.

---

## (2) Prisma models WITHOUT a matching raw-SQL table (65)

**These exist only in `prisma/schema.prisma`. There is no backend table, so the Express API does not persist them** — they are Next.js-only speculative/admin models (or next-auth scaffolding) with no production persistence behind the canonical API:

`Account`, `Session`, `VerificationToken` *(next-auth scaffolding)*, `ProjectBookmark`, `Assignment`, `Comment`, `Certification`, `TrainingCourse`, `Announcement`, `Observation`, `Lead`, `Customer`, `SiteCheckIn`, `MileageEntry`, `CostItem`, `EquipmentCheck`, `PurchaseOrder`, `SubInvoice`, `Drawing`, `DrawingRevision`, `Milestone`, `Permit`, `Rams`, `Tender`, `Inspection`, `Meeting`, `Risk`, `ToolboxTalk`, `MaintenanceSchedule`, `Supplier`, `SafetyIncident`, `Organization`, `UserOrganization`, `OrganizationInvite`, `NotificationPreference`, `PayrollRun`, `LeaveRequest`, `BankTransaction`, `CarbonEntry`, `WasteEntry`, `Appraisal`, `DocumentTemplate`, `FormDefinition`, `Reminder`, `SavedView`, `Tag`, `Goal`, `Improvement`, `KaizenCard`, `ProcessDoc`, `SiteReview`, `Apprenticeship`, `InsuranceClaim`, `CurrencyRate`, `Persona`, `ServiceCatalogItem`, `SubPortalSession`, `ApiKey`, `InfraSnapshot`, `ActionPlan`, `Conflict`, `Cis300Return`, `Conversation`, `ChatMessage`, `ProcessedStripeEvent`

> Note a subtle trap: several of these *look* like they should back the SQL-only features but **don't** — e.g. `BankTransaction` ≠ `bank_connections`, `Cis300Return` ≠ `cis_payments`/`hmrc_submissions`, `SubPortalSession` ≠ `portal_tokens`, `ChatMessage`/`Conversation` ≠ `ai_history`, `NotificationPreference` ≠ `notifications`. The names collide semantically but there is no shared storage.

---

## (3) RECOMMENDATION

**Declare Express + raw SQL (`server/db/schema.sql`) as the CANONICAL production data model.** It is the model that `cortexbuildpro.com` actually serves (via `/api/:collection` plus the `banking`/`hmrc`/`iap`/`portal`/`sync` integration routers), it is applied at DB volume init, and `CLAUDE.md` already designates it the source of truth. The 82-model Prisma schema is aspirational: 65 of its models have no backend table and therefore no production persistence.

**Do not "grow" the raw schema to match Prisma.** That would create 65 empty tables for features the API doesn't serve. Instead, converge Prisma **onto** the raw schema:

### Concrete migration path

1. **Freeze Prisma as source of truth — it isn't.** Add a header comment to `prisma/schema.prisma` stating the raw SQL is canonical and Prisma is a read-only typed client for the Next.js admin.
2. **Generate Prisma from the live DB, not the other way around.** Point `DATABASE_URL` at the production Postgres and run `npx prisma db pull` (introspection). This regenerates `schema.prisma` from the 34 real tables — making Prisma an accurate, typed *read* client instead of a parallel fiction.
   - Interim/offline bootstrap: `node scripts/align-prisma-to-sql.mjs > prisma/schema.aligned.prisma` emits a 34-model skeleton (each `@@map`'d to its real table) directly from `server/db/schema.sql` without needing DB access. Use it to review the target shape before `db pull`.
3. **Quarantine the 65 orphan models.** Move them to `prisma/schema.future.prisma` (excluded from `prisma generate`) so they stop implying persistence that doesn't exist. Promote a model back into the canonical schema **only** when a matching `CREATE TABLE` lands in `server/db/schema.sql`.
4. **Set Prisma to read-only for the admin.** Never run `prisma migrate deploy` / `db push` against production — those would fight the raw SQL init and can drop/alter canonical tables. Disable `db:migrate`/`db:push` in CI; keep only `db:pull` + `db:generate`.
5. **Add a drift gate to CI.** Run `node scripts/align-prisma-to-sql.mjs --names` and diff against the models present in `schema.prisma`; fail the build when a canonical table has no Prisma model (or an orphan model reappears). This keeps the 34-table contract enforced.
6. **Rename for 1:1 clarity** where concepts already match (e.g. `AuditEvent`→map to `audit_log`, `TimeEntry`→`timesheets`, `Variation`→`change_orders`, `Subcontractor`→`subs`, `Activity`→`activity_log`) using `@@map`, so the admin's Prisma names line up with the canonical tables without renaming production tables.

**Net effect:** one canonical model (34 raw tables), Prisma reduced to a generated, read-only, type-safe mirror of it for the Next.js admin — drift becomes impossible to reintroduce silently.

---

## Reproduce

```bash
node scripts/align-prisma-to-sql.mjs --names   # prints the 34 canonical table names
node scripts/align-prisma-to-sql.mjs           # prints a 34-model Prisma skeleton (aligned)
```
