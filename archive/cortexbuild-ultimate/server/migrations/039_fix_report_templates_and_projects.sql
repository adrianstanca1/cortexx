-- Migration 0008: Fix Report Templates and Enhanced Projects (UUID + TIMESTAMPTZ + Multi-tenancy)
-- Run: psql "$DATABASE_URL" -f server/migrations/0008_fix_report_templates_and_projects.sql

-- ─── Fix report_templates: UUID, TIMESTAMPTZ, multi-tenancy ─────────────────────
CREATE TABLE IF NOT EXISTS report_templates_new (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    description TEXT,
    config JSONB NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'report_templates') THEN
        INSERT INTO report_templates_new (organization_id, company_id, name, type, description, config, is_default, created_by, created_at, updated_at)
        SELECT
            NULL, NULL, name, type, description, config, is_default,
            CASE
                WHEN created_by ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN created_by::UUID
                ELSE NULL
            END,
            created_at::TIMESTAMPTZ, updated_at::TIMESTAMPTZ
        FROM report_templates;

        DROP TABLE report_templates;

        ALTER TABLE report_templates_new RENAME TO report_templates;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_report_templates_type ON report_templates(type);
CREATE INDEX IF NOT EXISTS idx_report_templates_default ON report_templates(is_default);
CREATE INDEX IF NOT EXISTS idx_report_templates_created_by ON report_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_report_templates_organization ON report_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_report_templates_company ON report_templates(company_id);

-- ─── Fix project_images: add multi-tenancy, convert uploaded_by to UUID ────────
CREATE TABLE IF NOT EXISTS project_images_new (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    file_path VARCHAR(500) NOT NULL,
    caption VARCHAR(500) DEFAULT '',
    category VARCHAR(100) DEFAULT 'general',
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'project_images') THEN
        INSERT INTO project_images_new (organization_id, company_id, project_id, file_path, caption, category, uploaded_by, created_at, updated_at)
        SELECT
            NULL, NULL, project_id, file_path, caption, category,
            CASE
                WHEN uploaded_by ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN uploaded_by::UUID
                ELSE NULL
            END,
            created_at::TIMESTAMPTZ, updated_at::TIMESTAMPTZ
        FROM project_images;

        DROP TABLE project_images;

        ALTER TABLE project_images_new RENAME TO project_images;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_project_images_project_id ON project_images(project_id);
CREATE INDEX IF NOT EXISTS idx_project_images_category ON project_images(category);
CREATE INDEX IF NOT EXISTS idx_project_images_created ON project_images(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_images_organization ON project_images(organization_id);
CREATE INDEX IF NOT EXISTS idx_project_images_company ON project_images(company_id);

-- ─── Fix project_tasks: add multi-tenancy, convert created_by/assigned_to to UUID ───────
CREATE TABLE IF NOT EXISTS project_tasks_new (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT DEFAULT '',
    status VARCHAR(50) DEFAULT 'todo',
    priority VARCHAR(50) DEFAULT 'medium',
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    due_date DATE DEFAULT NULL,
    category VARCHAR(100) DEFAULT 'general',
    estimated_hours DECIMAL(10,2) DEFAULT NULL,
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    tags TEXT DEFAULT '',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ DEFAULT NULL
);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'project_tasks') THEN
        INSERT INTO project_tasks_new (organization_id, company_id, project_id, title, description, status, priority, assigned_to, due_date, category, estimated_hours, progress, tags, created_by, created_at, updated_at, completed_at)
        SELECT
            NULL, NULL, project_id, title, description, status, priority,
            CASE
                WHEN assigned_to ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN assigned_to::UUID
                ELSE NULL
            END,
            due_date, category, estimated_hours, progress, tags,
            CASE
                WHEN created_by ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN created_by::UUID
                ELSE NULL
            END,
            created_at::TIMESTAMPTZ, updated_at::TIMESTAMPTZ, completed_at::TIMESTAMPTZ
        FROM project_tasks;

        DROP TABLE project_tasks;

        ALTER TABLE project_tasks_new RENAME TO project_tasks;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_project_tasks_project_id ON project_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_status ON project_tasks(status);
CREATE INDEX IF NOT EXISTS idx_project_tasks_priority ON project_tasks(priority);
CREATE INDEX IF NOT EXISTS idx_project_tasks_assigned_to ON project_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_project_tasks_due_date ON project_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_project_tasks_created ON project_tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_tasks_organization ON project_tasks(organization_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_company ON project_tasks(company_id);

-- ─── Fix project_task_comments: add multi-tenancy, convert author to UUID ───────
CREATE TABLE IF NOT EXISTS project_task_comments_new (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    task_id UUID REFERENCES project_tasks(id) ON DELETE CASCADE,
    comment TEXT NOT NULL,
    author UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'project_task_comments') THEN
        INSERT INTO project_task_comments_new (organization_id, company_id, task_id, comment, author, created_at)
        SELECT
            NULL, NULL, task_id, comment,
            CASE
                WHEN author ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN author::UUID
                ELSE NULL
            END,
            created_at::TIMESTAMPTZ
        FROM project_task_comments;

        DROP TABLE project_task_comments;

        ALTER TABLE project_task_comments_new RENAME TO project_task_comments;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_project_task_comments_task_id ON project_task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_project_task_comments_organization ON project_task_comments(organization_id);
CREATE INDEX IF NOT EXISTS idx_project_task_comments_company ON project_task_comments(company_id);

-- ─── Documents: add multi-tenancy columns if missing ────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'organization_id') THEN
        ALTER TABLE documents ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'company_id') THEN
        ALTER TABLE documents ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'created_by') THEN
        ALTER TABLE documents ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    ELSE
        -- If created_by exists as VARCHAR, we need to handle it separately
        ALTER TABLE documents ALTER COLUMN created_by TYPE UUID USING
            CASE
                WHEN created_by ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN created_by::UUID
                ELSE NULL
            END;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_documents_organization ON documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_documents_company ON documents(company_id);
