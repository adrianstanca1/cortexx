-- Add composite index to speed up the multi-tenant activity stream and list queries.
CREATE INDEX "Activity_organizationId_createdAt_idx" ON "Activity"("organizationId", "createdAt");
