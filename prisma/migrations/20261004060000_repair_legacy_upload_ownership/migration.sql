-- Recover legacy ownership from parents before falling back to the original bootstrap workspace.
UPDATE "Project" r SET "organizationId" = COALESCE((SELECT id FROM "Organization" WHERE slug = 'cortexbuildpro')) WHERE r."organizationId" IS NULL;
UPDATE "Document" r SET "organizationId" = COALESCE((SELECT p."organizationId" FROM "Project" p WHERE p.id = r."projectId"), (SELECT id FROM "Organization" WHERE slug = 'cortexbuildpro')) WHERE r."organizationId" IS NULL;
UPDATE "Snag" r SET "organizationId" = COALESCE((SELECT p."organizationId" FROM "Project" p WHERE p.id = r."projectId"), (SELECT id FROM "Organization" WHERE slug = 'cortexbuildpro')) WHERE r."organizationId" IS NULL;
UPDATE "Observation" r SET "organizationId" = COALESCE((SELECT p."organizationId" FROM "Project" p WHERE p.id = r."projectId"), (SELECT id FROM "Organization" WHERE slug = 'cortexbuildpro')) WHERE r."organizationId" IS NULL;
UPDATE "Drawing" r SET "organizationId" = COALESCE((SELECT p."organizationId" FROM "Project" p WHERE p.id = r."projectId"), (SELECT id FROM "Organization" WHERE slug = 'cortexbuildpro')) WHERE r."organizationId" IS NULL;
UPDATE "SafetyIncident" r SET "organizationId" = COALESCE((SELECT p."organizationId" FROM "Project" p WHERE p.id = r."projectId"), (SELECT id FROM "Organization" WHERE slug = 'cortexbuildpro')) WHERE r."organizationId" IS NULL;
UPDATE "DrawingRevision" r SET "organizationId" = COALESCE((SELECT p."organizationId" FROM "Drawing" p WHERE p.id = r."drawingId"), (SELECT id FROM "Organization" WHERE slug = 'cortexbuildpro')) WHERE r."organizationId" IS NULL;
UPDATE "SafetyCorrectiveAction" r SET "organizationId" = COALESCE((SELECT p."organizationId" FROM "SafetyIncident" p WHERE p.id = r."incidentId"), (SELECT id FROM "Organization" WHERE slug = 'cortexbuildpro')) WHERE r."organizationId" IS NULL;

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
