-- Drawing transmittals table
CREATE TABLE IF NOT EXISTS drawing_transmittals (
    id SERIAL PRIMARY KEY,
    project TEXT NOT NULL,
    issued_to TEXT,
    date DATE NOT NULL,
    purpose TEXT,
    status TEXT DEFAULT 'Issued' CHECK (status IN ('Issued', 'Pending', 'Received')),
    organization_id UUID,
    company_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drawing_transmittals_org ON drawing_transmittals(organization_id);

DO $$
DECLARE
    demo_org_id UUID := '00000000-0000-0000-0000-000000000001';
    demo_company_id UUID := '00000000-0000-0000-0000-000000000002';
BEGIN
    INSERT INTO drawing_transmittals (project, issued_to, date, purpose, status, organization_id, company_id) VALUES
        ('Cityview Offices', 'Main Contractor', '2024-02-25', 'IFC', 'Issued', demo_org_id, demo_company_id),
        ('Riverside Residential', 'Design Team', '2024-03-01', 'IFR', 'Issued', demo_org_id, demo_company_id),
        ('Tech Hub', 'Planning Authority', '2024-03-05', 'IFT', 'Pending', demo_org_id, demo_company_id),
        ('Cityview Offices', 'Client', '2024-03-08', 'IFI', 'Issued', demo_org_id, demo_company_id),
        ('Riverside Residential', 'MEP Contractor', '2024-03-10', 'IFC', 'Issued', demo_org_id, demo_company_id)
    ON CONFLICT DO NOTHING;
END $$;
