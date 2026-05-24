-- Seed data for Prequalification module with realistic UK construction contractors
DO $$
DECLARE
    demo_org_id UUID := '00000000-0000-0000-0000-000000000001';
    demo_company_id UUID := '00000000-0000-0000-0000-000000000002';
BEGIN
    INSERT INTO prequalification (organization_id, company_id, reference, contractor, project_id, project, questionnaire_type, status, score, approved_by, approved_date, expiry_date, documents, sections_completed, total_sections, notes)
    VALUES
        -- Approved contractors
        (demo_org_id, demo_company_id, 'PREQ-001', 'BuildRight Construction Ltd', 'c0ffee00-0000-0000-0000-000000000001', 'Cityview Offices Phase 2', 'full', 'approved', 92, 'Adrian Stanca', '2026-01-15', '2027-01-15', ARRAY['insurance_certificate.pdf', 'health_safety_policy.pdf', 'environmental_policy.pdf']::text[], 8, 8, 'Excellent track record. Recommended for main contractor role.'),
        (demo_org_id, demo_company_id, 'PREQ-002', 'Steelworks UK Ltd', 'c0ffee00-0000-0000-0000-000000000001', 'Cityview Offices Phase 2', 'full', 'approved', 88, 'Adrian Stanca', '2026-01-20', '2027-01-20', ARRAY['insurance_certificate.pdf', 'cis_verification.pdf']::text[], 7, 8, 'Specialist steelwork contractor. Approved for structural steel packages.'),
        (demo_org_id, demo_company_id, 'PREQ-003', 'M&E Solutions Ltd', 'c0ffee00-0000-0000-0000-000000000001', 'Cityview Offices Phase 2', 'full', 'approved', 85, 'Adrian Stanca', '2026-02-01', '2027-02-01', ARRAY[' NICEIC_certificate.pdf', 'insurance_certificate.pdf']::text[], 8, 8, 'Approved for mechanical and electrical installations.'),

        -- Under review
        (demo_org_id, demo_company_id, 'PREQ-004', 'Premier Facades Ltd', 'c0ffee00-0000-0000-0000-000000000002', 'Riverside Residential', 'full', 'under_review', 74, NULL, NULL, '2027-03-01', ARRAY['insurance_certificate.pdf']::text[], 5, 8, 'Cladding specialist. Awaiting health and safety documentation.'),
        (demo_org_id, demo_company_id, 'PREQ-005', 'Civic Civils Ltd', 'c0ffee00-0000-0000-0000-000000000002', 'Riverside Residential', 'full', 'under_review', 68, NULL, NULL, '2027-03-15', ARRAY[]::text[], 3, 8, 'Groundworks and drainage. Documentation incomplete.'),

        -- Pending submission
        (demo_org_id, demo_company_id, 'PREQ-006', 'Atlas Scaffolding Ltd', 'c0ffee00-0000-0000-0000-000000000002', 'Riverside Residential', 'standard', 'pending', NULL, NULL, NULL, '2026-06-01', ARRAY[]::text[], 0, 8, 'Scaffolding services required for facade works.'),
        (demo_org_id, demo_company_id, 'PREQ-007', 'ProPaint Decorators', NULL, NULL, 'General Works', 'standard', 'pending', NULL, NULL, NULL, '2026-09-01', ARRAY[]::text[], 0, 8, 'Painting and decorating specialist. Awaiting questionnaire.'),

        -- Expiring soon
        (demo_org_id, demo_company_id, 'PREQ-008', 'TopFloor Flooring Ltd', 'c0ffee00-0000-0000-0000-000000000003', 'Tech Hub Fit-Out', 'full', 'approved', 79, 'Adrian Stanca', '2025-07-20', '2026-07-20', ARRAY['insurance_certificate.pdf', 'flooring_qualifications.pdf']::text[], 8, 8, 'Flooring specialist. Expiry approaching — initiate re-qualification.'),
        (demo_org_id, demo_company_id, 'PREQ-009', 'FireSafe Systems Ltd', 'c0ffee00-0000-0000-0000-000000000003', 'Tech Hub Fit-Out', 'full', 'approved', 91, 'Adrian Stanca', '2025-08-10', '2026-08-10', ARRAY['insurance_certificate.pdf', 'bm-trada_certificate.pdf', 'firestop_schedule.pdf']::text[], 8, 8, 'Fire safety and compartmentalisation specialist. Re-approval required before Aug 2026.'),

        -- Rejected
        (demo_org_id, demo_company_id, 'PREQ-010', 'QuickBuild Ltd', NULL, NULL, 'General Works', 'full', 'rejected', 35, 'Adrian Stanca', '2026-02-28', NULL, ARRAY['insurance_certificate.pdf']::text[], 2, 8, 'Rejected: inadequate health and safety documentation, no BIM capability declared.')
    ON CONFLICT DO NOTHING;
END $$;
