-- Permit
CREATE TABLE "Permit" (
    "id"         TEXT NOT NULL,
    "projectId"  TEXT NOT NULL,
    "title"      TEXT NOT NULL,
    "type"       TEXT NOT NULL DEFAULT 'general',
    "status"     TEXT NOT NULL DEFAULT 'draft',
    "riskLevel"  TEXT NOT NULL DEFAULT 'medium',
    "location"   TEXT,
    "issuedBy"   TEXT,
    "issuedTo"   TEXT,
    "validFrom"  TIMESTAMP(3),
    "validTo"    TIMESTAMP(3),
    "conditions" TEXT,
    "notes"      TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Permit_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Permit_projectId_status_idx" ON "Permit" ("projectId", "status");
CREATE INDEX "Permit_status_validTo_idx"   ON "Permit" ("status", "validTo");
CREATE INDEX "Permit_type_idx"             ON "Permit" ("type");
ALTER TABLE "Permit" ADD CONSTRAINT "Permit_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Tender
CREATE TABLE "Tender" (
    "id"          TEXT NOT NULL,
    "projectId"   TEXT,
    "title"       TEXT NOT NULL,
    "clientName"  TEXT,
    "status"      TEXT NOT NULL DEFAULT 'draft',
    "totalValue"  DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deadline"    TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "decidedAt"   TIMESTAMP(3),
    "notes"       TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Tender_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Tender_projectId_status_idx" ON "Tender" ("projectId", "status");
CREATE INDEX "Tender_status_deadline_idx"  ON "Tender" ("status", "deadline");
ALTER TABLE "Tender" ADD CONSTRAINT "Tender_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Rams (Risk Assessment / Method Statement)
CREATE TABLE "Rams" (
    "id"        TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title"     TEXT NOT NULL,
    "type"      TEXT NOT NULL DEFAULT 'rams',
    "hazards"   TEXT,
    "controls"  TEXT,
    "ppe"       TEXT,
    "reviewBy"  TIMESTAMP(3),
    "signedBy"  TEXT,
    "signedAt"  TIMESTAMP(3),
    "status"    TEXT NOT NULL DEFAULT 'draft',
    "notes"     TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Rams_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Rams_projectId_status_idx" ON "Rams" ("projectId", "status");
CREATE INDEX "Rams_reviewBy_idx"         ON "Rams" ("reviewBy");
CREATE INDEX "Rams_type_idx"             ON "Rams" ("type");
ALTER TABLE "Rams" ADD CONSTRAINT "Rams_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
