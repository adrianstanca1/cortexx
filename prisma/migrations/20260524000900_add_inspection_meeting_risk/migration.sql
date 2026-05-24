-- Inspection
CREATE TABLE "Inspection" (
    "id"             TEXT NOT NULL,
    "projectId"      TEXT NOT NULL,
    "title"          TEXT NOT NULL,
    "type"           TEXT NOT NULL DEFAULT 'general',
    "status"         TEXT NOT NULL DEFAULT 'draft',
    "checklistItems" JSONB NOT NULL DEFAULT '[]',
    "overallResult"  TEXT,
    "conductedBy"    TEXT,
    "scheduledAt"    TIMESTAMP(3),
    "completedAt"    TIMESTAMP(3),
    "notes"          TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Inspection_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Inspection_projectId_status_idx" ON "Inspection" ("projectId", "status");
CREATE INDEX "Inspection_scheduledAt_idx"      ON "Inspection" ("scheduledAt");
CREATE INDEX "Inspection_type_idx"             ON "Inspection" ("type");
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Meeting
CREATE TABLE "Meeting" (
    "id"          TEXT NOT NULL,
    "projectId"   TEXT,
    "title"       TEXT NOT NULL,
    "location"    TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "durationMin" INTEGER NOT NULL DEFAULT 60,
    "attendees"   TEXT,
    "minutes"     TEXT,
    "actionItems" JSONB NOT NULL DEFAULT '[]',
    "status"      TEXT NOT NULL DEFAULT 'scheduled',
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Meeting_projectId_scheduledAt_idx" ON "Meeting" ("projectId", "scheduledAt");
CREATE INDEX "Meeting_status_scheduledAt_idx"    ON "Meeting" ("status", "scheduledAt");
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Risk
CREATE TABLE "Risk" (
    "id"         TEXT NOT NULL,
    "projectId"  TEXT NOT NULL,
    "title"      TEXT NOT NULL,
    "category"   TEXT NOT NULL DEFAULT 'operational',
    "likelihood" INTEGER NOT NULL DEFAULT 3,
    "impact"     INTEGER NOT NULL DEFAULT 3,
    "score"      INTEGER NOT NULL DEFAULT 9,
    "mitigation" TEXT,
    "owner"      TEXT,
    "status"     TEXT NOT NULL DEFAULT 'open',
    "reviewBy"   TIMESTAMP(3),
    "notes"      TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Risk_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Risk_projectId_status_idx" ON "Risk" ("projectId", "status");
CREATE INDEX "Risk_score_idx"            ON "Risk" ("score");
CREATE INDEX "Risk_reviewBy_idx"         ON "Risk" ("reviewBy");
ALTER TABLE "Risk" ADD CONSTRAINT "Risk_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
