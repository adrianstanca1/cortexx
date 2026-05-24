-- 079_seed_submittals.sql
-- Demo submittals for testing the new API.

-- Defensive check: abort if projects table is empty (nothing to link to)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM projects LIMIT 1) THEN
    RAISE NOTICE 'No projects found; skipping submittal seed.';
    RETURN;
  END IF;
END $$;

INSERT INTO submittals (
  project_id, number, title, description, type, status,
  ball_in_court, responsible_company, responsible_person,
  due_date, submitted_date, reviewer,
  submittal_number, submitted_by_company, priority,
  organization_id, company_id,
  created_at, updated_at
)
SELECT
  (SELECT id FROM projects ORDER BY created_at LIMIT 1),
  'SUB-001', 'Structural Steel Shop Drawings',
  'Shop drawings for main structural steel frame, Level 1-3',
  'Shop Drawing', 'In Review',
  'Engineering', 'Steel Fabricators Ltd', 'James Wilson',
  '2026-04-05', '2026-03-20', 'James Wilson',
  'SUB-001', 'Steel Fabricators Ltd', 'high',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM submittals WHERE number = 'SUB-001');

INSERT INTO submittals (
  project_id, number, title, description, type, status,
  ball_in_court, responsible_company, responsible_person,
  due_date, submitted_date, reviewer,
  submittal_number, submitted_by_company, priority,
  organization_id, company_id,
  created_at, updated_at
)
SELECT
  (SELECT id FROM projects ORDER BY created_at LIMIT 1),
  'SUB-002', 'HVAC Equipment Product Data',
  'Product data sheets for rooftop HVAC units',
  'Product Data', 'Approved',
  'Engineering', 'Climate Systems Inc', 'Sarah Mitchell',
  '2026-04-02', '2026-03-15', 'Sarah Mitchell',
  'SUB-002', 'Climate Systems Inc', 'medium',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM submittals WHERE number = 'SUB-002');

INSERT INTO submittals (
  project_id, number, title, description, type, status,
  ball_in_court, responsible_company, responsible_person,
  due_date, submitted_date, reviewer,
  submittal_number, submitted_by_company, priority,
  organization_id, company_id,
  created_at, updated_at
)
SELECT
  (SELECT id FROM projects ORDER BY created_at LIMIT 1),
  'SUB-003', 'Curtain Wall System Sample',
  'Physical sample of curtain wall glazing system',
  'Sample', 'Open',
  'Architect', 'Glazing Solutions Ltd', 'Michael Chen',
  '2026-04-10', '2026-03-25', 'Michael Chen',
  'SUB-003', 'Glazing Solutions Ltd', 'critical',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM submittals WHERE number = 'SUB-003');
