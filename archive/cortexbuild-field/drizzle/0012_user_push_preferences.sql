-- ============================================================================
-- 0012_user_push_preferences.sql
-- ============================================================================
-- Sparse JSONB column on users; missing keys = enabled. Convention
-- codified in shared/notification-events.ts. Defaults to '{}'::jsonb
-- so existing rows see no behaviour change.
-- ============================================================================

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "pushPreferences" jsonb NOT NULL DEFAULT '{}'::jsonb;
