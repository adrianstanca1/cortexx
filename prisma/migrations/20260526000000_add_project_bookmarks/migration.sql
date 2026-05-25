CREATE TABLE "ProjectBookmark" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "organizationId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectBookmark_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectBookmark_userId_projectId_key" ON "ProjectBookmark"("userId", "projectId");
CREATE INDEX "ProjectBookmark_userId_idx" ON "ProjectBookmark"("userId");
CREATE INDEX "ProjectBookmark_organizationId_idx" ON "ProjectBookmark"("organizationId");

ALTER TABLE "ProjectBookmark" ADD CONSTRAINT "ProjectBookmark_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectBookmark" ADD CONSTRAINT "ProjectBookmark_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectBookmark" ADD CONSTRAINT "ProjectBookmark_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
