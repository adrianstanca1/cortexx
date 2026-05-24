-- Migration 0003: Add Missing Tables (teams, drawings)
-- Run: psql "$DATABASE_URL" -f server/migrations/0003_add_missing_tables.sql

-- Teams - for organizing team members into groups
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    lead_id UUID REFERENCES team_members(id) ON DELETE SET NULL,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'active'
        CHECK (status IN ('active','inactive','archived')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_teams_organization ON teams(organization_id);
CREATE INDEX idx_teams_company ON teams(company_id);
CREATE INDEX idx_teams_project ON teams(project_id);

-- Drawings - for managing construction drawings and revisions
CREATE TABLE IF NOT EXISTS drawings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    drawing_number VARCHAR(100) NOT NULL,
    revision VARCHAR(20) DEFAULT 'P01',
    title VARCHAR(255) NOT NULL,
    discipline VARCHAR(50)
        CHECK (discipline IN ('ARCH','STR','MEP','LAND','CIVIL','TEMP','OTHER')),
    status VARCHAR(50) DEFAULT 'draft'
        CHECK (status IN ('draft','for_review','for_construction','superseded','archived')),
    file_path TEXT,
    file_size BIGINT,
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    review_date DATE,
    approval_date DATE,
    issue_date DATE,
    description TEXT,
    tags TEXT[],
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_drawings_organization ON drawings(organization_id);
CREATE INDEX idx_drawings_company ON drawings(company_id);
CREATE INDEX idx_drawings_project ON drawings(project_id);
CREATE INDEX idx_drawings_number ON drawings(drawing_number);
CREATE INDEX idx_drawings_status ON drawings(status);
