-- Migration 0002: New Construction Modules (Corrected)
-- Fixes: UUID primary keys, TIMESTAMPTZ, multi-tenancy columns, UUID foreign keys
-- Run: psql "$DATABASE_URL" -f server/migrations/0002_new_modules_corrected.sql

-- Variations
CREATE TABLE IF NOT EXISTS variations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    ref VARCHAR(50) UNIQUE,
    title VARCHAR(255),
    project_id UUID,
    project VARCHAR(255),
    subcontractor VARCHAR(255),
    status VARCHAR(50) DEFAULT 'draft',
    type VARCHAR(50),
    value DECIMAL(12,2) DEFAULT 0,
    original_value DECIMAL(12,2) DEFAULT 0,
    impact VARCHAR(20),
    submitted_date DATE,
    responded_date DATE,
    description TEXT,
    reason TEXT,
    affected_items TEXT[],
    approval_chain JSONB,
    documents JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_variations_organization ON variations(organization_id);
CREATE INDEX idx_variations_company ON variations(company_id);

-- Defects
CREATE TABLE IF NOT EXISTS defects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    reference VARCHAR(50) UNIQUE,
    title VARCHAR(255),
    project_id UUID,
    project VARCHAR(255),
    location VARCHAR(255),
    description TEXT,
    priority VARCHAR(20),
    status VARCHAR(50) DEFAULT 'open',
    trade VARCHAR(100),
    raised_by VARCHAR(255),
    assigned_to VARCHAR(255),
    due_date DATE,
    closed_date DATE,
    photos INTEGER DEFAULT 0,
    cost DECIMAL(10,2),
    category VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_defects_organization ON defects(organization_id);
CREATE INDEX idx_defects_company ON defects(company_id);

-- Valuations
CREATE TABLE IF NOT EXISTS valuations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    reference VARCHAR(50) UNIQUE,
    project_id UUID,
    project VARCHAR(255),
    application_number VARCHAR(50),
    period_start DATE,
    period_end DATE,
    status VARCHAR(50) DEFAULT 'draft',
    contractor_name VARCHAR(255),
    client_name VARCHAR(255),
    original_value DECIMAL(12,2) DEFAULT 0,
    variations DECIMAL(12,2) DEFAULT 0,
    total_value DECIMAL(12,2) DEFAULT 0,
    retention DECIMAL(10,2) DEFAULT 0,
    amount_due DECIMAL(12,2) DEFAULT 0,
    submitted_date DATE,
    certified_date DATE,
    certified_by VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_valuations_organization ON valuations(organization_id);
CREATE INDEX idx_valuations_company ON valuations(company_id);

-- Specifications
CREATE TABLE IF NOT EXISTS specifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    reference VARCHAR(50) UNIQUE,
    title VARCHAR(255),
    project_id UUID,
    project VARCHAR(255),
    section VARCHAR(100),
    version VARCHAR(20),
    status VARCHAR(50) DEFAULT 'draft',
    description TEXT,
    specifications JSONB,
    materials JSONB,
    standards TEXT[],
    approved_by VARCHAR(255),
    approved_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_specifications_organization ON specifications(organization_id);
CREATE INDEX idx_specifications_company ON specifications(company_id);

