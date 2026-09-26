CREATE TABLE "DrawingDistribution" (
  "id" TEXT NOT NULL,
  "drawingId" TEXT NOT NULL,
  "revisionId" TEXT NOT NULL,
  "purpose" TEXT NOT NULL DEFAULT 'For information',
  "message" TEXT,
  "issuedByUserId" TEXT,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "organizationId" TEXT,
  CONSTRAINT "DrawingDistribution_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "DrawingDistributionRecipient" (
  "id" TEXT NOT NULL,
  "distributionId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acknowledgedAt" TIMESTAMP(3),
  "acknowledgedBy" TEXT,
  "organizationId" TEXT,
  CONSTRAINT "DrawingDistributionRecipient_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DrawingDistribution_drawingId_issuedAt_idx" ON "DrawingDistribution"("drawingId", "issuedAt");
CREATE INDEX "DrawingDistribution_revisionId_issuedAt_idx" ON "DrawingDistribution"("revisionId", "issuedAt");
CREATE INDEX "DrawingDistribution_organizationId_idx" ON "DrawingDistribution"("organizationId");
CREATE UNIQUE INDEX "DrawingDistributionRecipient_distributionId_email_key" ON "DrawingDistributionRecipient"("distributionId", "email");
CREATE INDEX "DrawingDistributionRecipient_email_acknowledgedAt_idx" ON "DrawingDistributionRecipient"("email", "acknowledgedAt");
CREATE INDEX "DrawingDistributionRecipient_organizationId_idx" ON "DrawingDistributionRecipient"("organizationId");
ALTER TABLE "DrawingDistribution" ADD CONSTRAINT "DrawingDistribution_drawingId_fkey" FOREIGN KEY ("drawingId") REFERENCES "Drawing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DrawingDistribution" ADD CONSTRAINT "DrawingDistribution_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "DrawingRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DrawingDistribution" ADD CONSTRAINT "DrawingDistribution_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DrawingDistributionRecipient" ADD CONSTRAINT "DrawingDistributionRecipient_distributionId_fkey" FOREIGN KEY ("distributionId") REFERENCES "DrawingDistribution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DrawingDistributionRecipient" ADD CONSTRAINT "DrawingDistributionRecipient_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
