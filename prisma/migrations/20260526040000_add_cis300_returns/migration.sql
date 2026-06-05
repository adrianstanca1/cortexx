CREATE TABLE "Cis300Return" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT,
  "taxMonth" TIMESTAMP(3) NOT NULL,
  "totalGross" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalCis" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalNet" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "subCount" INTEGER NOT NULL DEFAULT 0,
  "lineItems" JSONB NOT NULL DEFAULT '[]',
  "status" TEXT NOT NULL DEFAULT 'draft',
  "submittedAt" TIMESTAMP(3),
  "hmrcReference" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Cis300Return_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Cis300Return_organizationId_taxMonth_key" ON "Cis300Return"("organizationId", "taxMonth");
CREATE INDEX "Cis300Return_organizationId_idx" ON "Cis300Return"("organizationId");
CREATE INDEX "Cis300Return_status_idx" ON "Cis300Return"("status");

ALTER TABLE "Cis300Return" ADD CONSTRAINT "Cis300Return_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
