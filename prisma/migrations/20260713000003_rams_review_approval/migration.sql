-- Add multi-stage sign-off columns to Rams for reviewed → approved → active workflow.
-- All columns are nullable and additive; existing rows default to NULL.

ALTER TABLE "Rams" ADD COLUMN IF NOT EXISTS "reviewedBy" TEXT;
ALTER TABLE "Rams" ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3);
ALTER TABLE "Rams" ADD COLUMN IF NOT EXISTS "approvedBy" TEXT;
ALTER TABLE "Rams" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);

-- Backfill: any existing signed/active RAMS doc is treated as approved and active.
UPDATE "Rams"
SET "approvedBy" = "signedBy",
    "approvedAt" = "signedAt"
WHERE "signedBy" IS NOT NULL AND "approvedBy" IS NULL;

CREATE INDEX IF NOT EXISTS "Rams_reviewedBy_idx" ON "Rams"("reviewedBy");
CREATE INDEX IF NOT EXISTS "Rams_approvedBy_idx" ON "Rams"("approvedBy");
