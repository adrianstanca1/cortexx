-- Migration 0010: Fix OAuth and Shell Tables (UUID + TIMESTAMPTZ + Multi-tenancy)
-- Run: psql "$DATABASE_URL" -f server/migrations/0010_fix_oauth_and_shell_tables.sql
-- Fixes: oauth_providers, work_packages, tasks, sustainability, waste_management,
--        training, certifications, lettings, measuring, signage, temp_works, ai_vision_logs

-- ─── Fix oauth_providers: add multi-tenancy ─────────────────────────────────────
DO $$
BEGIN
    ALTER TABLE oauth_providers
        ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
END $$;

CREATE INDEX IF NOT EXISTS idx_oauth_providers_organization ON oauth_providers(organization_id);
CREATE INDEX IF NOT EXISTS idx_oauth_providers_company ON oauth_providers(company_id);

-- ─── Fix work_packages: organization_id should reference organizations, TIMESTAMPTZ ───────
-- CRITICAL BUG: organization_id was referencing users(id) instead of organizations(id)
CREATE TABLE IF NOT EXISTS work_packages_new (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id),
    name VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    status VARCHAR(50) DEFAULT 'planned',
    priority VARCHAR(50) DEFAULT 'medium',
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    start_date DATE,
    end_date DATE,
    budget DECIMAL(15,2),
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'work_packages') THEN
        INSERT INTO work_packages_new (organization_id, company_id, project_id, name, description, status, priority, assigned_to, start_date, end_date, budget, progress, created_at, updated_at)
        SELECT
            CASE
                WHEN organization_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN organization_id::UUID
                ELSE NULL
            END,
            NULL,
            project_id, name, description, status, priority, assigned_to, start_date, end_date, budget, progress,
            created_at::TIMESTAMPTZ, updated_at::TIMESTAMPTZ
        FROM work_packages;

        DROP TABLE work_packages;

        ALTER TABLE work_packages_new RENAME TO work_packages;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_work_packages_org ON work_packages(organization_id);
CREATE INDEX IF NOT EXISTS idx_work_packages_project ON work_packages(project_id);
CREATE INDEX IF NOT EXISTS idx_work_packages_status ON work_packages(status);
CREATE INDEX IF NOT EXISTS idx_work_packages_assigned ON work_packages(assigned_to);
CREATE INDEX IF NOT EXISTS idx_work_packages_company ON work_packages(company_id);

-- ─── Fix tasks: add multi-tenancy, TIMESTAMPTZ ─────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks_new (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id),
    title VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    status VARCHAR(50) DEFAULT 'todo',
    priority VARCHAR(50) DEFAULT 'medium',
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    due_date DATE,
    category VARCHAR(100) DEFAULT 'general',
    estimated_hours DECIMAL(6,2),
    tags TEXT DEFAULT '',
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tasks') THEN
        INSERT INTO tasks_new (organization_id, company_id, project_id, title, description, status, priority, assigned_to, due_date, category, estimated_hours, tags, progress, created_at, updated_at)
        SELECT
            NULL, NULL, project_id, title, description, status, priority, assigned_to, due_date, category, estimated_hours, tags, progress,
            created_at::TIMESTAMPTZ, updated_at::TIMESTAMPTZ
        FROM tasks;

        DROP TABLE tasks;

        ALTER TABLE tasks_new RENAME TO tasks;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_organization ON tasks(organization_id);
CREATE INDEX IF NOT EXISTS idx_tasks_company ON tasks(company_id);

