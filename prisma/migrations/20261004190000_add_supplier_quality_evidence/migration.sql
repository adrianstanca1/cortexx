-- CreateTable
CREATE TABLE "SupplierQualityEvidence" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "snagId" TEXT,
    "inspectionId" TEXT,
    "purchaseOrderId" TEXT,
    "reason" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawnAt" TIMESTAMP(3),
    "withdrawnBy" TEXT,
    "withdrawalReason" TEXT,

    CONSTRAINT "SupplierQualityEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupplierQualityEvidence_organizationId_supplierId_createdAt_idx" ON "SupplierQualityEvidence"("organizationId", "supplierId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "SupplierQualityEvidence_projectId_idx" ON "SupplierQualityEvidence"("projectId");

-- CreateIndex
CREATE INDEX "SupplierQualityEvidence_purchaseOrderId_idx" ON "SupplierQualityEvidence"("purchaseOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierQualityEvidence_supplierId_snagId_key" ON "SupplierQualityEvidence"("supplierId", "snagId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierQualityEvidence_supplierId_inspectionId_key" ON "SupplierQualityEvidence"("supplierId", "inspectionId");

-- CreateIndex
CREATE UNIQUE INDEX "Project_id_organizationId_key" ON "Project"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Snag_id_organizationId_projectId_key" ON "Snag"("id", "organizationId", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_id_organizationId_supplierId_projectId_key" ON "PurchaseOrder"("id", "organizationId", "supplierId", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Inspection_id_organizationId_projectId_key" ON "Inspection"("id", "organizationId", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_id_organizationId_key" ON "Supplier"("id", "organizationId");

-- AddForeignKey
ALTER TABLE "SupplierQualityEvidence" ADD CONSTRAINT "SupplierQualityEvidence_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierQualityEvidence" ADD CONSTRAINT "SupplierQualityEvidence_supplierId_organizationId_fkey" FOREIGN KEY ("supplierId", "organizationId") REFERENCES "Supplier"("id", "organizationId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "SupplierQualityEvidence" ADD CONSTRAINT "SupplierQualityEvidence_projectId_organizationId_fkey" FOREIGN KEY ("projectId", "organizationId") REFERENCES "Project"("id", "organizationId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "SupplierQualityEvidence" ADD CONSTRAINT "SupplierQualityEvidence_snagId_organizationId_projectId_fkey" FOREIGN KEY ("snagId", "organizationId", "projectId") REFERENCES "Snag"("id", "organizationId", "projectId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "SupplierQualityEvidence" ADD CONSTRAINT "SupplierQualityEvidence_inspectionId_organizationId_projec_fkey" FOREIGN KEY ("inspectionId", "organizationId", "projectId") REFERENCES "Inspection"("id", "organizationId", "projectId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "SupplierQualityEvidence" ADD CONSTRAINT "SupplierQualityEvidence_purchaseOrderId_organizationId_sup_fkey" FOREIGN KEY ("purchaseOrderId", "organizationId", "supplierId", "projectId") REFERENCES "PurchaseOrder"("id", "organizationId", "supplierId", "projectId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- A record attributes exactly one real source; attribution/withdrawal notes
-- remain complete even if a caller bypasses the HTTP validation.
ALTER TABLE "SupplierQualityEvidence" ADD CONSTRAINT "SupplierQualityEvidence_one_source_check"
  CHECK (("snagId" IS NOT NULL) <> ("inspectionId" IS NOT NULL));
ALTER TABLE "SupplierQualityEvidence" ADD CONSTRAINT "SupplierQualityEvidence_reason_check"
  CHECK (char_length(btrim("reason")) BETWEEN 3 AND 2000);
ALTER TABLE "SupplierQualityEvidence" ADD CONSTRAINT "SupplierQualityEvidence_withdrawal_check"
  CHECK (
    ("withdrawnAt" IS NULL AND "withdrawnBy" IS NULL AND "withdrawalReason" IS NULL)
    OR ("withdrawnAt" IS NOT NULL AND "withdrawnBy" IS NOT NULL AND "withdrawalReason" IS NOT NULL
        AND char_length(btrim("withdrawalReason")) BETWEEN 3 AND 2000)
  );
