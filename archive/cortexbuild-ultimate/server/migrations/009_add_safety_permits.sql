-- Safety permits table
CREATE TABLE IF NOT EXISTS safety_permits (
    id SERIAL PRIMARY KEY,
    permit_no TEXT NOT NULL,
    type TEXT NOT NULL,
    project TEXT,
    location TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    issued_by TEXT,
    status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Expired', 'Cancelled')),
    organization_id UUID,
    company_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_safety_permits_org ON safety_permits(organization_id);

DO $$
DECLARE
    demo_org_id UUID := '00000000-0000-0000-0000-000000000001';
    demo_company_id UUID := '00000000-0000-0000-0000-000000000002';
BEGIN
    INSERT INTO safety_permits (permit_no, type, project, location, start_date, end_date, issued_by, status, organization_id, company_id) VALUES
        ('HW-2026-001', 'Hot Works', 'Main Tower', 'Level 5', CURRENT_DATE - 5, CURRENT_DATE + 2, 'John Smith', 'Active', demo_org_id, demo_company_id),
        ('CS-2026-002', 'Confined Space', 'Tank Maintenance', 'Tank A', CURRENT_DATE - 7, CURRENT_DATE - 3, 'Sarah Jones', 'Expired', demo_org_id, demo_company_id),
        ('EX-2026-003', 'Excavation', 'Foundation Work', 'Grid F2', CURRENT_DATE - 3, CURRENT_DATE + 5, 'Mike Brown', 'Active', demo_org_id, demo_company_id),
        ('MW-2026-004', 'MEWP', 'Facade Cleaning', 'South Face', CURRENT_DATE - 5, CURRENT_DATE - 5, 'Emma Wilson', 'Expired', demo_org_id, demo_company_id),
        ('EI-2026-005', 'Electrical Isolation', 'Rewiring', 'Level 3', CURRENT_DATE - 2, CURRENT_DATE + 6, 'David Lee', 'Active', demo_org_id, demo_company_id)
    ON CONFLICT DO NOTHING;
END $$;