-- ─── Fix sustainability: UUID primary key ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS sustainability_new (
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

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sustainability') THEN
        INSERT INTO sustainability_new (organization_id, company_id, project_id, project, metric_type, target, actual, unit, period, status, notes, created_at, updated_at)
        SELECT
            organization_id,
            company_id,
            CASE
                WHEN project_id::TEXT ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN project_id::UUID
                ELSE NULL
            END AS project_id,
            project,
            metric_type,
            target,
            actual,
            unit,
            period,
            status,
            notes,
            created_at,
            updated_at
        FROM sustainability;

        DROP TABLE sustainability;

        ALTER TABLE sustainability_new RENAME TO sustainability;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sustainability_org ON sustainability(organization_id);
CREATE INDEX IF NOT EXISTS idx_sustainability_company ON sustainability(company_id);
CREATE INDEX IF NOT EXISTS idx_sustainability_project ON sustainability(project_id);

-- ─── Fix waste_management: UUID primary key ────────────────────────────────────
CREATE TABLE IF NOT EXISTS waste_management_new (
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

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'waste_management') THEN
        INSERT INTO waste_management_new (organization_id, company_id, reference, project_id, project, waste_type, carrier, license_number, skip_number, collection_date, quantity, unit, cost, disposal_site, waste_code, status, notes, created_at, updated_at)
        SELECT
            organization_id,
            company_id,
            reference,
            CASE
                WHEN project_id::TEXT ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN project_id::UUID
                ELSE NULL
            END AS project_id,
            project,
            waste_type,
            carrier,
            license_number,
            skip_number,
            collection_date,
            quantity,
            unit,
            cost,
            disposal_site,
            waste_code,
            status,
            notes,
            created_at,
            updated_at
        FROM waste_management;

        DROP TABLE waste_management;

        ALTER TABLE waste_management_new RENAME TO waste_management;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_waste_management_org ON waste_management(organization_id);
CREATE INDEX IF NOT EXISTS idx_waste_management_company ON waste_management(company_id);
CREATE INDEX IF NOT EXISTS idx_waste_management_project ON waste_management(project_id);

-- ─── Fix training: UUID primary key ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS training_new (
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

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'training') THEN
        INSERT INTO training_new (organization_id, company_id, reference, title, project_id, project, type, provider, duration, cost, attendees, status, scheduled_date, completed_date, certification, expiry_date, notes, created_at, updated_at)
        SELECT
            organization_id,
            company_id,
            reference,
            title,
            CASE
                WHEN project_id::TEXT ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN project_id::UUID
                ELSE NULL
            END AS project_id,
            project,
            type,
            provider,
            duration,
            cost,
            attendees,
            status,
            scheduled_date,
            completed_date,
            certification,
            expiry_date,
            notes,
            created_at,
            updated_at
        FROM training;

        DROP TABLE training;

        ALTER TABLE training_new RENAME TO training;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_training_org ON training(organization_id);
CREATE INDEX IF NOT EXISTS idx_training_company ON training(company_id);
CREATE INDEX IF NOT EXISTS idx_training_project ON training(project_id);

-- ─── Fix certifications: UUID primary key ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS certifications_new (
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

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'certifications') THEN
        INSERT INTO certifications_new (organization_id, company_id, reference, company, certification_type, body, grade, expiry_date, status, renewal_date, cost, scope, accreditation_number, notes, created_at, updated_at)
        SELECT organization_id, company_id, reference, company, certification_type, body, grade, expiry_date, status, renewal_date, cost, scope, accreditation_number, notes, created_at, updated_at
        FROM certifications;

        DROP TABLE certifications;

        ALTER TABLE certifications_new RENAME TO certifications;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_certifications_org ON certifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_certifications_company ON certifications(company_id);

-- ─── Fix lettings: UUID primary key ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lettings_new (
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

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'lettings') THEN
        INSERT INTO lettings_new (organization_id, company_id, reference, project_id, project, package_name, trade, status, tender_closing_date, award_date, contractor, contract_value, notes, created_at, updated_at)
        SELECT
            organization_id,
            company_id,
            reference,
            CASE
                WHEN project_id::TEXT ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN project_id::UUID
                ELSE NULL
            END AS project_id,
            project,
            package_name,
            trade,
            status,
            tender_closing_date,
            award_date,
            contractor,
            contract_value,
            notes,
            created_at,
            updated_at
        FROM lettings;

        DROP TABLE lettings;

        ALTER TABLE lettings_new RENAME TO lettings;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_lettings_org ON lettings(organization_id);
CREATE INDEX IF NOT EXISTS idx_lettings_company ON lettings(company_id);
CREATE INDEX IF NOT EXISTS idx_lettings_project ON lettings(project_id);

-- ─── Fix measuring: UUID primary key ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS measuring_new (
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

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'measuring') THEN
        INSERT INTO measuring_new (organization_id, company_id, reference, project_id, project, survey_type, location, status, surveyor, survey_date, completed_date, areas, total_area, unit, notes, created_at, updated_at)
        SELECT
            organization_id,
            company_id,
            reference,
            CASE
                WHEN project_id::TEXT ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN project_id::UUID
                ELSE NULL
            END AS project_id,
            project,
            survey_type,
            location,
            status,
            surveyor,
            survey_date,
            completed_date,
            areas,
            total_area,
            unit,
            notes,
            created_at,
            updated_at
        FROM measuring;

        DROP TABLE measuring;

        ALTER TABLE measuring_new RENAME TO measuring;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_measuring_org ON measuring(organization_id);
CREATE INDEX IF NOT EXISTS idx_measuring_company ON measuring(company_id);
CREATE INDEX IF NOT EXISTS idx_measuring_project ON measuring(project_id);

-- ─── Fix signage: UUID primary key ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS signage_new (
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

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'signage') THEN
        INSERT INTO signage_new (organization_id, company_id, reference, project_id, project, type, description, location, size, material, quantity, status, required_date, installed_date, installed_by, notes, created_at, updated_at)
        SELECT
            organization_id,
            company_id,
            reference,
            CASE
                WHEN project_id::TEXT ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN project_id::UUID
                ELSE NULL
            END AS project_id,
            project,
            type,
            description,
            location,
            size,
            material,
            quantity,
            status,
            required_date,
            installed_date,
            installed_by,
            notes,
            created_at,
            updated_at
        FROM signage;

        DROP TABLE signage;

        ALTER TABLE signage_new RENAME TO signage;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_signage_org ON signage(organization_id);
CREATE INDEX IF NOT EXISTS idx_signage_company ON signage(company_id);
CREATE INDEX IF NOT EXISTS idx_signage_project ON signage(project_id);

-- ─── Fix temp_works: UUID primary key ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS temp_works_new (
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

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'temp_works') THEN
        INSERT INTO temp_works_new (organization_id, company_id, reference, title, project_id, project, description, type, status, location, design_by, approved_by, design_date, approval_date, erected_by, erected_date, inspected_by, inspected_date, load_capacity, notes, created_at, updated_at)
        SELECT
            organization_id,
            company_id,
            reference,
            title,
            CASE
                WHEN project_id::TEXT ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN project_id::UUID
                ELSE NULL
            END AS project_id,
            project,
            description,
            type,
            status,
            location,
            design_by,
            approved_by,
            design_date,
            approval_date,
            erected_by,
            erected_date,
            inspected_by,
            inspected_date,
            load_capacity,
            notes,
            created_at,
            updated_at
        FROM temp_works;

        DROP TABLE temp_works;

        ALTER TABLE temp_works_new RENAME TO temp_works;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_temp_works_org ON temp_works(organization_id);
CREATE INDEX IF NOT EXISTS idx_temp_works_company ON temp_works(company_id);
CREATE INDEX IF NOT EXISTS idx_temp_works_project ON temp_works(project_id);

-- ─── Fix ai_vision_logs: UUID primary key ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_vision_logs_new (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id),
    image_url TEXT,
    analysis_result JSONB,
    confidence_score NUMERIC,
    processed_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_vision_logs') THEN
        INSERT INTO ai_vision_logs_new (organization_id, company_id, project_id, image_url, analysis_result, confidence_score, processed_at)
        SELECT
            organization_id,
            company_id,
            CASE
                WHEN project_id::TEXT ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN project_id::UUID
                ELSE NULL
            END AS project_id,
            image_url,
            analysis_result,
            confidence_score,
            processed_at
        FROM ai_vision_logs;

        DROP TABLE ai_vision_logs;

        ALTER TABLE ai_vision_logs_new RENAME TO ai_vision_logs;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ai_vision_logs_org ON ai_vision_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_vision_logs_company ON ai_vision_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_ai_vision_logs_project ON ai_vision_logs(project_id);
