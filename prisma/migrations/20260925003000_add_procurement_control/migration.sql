CREATE UNIQUE INDEX IF NOT EXISTS "PurchaseOrder_organizationId_number_key" ON "PurchaseOrder"("organizationId", "number");
DROP INDEX IF EXISTS "PurchaseOrder_number_key";

-- Gate C procurement control: approval metadata, linked suppliers and auditable goods receipts.
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "approvalRequestedAt" TIMESTAMP(3);
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "approvedBy" TEXT;
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "rejectedAt" TIMESTAMP(3);
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "supplierId" TEXT;

ALTER TABLE "PurchaseOrder"
  ADD CONSTRAINT "PurchaseOrder_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "PurchaseOrder_supplierId_idx" ON "PurchaseOrder"("supplierId");

CREATE TABLE "GoodsReceipt" (
  "id" TEXT NOT NULL,
  "purchaseOrderId" TEXT NOT NULL,
  "deliveryNote" TEXT,
  "deliveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "receivedBy" TEXT,
  "lineItems" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "netReceived" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "organizationId" TEXT,
  CONSTRAINT "GoodsReceipt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GoodsReceipt_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "GoodsReceipt_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "GoodsReceipt_purchaseOrderId_deliveredAt_idx" ON "GoodsReceipt"("purchaseOrderId", "deliveredAt");
CREATE INDEX "GoodsReceipt_organizationId_idx" ON "GoodsReceipt"("organizationId");

ALTER TABLE "SubInvoice" ADD COLUMN IF NOT EXISTS "matchStatus" TEXT NOT NULL DEFAULT 'unmatched';
ALTER TABLE "SubInvoice" ADD COLUMN IF NOT EXISTS "matchDetails" JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE "SubInvoice" ADD COLUMN IF NOT EXISTS "matchedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "SubInvoice_purchaseOrderId_matchStatus_idx" ON "SubInvoice"("purchaseOrderId", "matchStatus");
