-- Lead
CREATE TABLE "Lead" (
    "id"           TEXT NOT NULL,
    "name"         TEXT NOT NULL,
    "contactName"  TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "address"      TEXT,
    "postcode"     TEXT,
    "source"       TEXT,
    "status"       TEXT NOT NULL DEFAULT 'new',
    "value"        DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes"        TEXT,
    "lostReason"   TEXT,
    "convertedAt"  TIMESTAMP(3),
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Lead_status_idx"     ON "Lead" ("status");
CREATE INDEX "Lead_createdAt_idx"  ON "Lead" ("createdAt");

-- Customer
CREATE TABLE "Customer" (
    "id"           TEXT NOT NULL,
    "name"         TEXT NOT NULL,
    "contactName"  TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "address"      TEXT,
    "postcode"     TEXT,
    "notes"        TEXT,
    "archivedAt"   TIMESTAMP(3),
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Customer_name_idx"       ON "Customer" ("name");
CREATE INDEX "Customer_archivedAt_idx" ON "Customer" ("archivedAt");

-- Quote
CREATE TABLE "Quote" (
    "id"           TEXT NOT NULL,
    "number"       TEXT NOT NULL,
    "customerId"   TEXT,
    "customerName" TEXT NOT NULL,
    "title"        TEXT NOT NULL,
    "description"  TEXT,
    "lineItems"    JSONB NOT NULL DEFAULT '[]',
    "subtotal"     DOUBLE PRECISION NOT NULL DEFAULT 0,
    "vatRate"      DOUBLE PRECISION NOT NULL DEFAULT 20,
    "vatAmount"    DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total"        DOUBLE PRECISION NOT NULL DEFAULT 0,
    "validUntil"   TIMESTAMP(3),
    "status"       TEXT NOT NULL DEFAULT 'draft',
    "terms"        TEXT,
    "sentAt"       TIMESTAMP(3),
    "acceptedAt"   TIMESTAMP(3),
    "rejectedAt"   TIMESTAMP(3),
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Quote_number_key" ON "Quote" ("number");
CREATE INDEX "Quote_status_idx"        ON "Quote" ("status");
CREATE INDEX "Quote_customerId_idx"    ON "Quote" ("customerId");
CREATE INDEX "Quote_validUntil_idx"    ON "Quote" ("validUntil");
ALTER TABLE "Quote"
  ADD CONSTRAINT "Quote_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer" ("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
