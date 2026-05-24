-- Risk mitigation actions for the Actions tab
CREATE TABLE IF NOT EXISTS risk_mitigation_actions (
    id SERIAL PRIMARY KEY,
    risk_id INTEGER,
    title TEXT NOT NULL,
    owner TEXT,
    due_date DATE,
    status TEXT DEFAULT 'Not Started' CHECK (status IN ('Not Started', 'In Progress', 'Completed', 'Overdue')),
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    organization_id UUID,
    company_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_risk_mitigation_actions_risk ON risk_mitigation_actions(risk_id);

DO $$
DECLARE
    demo_org_id UUID := '00000000-0000-0000-0000-000000000001';
    demo_company_id UUID := '00000000-0000-0000-0000-000000000002';
BEGIN
    INSERT INTO risk_mitigation_actions (risk_id, title, owner, due_date, status, progress, organization_id, company_id) VALUES
        (1, 'Implement backup power system', 'John Smith', CURRENT_DATE + 21, 'In Progress', 65, demo_org_id, demo_company_id),
        (2, 'Review supplier contracts', 'Jane Doe', CURRENT_DATE + 3, 'Not Started', 0, demo_org_id, demo_company_id),
        (3, 'Weather protection measures', 'Mike Johnson', CURRENT_DATE - 5, 'Completed', 100, demo_org_id, demo_company_id),
        (4, 'Staff training program', 'Sarah Williams', CURRENT_DATE - 5, 'Overdue', 40, demo_org_id, demo_company_id),
        (5, 'Schedule optimization', 'Tom Brown', CURRENT_DATE + 36, 'In Progress', 30, demo_org_id, demo_company_id)
    ON CONFLICT DO NOTHING;
END $$;
