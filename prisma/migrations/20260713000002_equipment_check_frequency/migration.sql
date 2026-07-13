-- Add recurrence fields to EquipmentCheck
ALTER TABLE "EquipmentCheck" ADD COLUMN "frequency" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "EquipmentCheck" ADD COLUMN "nextDueAt" TIMESTAMP(3);
ALTER TABLE "EquipmentCheck" ADD COLUMN "lastCompletedAt" TIMESTAMP(3);

CREATE INDEX "EquipmentCheck_nextDueAt_idx" ON "EquipmentCheck" ("nextDueAt");
