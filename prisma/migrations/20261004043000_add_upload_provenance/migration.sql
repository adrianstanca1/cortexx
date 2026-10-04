CREATE TABLE IF NOT EXISTS "UploadObject" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "uploadedById" TEXT,
  "uploadId" TEXT,
  "storedName" TEXT NOT NULL,
  "originalName" TEXT,
  "mimeType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "sha256" TEXT,
  "backend" TEXT NOT NULL,
  "legacy" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UploadObject_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UploadObject_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UploadObject_uploadedById_fkey"
    FOREIGN KEY ("uploadedById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "UploadObject_storedName_key"
  ON "UploadObject"("storedName");
CREATE UNIQUE INDEX IF NOT EXISTS "UploadObject_organizationId_uploadId_key"
  ON "UploadObject"("organizationId", "uploadId");
CREATE INDEX IF NOT EXISTS "UploadObject_uploadedById_idx"
  ON "UploadObject"("uploadedById");
CREATE INDEX IF NOT EXISTS "UploadObject_organizationId_createdAt_idx"
  ON "UploadObject"("organizationId", "createdAt");

-- Preserve all already-referenced evidence as tenant-scoped legacy provenance.
-- Uploader/hash cannot be reconstructed historically; ownership is therefore
-- established at tenant level while destination routes keep enforcing RBAC and
-- project assignment for any new reference.
WITH refs AS (
  SELECT 1 AS priority, "organizationId",
         substring("url" from '^/api/uploads/([A-Za-z0-9._-]+)$') AS "storedName",
         "name" AS "originalName",
         COALESCE("mimeType", 'application/octet-stream') AS "mimeType",
         COALESCE("size", 0) AS "size",
         "createdAt"
    FROM "Document"
   WHERE "organizationId" IS NOT NULL AND "url" ~ '^/api/uploads/[A-Za-z0-9._-]+$'
  UNION ALL
  SELECT 2, "organizationId",
         substring("photoUrl" from '^/api/uploads/([A-Za-z0-9._-]+)$'),
         NULL, 'application/octet-stream', 0, "createdAt"
    FROM "Snag"
   WHERE "organizationId" IS NOT NULL AND "photoUrl" ~ '^/api/uploads/[A-Za-z0-9._-]+$'
  UNION ALL
  SELECT 3, "organizationId",
         substring("photoUrl" from '^/api/uploads/([A-Za-z0-9._-]+)$'),
         NULL, 'application/octet-stream', 0, "createdAt"
    FROM "Observation"
   WHERE "organizationId" IS NOT NULL AND "photoUrl" ~ '^/api/uploads/[A-Za-z0-9._-]+$'
  UNION ALL
  SELECT 4, "organizationId",
         substring("fileUrl" from '^/api/uploads/([A-Za-z0-9._-]+)$'),
         "fileName", COALESCE("mimeType", 'application/octet-stream'),
         COALESCE("fileSize", 0), "uploadedAt"
    FROM "DrawingRevision"
   WHERE "organizationId" IS NOT NULL AND "fileUrl" ~ '^/api/uploads/[A-Za-z0-9._-]+$'
  UNION ALL
  SELECT 5, "organizationId",
         substring("photoUrl" from '^/api/uploads/([A-Za-z0-9._-]+)$'),
         NULL, 'application/octet-stream', 0, "createdAt"
    FROM "SafetyIncident"
   WHERE "organizationId" IS NOT NULL AND "photoUrl" ~ '^/api/uploads/[A-Za-z0-9._-]+$'
  UNION ALL
  SELECT 6, "organizationId",
         substring("evidenceUrl" from '^/api/uploads/([A-Za-z0-9._-]+)$'),
         NULL, 'application/octet-stream', 0, "createdAt"
    FROM "SafetyCorrectiveAction"
   WHERE "organizationId" IS NOT NULL AND "evidenceUrl" ~ '^/api/uploads/[A-Za-z0-9._-]+$'
),
dedup AS (
  -- One physical storage key can have exactly one tenant owner. If historical
  -- data copied the same upload URL across tenants, keep the earliest owner and
  -- fail closed for all later references rather than preserve cross-tenant
  -- sharing.
  SELECT DISTINCT ON ("storedName")
         "organizationId", "storedName", "originalName", "mimeType", "size", "createdAt"
    FROM refs
   WHERE "storedName" IS NOT NULL
   ORDER BY "storedName", "createdAt" ASC, priority ASC, "organizationId" ASC
)
INSERT INTO "UploadObject" (
  "id", "organizationId", "uploadedById", "uploadId", "storedName",
  "originalName", "mimeType", "size", "sha256", "backend", "legacy", "createdAt"
)
SELECT
  'legacy_' || md5("organizationId" || ':' || "storedName"),
  "organizationId", NULL, NULL, "storedName", "originalName",
  "mimeType", "size", NULL, 'legacy', true, "createdAt"
FROM dedup
ON CONFLICT ("storedName") DO NOTHING;
