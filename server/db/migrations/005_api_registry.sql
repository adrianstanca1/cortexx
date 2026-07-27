-- Migration 005: Central API / credential registry.
-- Idempotent; safe to run on a live volume that predates this table.

CREATE TABLE IF NOT EXISTS api_connections (
  name             TEXT PRIMARY KEY,
  category         TEXT NOT NULL,
  provider         TEXT NOT NULL,
  encrypted_secret TEXT,
  config           JSONB DEFAULT '{}'::jsonb,
  status           TEXT DEFAULT 'unknown',
  last_tested_at   TIMESTAMPTZ,
  last_error       TEXT,
  updated_by       TEXT,
  updated_at       TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_api_conn_cat ON api_connections(category);
