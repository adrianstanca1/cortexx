-- Repair runtime/schema drift after the legacy workspace schema was retired.

-- Modern, tenant- and user-scoped AI history.
CREATE TABLE "AiHistory" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "userMsg" TEXT,
  "aiReply" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiHistory_organizationId_userId_createdAt_idx"
ON "AiHistory"("organizationId", "userId", "createdAt");

CREATE INDEX "AiHistory_userId_createdAt_idx"
ON "AiHistory"("userId", "createdAt");

ALTER TABLE "AiHistory"
ADD CONSTRAINT "AiHistory_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AiHistory"
ADD CONSTRAINT "AiHistory_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Small Prisma drift repairs that were missing from earlier migrations.
ALTER TABLE "BankTransaction"
ALTER COLUMN "reconciled" SET DEFAULT false;

CREATE INDEX "Permit_type_idx"
ON "Permit"("type");

ALTER TABLE "TrainingCourse"
ADD CONSTRAINT "TrainingCourse_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- PostgreSQL truncates identifiers to 63 bytes. Rename the three long
-- innovation indexes to stable explicit names that Prisma can introspect.
ALTER INDEX "FieldConstraint_organizationId_projectId_status_priority_dueDat"
RENAME TO "idx_innov_constraint_scope";

ALTER INDEX "ProgrammeActivity_organizationId_projectId_status_plannedEnd_id"
RENAME TO "idx_innov_programme_scope";

ALTER INDEX "ProcurementRequisition_organizationId_projectId_status_neededBy"
RENAME TO "idx_innov_requisition_scope";
