-- Migration 029: Fix notifications.user_id column type (integer → uuid)
-- The users.id column is uuid, but notifications.user_id was integer, causing
-- "invalid input syntax for type integer" errors on every notification fetch.

-- Drop any existing integer FK (none was defined but be safe)
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;

-- Clear any existing user_id values (they were integer placeholders, unusable)
UPDATE notifications SET user_id = NULL;

-- Retype the column
ALTER TABLE notifications ALTER COLUMN user_id TYPE uuid USING NULL;

-- Add proper FK to users
ALTER TABLE notifications ADD CONSTRAINT notifications_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
