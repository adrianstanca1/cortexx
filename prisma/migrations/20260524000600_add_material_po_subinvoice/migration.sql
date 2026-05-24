-- Material
CREATE TABLE "Material" (
    "id"           TEXT NOT NULL,
    "name"         TEXT NOT NULL,
    "code"         TEXT,
    "category"     TEXT,
    "unit"         TEXT NOT NULL DEFAULT 'item',
    "unitCost"     DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stockLevel"   DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reorderPoint" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "supplier"     TEXT,
    "location"     TEXT,
    "notes"        TEXT,
    "archivedAt"   TIMESTAMP(3),
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Material_category_idx"   ON "Material" ("category");
CREATE INDEX "Material_code_idx"       ON "Material" ("code");
CREATE INDEX "Material_archivedAt_idx" ON "Material" ("archivedAt");

-- PurchaseOrder
CREATE TABLE "PurchaseOrder" (
    "id"               TEXT NOT NULL,
    "number"           TEXT NOT NULL,
    "projectId"        TEXT,
    "supplier"         TEXT NOT NULL,
    "contactEmail"     TEXT,
    "contactPhone"     TEXT,
    "status"           TEXT NOT NULL DEFAULT 'draft',
    "lineItems"        JSONB NOT NULL DEFAULT '[]',
    "subtotal"         DOUBLE PRECISION NOT NULL DEFAULT 0,
    "vatRate"          DOUBLE PRECISION NOT NULL DEFAULT 20,
    "vatAmount"        DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total"            DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expectedDelivery" TIMESTAMP(3),
    "receivedAt"       TIMESTAMP(3),
    "sentAt"           TIMESTAMP(3),
    "closedAt"         TIMESTAMP(3),
    "notes"            TEXT,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PurchaseOrder_number_key" ON "PurchaseOrder" ("number");
CREATE INDEX "PurchaseOrder_projectId_status_idx" ON "PurchaseOrder" ("projectId", "status");
CREATE INDEX "PurchaseOrder_status_idx"           ON "PurchaseOrder" ("status");
CREATE INDEX "PurchaseOrder_expectedDelivery_idx" ON "PurchaseOrder" ("expectedDelivery");
ALTER TABLE "PurchaseOrder"
  ADD CONSTRAINT "PurchaseOrder_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project" ("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- SubInvoice
CREATE TABLE "SubInvoice" (
    "id"              TEXT NOT NULL,
    "number"          TEXT NOT NULL,
    "subcontractorId" TEXT NOT NULL,
    "projectId"       TEXT,
    "invoiceDate"     TIMESTAMP(3) NOT NULL,
    "description"     TEXT,
    "netAmount"       DOUBLE PRECISION NOT NULL DEFAULT 0,
    "vatAmount"       DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cisAmount"       DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grossAmount"     DOUBLE PRECISION NOT NULL DEFAULT 0,
    "payableAmount"   DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status"          TEXT NOT NULL DEFAULT 'received',
    "paidAt"          TIMESTAMP(3),
    "notes"           TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SubInvoice_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SubInvoice_subcontractorId_number_key" ON "SubInvoice" ("subcontractorId", "number");
CREATE INDEX "SubInvoice_subcontractorId_status_idx"        ON "SubInvoice" ("subcontractorId", "status");
CREATE INDEX "SubInvoice_status_invoiceDate_idx"            ON "SubInvoice" ("status", "invoiceDate");
ALTER TABLE "SubInvoice"
  ADD CONSTRAINT "SubInvoice_subcontractorId_fkey"
  FOREIGN KEY ("subcontractorId") REFERENCES "Subcontractor" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubInvoice"
  ADD CONSTRAINT "SubInvoice_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project" ("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
