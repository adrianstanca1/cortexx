-- ============================================================================
-- 0008_team_members_companyId.sql
-- ============================================================================
-- Adds a `companyId integer NOT NULL DEFAULT 1` column to the team_members
-- table — the last tenant-scoped table that lacked one. Closes SECURITY.md
-- P1-E (`teams.list` returning members across all tenants, `teams.create`
-- silently stripping companyId, etc.).
--
-- Existing rows are assigned to companyId = 1 by default. For rows with a
-- projectId, the row is then re-assigned to its parent project's companyId.
-- Rows with no projectId stay at companyId = 1.
--
-- All statements idempotent (IF NOT EXISTS, conditional UPDATE) so this file
-- can be re-applied safely.
-- ============================================================================

-- ── add column ──────────────────────────────────────────────────────────────
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS "companyId" integer NOT NULL DEFAULT 1;
--> statement-breakpoint

-- ── backfill from parent project where projectId is set ─────────────────────
-- Only re-assigns rows still at the default 1 — already-rebalanced rows stay.
UPDATE team_members tm
   SET "companyId" = p."companyId"
  FROM projects p
 WHERE tm."projectId" IS NOT NULL
   AND tm."projectId" = p.id
   AND tm."companyId" = 1
   AND p."companyId" <> 1;
--> statement-breakpoint

-- ── index for tenant-filtered queries ───────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_team_members_companyId ON team_members ("companyId");
