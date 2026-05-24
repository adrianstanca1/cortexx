-- CreateTable
CREATE TABLE "SafetyIncident" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'near_miss',
    "severity" TEXT NOT NULL DEFAULT 'low',
    "status" TEXT NOT NULL DEFAULT 'open',
    "location" TEXT,
    "reportedBy" TEXT,
    "injuredParty" TEXT,
    "photoUrl" TEXT,
    "riddorReportable" BOOLEAN NOT NULL DEFAULT false,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SafetyIncident_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SafetyIncident_projectId_status_idx" ON "SafetyIncident"("projectId", "status");

-- CreateIndex
CREATE INDEX "SafetyIncident_status_occurredAt_idx" ON "SafetyIncident"("status", "occurredAt");

-- CreateIndex
CREATE INDEX "SafetyIncident_severity_idx" ON "SafetyIncident"("severity");

-- AddForeignKey
ALTER TABLE "SafetyIncident" ADD CONSTRAINT "SafetyIncident_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
