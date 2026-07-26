-- Migration: users.disabled + last_active_at
-- Adds account-disable support so operators can lock an account out of login
-- (distinct from workspace suspension, which is tenant-scoped). `last_active_at`
-- lets the admin directory surface stale/never-active accounts. ADD COLUMN IF
-- NOT EXISTS keeps this idempotent across restarts and fresh DBs (the boot
-- migration in index.js also defends these).

ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_users_disabled ON users(disabled);
CREATE INDEX IF NOT EXISTS idx_users_last_active ON users(last_active_at DESC);
