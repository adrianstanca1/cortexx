ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "bankReconciledAt" TIMESTAMP(3);
ALTER TABLE "SubInvoice" ADD COLUMN IF NOT EXISTS "bankReconciledAt" TIMESTAMP(3);

ALTER TABLE "BankTransaction" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE "BankTransaction" ADD COLUMN IF NOT EXISTS "externalId" TEXT;
ALTER TABLE "BankTransaction" ADD COLUMN IF NOT EXISTS "connectionId" TEXT;
ALTER TABLE "BankTransaction" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'GBP';
ALTER TABLE "BankTransaction" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'unmatched';
UPDATE "BankTransaction" SET "status" = CASE WHEN COALESCE("reconciled", false) THEN 'reconciled' ELSE 'unmatched' END WHERE "status" IS NULL OR "status" = '';
CREATE UNIQUE INDEX IF NOT EXISTS "BankTransaction_organizationId_source_externalId_key" ON "BankTransaction"("organizationId", "source", "externalId");
CREATE INDEX IF NOT EXISTS "BankTransaction_organizationId_status_occurredAt_idx" ON "BankTransaction"("organizationId", "status", "occurredAt");

CREATE TABLE IF NOT EXISTS "BankAllocation" (
  "id" TEXT NOT NULL,
  "bankTransactionId" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "organizationId" TEXT,
  CONSTRAINT "BankAllocation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BankAllocation_bankTransactionId_fkey" FOREIGN KEY ("bankTransactionId") REFERENCES "BankTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BankAllocation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "BankAllocation_bankTransactionId_targetType_targetId_key" ON "BankAllocation"("bankTransactionId", "targetType", "targetId");
CREATE INDEX IF NOT EXISTS "BankAllocation_targetType_targetId_idx" ON "BankAllocation"("targetType", "targetId");
CREATE INDEX IF NOT EXISTS "BankAllocation_organizationId_idx" ON "BankAllocation"("organizationId");

ALTER TABLE "ValuationPayment" ADD COLUMN IF NOT EXISTS "bankAllocationId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "ValuationPayment_bankAllocationId_key" ON "ValuationPayment"("bankAllocationId");
ALTER TABLE "ValuationPayment" ADD CONSTRAINT "ValuationPayment_bankAllocationId_fkey" FOREIGN KEY ("bankAllocationId") REFERENCES "BankAllocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
