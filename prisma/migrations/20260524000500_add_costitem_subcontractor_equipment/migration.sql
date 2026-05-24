-- CostItem
CREATE TABLE "CostItem" (
    "id"          TEXT NOT NULL,
    "code"        TEXT,
    "description" TEXT NOT NULL,
    "category"    TEXT,
    "unit"        TEXT NOT NULL DEFAULT 'item',
    "unitCost"    DOUBLE PRECISION NOT NULL DEFAULT 0,
    "vendor"      TEXT,
    "notes"       TEXT,
    "archivedAt"  TIMESTAMP(3),
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CostItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CostItem_category_idx"   ON "CostItem" ("category");
CREATE INDEX "CostItem_code_idx"       ON "CostItem" ("code");
CREATE INDEX "CostItem_archivedAt_idx" ON "CostItem" ("archivedAt");

-- Subcontractor
CREATE TABLE "Subcontractor" (
    "id"                   TEXT NOT NULL,
    "name"                 TEXT NOT NULL,
    "trade"                TEXT,
    "contactName"          TEXT,
    "contactEmail"         TEXT,
    "contactPhone"         TEXT,
    "address"              TEXT,
    "postcode"             TEXT,
    "cisStatus"            TEXT NOT NULL DEFAULT '20',
    "utrNumber"            TEXT,
    "insuranceExpiry"      TIMESTAMP(3),
    "qualificationsExpiry" TIMESTAMP(3),
    "notes"                TEXT,
    "archivedAt"           TIMESTAMP(3),
    "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"            TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Subcontractor_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Subcontractor_name_idx"            ON "Subcontractor" ("name");
CREATE INDEX "Subcontractor_trade_idx"           ON "Subcontractor" ("trade");
CREATE INDEX "Subcontractor_insuranceExpiry_idx" ON "Subcontractor" ("insuranceExpiry");
CREATE INDEX "Subcontractor_archivedAt_idx"      ON "Subcontractor" ("archivedAt");

-- Equipment
CREATE TABLE "Equipment" (
    "id"             TEXT NOT NULL,
    "name"           TEXT NOT NULL,
    "code"           TEXT,
    "category"       TEXT,
    "serial"         TEXT,
    "ownership"      TEXT NOT NULL DEFAULT 'owned',
    "hireCompany"    TEXT,
    "location"       TEXT,
    "status"         TEXT NOT NULL DEFAULT 'in_yard',
    "lastServicedAt" TIMESTAMP(3),
    "nextServiceAt"  TIMESTAMP(3),
    "notes"          TEXT,
    "archivedAt"     TIMESTAMP(3),
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Equipment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Equipment_status_idx"        ON "Equipment" ("status");
CREATE INDEX "Equipment_nextServiceAt_idx" ON "Equipment" ("nextServiceAt");
CREATE INDEX "Equipment_archivedAt_idx"    ON "Equipment" ("archivedAt");
