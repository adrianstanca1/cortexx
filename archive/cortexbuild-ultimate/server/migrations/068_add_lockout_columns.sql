-- Migration: 068_add_lockout_columns
-- Purpose: Add DB-level account lockout fallback columns

BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_attempts INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

COMMIT;
