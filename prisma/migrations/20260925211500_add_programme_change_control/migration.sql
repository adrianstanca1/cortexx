CREATE TABLE "ProgrammeBaselineRevision" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "label" TEXT,
  "reason" TEXT NOT NULL,
  "snapshot" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "organizationId" TEXT,
  CONSTRAINT "ProgrammeBaselineRevision_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ProgrammeDelayEvent" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "activityId" TEXT,
  "title" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'other',
  "cause" TEXT,
  "impact" TEXT,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3),
  "delayDays" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'open',
  "decisionNotes" TEXT,
  "decidedAt" TIMESTAMP(3),
  "decidedByUserId" TEXT,
  "closedAt" TIMESTAMP(3),
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "organizationId" TEXT,
  CONSTRAINT "ProgrammeDelayEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProgrammeBaselineRevision_projectId_revision_key" ON "ProgrammeBaselineRevision"("projectId", "revision");
CREATE INDEX "ProgrammeBaselineRevision_projectId_status_idx" ON "ProgrammeBaselineRevision"("projectId", "status");
CREATE INDEX "ProgrammeBaselineRevision_effectiveAt_idx" ON "ProgrammeBaselineRevision"("effectiveAt");
CREATE INDEX "ProgrammeBaselineRevision_organizationId_idx" ON "ProgrammeBaselineRevision"("organizationId");
CREATE INDEX "ProgrammeDelayEvent_projectId_status_startDate_idx" ON "ProgrammeDelayEvent"("projectId", "status", "startDate");
CREATE INDEX "ProgrammeDelayEvent_activityId_status_idx" ON "ProgrammeDelayEvent"("activityId", "status");
CREATE INDEX "ProgrammeDelayEvent_organizationId_idx" ON "ProgrammeDelayEvent"("organizationId");
ALTER TABLE "ProgrammeBaselineRevision" ADD CONSTRAINT "ProgrammeBaselineRevision_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProgrammeBaselineRevision" ADD CONSTRAINT "ProgrammeBaselineRevision_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProgrammeDelayEvent" ADD CONSTRAINT "ProgrammeDelayEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProgrammeDelayEvent" ADD CONSTRAINT "ProgrammeDelayEvent_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "ProgrammeActivity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProgrammeDelayEvent" ADD CONSTRAINT "ProgrammeDelayEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
