CREATE TABLE "DrawingMarkup" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "drawingId" TEXT NOT NULL,
  "revisionId" TEXT NOT NULL,
  "page" INTEGER NOT NULL DEFAULT 1,
  "kind" TEXT NOT NULL DEFAULT 'pin',
  "x" DOUBLE PRECISION NOT NULL,
  "y" DOUBLE PRECISION NOT NULL,
  "width" DOUBLE PRECISION,
  "height" DOUBLE PRECISION,
  "text" TEXT NOT NULL,
  "color" TEXT NOT NULL DEFAULT '#f59e0b',
  "status" TEXT NOT NULL DEFAULT 'open',
  "createdByUserId" TEXT,
  "createdBy" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "resolvedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "organizationId" TEXT,
  CONSTRAINT "DrawingMarkup_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DrawingMarkup_revisionId_page_status_idx" ON "DrawingMarkup"("revisionId", "page", "status");
CREATE INDEX "DrawingMarkup_projectId_status_idx" ON "DrawingMarkup"("projectId", "status");
CREATE INDEX "DrawingMarkup_drawingId_createdAt_idx" ON "DrawingMarkup"("drawingId", "createdAt");
CREATE INDEX "DrawingMarkup_organizationId_idx" ON "DrawingMarkup"("organizationId");
ALTER TABLE "DrawingMarkup" ADD CONSTRAINT "DrawingMarkup_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DrawingMarkup" ADD CONSTRAINT "DrawingMarkup_drawingId_fkey" FOREIGN KEY ("drawingId") REFERENCES "Drawing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DrawingMarkup" ADD CONSTRAINT "DrawingMarkup_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "DrawingRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DrawingMarkup" ADD CONSTRAINT "DrawingMarkup_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
