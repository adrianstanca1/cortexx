-- Team member skills, inductions, and availability tables
-- These support the Skills/Inductions/Availability tabs in the Teams module

CREATE TABLE IF NOT EXISTS team_member_skills (
    id SERIAL PRIMARY KEY,
    member_id UUID REFERENCES team_members(id) ON DELETE CASCADE,
    skill_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'no' CHECK (status IN ('yes', 'no', 'expired')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS team_member_inductions (
    id SERIAL PRIMARY KEY,
    member_id UUID REFERENCES team_members(id) ON DELETE CASCADE,
    project TEXT NOT NULL,
    date DATE NOT NULL,
    next_due DATE,
    status TEXT NOT NULL DEFAULT 'current' CHECK (status IN ('current', 'due_soon', 'overdue')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS team_member_availability (
    id SERIAL PRIMARY KEY,
    member_id UUID REFERENCES team_members(id) ON DELETE CASCADE,
    project TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'off' CHECK (status IN ('onsite', 'office', 'off', 'sick')),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(member_id, project)
);

CREATE INDEX IF NOT EXISTS idx_member_skills_member_id ON team_member_skills(member_id);
CREATE INDEX IF NOT EXISTS idx_member_inductions_member_id ON team_member_inductions(member_id);
CREATE INDEX IF NOT EXISTS idx_member_availability_member_id ON team_member_availability(member_id);

-- Seed some sample data for the demo organization
DO $$
DECLARE
    demo_org_id UUID := '00000000-0000-0000-0000-000000000001';
    demo_member_id UUID;
BEGIN
    -- Get first team member for demo
    SELECT id INTO demo_member_id FROM team_members LIMIT 1;

    IF demo_member_id IS NOT NULL THEN
        INSERT INTO team_member_skills (member_id, skill_name, status) VALUES
            (demo_member_id, 'Working at Heights', 'yes'),
            (demo_member_id, 'Scaffolding', 'yes'),
            (demo_member_id, 'CSCS Card', 'yes'),
            (demo_member_id, 'First Aid', 'expired'),
            (demo_member_id, 'Confined Spaces', 'no')
        ON CONFLICT DO NOTHING;

        INSERT INTO team_member_inductions (member_id, project, date, next_due, status) VALUES
            (demo_member_id, 'Tower Refurbishment', CURRENT_DATE - 30, CURRENT_DATE + 60, 'current'),
            (demo_member_id, 'Office Renovation', CURRENT_DATE - 10, CURRENT_DATE + 80, 'current')
        ON CONFLICT DO NOTHING;

        INSERT INTO team_member_availability (member_id, project, status) VALUES
            (demo_member_id, 'Tower Refurbishment', 'onsite'),
            (demo_member_id, 'Office Renovation', 'off')
        ON CONFLICT (member_id, project) DO UPDATE SET status = EXCLUDED.status;
    END IF;
END $$;
