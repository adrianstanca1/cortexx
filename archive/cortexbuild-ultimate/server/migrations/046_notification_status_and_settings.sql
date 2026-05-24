-- Migration: 046_notification_status_and_settings
-- Purpose: Add status tracking, archive, snooze, and per-user settings to notifications
-- Run: psql -d cortexbuild -f server/migrations/046_notification_status_and_settings.sql

-- Add status column with default 'active' so existing rows stay visible
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active' NOT NULL;

-- Add archived_at timestamp for archive tracking
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Add snoozed_until for snooze feature
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS snoozed_until TIMESTAMPTZ;

-- Add notification preferences/settings table
CREATE TABLE IF NOT EXISTS notification_settings (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID        REFERENCES users(id) ON DELETE CASCADE,
  category        VARCHAR(50)  DEFAULT 'all',
  sound_alerts   BOOLEAN     DEFAULT true,
  browser_notif  BOOLEAN     DEFAULT false,
  quiet_hours_enabled BOOLEAN DEFAULT false,
  quiet_hours_start TIME     DEFAULT '22:00',
  quiet_hours_end   TIME     DEFAULT '08:00',
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, category)
);

-- Index for fast user settings lookup
CREATE INDEX IF NOT EXISTS idx_notification_settings_user
  ON notification_settings(user_id);
