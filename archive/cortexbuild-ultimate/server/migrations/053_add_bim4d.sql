-- 4D BIM — Time-linked 3D model management
CREATE TABLE IF NOT EXISTS bim4d_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL,
    organization_id UUID,
    company_id UUID,
    name TEXT NOT NULL,
    description TEXT,
    model_url TEXT, -- URL to IFC/glTF file in cloud storage
    thumbnail_url TEXT,
    ifc_version TEXT,
    coordinate_system TEXT,
    simulation_start DATE,
    simulation_end DATE,
    phase TEXT, -- design, pre-construction, construction, handover
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'linked', 'active', 'completed')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bim4d_models_project ON bim4d_models(project_id);
CREATE INDEX IF NOT EXISTS idx_bim4d_models_org ON bim4d_models(organization_id);

-- BIM element to schedule task links
CREATE TABLE IF NOT EXISTS bim4d_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id UUID NOT NULL REFERENCES bim4d_models(id) ON DELETE CASCADE,
    task_id UUID NOT NULL, -- FK to project_tasks (may not exist as explicit FK)
    element_ids JSONB NOT NULL, -- Array of BIM element IDs to show at this task
    start_date DATE,
    end_date DATE,
    colour TEXT DEFAULT '#3b82f6', -- hex colour for the element in the 4D view
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(model_id, task_id)
);

CREATE INDEX IF NOT EXISTS idx_bim4d_tasks_model ON bim4d_tasks(model_id);
CREATE INDEX IF NOT EXISTS idx_bim4d_tasks_task ON bim4d_tasks(task_id);
CREATE INDEX IF NOT EXISTS idx_bim4d_tasks_dates ON bim4d_tasks(start_date, end_date);
