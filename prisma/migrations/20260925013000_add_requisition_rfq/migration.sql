-- Gate C procurement lifecycle: requisition -> RFQ -> supplier quote -> awarded PO.
CREATE TABLE "ProcurementRequisition" (
  "id" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "costCodeId" TEXT,
  "requestedBy" TEXT,
  "neededBy" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'draft',
  "lineItems" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "estimatedNet" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "notes" TEXT,
  "submittedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "approvedBy" TEXT,
  "rejectedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "organizationId" TEXT,
  CONSTRAINT "ProcurementRequisition_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProcurementRequisition_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProcurementRequisition_costCodeId_fkey" FOREIGN KEY ("costCodeId") REFERENCES "CostCode"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ProcurementRequisition_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ProcurementRequisition_organizationId_number_key" ON "ProcurementRequisition"("organizationId", "number");
CREATE INDEX "ProcurementRequisition_projectId_status_idx" ON "ProcurementRequisition"("projectId", "status");
CREATE INDEX "ProcurementRequisition_costCodeId_idx" ON "ProcurementRequisition"("costCodeId");
CREATE INDEX "ProcurementRequisition_neededBy_idx" ON "ProcurementRequisition"("neededBy");
CREATE INDEX "ProcurementRequisition_organizationId_idx" ON "ProcurementRequisition"("organizationId");

CREATE TABLE "ProcurementRfq" (
  "id" TEXT NOT NULL,
  "requisitionId" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "supplierIds" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "dueAt" TIMESTAMP(3),
  "notes" TEXT,
  "sentAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "organizationId" TEXT,
  CONSTRAINT "ProcurementRfq_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProcurementRfq_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "ProcurementRequisition"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProcurementRfq_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ProcurementRfq_organizationId_reference_key" ON "ProcurementRfq"("organizationId", "reference");
CREATE INDEX "ProcurementRfq_requisitionId_status_idx" ON "ProcurementRfq"("requisitionId", "status");
CREATE INDEX "ProcurementRfq_dueAt_idx" ON "ProcurementRfq"("dueAt");
CREATE INDEX "ProcurementRfq_organizationId_idx" ON "ProcurementRfq"("organizationId");

CREATE TABLE "SupplierQuote" (
  "id" TEXT NOT NULL,
  "rfqId" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "reference" TEXT,
  "status" TEXT NOT NULL DEFAULT 'received',
  "lineItems" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "netAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "vatRate" DOUBLE PRECISION NOT NULL DEFAULT 20,
  "vatAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "leadDays" INTEGER,
  "validUntil" TIMESTAMP(3),
  "notes" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "awardedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "organizationId" TEXT,
  CONSTRAINT "SupplierQuote_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SupplierQuote_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "ProcurementRfq"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SupplierQuote_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SupplierQuote_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SupplierQuote_rfqId_supplierId_key" ON "SupplierQuote"("rfqId", "supplierId");
CREATE INDEX "SupplierQuote_supplierId_status_idx" ON "SupplierQuote"("supplierId", "status");
CREATE INDEX "SupplierQuote_organizationId_idx" ON "SupplierQuote"("organizationId");

ALTER TABLE "PurchaseOrder" ADD COLUMN "requisitionId" TEXT;
CREATE UNIQUE INDEX "PurchaseOrder_requisitionId_key" ON "PurchaseOrder"("requisitionId");
CREATE INDEX "PurchaseOrder_requisitionId_idx" ON "PurchaseOrder"("requisitionId");
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "ProcurementRequisition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PurchaseOrder" ADD COLUMN "supplierQuoteId" TEXT;
CREATE UNIQUE INDEX "PurchaseOrder_supplierQuoteId_key" ON "PurchaseOrder"("supplierQuoteId");
CREATE INDEX "PurchaseOrder_supplierQuoteId_idx" ON "PurchaseOrder"("supplierQuoteId");
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierQuoteId_fkey" FOREIGN KEY ("supplierQuoteId") REFERENCES "SupplierQuote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
