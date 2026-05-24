-- ============================================================================
-- 0004_add_companyid_to_tenant_tables.sql
-- ============================================================================
-- Adds a `companyId integer NOT NULL DEFAULT 1` column to the eight tenant-
-- scoped tables that lacked one, and backfills it from the parent project
-- where possible.
--
-- This migration is the schema half of the multi-tenancy rollout. The Drizzle
-- schema (drizzle/schema.ts) is updated in the same commit. Server-side
-- procedures that touch these tables can subsequently move from
-- protectedProcedure to companyScopedProcedure.
--
-- Existing rows are assigned to companyId = 1 by default. For child tables
-- that have a `projectId`, the row is then re-assigned to its parent project's
-- companyId (so a project's defects/incidents/permits/etc. follow the project's
-- tenant). Rows with no projectId stay at companyId = 1.
--
-- All statements are idempotent (IF NOT EXISTS, conditional UPDATE) so this
-- file can be re-applied safely.
-- ============================================================================

-- ── projects: root of the tenant tree ────────────────────────────────────────
ALTER TABLE projects ADD COLUMN IF NOT EXISTS "companyId" integer NOT NULL DEFAULT 1;
--> statement-breakpoint

-- ── child tables that already reference projectId ───────────────────────────
ALTER TABLE tasks         ADD COLUMN IF NOT EXISTS "companyId" integer NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE incidents     ADD COLUMN IF NOT EXISTS "companyId" integer NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE defects       ADD COLUMN IF NOT EXISTS "companyId" integer NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE permits       ADD COLUMN IF NOT EXISTS "companyId" integer NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS "companyId" integer NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE files         ADD COLUMN IF NOT EXISTS "companyId" integer NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE documents     ADD COLUMN IF NOT EXISTS "companyId" integer NOT NULL DEFAULT 1;--> statement-breakpoint

-- ── backfill child rows from their parent project ───────────────────────────
-- Only re-assign rows still at the default 1 — running the migration twice
-- on already-rebalanced data is a no-op for any row whose companyId has been
-- moved off 1 by a later operation.

UPDATE tasks t
   SET "companyId" = p."companyId"
  FROM projects p
 WHERE t."projectId" = p.id
   AND t."companyId" = 1
   AND p."companyId" <> 1;--> statement-breakpoint

UPDATE incidents i
   SET "companyId" = p."companyId"
  FROM projects p
 WHERE i."projectId" = p.id
   AND i."companyId" = 1
   AND p."companyId" <> 1;--> statement-breakpoint

UPDATE defects d
   SET "companyId" = p."companyId"
  FROM projects p
 WHERE d."projectId" = p.id
   AND d."companyId" = 1
   AND p."companyId" <> 1;--> statement-breakpoint

UPDATE permits pe
   SET "companyId" = p."companyId"
  FROM projects p
 WHERE pe."projectId" = p.id
   AND pe."companyId" = 1
   AND p."companyId" <> 1;--> statement-breakpoint

UPDATE daily_reports dr
   SET "companyId" = p."companyId"
  FROM projects p
 WHERE dr."projectId" = p.id
   AND dr."companyId" = 1
   AND p."companyId" <> 1;--> statement-breakpoint

-- files and documents have a nullable projectId; only backfill rows that
-- actually link to a project.
UPDATE files f
   SET "companyId" = p."companyId"
  FROM projects p
 WHERE f."projectId" IS NOT NULL
   AND f."projectId" = p.id
   AND f."companyId" = 1
   AND p."companyId" <> 1;--> statement-breakpoint

UPDATE documents d
   SET "companyId" = p."companyId"
  FROM projects p
 WHERE d."projectId" IS NOT NULL
   AND d."projectId" = p.id
   AND d."companyId" = 1
   AND p."companyId" <> 1;--> statement-breakpoint

-- ── helpful indexes for tenant-filtered queries ─────────────────────────────
-- Every list/filter procedure now ANDs `eq(table.companyId, ...)` into the
-- WHERE clause, so a btree on companyId pays off. Keep these conservative —
-- only the tables likely to grow large enough to matter.
CREATE INDEX IF NOT EXISTS idx_projects_companyId      ON projects ("companyId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_tasks_companyId         ON tasks ("companyId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_incidents_companyId     ON incidents ("companyId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_defects_companyId       ON defects ("companyId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_permits_companyId       ON permits ("companyId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_daily_reports_companyId ON daily_reports ("companyId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_files_companyId         ON files ("companyId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_documents_companyId     ON documents ("companyId");
