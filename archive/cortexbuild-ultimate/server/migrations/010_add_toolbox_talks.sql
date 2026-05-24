-- Toolbox talks table
CREATE TABLE IF NOT EXISTS toolbox_talks (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    topic TEXT NOT NULL,
    location TEXT,
    presenter TEXT,
    attendees INTEGER DEFAULT 0,
    signed_off BOOLEAN DEFAULT FALSE,
    organization_id UUID,
    company_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_toolbox_talks_org ON toolbox_talks(organization_id);

DO $$
DECLARE
    demo_org_id UUID := '00000000-0000-0000-0000-000000000001';
    demo_company_id UUID := '00000000-0000-0000-0000-000000000002';
BEGIN
    INSERT INTO toolbox_talks (date, topic, location, presenter, attendees, signed_off, organization_id, company_id) VALUES
        (CURRENT_DATE - 5, 'Fall Protection Best Practices', 'Site Induction', 'Health & Safety Team', 24, TRUE, demo_org_id, demo_company_id),
        (CURRENT_DATE - 7, 'Confined Space Entry Procedures', 'Tank Area', 'Sarah Jones', 8, TRUE, demo_org_id, demo_company_id),
        (CURRENT_DATE - 10, 'PPE Requirements Update', 'Main Office', 'John Smith', 32, TRUE, demo_org_id, demo_company_id),
        (CURRENT_DATE - 15, 'Fire Safety & Evacuation', 'All Zones', 'Emergency Coordinator', 47, TRUE, demo_org_id, demo_company_id)
    ON CONFLICT DO NOTHING;
END $$;
