CREATE TABLE IF NOT EXISTS "ValuationCertificate" (
  "id" TEXT NOT NULL,
  "valuationId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "certificateNumber" TEXT NOT NULL,
  "certifiedGrossToDate" DOUBLE PRECISION NOT NULL,
  "retentionPct" DOUBLE PRECISION NOT NULL,
  "retentionAmount" DOUBLE PRECISION NOT NULL,
  "previousCertified" DOUBLE PRECISION NOT NULL,
  "retentionRelease" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "amountCertified" DOUBLE PRECISION NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'issued',
  "dueDate" TIMESTAMP(3),
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "organizationId" TEXT,
  CONSTRAINT "ValuationCertificate_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ValuationCertificate_valuationId_fkey" FOREIGN KEY ("valuationId") REFERENCES "Valuation"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ValuationCertificate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "ValuationCertificate_valuationId_revision_key" ON "ValuationCertificate"("valuationId", "revision");
CREATE INDEX IF NOT EXISTS "ValuationCertificate_certificateNumber_idx" ON "ValuationCertificate"("certificateNumber");
CREATE INDEX IF NOT EXISTS "ValuationCertificate_status_dueDate_idx" ON "ValuationCertificate"("status", "dueDate");
CREATE INDEX IF NOT EXISTS "ValuationCertificate_organizationId_idx" ON "ValuationCertificate"("organizationId");

CREATE TABLE IF NOT EXISTS "ValuationPayment" (
  "id" TEXT NOT NULL,
  "certificateId" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reference" TEXT,
  "method" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "organizationId" TEXT,
  CONSTRAINT "ValuationPayment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ValuationPayment_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "ValuationCertificate"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ValuationPayment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ValuationPayment_certificateId_paidAt_idx" ON "ValuationPayment"("certificateId", "paidAt");
CREATE INDEX IF NOT EXISTS "ValuationPayment_organizationId_idx" ON "ValuationPayment"("organizationId");

CREATE TABLE IF NOT EXISTS "ValuationVariation" (
  "id" TEXT NOT NULL,
  "valuationId" TEXT NOT NULL,
  "variationId" TEXT NOT NULL,
  "amountIncluded" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "organizationId" TEXT,
  CONSTRAINT "ValuationVariation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ValuationVariation_valuationId_fkey" FOREIGN KEY ("valuationId") REFERENCES "Valuation"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ValuationVariation_variationId_fkey" FOREIGN KEY ("variationId") REFERENCES "Variation"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ValuationVariation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "ValuationVariation_valuationId_variationId_key" ON "ValuationVariation"("valuationId", "variationId");
CREATE INDEX IF NOT EXISTS "ValuationVariation_variationId_idx" ON "ValuationVariation"("variationId");
CREATE INDEX IF NOT EXISTS "ValuationVariation_organizationId_idx" ON "ValuationVariation"("organizationId");
