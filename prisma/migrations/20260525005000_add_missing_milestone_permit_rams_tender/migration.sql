-- These four tables were added to schema.prisma at some point during the
-- v1.0 build cycle but never got a corresponding CREATE TABLE migration
-- (likely lost in a db push iteration). Production therefore lacks the
-- physical tables, which broke the keystone organizationId migration
-- when it tried to ALTER each of them.
--
-- This migration creates them with all the columns the schema expects,
-- BEFORE the organizationId migration (20260525010000) runs. ON CONFLICT-
-- safe via IF NOT EXISTS so re-running is a no-op.

-- CreateTable: Milestone
CREATE TABLE IF NOT EXISTS "Milestone" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "plannedStart" TIMESTAMP(3) NOT NULL,
    "plannedEnd" TIMESTAMP(3) NOT NULL,
    "actualEnd" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'planned',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Milestone_projectId_plannedStart_idx" ON "Milestone"("projectId", "plannedStart");
CREATE INDEX IF NOT EXISTS "Milestone_plannedEnd_idx" ON "Milestone"("plannedEnd");
CREATE INDEX IF NOT EXISTS "Milestone_status_idx" ON "Milestone"("status");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Milestone_projectId_fkey') THEN
    ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- CreateTable: Permit
CREATE TABLE IF NOT EXISTS "Permit" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'general',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "riskLevel" TEXT NOT NULL DEFAULT 'medium',
    "location" TEXT,
    "issuedBy" TEXT,
    "issuedTo" TEXT,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "conditions" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Permit_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Permit_projectId_status_idx" ON "Permit"("projectId", "status");
CREATE INDEX IF NOT EXISTS "Permit_status_validTo_idx" ON "Permit"("status", "validTo");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Permit_projectId_fkey') THEN
    ALTER TABLE "Permit" ADD CONSTRAINT "Permit_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- CreateTable: Rams
CREATE TABLE IF NOT EXISTS "Rams" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'rams',
    "hazards" TEXT,
    "controls" TEXT,
    "ppe" TEXT,
    "reviewBy" TIMESTAMP(3),
    "signedBy" TEXT,
    "signedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'draft',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Rams_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Rams_projectId_status_idx" ON "Rams"("projectId", "status");
CREATE INDEX IF NOT EXISTS "Rams_reviewBy_idx" ON "Rams"("reviewBy");
CREATE INDEX IF NOT EXISTS "Rams_type_idx" ON "Rams"("type");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Rams_projectId_fkey') THEN
    ALTER TABLE "Rams" ADD CONSTRAINT "Rams_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- CreateTable: Tender
CREATE TABLE IF NOT EXISTS "Tender" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "clientName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "totalValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deadline" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Tender_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Tender_projectId_status_idx" ON "Tender"("projectId", "status");
CREATE INDEX IF NOT EXISTS "Tender_status_deadline_idx" ON "Tender"("status", "deadline");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Tender_projectId_fkey') THEN
    ALTER TABLE "Tender" ADD CONSTRAINT "Tender_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
