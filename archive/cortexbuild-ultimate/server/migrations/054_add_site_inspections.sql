-- Site Inspections module
CREATE TABLE IF NOT EXISTS site_inspections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID,
    company_id UUID,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','passed','failed','conditional')),
    description TEXT,
    category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('structural','electrical','mechanical','fire_safety','general','environmental')),
    severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
    resolution TEXT,
    due_date DATE,
    inspector TEXT,
    location TEXT,
    findings TEXT,
    corrective_actions TEXT,
    scheduled_date DATE,
    completed_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_site_inspections_org ON site_inspections(organization_id);
CREATE INDEX IF NOT EXISTS idx_site_inspections_project ON site_inspections(project_id);
CREATE INDEX IF NOT EXISTS idx_site_inspections_status ON site_inspections(status);
CREATE INDEX IF NOT EXISTS idx_site_inspections_severity ON site_inspections(severity);
CREATE INDEX IF NOT EXISTS idx_site_inspections_due_date ON site_inspections(due_date);