-- Migration 073: APNs/push notification token persistence
-- Stores device tokens for iOS, Android, and web push notifications
-- Supports multi-device-per-user with unique constraint on (user_id, device_token)
--
-- Idempotency: every CREATE uses IF NOT EXISTS / OR REPLACE / DROP-then-CREATE so
-- this migration can be re-applied safely against a database where the schema
-- already exists (e.g. when a developer hand-applied it before migration_log
-- tracking was hooked into deploys).

CREATE TABLE IF NOT EXISTS push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform VARCHAR(20) NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  device_token TEXT NOT NULL,
  environment VARCHAR(20) DEFAULT 'production' CHECK (environment IN ('sandbox', 'production')),
  bundle_id TEXT,
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, device_token)
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_platform_last_seen ON push_tokens(platform, last_seen_at DESC);

-- Audit trigger
CREATE OR REPLACE FUNCTION update_push_tokens_updated_at()
  RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS push_tokens_update_updated_at ON push_tokens;
CREATE TRIGGER push_tokens_update_updated_at
  BEFORE UPDATE ON push_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_push_tokens_updated_at();