-- Temp Works
CREATE TABLE IF NOT EXISTS temp_works (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    reference VARCHAR(50) UNIQUE,
    title VARCHAR(255),
    project_id UUID,
    project VARCHAR(255),
    description TEXT,
    type VARCHAR(100),
    status VARCHAR(50) DEFAULT 'pending',
    location VARCHAR(255),
    design_by VARCHAR(255),
    approved_by VARCHAR(255),
    design_date DATE,
    approval_date DATE,
    erected_by VARCHAR(255),
    erected_date DATE,
    inspected_by VARCHAR(255),
    inspected_date DATE,
    load_capacity DECIMAL(10,2),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_temp_works_organization ON temp_works(organization_id);
CREATE INDEX idx_temp_works_company ON temp_works(company_id);

-- Signage
CREATE TABLE IF NOT EXISTS signage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    reference VARCHAR(50) UNIQUE,
    project_id UUID,
    project VARCHAR(255),
    type VARCHAR(100),
    description VARCHAR(255),
    location VARCHAR(255),
    size VARCHAR(50),
    material VARCHAR(100),
    quantity INTEGER DEFAULT 1,
    status VARCHAR(50) DEFAULT 'required',
    required_date DATE,
    installed_date DATE,
    installed_by VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_signage_organization ON signage(organization_id);
CREATE INDEX idx_signage_company ON signage(company_id);

-- Waste Management
CREATE TABLE IF NOT EXISTS waste_management (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    reference VARCHAR(50) UNIQUE,
    project_id UUID,
    project VARCHAR(255),
    waste_type VARCHAR(100),
    carrier VARCHAR(255),
    license_number VARCHAR(100),
    skip_number VARCHAR(50),
    collection_date DATE,
    quantity DECIMAL(10,2),
    unit VARCHAR(20),
    cost DECIMAL(10,2),
    disposal_site VARCHAR(255),
    waste_code VARCHAR(50),
    status VARCHAR(50) DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_waste_management_organization ON waste_management(organization_id);
CREATE INDEX idx_waste_management_company ON waste_management(company_id);

-- Sustainability
CREATE TABLE IF NOT EXISTS sustainability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    project_id UUID,
    project VARCHAR(255),
    metric_type VARCHAR(100),
    target DECIMAL(10,2),
    actual DECIMAL(10,2),
    unit VARCHAR(20),
    period VARCHAR(50),
    status VARCHAR(50) DEFAULT 'tracking',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_sustainability_organization ON sustainability(organization_id);
CREATE INDEX idx_sustainability_company ON sustainability(company_id);

-- Training
CREATE TABLE IF NOT EXISTS training (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    reference VARCHAR(50) UNIQUE,
    title VARCHAR(255),
    project_id UUID,
    project VARCHAR(255),
    type VARCHAR(100),
    provider VARCHAR(255),
    duration VARCHAR(50),
    cost DECIMAL(10,2),
    attendees JSONB,
    status VARCHAR(50) DEFAULT 'scheduled',
    scheduled_date DATE,
    completed_date DATE,
    certification VARCHAR(255),
    expiry_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_training_organization ON training(organization_id);
CREATE INDEX idx_training_company ON training(company_id);

-- Certifications
CREATE TABLE IF NOT EXISTS certifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    reference VARCHAR(50) UNIQUE,
    company VARCHAR(255),
    certification_type VARCHAR(100),
    body VARCHAR(255),
    grade VARCHAR(50),
    expiry_date DATE,
    status VARCHAR(50) DEFAULT 'active',
    renewal_date DATE,
    cost DECIMAL(10,2),
    scope TEXT,
    accreditation_number VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_certifications_organization ON certifications(organization_id);
CREATE INDEX idx_certifications_company ON certifications(company_id);

-- Prequalification
CREATE TABLE IF NOT EXISTS prequalification (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    reference VARCHAR(50) UNIQUE,
    contractor VARCHAR(255),
    project_id UUID,
    project VARCHAR(255),
    questionnaire_type VARCHAR(100),
    status VARCHAR(50) DEFAULT 'pending',
    score DECIMAL(5,2),
    approved_by VARCHAR(255),
    approved_date DATE,
    expiry_date DATE,
    documents JSONB,
    sections_completed INTEGER DEFAULT 0,
    total_sections INTEGER DEFAULT 8,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_prequalification_organization ON prequalification(organization_id);
CREATE INDEX idx_prequalification_company ON prequalification(company_id);

-- Lettings
CREATE TABLE IF NOT EXISTS lettings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    reference VARCHAR(50) UNIQUE,
    project_id UUID,
    project VARCHAR(255),
    package_name VARCHAR(255),
    trade VARCHAR(100),
    status VARCHAR(50) DEFAULT 'advertising',
    tender_closing_date DATE,
    award_date DATE,
    contractor VARCHAR(255),
    contract_value DECIMAL(12,2),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_lettings_organization ON lettings(organization_id);
CREATE INDEX idx_lettings_company ON lettings(company_id);

-- Measuring
CREATE TABLE IF NOT EXISTS measuring (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    reference VARCHAR(50) UNIQUE,
    project_id UUID,
    project VARCHAR(255),
    survey_type VARCHAR(100),
    location VARCHAR(255),
    status VARCHAR(50) DEFAULT 'scheduled',
    surveyor VARCHAR(255),
    survey_date DATE,
    completed_date DATE,
    areas JSONB,
    total_area DECIMAL(12,2),
    unit VARCHAR(20),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_measuring_organization ON measuring(organization_id);
CREATE INDEX idx_measuring_company ON measuring(company_id);
