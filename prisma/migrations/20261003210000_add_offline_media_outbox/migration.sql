ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "offlineOutboxId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Document_organizationId_offlineOutboxId_key"
  ON "Document"("organizationId", "offlineOutboxId");
