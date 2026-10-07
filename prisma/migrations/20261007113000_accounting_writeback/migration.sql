ALTER TABLE "Invoice"
  ADD COLUMN "netAmount" DOUBLE PRECISION,
  ADD COLUMN "vatAmount" DOUBLE PRECISION,
  ADD COLUMN "vatRate" DOUBLE PRECISION;

CREATE TABLE "AccountingWriteback" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "connectionId" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "externalId" TEXT,
  "payloadHash" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "lastError" TEXT,
  "lastAttemptAt" TIMESTAMP(3),
  "syncedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AccountingWriteback_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AccountingWriteback_connectionId_entityType_entityId_key"
  ON "AccountingWriteback"("connectionId", "entityType", "entityId");
CREATE INDEX "AccountingWriteback_organizationId_status_idx"
  ON "AccountingWriteback"("organizationId", "status");
CREATE INDEX "AccountingWriteback_externalId_idx"
  ON "AccountingWriteback"("externalId");
ALTER TABLE "AccountingWriteback" ADD CONSTRAINT "AccountingWriteback_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccountingWriteback" ADD CONSTRAINT "AccountingWriteback_connectionId_fkey"
  FOREIGN KEY ("connectionId") REFERENCES "AccountingConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
