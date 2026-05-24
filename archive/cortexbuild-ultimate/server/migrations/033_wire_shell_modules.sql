-- Migration to wire "Shell" modules to real DB tables
-- Based on ALLOWED_COLUMNS in server/routes/generic.js

BEGIN;

-- 1. Sustainability
CREATE TABLE IF NOT EXISTS sustainability (
    id SERIAL PRIMARY KEY,
    project_id UUID REFERENCES projects(id),
    project TEXT,
    metric_type TEXT,
    target NUMERIC,
    actual NUMERIC,
    unit TEXT,
    period TEXT,
    status TEXT,
    notes TEXT,
    organization_id UUID,
    company_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Waste Management
CREATE TABLE IF NOT EXISTS waste_management (
    id SERIAL PRIMARY KEY,
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
    organization_id UUID,
    company_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Training
CREATE TABLE IF NOT EXISTS training (
    id SERIAL PRIMARY KEY,
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
    organization_id UUID,
    company_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Certifications
CREATE TABLE IF NOT EXISTS certifications (
    id SERIAL PRIMARY KEY,
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
    organization_id UUID,
    company_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Lettings
CREATE TABLE IF NOT EXISTS lettings (
    id SERIAL PRIMARY KEY,
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
    organization_id UUID,
    company_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Measuring
CREATE TABLE IF NOT EXISTS measuring (
    id SERIAL PRIMARY KEY,
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
    organization_id UUID,
    company_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Signage
CREATE TABLE IF NOT EXISTS signage (
    id SERIAL PRIMARY KEY,
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
    organization_id UUID,
    company_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Temp Works
CREATE TABLE IF NOT EXISTS temp_works (
    id SERIAL PRIMARY KEY,
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
    organization_id UUID,
    company_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. AI Vision Logs (Supporting AIVision.tsx)
CREATE TABLE IF NOT EXISTS ai_vision_logs (
    id SERIAL PRIMARY KEY,
    project_id UUID REFERENCES projects(id),
    image_url TEXT,
    analysis_result JSONB,
    confidence_score NUMERIC,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    organization_id UUID,
    company_id UUID
);

COMMIT;
