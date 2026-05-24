-- ============================================================================
-- 0005_email_password_auth.sql
-- ============================================================================
-- Adds email/password authentication alongside the existing Manus OAuth flow.
--
-- users.passwordHash — nullable text column, populated only for users who
-- authenticate with email + password (loginMethod = 'password'). OAuth users
-- keep it NULL.
--
-- Super-admin bootstrap is intentionally NOT inlined here. Run
-- `node scripts/seed-superadmin.mjs` once after this migration with the
-- BOOTSTRAP_SUPERADMIN_EMAIL and BOOTSTRAP_SUPERADMIN_PASSWORD env vars set.
-- See scripts/seed-superadmin.mjs for details. Keeping the password (even
-- hashed) out of git is hygiene, even though scrypt is one-way.
--
-- Idempotent — safe to re-apply.
-- ============================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS "passwordHash" text;
