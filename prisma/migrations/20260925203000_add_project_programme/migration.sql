CREATE TABLE "ProgrammeActivity" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "code" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "baselineStart" TIMESTAMP(3) NOT NULL,
  "baselineEnd" TIMESTAMP(3) NOT NULL,
  "plannedStart" TIMESTAMP(3) NOT NULL,
  "plannedEnd" TIMESTAMP(3) NOT NULL,
  "actualStart" TIMESTAMP(3),
  "actualEnd" TIMESTAMP(3),
  "progress" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'not_started',
  "responsibleMemberId" TEXT,
  "location" TEXT,
  "notes" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "organizationId" TEXT,
  CONSTRAINT "ProgrammeActivity_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProgrammeActivity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProgrammeActivity_responsibleMemberId_fkey" FOREIGN KEY ("responsibleMemberId") REFERENCES "TeamMember"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ProgrammeActivity_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProgrammeActivity_projectId_plannedStart_idx" ON "ProgrammeActivity"("projectId", "plannedStart");
CREATE INDEX "ProgrammeActivity_projectId_plannedEnd_idx" ON "ProgrammeActivity"("projectId", "plannedEnd");
CREATE INDEX "ProgrammeActivity_responsibleMemberId_plannedStart_idx" ON "ProgrammeActivity"("responsibleMemberId", "plannedStart");
CREATE INDEX "ProgrammeActivity_status_plannedEnd_idx" ON "ProgrammeActivity"("status", "plannedEnd");
CREATE INDEX "ProgrammeActivity_organizationId_idx" ON "ProgrammeActivity"("organizationId");

CREATE TABLE "ProgrammeDependency" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "predecessorId" TEXT NOT NULL,
  "successorId" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'FS',
  "lagDays" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "organizationId" TEXT,
  CONSTRAINT "ProgrammeDependency_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProgrammeDependency_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProgrammeDependency_predecessorId_fkey" FOREIGN KEY ("predecessorId") REFERENCES "ProgrammeActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProgrammeDependency_successorId_fkey" FOREIGN KEY ("successorId") REFERENCES "ProgrammeActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProgrammeDependency_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ProgrammeDependency_predecessorId_successorId_type_key" ON "ProgrammeDependency"("predecessorId", "successorId", "type");
CREATE INDEX "ProgrammeDependency_projectId_idx" ON "ProgrammeDependency"("projectId");
CREATE INDEX "ProgrammeDependency_successorId_idx" ON "ProgrammeDependency"("successorId");
CREATE INDEX "ProgrammeDependency_organizationId_idx" ON "ProgrammeDependency"("organizationId");
