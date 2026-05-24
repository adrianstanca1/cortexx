-- ToolboxTalk
CREATE TABLE "ToolboxTalk" (
    "id"             TEXT NOT NULL,
    "projectId"      TEXT,
    "date"           TIMESTAMP(3) NOT NULL,
    "topic"          TEXT NOT NULL,
    "location"       TEXT,
    "deliveredBy"    TEXT,
    "attendees"      TEXT,
    "attendeeCount"  INTEGER NOT NULL DEFAULT 0,
    "hazardsCovered" TEXT,
    "notes"          TEXT,
    "signedOff"      BOOLEAN NOT NULL DEFAULT false,
    "signedAt"       TIMESTAMP(3),
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ToolboxTalk_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ToolboxTalk_projectId_date_idx" ON "ToolboxTalk" ("projectId", "date");
CREATE INDEX "ToolboxTalk_date_idx"            ON "ToolboxTalk" ("date");
ALTER TABLE "ToolboxTalk" ADD CONSTRAINT "ToolboxTalk_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- MaintenanceSchedule
CREATE TABLE "MaintenanceSchedule" (
    "id"           TEXT NOT NULL,
    "equipmentId"  TEXT NOT NULL,
    "title"        TEXT NOT NULL,
    "type"         TEXT NOT NULL DEFAULT 'service',
    "status"       TEXT NOT NULL DEFAULT 'scheduled',
    "dueDate"      TIMESTAMP(3) NOT NULL,
    "intervalDays" INTEGER,
    "completedAt"  TIMESTAMP(3),
    "performedBy"  TEXT,
    "cost"         DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes"        TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MaintenanceSchedule_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MaintenanceSchedule_equipmentId_status_idx" ON "MaintenanceSchedule" ("equipmentId", "status");
CREATE INDEX "MaintenanceSchedule_status_dueDate_idx"     ON "MaintenanceSchedule" ("status", "dueDate");
CREATE INDEX "MaintenanceSchedule_dueDate_idx"            ON "MaintenanceSchedule" ("dueDate");
ALTER TABLE "MaintenanceSchedule" ADD CONSTRAINT "MaintenanceSchedule_equipmentId_fkey"
    FOREIGN KEY ("equipmentId") REFERENCES "Equipment" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Supplier
CREATE TABLE "Supplier" (
    "id"            TEXT NOT NULL,
    "name"          TEXT NOT NULL,
    "category"      TEXT NOT NULL DEFAULT 'materials',
    "contactName"   TEXT,
    "contactEmail"  TEXT,
    "contactPhone"  TEXT,
    "address"       TEXT,
    "postcode"      TEXT,
    "paymentTerms"  TEXT,
    "accountNumber" TEXT,
    "notes"         TEXT,
    "archivedAt"    TIMESTAMP(3),
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Supplier_name_idx"       ON "Supplier" ("name");
CREATE INDEX "Supplier_category_idx"   ON "Supplier" ("category");
CREATE INDEX "Supplier_archivedAt_idx" ON "Supplier" ("archivedAt");
