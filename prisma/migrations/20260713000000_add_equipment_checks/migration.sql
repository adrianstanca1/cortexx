-- Add equipment-specific daily/weekly safety checks (scissor lifts, MEWPs, telehandlers, harnesses, fall-arrest).
CREATE TABLE "EquipmentCheck" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "equipmentId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'scissor_lift',
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "checklistItems" JSONB NOT NULL DEFAULT '[]',
    "overallResult" TEXT,
    "conductedBy" TEXT,
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT,

    CONSTRAINT "EquipmentCheck_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EquipmentCheck_projectId_idx" ON "EquipmentCheck"("projectId");
CREATE INDEX "EquipmentCheck_equipmentId_idx" ON "EquipmentCheck"("equipmentId");
CREATE INDEX "EquipmentCheck_type_idx" ON "EquipmentCheck"("type");
CREATE INDEX "EquipmentCheck_status_idx" ON "EquipmentCheck"("status");
CREATE INDEX "EquipmentCheck_organizationId_idx" ON "EquipmentCheck"("organizationId");

ALTER TABLE "EquipmentCheck" ADD CONSTRAINT "EquipmentCheck_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EquipmentCheck" ADD CONSTRAINT "EquipmentCheck_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EquipmentCheck" ADD CONSTRAINT "EquipmentCheck_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
