-- Seed audit_log with historical entries from existing data
DO $$
DECLARE
    demo_org_id UUID := '00000000-0000-0000-0000-000000000001';
    demo_company_id UUID := '00000000-0000-0000-0000-000000000002';
    demo_user_id UUID;
    now_ts TIMESTAMPTZ := NOW();
BEGIN
    -- Get the demo user id
    SELECT id INTO demo_user_id FROM users WHERE email = 'admin@cortexbuild.com' LIMIT 1;
    IF demo_user_id IS NULL THEN
        SELECT id INTO demo_user_id FROM users LIMIT 1;
    END IF;
    IF demo_user_id IS NULL THEN RETURN; END IF;

    -- Audit entries from existing projects
    INSERT INTO audit_log (user_id, action, table_name, record_id, changes, organization_id, company_id, created_at)
    SELECT demo_user_id, 'create', 'projects', id,
           jsonb_build_object('new', jsonb_build_object('name', name, 'status', status, 'client', client)),
           demo_org_id, demo_company_id,
           created_at + (floor(random() * 30)::int || ' days')::interval
    FROM projects
    WHERE organization_id = demo_org_id
    ON CONFLICT DO NOTHING;

    -- Audit entries from existing invoices
    INSERT INTO audit_log (user_id, action, table_name, record_id, changes, organization_id, company_id, created_at)
    SELECT demo_user_id, 'create', 'invoices', id,
           jsonb_build_object('new', jsonb_build_object('number', number, 'amount', amount, 'status', status)),
           demo_org_id, demo_company_id,
           created_at + (floor(random() * 30)::int || ' days')::interval
    FROM invoices
    WHERE organization_id = demo_org_id
    ON CONFLICT DO NOTHING;

    -- Audit entries from existing safety incidents
    INSERT INTO audit_log (user_id, action, table_name, record_id, changes, organization_id, company_id, created_at)
    SELECT demo_user_id, 'create', 'safety_incidents', id,
           jsonb_build_object('new', jsonb_build_object('title', title, 'severity', severity, 'status', status)),
           demo_org_id, demo_company_id,
           created_at + (floor(random() * 30)::int || ' days')::interval
    FROM safety_incidents
    WHERE organization_id = demo_org_id
    ON CONFLICT DO NOTHING;

    -- Audit entries from existing RFIs
    INSERT INTO audit_log (user_id, action, table_name, record_id, changes, organization_id, company_id, created_at)
    SELECT demo_user_id, 'create', 'rfis', id,
           jsonb_build_object('new', jsonb_build_object('subject', subject, 'status', status)),
           demo_org_id, demo_company_id,
           created_at + (floor(random() * 30)::int || ' days')::interval
    FROM rfis
    WHERE organization_id = demo_org_id
    ON CONFLICT DO NOTHING;

    -- Audit entries from existing team members
    INSERT INTO audit_log (user_id, action, table_name, record_id, changes, organization_id, company_id, created_at)
    SELECT demo_user_id, 'create', 'team_members', id,
           jsonb_build_object('new', jsonb_build_object('name', name, 'role', role, 'trade', trade)),
           demo_org_id, demo_company_id,
           created_at + (floor(random() * 30)::int || ' days')::interval
    FROM team_members
    WHERE organization_id = demo_org_id
    ON CONFLICT DO NOTHING;

    -- Note: login events omitted — audit_log.action CHECK constraint only allows create/update/delete
    RAISE NOTICE 'Seeded audit_log with % entries', (SELECT COUNT(*) FROM audit_log);
END $$;
