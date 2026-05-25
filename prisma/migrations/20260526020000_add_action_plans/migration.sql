CREATE TABLE "ActionPlan" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "owner" TEXT,
  "priority" TEXT NOT NULL DEFAULT 'medium',
  "status" TEXT NOT NULL DEFAULT 'open',
  "dueDate" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "closeOutNotes" TEXT,
  "linkedType" TEXT,
  "linkedId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ActionPlan_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ActionPlan_organizationId_idx" ON "ActionPlan"("organizationId");
CREATE INDEX "ActionPlan_status_idx" ON "ActionPlan"("status");

ALTER TABLE "ActionPlan" ADD CONSTRAINT "ActionPlan_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
