-- Certification
CREATE TABLE "Certification" (
    "id"         TEXT NOT NULL,
    "memberId"   TEXT,
    "holderName" TEXT NOT NULL,
    "type"       TEXT NOT NULL,
    "number"     TEXT,
    "issuedDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "notes"      TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Certification_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Certification_memberId_idx"   ON "Certification" ("memberId");
CREATE INDEX "Certification_expiryDate_idx" ON "Certification" ("expiryDate");
CREATE INDEX "Certification_type_idx"       ON "Certification" ("type");
ALTER TABLE "Certification"
  ADD CONSTRAINT "Certification_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "TeamMember" ("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Rfi
CREATE TABLE "Rfi" (
    "id"          TEXT NOT NULL,
    "number"      TEXT NOT NULL,
    "subject"     TEXT NOT NULL,
    "body"        TEXT NOT NULL,
    "projectId"   TEXT NOT NULL,
    "status"      TEXT NOT NULL DEFAULT 'open',
    "priority"    TEXT NOT NULL DEFAULT 'medium',
    "raisedBy"    TEXT,
    "assignee"    TEXT,
    "dueDate"     TIMESTAMP(3),
    "response"    TEXT,
    "respondedAt" TIMESTAMP(3),
    "closedAt"    TIMESTAMP(3),
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Rfi_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Rfi_projectId_number_key"    ON "Rfi" ("projectId", "number");
CREATE INDEX "Rfi_projectId_status_idx"           ON "Rfi" ("projectId", "status");
CREATE INDEX "Rfi_status_priority_idx"            ON "Rfi" ("status", "priority");
CREATE INDEX "Rfi_dueDate_idx"                    ON "Rfi" ("dueDate");
ALTER TABLE "Rfi"
  ADD CONSTRAINT "Rfi_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Announcement
CREATE TABLE "Announcement" (
    "id"         TEXT NOT NULL,
    "title"      TEXT NOT NULL,
    "body"       TEXT NOT NULL,
    "type"       TEXT NOT NULL DEFAULT 'general',
    "projectId"  TEXT,
    "authorName" TEXT,
    "isPinned"   BOOLEAN NOT NULL DEFAULT false,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Announcement_projectId_createdAt_idx" ON "Announcement" ("projectId", "createdAt");
CREATE INDEX "Announcement_isPinned_createdAt_idx"  ON "Announcement" ("isPinned", "createdAt");
ALTER TABLE "Announcement"
  ADD CONSTRAINT "Announcement_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project" ("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
