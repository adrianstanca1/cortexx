ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "capturedAt" TIMESTAMP(3);
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "accuracyM" DOUBLE PRECISION;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "metadata" JSONB NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS "Document_capturedAt_idx" ON "Document"("capturedAt");

CREATE TABLE IF NOT EXISTS "ExpenseReceipt" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "projectId" TEXT,
  "vendor" TEXT,
  "receiptDate" TIMESTAMP(3),
  "subtotal" DOUBLE PRECISION,
  "vatAmount" DOUBLE PRECISION,
  "totalAmount" DOUBLE PRECISION,
  "currency" TEXT NOT NULL DEFAULT 'GBP',
  "category" TEXT,
  "items" JSONB NOT NULL DEFAULT '[]',
  "confidence" DOUBLE PRECISION,
  "notes" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "capturedAt" TIMESTAMP(3),
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "accuracyM" DOUBLE PRECISION,
  "extraction" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "organizationId" TEXT,
  CONSTRAINT "ExpenseReceipt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ExpenseReceipt_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ExpenseReceipt_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ExpenseReceipt_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "ExpenseReceipt_documentId_key" ON "ExpenseReceipt"("documentId");
CREATE INDEX IF NOT EXISTS "ExpenseReceipt_projectId_status_idx" ON "ExpenseReceipt"("projectId", "status");
CREATE INDEX IF NOT EXISTS "ExpenseReceipt_status_receiptDate_idx" ON "ExpenseReceipt"("status", "receiptDate");
CREATE INDEX IF NOT EXISTS "ExpenseReceipt_vendor_idx" ON "ExpenseReceipt"("vendor");
CREATE INDEX IF NOT EXISTS "ExpenseReceipt_organizationId_idx" ON "ExpenseReceipt"("organizationId");
