-- Migration: Add Project Templates for Rapid Project Creation
-- 2026-05-11

CREATE TABLE IF NOT EXISTS project_templates (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID REFERENCES organizations(id) ON DELETE CASCADE,
  company_id       UUID REFERENCES companies(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  description      TEXT,
  type             TEXT DEFAULT 'standard',
  default_budget   NUMERIC(14,2) DEFAULT 0,
  default_duration_days INT DEFAULT 0,
  default_phase_order TEXT[] DEFAULT '{}',
  custom_fields    JSONB DEFAULT '{}',
  tasks            JSONB DEFAULT '[]',
  checklists       JSONB DEFAULT '[]',
  is_shared        BOOLEAN DEFAULT TRUE,
  is_default       BOOLEAN DEFAULT FALSE,
  created_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_project_templates_org ON project_templates(organization_id);
CREATE INDEX idx_project_templates_company ON project_templates(company_id);
CREATE INDEX idx_project_templates_default ON project_templates(is_default);

-- Template tasks embedded view (no separate table needed for MVP; JSONB is fine)

INSERT INTO migration_log (version, description, applied_at)
VALUES (81, 'Add project_templates table', NOW())
ON CONFLICT DO NOTHING;
