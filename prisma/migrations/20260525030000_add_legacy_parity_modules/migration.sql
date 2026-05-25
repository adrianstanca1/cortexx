-- 24 legacy-parity modules — each gets a thin table with organizationId
-- + index. Designed to be filled in incrementally; minimal columns now
-- so the menu surfaces work end-to-end (list + create via the generated
-- routes/pages). Field flesh-out comes per-module as product needs them.

-- PayrollRun
CREATE TABLE "PayrollRun" (
  "id"             TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT,
  "periodStart"    TIMESTAMP(3),
  "periodEnd"      TIMESTAMP(3),
  "grossTotal"     DOUBLE PRECISION,
  "cisDeducted"    DOUBLE PRECISION,
  "paeTotal"       DOUBLE PRECISION,
  "status"         TEXT,
  "notes"          TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL
);
CREATE INDEX "PayrollRun_organizationId_idx" ON "PayrollRun"("organizationId");
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- LeaveRequest
CREATE TABLE "LeaveRequest" (
  "id"             TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT,
  "memberId"       TEXT,
  "type"           TEXT,
  "startDate"      TIMESTAMP(3),
  "endDate"        TIMESTAMP(3),
  "days"           DOUBLE PRECISION,
  "status"         TEXT,
  "reason"         TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL
);
CREATE INDEX "LeaveRequest_organizationId_idx" ON "LeaveRequest"("organizationId");
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- BankTransaction
CREATE TABLE "BankTransaction" (
  "id"               TEXT NOT NULL PRIMARY KEY,
  "organizationId"   TEXT,
  "accountName"      TEXT,
  "occurredAt"       TIMESTAMP(3),
  "amount"           DOUBLE PRECISION,
  "description"      TEXT,
  "reference"        TEXT,
  "reconciled"       BOOLEAN,
  "matchedInvoiceId" TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL
);
CREATE INDEX "BankTransaction_organizationId_idx" ON "BankTransaction"("organizationId");
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- CarbonEntry
CREATE TABLE "CarbonEntry" (
  "id"             TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT,
  "projectId"      TEXT,
  "category"       TEXT,
  "description"    TEXT,
  "co2eKg"         DOUBLE PRECISION,
  "occurredAt"     TIMESTAMP(3),
  "source"         TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL
);
CREATE INDEX "CarbonEntry_organizationId_idx" ON "CarbonEntry"("organizationId");
ALTER TABLE "CarbonEntry" ADD CONSTRAINT "CarbonEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- WasteEntry
CREATE TABLE "WasteEntry" (
  "id"             TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT,
  "projectId"      TEXT,
  "wasteType"      TEXT,
  "weightKg"       DOUBLE PRECISION,
  "carrier"        TEXT,
  "ticketNumber"   TEXT,
  "occurredAt"     TIMESTAMP(3),
  "disposalSite"   TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL
);
CREATE INDEX "WasteEntry_organizationId_idx" ON "WasteEntry"("organizationId");
ALTER TABLE "WasteEntry" ADD CONSTRAINT "WasteEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- Appraisal
CREATE TABLE "Appraisal" (
  "id"             TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT,
  "memberId"       TEXT,
  "reviewerId"     TEXT,
  "periodLabel"    TEXT,
  "rating"         INTEGER,
  "strengths"      TEXT,
  "improvements"   TEXT,
  "goals"          TEXT,
  "status"         TEXT,
  "heldAt"         TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL
);
CREATE INDEX "Appraisal_organizationId_idx" ON "Appraisal"("organizationId");
ALTER TABLE "Appraisal" ADD CONSTRAINT "Appraisal_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- DocumentTemplate
CREATE TABLE "DocumentTemplate" (
  "id"             TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT,
  "name"           TEXT,
  "category"       TEXT,
  "body"           TEXT,
  "placeholders"   TEXT,
  "isPublic"       BOOLEAN,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL
);
CREATE INDEX "DocumentTemplate_organizationId_idx" ON "DocumentTemplate"("organizationId");
ALTER TABLE "DocumentTemplate" ADD CONSTRAINT "DocumentTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- FormDefinition
CREATE TABLE "FormDefinition" (
  "id"             TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT,
  "name"           TEXT,
  "schema"         TEXT,
  "description"    TEXT,
  "isActive"       BOOLEAN,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL
);
CREATE INDEX "FormDefinition_organizationId_idx" ON "FormDefinition"("organizationId");
ALTER TABLE "FormDefinition" ADD CONSTRAINT "FormDefinition_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- Reminder
CREATE TABLE "Reminder" (
  "id"             TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT,
  "title"          TEXT,
  "dueAt"          TIMESTAMP(3),
  "memberId"       TEXT,
  "done"           BOOLEAN,
  "notes"          TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL
);
CREATE INDEX "Reminder_organizationId_idx" ON "Reminder"("organizationId");
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- SavedView
CREATE TABLE "SavedView" (
  "id"             TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT,
  "userId"         TEXT,
  "name"           TEXT,
  "url"            TEXT,
  "description"    TEXT,
  "icon"           TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL
);
CREATE INDEX "SavedView_organizationId_idx" ON "SavedView"("organizationId");
ALTER TABLE "SavedView" ADD CONSTRAINT "SavedView_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- Tag
CREATE TABLE "Tag" (
  "id"             TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT,
  "name"           TEXT,
  "color"          TEXT,
  "description"    TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL
);
CREATE INDEX "Tag_organizationId_idx" ON "Tag"("organizationId");
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- Goal
CREATE TABLE "Goal" (
  "id"             TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT,
  "title"          TEXT,
  "owner"          TEXT,
  "quarter"        TEXT,
  "target"         TEXT,
  "progress"       INTEGER,
  "status"         TEXT,
  "notes"          TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL
);
CREATE INDEX "Goal_organizationId_idx" ON "Goal"("organizationId");
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- Improvement
CREATE TABLE "Improvement" (
  "id"             TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT,
  "title"          TEXT,
  "description"    TEXT,
  "raisedBy"       TEXT,
  "status"         TEXT,
  "impact"         TEXT,
  "effort"         TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL
);
CREATE INDEX "Improvement_organizationId_idx" ON "Improvement"("organizationId");
ALTER TABLE "Improvement" ADD CONSTRAINT "Improvement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- KaizenCard
CREATE TABLE "KaizenCard" (
  "id"             TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT,
  "title"          TEXT,
  "problem"        TEXT,
  "solution"       TEXT,
  "owner"          TEXT,
  "status"         TEXT,
  "boardColumn"    TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL
);
CREATE INDEX "KaizenCard_organizationId_idx" ON "KaizenCard"("organizationId");
ALTER TABLE "KaizenCard" ADD CONSTRAINT "KaizenCard_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- ProcessDoc
CREATE TABLE "ProcessDoc" (
  "id"             TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT,
  "title"          TEXT,
  "category"       TEXT,
  "body"           TEXT,
  "owner"          TEXT,
  "version"        TEXT,
  "publishedAt"    TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL
);
CREATE INDEX "ProcessDoc_organizationId_idx" ON "ProcessDoc"("organizationId");
ALTER TABLE "ProcessDoc" ADD CONSTRAINT "ProcessDoc_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- SiteReview
CREATE TABLE "SiteReview" (
  "id"             TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT,
  "projectId"      TEXT,
  "kind"           TEXT,
  "reviewer"       TEXT,
  "score"          INTEGER,
  "findings"       TEXT,
  "heldAt"         TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL
);
CREATE INDEX "SiteReview_organizationId_idx" ON "SiteReview"("organizationId");
ALTER TABLE "SiteReview" ADD CONSTRAINT "SiteReview_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- Apprenticeship
CREATE TABLE "Apprenticeship" (
  "id"                TEXT NOT NULL PRIMARY KEY,
  "organizationId"    TEXT,
  "memberId"          TEXT,
  "trade"             TEXT,
  "nvqLevel"          INTEGER,
  "startDate"         TIMESTAMP(3),
  "expectedEndDate"   TIMESTAMP(3),
  "trainingProvider"  TEXT,
  "status"            TEXT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL
);
CREATE INDEX "Apprenticeship_organizationId_idx" ON "Apprenticeship"("organizationId");
ALTER TABLE "Apprenticeship" ADD CONSTRAINT "Apprenticeship_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- InsuranceClaim
CREATE TABLE "InsuranceClaim" (
  "id"             TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT,
  "projectId"      TEXT,
  "incidentDate"   TIMESTAMP(3),
  "policy"         TEXT,
  "description"    TEXT,
  "amountClaimed"  DOUBLE PRECISION,
  "status"         TEXT,
  "closedAt"       TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL
);
CREATE INDEX "InsuranceClaim_organizationId_idx" ON "InsuranceClaim"("organizationId");
ALTER TABLE "InsuranceClaim" ADD CONSTRAINT "InsuranceClaim_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- CurrencyRate
CREATE TABLE "CurrencyRate" (
  "id"             TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT,
  "code"           TEXT,
  "gbpRate"        DOUBLE PRECISION,
  "asOf"           TIMESTAMP(3),
  "source"         TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL
);
CREATE INDEX "CurrencyRate_organizationId_idx" ON "CurrencyRate"("organizationId");
ALTER TABLE "CurrencyRate" ADD CONSTRAINT "CurrencyRate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- Persona
CREATE TABLE "Persona" (
  "id"             TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT,
  "name"           TEXT,
  "role"           TEXT,
  "goals"          TEXT,
  "painPoints"    TEXT,
  "quote"          TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL
);
CREATE INDEX "Persona_organizationId_idx" ON "Persona"("organizationId");
ALTER TABLE "Persona" ADD CONSTRAINT "Persona_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- ServiceCatalogItem
CREATE TABLE "ServiceCatalogItem" (
  "id"             TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT,
  "name"           TEXT,
  "category"       TEXT,
  "unitPrice"      DOUBLE PRECISION,
  "unit"           TEXT,
  "description"    TEXT,
  "active"         BOOLEAN,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL
);
CREATE INDEX "ServiceCatalogItem_organizationId_idx" ON "ServiceCatalogItem"("organizationId");
ALTER TABLE "ServiceCatalogItem" ADD CONSTRAINT "ServiceCatalogItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- SubPortalSession
CREATE TABLE "SubPortalSession" (
  "id"               TEXT NOT NULL PRIMARY KEY,
  "organizationId"   TEXT,
  "subcontractorId"  TEXT,
  "token"            TEXT,
  "expiresAt"        TIMESTAMP(3),
  "lastUsedAt"       TIMESTAMP(3),
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL
);
CREATE INDEX "SubPortalSession_organizationId_idx" ON "SubPortalSession"("organizationId");
ALTER TABLE "SubPortalSession" ADD CONSTRAINT "SubPortalSession_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- ApiKey
CREATE TABLE "ApiKey" (
  "id"             TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT,
  "name"           TEXT,
  "prefix"         TEXT,
  "hash"           TEXT,
  "scopes"         TEXT,
  "lastUsedAt"     TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL
);
CREATE INDEX "ApiKey_organizationId_idx" ON "ApiKey"("organizationId");
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- InfraSnapshot
CREATE TABLE "InfraSnapshot" (
  "id"             TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT,
  "recordedAt"     TIMESTAMP(3),
  "cpuPercent"     DOUBLE PRECISION,
  "memMb"          INTEGER,
  "diskGb"         INTEGER,
  "pgConnections"  INTEGER,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL
);
CREATE INDEX "InfraSnapshot_organizationId_idx" ON "InfraSnapshot"("organizationId");
ALTER TABLE "InfraSnapshot" ADD CONSTRAINT "InfraSnapshot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE ON UPDATE CASCADE;
