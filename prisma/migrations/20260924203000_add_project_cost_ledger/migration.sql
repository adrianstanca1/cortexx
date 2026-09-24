CREATE TABLE IF NOT EXISTS "CostCode" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT,
  "description" TEXT,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "organizationId" TEXT,
  CONSTRAINT "CostCode_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CostCode_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "CostCode_organizationId_code_key" ON "CostCode"("organizationId", "code");
CREATE INDEX IF NOT EXISTS "CostCode_category_idx" ON "CostCode"("category");
CREATE INDEX IF NOT EXISTS "CostCode_archivedAt_idx" ON "CostCode"("archivedAt");
CREATE INDEX IF NOT EXISTS "CostCode_organizationId_idx" ON "CostCode"("organizationId");

CREATE TABLE IF NOT EXISTS "ProjectCostEntry" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "costCodeId" TEXT,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT,
  "sourceReference" TEXT,
  "description" TEXT NOT NULL,
  "netAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "vatAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "grossAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'posted',
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "voidedAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "organizationId" TEXT,
  CONSTRAINT "ProjectCostEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProjectCostEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProjectCostEntry_costCodeId_fkey" FOREIGN KEY ("costCodeId") REFERENCES "CostCode"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ProjectCostEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "ProjectCostEntry_organizationId_sourceType_sourceId_key" ON "ProjectCostEntry"("organizationId", "sourceType", "sourceId");
CREATE INDEX IF NOT EXISTS "ProjectCostEntry_projectId_status_occurredAt_idx" ON "ProjectCostEntry"("projectId", "status", "occurredAt");
CREATE INDEX IF NOT EXISTS "ProjectCostEntry_costCodeId_status_idx" ON "ProjectCostEntry"("costCodeId", "status");
CREATE INDEX IF NOT EXISTS "ProjectCostEntry_sourceType_sourceId_idx" ON "ProjectCostEntry"("sourceType", "sourceId");
CREATE INDEX IF NOT EXISTS "ProjectCostEntry_organizationId_idx" ON "ProjectCostEntry"("organizationId");

ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "costCodeId" TEXT;
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_costCodeId_fkey" FOREIGN KEY ("costCodeId") REFERENCES "CostCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "PurchaseOrder_costCodeId_idx" ON "PurchaseOrder"("costCodeId");

ALTER TABLE "SubInvoice" ADD COLUMN IF NOT EXISTS "purchaseOrderId" TEXT;
ALTER TABLE "SubInvoice" ADD CONSTRAINT "SubInvoice_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "SubInvoice_purchaseOrderId_idx" ON "SubInvoice"("purchaseOrderId");

-- Preserve historical project cost as an auditable opening-balance row so
-- Project.spent can become a mirror of the canonical cost ledger without loss.
INSERT INTO "ProjectCostEntry" (
  "id", "projectId", "sourceType", "sourceId", "sourceReference", "description",
  "netAmount", "vatAmount", "grossAmount", "status", "occurredAt", "postedAt",
  "createdAt", "updatedAt", "organizationId"
)
SELECT
  'opening_' || md5(p."id"), p."id", 'opening_balance', p."id", 'legacy-spent',
  'Opening balance from legacy project spent', p."spent", 0, p."spent", 'posted',
  COALESCE(p."createdAt", CURRENT_TIMESTAMP), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP, p."organizationId"
FROM "Project" p
WHERE p."spent" > 0
  AND NOT EXISTS (
    SELECT 1 FROM "ProjectCostEntry" e
    WHERE e."organizationId" IS NOT DISTINCT FROM p."organizationId"
      AND e."sourceType" = 'opening_balance' AND e."sourceId" = p."id"
  );
