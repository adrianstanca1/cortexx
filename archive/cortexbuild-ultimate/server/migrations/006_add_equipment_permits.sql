-- Equipment service logs, hire records, and site permits
-- These support sub-tabs in PlantEquipment and FieldView modules

CREATE TABLE IF NOT EXISTS equipment_service_logs (
    id SERIAL PRIMARY KEY,
    equipment_id UUID REFERENCES equipment(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    type TEXT NOT NULL,
    technician TEXT,
    notes TEXT,
    next_due DATE,
    organization_id UUID REFERENCES organizations(id),
    company_id UUID REFERENCES companies(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS equipment_hire_logs (
    id SERIAL PRIMARY KEY,
    equipment_id UUID REFERENCES equipment(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    company TEXT,
    daily_rate NUMERIC(10,2),
    start_date DATE,
    end_date DATE,
    project TEXT,
    status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Completed', 'Cancelled')),
    organization_id UUID REFERENCES organizations(id),
    company_id UUID REFERENCES companies(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS site_permits (
    id SERIAL PRIMARY KEY,
    type TEXT NOT NULL,
    site TEXT NOT NULL,
    issued_by TEXT,
    from_date DATE NOT NULL,
    to_date DATE NOT NULL,
    status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Expired', 'Cancelled')),
    organization_id UUID REFERENCES organizations(id),
    company_id UUID REFERENCES companies(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_equip_service_logs_equipment ON equipment_service_logs(equipment_id);
CREATE INDEX IF NOT EXISTS idx_equip_hire_logs_equipment ON equipment_hire_logs(equipment_id);

-- Seed sample permit data
DO $$
DECLARE
    demo_org_id UUID := '00000000-0000-0000-0000-000000000001';
    demo_company_id UUID := '00000000-0000-0000-0000-000000000002';
BEGIN
    INSERT INTO site_permits (type, site, issued_by, from_date, to_date, status, organization_id, company_id) VALUES
        ('Hot Work', 'Tower Refurbishment - London E14', 'Sarah Johnson', CURRENT_DATE - 5, CURRENT_DATE + 2, 'Active', demo_org_id, demo_company_id),
        ('Confined Space', 'Office Renovation - Manchester M1', 'Mike Chen', CURRENT_DATE - 7, CURRENT_DATE, 'Active', demo_org_id, demo_company_id),
        ('Working at Height', 'High Rise - Birmingham B1', 'Emma Davis', CURRENT_DATE - 10, CURRENT_DATE - 3, 'Expired', demo_org_id, demo_company_id),
        ('Excavation', 'Infrastructure - Coventry CV1', 'John Smith', CURRENT_DATE - 3, CURRENT_DATE + 5, 'Active', demo_org_id, demo_company_id)
    ON CONFLICT DO NOTHING;
END $$;
