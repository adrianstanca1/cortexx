-- Project: client portal token + enable flag
ALTER TABLE "Project" ADD COLUMN "clientToken"       TEXT;
ALTER TABLE "Project" ADD COLUMN "clientViewEnabled" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX "Project_clientToken_key" ON "Project" ("clientToken");

-- Drawing
CREATE TABLE "Drawing" (
    "id"           TEXT NOT NULL,
    "projectId"    TEXT NOT NULL,
    "number"       TEXT,
    "title"        TEXT NOT NULL,
    "discipline"   TEXT NOT NULL DEFAULT 'arch',
    "revision"     TEXT NOT NULL DEFAULT 'C01',
    "fileUrl"      TEXT,
    "uploadedBy"   TEXT,
    "notes"        TEXT,
    "isSuperseded" BOOLEAN NOT NULL DEFAULT false,
    "supersededAt" TIMESTAMP(3),
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Drawing_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Drawing_projectId_number_revision_key" ON "Drawing" ("projectId", "number", "revision");
CREATE INDEX "Drawing_projectId_discipline_idx"  ON "Drawing" ("projectId", "discipline");
CREATE INDEX "Drawing_projectId_isSuperseded_idx" ON "Drawing" ("projectId", "isSuperseded");
CREATE INDEX "Drawing_discipline_idx"             ON "Drawing" ("discipline");
ALTER TABLE "Drawing" ADD CONSTRAINT "Drawing_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Milestone
CREATE TABLE "Milestone" (
    "id"           TEXT NOT NULL,
    "projectId"    TEXT NOT NULL,
    "title"        TEXT NOT NULL,
    "plannedStart" TIMESTAMP(3) NOT NULL,
    "plannedEnd"   TIMESTAMP(3) NOT NULL,
    "actualEnd"    TIMESTAMP(3),
    "status"       TEXT NOT NULL DEFAULT 'planned',
    "notes"        TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Milestone_projectId_plannedStart_idx" ON "Milestone" ("projectId", "plannedStart");
CREATE INDEX "Milestone_plannedEnd_idx"             ON "Milestone" ("plannedEnd");
CREATE INDEX "Milestone_status_idx"                 ON "Milestone" ("status");
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
