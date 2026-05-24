-- CreateTable
CREATE TABLE "Snag" (
    "id"          TEXT      NOT NULL,
    "projectId"   TEXT      NOT NULL,
    "title"       TEXT      NOT NULL,
    "description" TEXT,
    "location"    TEXT,
    "status"      TEXT      NOT NULL DEFAULT 'open',
    "priority"    TEXT      NOT NULL DEFAULT 'medium',
    "photoUrl"    TEXT,
    "dueDate"     TIMESTAMP(3),
    "closedAt"    TIMESTAMP(3),
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Snag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Snag_projectId_status_idx" ON "Snag" ("projectId", "status");
CREATE INDEX "Snag_status_priority_idx"  ON "Snag" ("status", "priority");
CREATE INDEX "Snag_dueDate_idx"          ON "Snag" ("dueDate");
CREATE INDEX "Document_type_idx"         ON "Document" ("type");

-- AddForeignKey
ALTER TABLE "Snag"
  ADD CONSTRAINT "Snag_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
