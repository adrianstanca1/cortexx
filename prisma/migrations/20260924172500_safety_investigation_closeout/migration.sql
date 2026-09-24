ALTER TABLE "SafetyIncident" ADD COLUMN IF NOT EXISTS "riddorStatus" TEXT NOT NULL DEFAULT 'not_assessed';
ALTER TABLE "SafetyIncident" ADD COLUMN IF NOT EXISTS "riddorDecisionReason" TEXT;
ALTER TABLE "SafetyIncident" ADD COLUMN IF NOT EXISTS "riddorReference" TEXT;
ALTER TABLE "SafetyIncident" ADD COLUMN IF NOT EXISTS "riddorSubmittedAt" TIMESTAMP(3);
ALTER TABLE "SafetyIncident" ADD COLUMN IF NOT EXISTS "investigatorName" TEXT;
ALTER TABLE "SafetyIncident" ADD COLUMN IF NOT EXISTS "immediateActions" TEXT;
ALTER TABLE "SafetyIncident" ADD COLUMN IF NOT EXISTS "investigationSummary" TEXT;
ALTER TABLE "SafetyIncident" ADD COLUMN IF NOT EXISTS "rootCause" TEXT;
ALTER TABLE "SafetyIncident" ADD COLUMN IF NOT EXISTS "lessonsLearned" TEXT;
ALTER TABLE "SafetyIncident" ADD COLUMN IF NOT EXISTS "investigationStartedAt" TIMESTAMP(3);
ALTER TABLE "SafetyIncident" ADD COLUMN IF NOT EXISTS "investigationCompletedAt" TIMESTAMP(3);
ALTER TABLE "SafetyIncident" ADD COLUMN IF NOT EXISTS "witnesses" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "SafetyIncident" ADD COLUMN IF NOT EXISTS "evidence" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "SafetyIncident" ADD COLUMN IF NOT EXISTS "closeoutVerifiedBy" TEXT;
ALTER TABLE "SafetyIncident" ADD COLUMN IF NOT EXISTS "closeoutVerifiedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "SafetyCorrectiveAction" (
  "id" TEXT NOT NULL,
  "incidentId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "ownerName" TEXT,
  "dueDate" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'open',
  "completedAt" TIMESTAMP(3),
  "evidenceUrl" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "organizationId" TEXT,
  CONSTRAINT "SafetyCorrectiveAction_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SafetyCorrectiveAction_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "SafetyIncident"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SafetyCorrectiveAction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "SafetyCorrectiveAction_incidentId_status_idx" ON "SafetyCorrectiveAction"("incidentId", "status");
CREATE INDEX IF NOT EXISTS "SafetyCorrectiveAction_dueDate_status_idx" ON "SafetyCorrectiveAction"("dueDate", "status");
CREATE INDEX IF NOT EXISTS "SafetyCorrectiveAction_organizationId_idx" ON "SafetyCorrectiveAction"("organizationId");
