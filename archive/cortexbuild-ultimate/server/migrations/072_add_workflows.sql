-- Migration: 072_add_workflows
-- Purpose: Create foundational workflow engine tables and triggers

BEGIN;

-- Create workflows table: trigger -> conditions -> actions execution pipeline
CREATE TABLE IF NOT EXISTS workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  trigger JSONB NOT NULL,
  conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint: one workflow name per organization
CREATE UNIQUE INDEX IF NOT EXISTS idx_workflows_org_name
  ON workflows(organization_id, name);

-- Index for querying enabled workflows by trigger event
CREATE INDEX IF NOT EXISTS idx_workflows_enabled_org
  ON workflows(organization_id, enabled)
  WHERE enabled = true;

-- Index for querying by trigger type
CREATE INDEX IF NOT EXISTS idx_workflows_trigger_event
  ON workflows USING GIN ((trigger->'event'));

-- Trigger for workflows.updated_at
CREATE OR REPLACE FUNCTION update_workflows_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS workflows_update_updated_at ON workflows;
CREATE TRIGGER workflows_update_updated_at
BEFORE UPDATE ON workflows
FOR EACH ROW
EXECUTE FUNCTION update_workflows_updated_at();

-- Create workflow_runs table: execution history and results
CREATE TABLE IF NOT EXISTS workflow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  trigger_event JSONB NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'succeeded', 'failed', 'skipped')),
  result JSONB,
  error TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Index for efficient workflow run lookups ordered by time
CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow_started
  ON workflow_runs(workflow_id, started_at DESC);

-- Index for querying runs by status
CREATE INDEX IF NOT EXISTS idx_workflow_runs_status
  ON workflow_runs(status)
  WHERE status != 'succeeded';

COMMIT;
