CREATE TABLE IF NOT EXISTS "Valuation" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "applicationNumber" INTEGER NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "grossToDate" DOUBLE PRECISION NOT NULL,
  "retentionPct" DOUBLE PRECISION NOT NULL DEFAULT 3,
  "retentionAmount" DOUBLE PRECISION NOT NULL,
  "previousCertified" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "netDue" DOUBLE PRECISION NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "notes" TEXT,
  "submittedAt" TIMESTAMP(3),
  "certifiedAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "organizationId" TEXT,
  CONSTRAINT "Valuation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Valuation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Valuation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "Valuation_projectId_applicationNumber_key" ON "Valuation"("projectId", "applicationNumber");
CREATE INDEX IF NOT EXISTS "Valuation_projectId_status_idx" ON "Valuation"("projectId", "status");
CREATE INDEX IF NOT EXISTS "Valuation_periodEnd_idx" ON "Valuation"("periodEnd");
CREATE INDEX IF NOT EXISTS "Valuation_organizationId_idx" ON "Valuation"("organizationId");
