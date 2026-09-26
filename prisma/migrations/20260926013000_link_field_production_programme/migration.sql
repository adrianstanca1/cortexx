-- Link field production evidence to the programme work package it reports against.
-- Nullable/additive so existing production logs and the currently deployed app remain compatible.
ALTER TABLE "FieldProductionLog"
ADD COLUMN "programmeActivityId" TEXT;

CREATE INDEX "FieldProductionLog_programmeActivityId_date_idx"
ON "FieldProductionLog"("programmeActivityId", "date");

ALTER TABLE "FieldProductionLog"
ADD CONSTRAINT "FieldProductionLog_programmeActivityId_fkey"
FOREIGN KEY ("programmeActivityId") REFERENCES "ProgrammeActivity"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
