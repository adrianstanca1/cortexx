-- Drawing
CREATE TABLE "Drawing" (
    "id"         TEXT NOT NULL,
    "projectId"  TEXT NOT NULL,
    "number"     TEXT NOT NULL,
    "title"      TEXT NOT NULL,
    "discipline" TEXT,
    "status"     TEXT NOT NULL DEFAULT 'draft',
    "notes"      TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Drawing_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Drawing_projectId_number_key" ON "Drawing" ("projectId", "number");
CREATE INDEX "Drawing_projectId_status_idx"        ON "Drawing" ("projectId", "status");
CREATE INDEX "Drawing_discipline_idx"              ON "Drawing" ("discipline");
ALTER TABLE "Drawing"
  ADD CONSTRAINT "Drawing_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- DrawingRevision
CREATE TABLE "DrawingRevision" (
    "id"         TEXT NOT NULL,
    "drawingId"  TEXT NOT NULL,
    "revision"   TEXT NOT NULL,
    "fileUrl"    TEXT,
    "fileName"   TEXT,
    "fileSize"   INTEGER,
    "mimeType"   TEXT,
    "notes"      TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DrawingRevision_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DrawingRevision_drawingId_revision_key" ON "DrawingRevision" ("drawingId", "revision");
CREATE INDEX "DrawingRevision_drawingId_uploadedAt_idx"      ON "DrawingRevision" ("drawingId", "uploadedAt");
ALTER TABLE "DrawingRevision"
  ADD CONSTRAINT "DrawingRevision_drawingId_fkey"
  FOREIGN KEY ("drawingId") REFERENCES "Drawing" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
