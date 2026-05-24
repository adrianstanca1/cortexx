-- ============================================================================
-- 0011_rfis_workflow.sql
-- ============================================================================
-- Phase 3.4 of docs/ROADMAP.md — RFI approval workflow.
-- Backfills existing rows from the legacy 'open' status and adds the
-- columns the new lifecycle needs. Idempotent (IF NOT EXISTS / no-op
-- ALTER).
-- ============================================================================

ALTER TABLE rfis ALTER COLUMN status TYPE varchar(20);
--> statement-breakpoint
ALTER TABLE rfis ALTER COLUMN status SET DEFAULT 'submitted';
--> statement-breakpoint

UPDATE rfis SET status = 'submitted' WHERE status = 'open';
--> statement-breakpoint

ALTER TABLE rfis ADD COLUMN IF NOT EXISTS "answeredById"   integer;
--> statement-breakpoint
ALTER TABLE rfis ADD COLUMN IF NOT EXISTS "approvedById"   integer;
--> statement-breakpoint
ALTER TABLE rfis ADD COLUMN IF NOT EXISTS "approvedAt"     timestamp;
--> statement-breakpoint
ALTER TABLE rfis ADD COLUMN IF NOT EXISTS "rejectedById"   integer;
--> statement-breakpoint
ALTER TABLE rfis ADD COLUMN IF NOT EXISTS "rejectedAt"     timestamp;
--> statement-breakpoint
ALTER TABLE rfis ADD COLUMN IF NOT EXISTS "rejectedReason" text;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_rfis_pending_review
  ON rfis ("companyId", status)
  WHERE status = 'answered';
