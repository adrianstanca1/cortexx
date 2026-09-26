CREATE TABLE "ProgrammeResourceAllocation" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "activityId" TEXT NOT NULL,
  "resourceType" TEXT NOT NULL,
  "teamMemberId" TEXT,
  "equipmentId" TEXT,
  "materialId" TEXT,
  "label" TEXT,
  "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "unit" TEXT NOT NULL DEFAULT 'unit',
  "hoursPerDay" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "needBy" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "organizationId" TEXT,
  CONSTRAINT "ProgrammeResourceAllocation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProgrammeResourceAllocation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProgrammeResourceAllocation_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "ProgrammeActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProgrammeResourceAllocation_teamMemberId_fkey" FOREIGN KEY ("teamMemberId") REFERENCES "TeamMember"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ProgrammeResourceAllocation_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ProgrammeResourceAllocation_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ProgrammeResourceAllocation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProgrammeResourceAllocation_projectId_resourceType_idx" ON "ProgrammeResourceAllocation"("projectId", "resourceType");
CREATE INDEX "ProgrammeResourceAllocation_activityId_idx" ON "ProgrammeResourceAllocation"("activityId");
CREATE INDEX "ProgrammeResourceAllocation_teamMemberId_idx" ON "ProgrammeResourceAllocation"("teamMemberId");
CREATE INDEX "ProgrammeResourceAllocation_equipmentId_idx" ON "ProgrammeResourceAllocation"("equipmentId");
CREATE INDEX "ProgrammeResourceAllocation_materialId_idx" ON "ProgrammeResourceAllocation"("materialId");
CREATE INDEX "ProgrammeResourceAllocation_needBy_idx" ON "ProgrammeResourceAllocation"("needBy");
CREATE INDEX "ProgrammeResourceAllocation_organizationId_idx" ON "ProgrammeResourceAllocation"("organizationId");
