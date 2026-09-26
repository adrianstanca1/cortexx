-- Extend continuous improvement records into measurable, project-aware innovation pilots.
-- All fields are nullable/additive so existing Improvement records remain valid.
ALTER TABLE "Improvement"
  ADD COLUMN "projectId" TEXT,
  ADD COLUMN "ownerName" TEXT,
  ADD COLUMN "area" TEXT,
  ADD COLUMN "metricName" TEXT,
  ADD COLUMN "metricUnit" TEXT,
  ADD COLUMN "metricDirection" TEXT,
  ADD COLUMN "baselineValue" DOUBLE PRECISION,
  ADD COLUMN "targetValue" DOUBLE PRECISION,
  ADD COLUMN "resultValue" DOUBLE PRECISION,
  ADD COLUMN "startedAt" TIMESTAMP(3),
  ADD COLUMN "completedAt" TIMESTAMP(3);

CREATE INDEX "Improvement_projectId_status_idx"
ON "Improvement"("projectId", "status");

ALTER TABLE "Improvement"
ADD CONSTRAINT "Improvement_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
