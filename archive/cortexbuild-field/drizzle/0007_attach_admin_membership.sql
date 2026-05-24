-- 0006_attach_admin_membership.sql
--
-- Backfill a `company_users` row for every platform admin who doesn't have
-- one yet. PR #93 makes the bootstrap endpoint create this row on first
-- super-admin creation, but Adrian's row was created by an earlier version
-- of the endpoint (PR #52) and so has no tenant binding — `/api/auth/me`
-- returns companyId=null, and `CompanyProvider` falls back to MOCK_COMPANIES[0]
-- in the UI until the tRPC settings.get query lands.
--
-- The INSERT is idempotent: the WHERE NOT EXISTS guards against re-attaching
-- a membership that already exists, so this file is safe to re-run on every
-- deploy. Once every admin has a membership the SELECT returns zero rows
-- and the INSERT is a no-op.
--
-- Default company id used when binding admins:
--   - Picks the lowest existing companies.id; if the table is empty,
--     creates `Default Company` first (matching server/_core/bootstrap.ts).

-- 1) Make sure at least one row in `companies` exists. Idempotent — only
--    fires when the table is empty.
INSERT INTO companies (name, slug, plan, "isActive", "createdAt", "updatedAt")
SELECT 'Default Company', 'default-company', 'enterprise', true, now(), now()
 WHERE NOT EXISTS (SELECT 1 FROM companies);

-- 2) For every admin without a `company_users` row, attach them as
--    `super_admin` against the lowest-id company. Re-runs are no-ops.
INSERT INTO company_users ("companyId", "userId", "companyRole", "isActive", "createdAt")
SELECT
  (SELECT id FROM companies ORDER BY id ASC LIMIT 1),
  u.id,
  'super_admin',
  true,
  now()
FROM users u
WHERE u.role = 'admin'
  AND NOT EXISTS (
    SELECT 1 FROM company_users cu WHERE cu."userId" = u.id
  );
