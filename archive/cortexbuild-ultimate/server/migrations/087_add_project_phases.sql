-- Migration 087: Add project_phases table for formal phase/stage management
BEGIN;

CREATE TABLE IF NOT EXISTS project_phases (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  organization_id  UUID REFERENCES organizations(id) ON DELETE CASCADE,
  company_id       UUID REFERENCES companies(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  description      TEXT,
  sequence_order   INTEGER NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'not_started',
  progress         INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  budget_allocated NUMERIC(14,2) DEFAULT 0,
  budget_spent     NUMERIC(14,2) DEFAULT 0,
  start_date       DATE,
  end_date         DATE,
  actual_start_date DATE,
  actual_end_date   DATE,
  color            TEXT,
  dependencies     TEXT[] DEFAULT '{}',
  gates          JSONB DEFAULT '[]',
  created_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_phases_project ON project_phases(project_id);
CREATE INDEX IF NOT EXISTS idx_project_phases_org ON project_phases(organization_id);
CREATE INDEX IF NOT EXISTS idx_project_phases_company ON project_phases(company_id);
CREATE INDEX IF NOT EXISTS idx_project_phases_status ON project_phases(status);

-- Ensure update_at trigger if needed
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_project_phases_updated_at'
  ) THEN
    CREATE TRIGGER trigger_project_phases_updated_at
      BEFORE UPDATE ON project_phases
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END
$$;

-- Add phase_id to tasks table for linking tasks to phases
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS phase_id UUID REFERENCES project_phases(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_phase ON tasks(phase_id);

-- Insert migration log entry (for tracked migrations)
INSERT INTO migration_log (migration_name, applied_at)
VALUES ('087_add_project_phases.sql', NOW())
ON CONFLICT DO NOTHING;

COMMIT;
