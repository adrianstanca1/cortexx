-- Migration 030: Add notification_preferences JSONB column to users
-- Stores per-user notification channel settings as JSON
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_preferences JSONB;
