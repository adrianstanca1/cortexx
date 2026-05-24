-- 076_user_ui_preferences.sql
-- Cross-device UI preferences (active tab, view mode, etc.) for Dashboard,
-- Analytics, Calendar and other modules.
--
-- Stored as a JSONB blob on the users row rather than a separate table so:
--   1. Reads are co-located with the user record (already fetched on every request)
--   2. The schema stays flexible — modules add keys without migrations
--   3. Per-key isolation is enforced in the API layer (jsonb_set), not in SQL
--
-- Existing notification_preferences column established the same pattern.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS ui_preferences JSONB NOT NULL DEFAULT '{}'::jsonb;
