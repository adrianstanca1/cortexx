-- Contact interactions for CRM interaction history
CREATE TABLE IF NOT EXISTS contact_interactions (
    id SERIAL PRIMARY KEY,
    contact_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('call', 'email', 'meeting')),
    date DATE NOT NULL,
    note TEXT,
    organization_id UUID,
    company_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contact_interactions_contact ON contact_interactions(contact_id);

DO $$
DECLARE
    demo_org_id UUID := '00000000-0000-0000-0000-000000000001';
    demo_company_id UUID := '00000000-0000-0000-0000-000000000002';
BEGIN
    INSERT INTO contact_interactions (contact_id, type, date, note, organization_id, company_id) VALUES
        (1, 'call', CURRENT_DATE - 2, 'Discussed project timeline and budget', demo_org_id, demo_company_id),
        (1, 'email', CURRENT_DATE - 12, 'Initial contact made', demo_org_id, demo_company_id),
        (2, 'email', CURRENT_DATE - 5, 'Sent proposal document', demo_org_id, demo_company_id),
        (2, 'meeting', CURRENT_DATE - 1, 'Kickoff meeting completed', demo_org_id, demo_company_id),
        (2, 'email', CURRENT_DATE - 12, 'Initial contact made', demo_org_id, demo_company_id),
        (3, 'email', CURRENT_DATE - 5, 'Sent proposal document', demo_org_id, demo_company_id),
        (3, 'call', CURRENT_DATE - 12, 'Initial contact made', demo_org_id, demo_company_id),
        (4, 'meeting', CURRENT_DATE - 1, 'Kickoff meeting completed', demo_org_id, demo_company_id),
        (4, 'email', CURRENT_DATE - 12, 'Initial contact made', demo_org_id, demo_company_id)
    ON CONFLICT DO NOTHING;
END $$;
