-- Migration 067: Add project_phases table
CREATE TABLE IF NOT EXISTS project_phases (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  organization_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  sequence_order INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'not_started',
  progress NUMERIC(5,2) DEFAULT 0,
  budget_allocated NUMERIC(14,2) DEFAULT 0,
  budget_spent NUMERIC(14,2) DEFAULT 0,
  start_date DATE,
  end_date DATE,
  actual_start_date DATE,
  actual_end_date DATE,
  color VARCHAR(50),
  dependencies JSONB DEFAULT '[]',
  gates JSONB DEFAULT '[]',
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_phases_project_id ON project_phases(project_id);
CREATE INDEX IF NOT EXISTS idx_project_phases_org_id ON project_phases(organization_id);
CREATE INDEX IF NOT EXISTS idx_project_phases_company_id ON project_phases(company_id);
CREATE INDEX IF NOT EXISTS idx_project_phases_status ON project_phases(status);
