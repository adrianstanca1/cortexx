-- Migration: workspaces.suspended
-- Adds a suspend flag so operators can disable a tenant without deleting it.
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS suspended BOOLEAN DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_workspaces_suspended ON workspaces(suspended);
