-- Migration 044: Recreate Shell Tables with UUID Primary Keys
-- These tables were dropped by migration 043 but had no data to migrate
-- Run: psql "$DATABASE_URL" -f server/migrations/044_recreate_shell_tables.sql

BEGIN;

-- 1. Sustainability
CREATE TABLE IF NOT EXISTS sustainability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id),
    project TEXT,
    metric_type TEXT,
    target NUMERIC,
    actual NUMERIC,
    unit TEXT,
    period TEXT,
    status TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sustainability_org ON sustainability(organization_id);
CREATE INDEX IF NOT EXISTS idx_sustainability_company ON sustainability(company_id);
CREATE INDEX IF NOT EXISTS idx_sustainability_project ON sustainability(project_id);

-- 2. Waste Management
CREATE TABLE IF NOT EXISTS waste_management (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    reference TEXT,
    project_id UUID REFERENCES projects(id),
    project TEXT,
    waste_type TEXT,
    carrier TEXT,
    license_number TEXT,
    skip_number TEXT,
    collection_date DATE,
    quantity NUMERIC,
    unit TEXT,
    cost NUMERIC,
    disposal_site TEXT,
    waste_code TEXT,
    status TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_waste_management_org ON waste_management(organization_id);
CREATE INDEX IF NOT EXISTS idx_waste_management_company ON waste_management(company_id);
CREATE INDEX IF NOT EXISTS idx_waste_management_project ON waste_management(project_id);

-- 3. Training
CREATE TABLE IF NOT EXISTS training (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    reference TEXT,
    title TEXT,
    project_id UUID REFERENCES projects(id),
    project TEXT,
    type TEXT,
    provider TEXT,
    duration TEXT,
    cost NUMERIC,
    attendees TEXT,
    status TEXT,
    scheduled_date DATE,
    completed_date DATE,
    certification TEXT,
    expiry_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_org ON training(organization_id);
CREATE INDEX IF NOT EXISTS idx_training_company ON training(company_id);
CREATE INDEX IF NOT EXISTS idx_training_project ON training(project_id);

-- 4. Certifications
CREATE TABLE IF NOT EXISTS certifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    reference TEXT,
    company TEXT,
    certification_type TEXT,
    body TEXT,
    grade TEXT,
    expiry_date DATE,
    status TEXT,
    renewal_date DATE,
    cost NUMERIC,
    scope TEXT,
    accreditation_number TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_certifications_org ON certifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_certifications_company ON certifications(company_id);

-- 5. Lettings
CREATE TABLE IF NOT EXISTS lettings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    reference TEXT,
    project_id UUID REFERENCES projects(id),
    project TEXT,
    package_name TEXT,
    trade TEXT,
    status TEXT,
    tender_closing_date DATE,
    award_date DATE,
    contractor TEXT,
    contract_value NUMERIC,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lettings_org ON lettings(organization_id);
CREATE INDEX IF NOT EXISTS idx_lettings_company ON lettings(company_id);
CREATE INDEX IF NOT EXISTS idx_lettings_project ON lettings(project_id);

-- 6. Measuring
CREATE TABLE IF NOT EXISTS measuring (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    reference TEXT,
    project_id UUID REFERENCES projects(id),
    project TEXT,
    survey_type TEXT,
    location TEXT,
    status TEXT,
    surveyor TEXT,
    survey_date DATE,
    completed_date DATE,
    areas TEXT,
    total_area NUMERIC,
    unit TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_measuring_org ON measuring(organization_id);
CREATE INDEX IF NOT EXISTS idx_measuring_company ON measuring(company_id);
CREATE INDEX IF NOT EXISTS idx_measuring_project ON measuring(project_id);

-- 7. Signage
CREATE TABLE IF NOT EXISTS signage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    reference TEXT,
    project_id UUID REFERENCES projects(id),
    project TEXT,
    type TEXT,
    description TEXT,
    location TEXT,
    size TEXT,
    material TEXT,
    quantity INTEGER,
    status TEXT,
    required_date DATE,
    installed_date DATE,
    installed_by TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signage_org ON signage(organization_id);
CREATE INDEX IF NOT EXISTS idx_signage_company ON signage(company_id);
CREATE INDEX IF NOT EXISTS idx_signage_project ON signage(project_id);

-- 8. Temp Works
CREATE TABLE IF NOT EXISTS temp_works (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    reference TEXT,
    title TEXT,
    project_id UUID REFERENCES projects(id),
    project TEXT,
    description TEXT,
    type TEXT,
    status TEXT,
    location TEXT,
    design_by TEXT,
    approved_by TEXT,
    design_date DATE,
    approval_date DATE,
    erected_by TEXT,
    erected_date DATE,
    inspected_by TEXT,
    inspected_date DATE,
    load_capacity TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_temp_works_org ON temp_works(organization_id);
CREATE INDEX IF NOT EXISTS idx_temp_works_company ON temp_works(company_id);
CREATE INDEX IF NOT EXISTS idx_temp_works_project ON temp_works(project_id);

-- 9. AI Vision Logs
CREATE TABLE IF NOT EXISTS ai_vision_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id),
    image_url TEXT,
    analysis_result JSONB,
    confidence_score NUMERIC,
    processed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_vision_logs_org ON ai_vision_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_vision_logs_company ON ai_vision_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_ai_vision_logs_project ON ai_vision_logs(project_id);

-- 10. Work Packages
CREATE TABLE IF NOT EXISTS work_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id),
    name VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    status VARCHAR(50) DEFAULT 'planned',
    priority VARCHAR(50) DEFAULT 'medium',
    assigned_to UUID REFERENCES users(id),
    start_date DATE,
    end_date DATE,
    budget DECIMAL(15,2),
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_work_packages_org ON work_packages(organization_id);
CREATE INDEX IF NOT EXISTS idx_work_packages_company ON work_packages(company_id);
CREATE INDEX IF NOT EXISTS idx_work_packages_project ON work_packages(project_id);
CREATE INDEX IF NOT EXISTS idx_work_packages_status ON work_packages(status);
CREATE INDEX IF NOT EXISTS idx_work_packages_assigned ON work_packages(assigned_to);

-- 11. Tasks
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id),
    title VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    status VARCHAR(50) DEFAULT 'todo',
    priority VARCHAR(50) DEFAULT 'medium',
    assigned_to UUID REFERENCES users(id),
    due_date DATE,
    category VARCHAR(100) DEFAULT 'general',
    estimated_hours DECIMAL(6,2),
    tags TEXT DEFAULT '',
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_org ON tasks(organization_id);
CREATE INDEX IF NOT EXISTS idx_tasks_company ON tasks(company_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);

COMMIT;
