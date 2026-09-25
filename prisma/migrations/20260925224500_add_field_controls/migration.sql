-- Field operations v17: QA hold/witness points, handover, constraints,
-- production tracking, and delivery evidence.

ALTER TABLE "GoodsReceipt"
  ADD COLUMN "evidence" JSONB NOT NULL DEFAULT '{}';

ALTER TABLE "Inspection"
  ADD COLUMN "pointType" TEXT NOT NULL DEFAULT 'inspection',
  ADD COLUMN "location" TEXT,
  ADD COLUMN "drawingId" TEXT,
  ADD COLUMN "drawingRevisionId" TEXT,
  ADD COLUMN "releaseStatus" TEXT NOT NULL DEFAULT 'not_required',
  ADD COLUMN "releasedBy" TEXT,
  ADD COLUMN "releasedAt" TIMESTAMP(3),
  ADD COLUMN "witnessedBy" TEXT,
  ADD COLUMN "witnessedAt" TIMESTAMP(3),
  ADD COLUMN "evidence" JSONB NOT NULL DEFAULT '{}';

ALTER TABLE "Inspection"
  ADD CONSTRAINT "Inspection_drawingId_fkey"
  FOREIGN KEY ("drawingId") REFERENCES "Drawing"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Inspection"
  ADD CONSTRAINT "Inspection_drawingRevisionId_fkey"
  FOREIGN KEY ("drawingRevisionId") REFERENCES "DrawingRevision"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Inspection_projectId_pointType_releaseStatus_idx"
  ON "Inspection"("projectId", "pointType", "releaseStatus");
CREATE INDEX "Inspection_drawingId_idx" ON "Inspection"("drawingId");
CREATE INDEX "Inspection_drawingRevisionId_idx" ON "Inspection"("drawingRevisionId");

CREATE TABLE "FieldConstraint" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'other',
  "title" TEXT NOT NULL,
  "detail" TEXT,
  "location" TEXT,
  "priority" TEXT NOT NULL DEFAULT 'medium',
  "status" TEXT NOT NULL DEFAULT 'open',
  "ownerName" TEXT,
  "dueDate" TIMESTAMP(3),
  "resolution" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "organizationId" TEXT,
  CONSTRAINT "FieldConstraint_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FieldConstraint_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "FieldConstraint_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "FieldConstraint_projectId_status_idx" ON "FieldConstraint"("projectId", "status");
CREATE INDEX "FieldConstraint_priority_status_idx" ON "FieldConstraint"("priority", "status");
CREATE INDEX "FieldConstraint_dueDate_idx" ON "FieldConstraint"("dueDate");
CREATE INDEX "FieldConstraint_organizationId_idx" ON "FieldConstraint"("organizationId");

CREATE TABLE "FieldHandover" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "shiftDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "shiftType" TEXT NOT NULL DEFAULT 'day',
  "outgoingBy" TEXT,
  "incomingBy" TEXT,
  "summary" TEXT,
  "completedWork" TEXT,
  "nextShiftPlan" TEXT,
  "safetyNotes" TEXT,
  "qualityNotes" TEXT,
  "materialsNotes" TEXT,
  "plantNotes" TEXT,
  "openItems" JSONB NOT NULL DEFAULT '[]',
  "acceptedBy" TEXT,
  "acceptedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "organizationId" TEXT,
  CONSTRAINT "FieldHandover_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FieldHandover_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "FieldHandover_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "FieldHandover_projectId_shiftDate_idx" ON "FieldHandover"("projectId", "shiftDate");
CREATE INDEX "FieldHandover_acceptedAt_idx" ON "FieldHandover"("acceptedAt");
CREATE INDEX "FieldHandover_organizationId_idx" ON "FieldHandover"("organizationId");

CREATE TABLE "FieldProductionLog" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "area" TEXT NOT NULL,
  "elevation" TEXT,
  "activity" TEXT NOT NULL,
  "unit" TEXT NOT NULL DEFAULT 'm2',
  "plannedQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "installedQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "crewSize" INTEGER NOT NULL DEFAULT 0,
  "labourHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "notes" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "organizationId" TEXT,
  CONSTRAINT "FieldProductionLog_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FieldProductionLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "FieldProductionLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "FieldProductionLog_projectId_date_idx" ON "FieldProductionLog"("projectId", "date");
CREATE INDEX "FieldProductionLog_projectId_area_idx" ON "FieldProductionLog"("projectId", "area");
CREATE INDEX "FieldProductionLog_activity_idx" ON "FieldProductionLog"("activity");
CREATE INDEX "FieldProductionLog_organizationId_idx" ON "FieldProductionLog"("organizationId");
