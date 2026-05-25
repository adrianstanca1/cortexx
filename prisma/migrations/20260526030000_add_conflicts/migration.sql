CREATE TABLE "Conflict" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "projectId" TEXT,
  "parties" TEXT,
  "severity" TEXT NOT NULL DEFAULT 'medium',
  "status" TEXT NOT NULL DEFAULT 'open',
  "owner" TEXT,
  "raisedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "resolutionNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Conflict_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Conflict_organizationId_idx" ON "Conflict"("organizationId");
CREATE INDEX "Conflict_status_idx" ON "Conflict"("status");

ALTER TABLE "Conflict" ADD CONSTRAINT "Conflict_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
