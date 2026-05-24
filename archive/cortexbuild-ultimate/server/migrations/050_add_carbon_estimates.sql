-- Carbon estimates table for Net Zero UK compliance tracking
CREATE TABLE IF NOT EXISTS carbon_estimates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL,
    organization_id UUID,
    company_id UUID,
    area_m2 NUMERIC,
    embodied_kgCO2e NUMERIC,
    operational_annual_kgCO2e NUMERIC,
    total_lifetime_kgCO2e NUMERIC,
    epc_rating TEXT,
    data JSONB, -- Full estimate result
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_carbon_estimates_project ON carbon_estimates(project_id);
CREATE INDEX IF NOT EXISTS idx_carbon_estimates_org ON carbon_estimates(organization_id);
