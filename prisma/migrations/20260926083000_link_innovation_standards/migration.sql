-- Link evidence-backed innovations to reusable process-library standards.
ALTER TABLE "Improvement"
  ADD COLUMN "standardProcessId" TEXT;

CREATE INDEX "Improvement_standardProcessId_idx"
ON "Improvement"("standardProcessId");

ALTER TABLE "Improvement"
ADD CONSTRAINT "Improvement_standardProcessId_fkey"
FOREIGN KEY ("standardProcessId") REFERENCES "ProcessDoc"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
