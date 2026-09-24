ALTER TABLE "UserOrganization" ADD COLUMN IF NOT EXISTS "personaRole" TEXT NOT NULL DEFAULT 'operative';
ALTER TABLE "OrganizationInvite" ADD COLUMN IF NOT EXISTS "personaRole" TEXT NOT NULL DEFAULT 'operative';

-- Preserve the established construction persona for existing memberships while
-- moving it from the global User row to the tenant membership. Administrative
-- membership is a safe company-admin fallback for legacy accounts.
UPDATE "UserOrganization" AS membership
SET "personaRole" = CASE
  WHEN usr."role" IN ('super_admin', 'platform_admin', 'company_admin', 'project_manager', 'foreman', 'operative', 'client') THEN usr."role"
  WHEN membership."role" IN ('owner', 'admin') THEN 'company_admin'
  ELSE 'operative'
END
FROM "User" AS usr
WHERE usr."id" = membership."userId";

UPDATE "OrganizationInvite"
SET "personaRole" = CASE WHEN "role" = 'admin' THEN 'company_admin' ELSE 'operative' END
WHERE "personaRole" = 'operative';
