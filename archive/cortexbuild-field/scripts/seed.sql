-- ============================================================
-- CortexBuild Field — Complete Database Seed
-- Company: Apex Construction Ltd (UK)
-- ============================================================

-- ============================================================
-- 1. COMPANY
-- ============================================================
INSERT INTO companies (id, name, slug, logo_url, primary_color, address, phone, email, website, industry, employee_count, subscription_plan, subscription_status, trial_ends_at, created_at, updated_at)
VALUES (1, 'Apex Construction Ltd', 'apex-construction', 'https://placehold.co/200x200/1a56db/ffffff?text=AC', '#1a56db',
  '14 Brunel Way, Bristol, BS1 6QH', '+44 117 900 1234', 'info@apexconstruction.co.uk', 'https://apexconstruction.co.uk',
  'construction', 85, 'professional', 'active', NOW() + INTERVAL '30 days', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW();

SELECT setval('companies_id_seq', (SELECT MAX(id) FROM companies));

-- ============================================================
-- 2. USERS
-- ============================================================
INSERT INTO users (id, name, email, phone, avatar_url, role, company_id, job_title, department, is_active, created_at, updated_at) VALUES
(1, 'James Hartley',    'james.hartley@apexconstruction.co.uk',  '+44 7700 900001', NULL, 'admin',   1, 'Managing Director',      'Executive',    true, NOW(), NOW()),
(2, 'Sarah Mitchell',   'sarah.mitchell@apexconstruction.co.uk', '+44 7700 900002', NULL, 'manager', 1, 'Project Manager',        'Projects',     true, NOW(), NOW()),
(3, 'Tom Patel',        'tom.patel@apexconstruction.co.uk',      '+44 7700 900003', NULL, 'manager', 1, 'Site Manager',           'Operations',   true, NOW(), NOW()),
(4, 'Emily Clarke',     'emily.clarke@apexconstruction.co.uk',   '+44 7700 900004', NULL, 'user',    1, 'Health & Safety Officer', 'Safety',       true, NOW(), NOW()),
(5, 'Raj Singh',        'raj.singh@apexconstruction.co.uk',      '+44 7700 900005', NULL, 'user',    1, 'Site Foreman',           'Operations',   true, NOW(), NOW()),
(6, 'Laura Bennett',    'laura.bennett@apexconstruction.co.uk',  '+44 7700 900006', NULL, 'user',    1, 'Quantity Surveyor',      'Commercial',   true, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW();

SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));

-- ============================================================
-- 3. COMPANY USERS
-- ============================================================
INSERT INTO company_users (id, company_id, user_id, role, is_active, created_at) VALUES
(1, 1, 1, 'admin',   true, NOW()),
(2, 1, 2, 'manager', true, NOW()),
(3, 1, 3, 'manager', true, NOW()),
(4, 1, 4, 'user',    true, NOW()),
(5, 1, 5, 'user',    true, NOW()),
(6, 1, 6, 'user',    true, NOW())
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

SELECT setval('company_users_id_seq', (SELECT MAX(id) FROM company_users));

-- ============================================================
-- 4. PROJECTS
-- ============================================================
INSERT INTO projects (id, name, description, company_id, status, address, city, postcode, country, start_date, end_date, budget, spent, project_manager_id, site_manager_id, client_name, client_email, client_phone, created_at, updated_at) VALUES
(1, 'Harbourside Apartments', 'Residential development — 48 luxury apartments across 6 floors with underground parking', 1, 'active',
  'Harbourside Quarter, Bristol', 'Bristol', 'BS1 5TT', 'UK',
  '2025-09-01', '2026-12-31', 4200000.00, 1850000.00, 2, 3, 'Harbourside Developments Ltd', 'contact@harbourside.co.uk', '+44 117 800 5000',
  NOW(), NOW()),
(2, 'Clifton Office Refurb', 'Full internal refurbishment of Grade II listed office building — 3 floors, 2400 sqm', 1, 'active',
  '22 Clifton Down Road, Bristol', 'Bristol', 'BS8 4AA', 'UK',
  '2026-01-15', '2026-08-30', 980000.00, 320000.00, 2, 3, 'Clifton Property Group', 'pm@cliftonproperty.co.uk', '+44 117 700 2200',
  NOW(), NOW()),
(3, 'Bath Road Industrial Unit', 'Steel-frame industrial unit — 1800 sqm warehouse with offices and loading bays', 1, 'planning',
  'Bath Road Business Park, Bristol', 'Bristol', 'BS4 3HQ', 'UK',
  '2026-06-01', '2026-11-30', 1650000.00, 45000.00, 2, NULL, 'Bristol Logistics Ltd', 'build@bristollogistics.co.uk', '+44 117 600 3300',
  NOW(), NOW()),
(4, 'Redland School Extension', 'Two-storey classroom block extension — 12 classrooms, accessible design, BREEAM Excellent target', 1, 'completed',
  'Redland High School, Bristol', 'Bristol', 'BS6 6UE', 'UK',
  '2024-06-01', '2025-07-31', 2100000.00, 2085000.00, 2, 3, 'Bristol City Council', 'projects@bristol.gov.uk', '+44 117 922 2000',
  NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW();

SELECT setval('projects_id_seq', (SELECT MAX(id) FROM projects));

-- ============================================================
-- 5. TEAM MEMBERS
-- ============================================================
INSERT INTO team_members (id, project_id, user_id, role, is_active, joined_at) VALUES
(1,  1, 1, 'admin',   true, NOW()),
(2,  1, 2, 'manager', true, NOW()),
(3,  1, 3, 'manager', true, NOW()),
(4,  1, 4, 'user',    true, NOW()),
(5,  1, 5, 'user',    true, NOW()),
(6,  2, 2, 'manager', true, NOW()),
(7,  2, 3, 'manager', true, NOW()),
(8,  2, 4, 'user',    true, NOW()),
(9,  3, 2, 'manager', true, NOW()),
(10, 4, 2, 'manager', true, NOW())
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

SELECT setval('team_members_id_seq', (SELECT MAX(id) FROM team_members));

-- ============================================================
-- 6. TASKS
-- ============================================================
INSERT INTO tasks (id, project_id, title, description, status, priority, assigned_to, due_date, created_by, created_at, updated_at) VALUES
(1,  1, 'Complete foundation pour — Block A',    'Concrete pour for Block A foundations, weather window confirmed', 'in_progress', 'high',   '5', NOW() + INTERVAL '3 days',  1, NOW(), NOW()),
(2,  1, 'Install scaffolding — Floors 3-6',      'Erect external scaffolding for upper floors', 'todo', 'high', '3', NOW() + INTERVAL '7 days', 2, NOW(), NOW()),
(3,  1, 'Electrical first fix — Floors 1-2',     'First fix wiring and conduit installation', 'todo', 'medium', '5', NOW() + INTERVAL '14 days', 2, NOW(), NOW()),
(4,  1, 'Plumbing rough-in — All floors',        'Install all supply and waste pipework', 'todo', 'medium', '5', NOW() + INTERVAL '21 days', 3, NOW(), NOW()),
(5,  1, 'Fire safety inspection — Block A',      'Third-party fire safety compliance check', 'todo', 'high', '4', NOW() + INTERVAL '10 days', 4, NOW(), NOW()),
(6,  2, 'Strip out existing fit-out — Floor 1',  'Remove all existing partitions, ceilings, and M&E', 'done', 'high', '3', NOW() - INTERVAL '5 days', 2, NOW(), NOW()),
(7,  2, 'Structural surveys complete',           'Confirm all structural surveys signed off', 'done', 'high', '2', NOW() - INTERVAL '10 days', 2, NOW(), NOW()),
(8,  2, 'New partitions — Floor 2',              'Install new stud partitions to approved layout', 'in_progress', 'medium', '5', NOW() + INTERVAL '5 days', 3, NOW(), NOW()),
(9,  3, 'Planning permission — final approval',  'Await final planning decision from council', 'in_progress', 'high', '2', NOW() + INTERVAL '30 days', 2, NOW(), NOW()),
(10, 3, 'Appoint structural engineer',           'Issue appointment letter to structural engineer', 'todo', 'medium', '2', NOW() + INTERVAL '14 days', 1, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, updated_at = NOW();

SELECT setval('tasks_id_seq', (SELECT MAX(id) FROM tasks));

-- ============================================================
-- 7. SITE CHECK-INS
-- ============================================================
INSERT INTO check_ins (id, project_id, user_id, check_in_time, check_out_time, location_lat, location_lng, notes, created_at) VALUES
(1,  1, 3, NOW() - INTERVAL '1 day 7 hours',  NOW() - INTERVAL '1 day 1 hour',  51.4545, -2.5879, 'Normal site start, all operatives briefed', NOW()),
(2,  1, 5, NOW() - INTERVAL '1 day 7 hours',  NOW() - INTERVAL '1 day 1 hour',  51.4545, -2.5879, 'Concrete gang on site', NOW()),
(3,  1, 4, NOW() - INTERVAL '1 day 8 hours',  NOW() - INTERVAL '1 day 3 hours', 51.4545, -2.5879, 'Safety inspection walkthrough', NOW()),
(4,  2, 3, NOW() - INTERVAL '2 days 7 hours', NOW() - INTERVAL '2 days 2 hours',51.4558, -2.6035, 'Clifton site — strip-out day 3', NOW()),
(5,  1, 3, NOW() - INTERVAL '7 hours',        NULL,                              51.4545, -2.5879, 'On site today — foundation pour', NOW()),
(6,  1, 5, NOW() - INTERVAL '7 hours',        NULL,                              51.4545, -2.5879, 'Concrete gang — day 2', NOW())
ON CONFLICT (id) DO UPDATE SET notes = EXCLUDED.notes;

SELECT setval('check_ins_id_seq', (SELECT MAX(id) FROM check_ins));

-- ============================================================
-- 8. TIMESHEETS
-- ============================================================
INSERT INTO timesheets (id, project_id, user_id, date, hours_worked, work_description, status, approved_by, approved_at, created_at, updated_at) VALUES
(1,  1, 3, CURRENT_DATE - 1, 9.0, 'Site management — foundation pour supervision',      'approved', 2, NOW() - INTERVAL '12 hours', NOW(), NOW()),
(2,  1, 5, CURRENT_DATE - 1, 9.0, 'Concrete gang supervision and quality checks',        'approved', 3, NOW() - INTERVAL '12 hours', NOW(), NOW()),
(3,  1, 4, CURRENT_DATE - 1, 7.5, 'Safety inspections and toolbox talk delivery',        'approved', 2, NOW() - INTERVAL '12 hours', NOW(), NOW()),
(4,  2, 3, CURRENT_DATE - 2, 8.0, 'Clifton site — strip-out supervision',               'approved', 2, NOW() - INTERVAL '36 hours', NOW(), NOW()),
(5,  1, 3, CURRENT_DATE,     9.0, 'Foundation pour — Block A day 2',                    'pending',  NULL, NULL, NOW(), NOW()),
(6,  1, 5, CURRENT_DATE,     9.0, 'Concrete works — Block A',                           'pending',  NULL, NULL, NOW(), NOW()),
(7,  2, 5, CURRENT_DATE - 3, 8.5, 'Partition installation — Floor 2',                   'approved', 3, NOW() - INTERVAL '60 hours', NOW(), NOW()),
(8,  1, 6, CURRENT_DATE - 1, 7.0, 'QS site measurement — Block A foundations',          'approved', 2, NOW() - INTERVAL '12 hours', NOW(), NOW()),
(9,  1, 6, CURRENT_DATE,     7.0, 'Variation order assessment — electrical first fix',   'pending',  NULL, NULL, NOW(), NOW()),
(10, 4, 3, CURRENT_DATE - 7, 8.0, 'Final snagging walkthrough — Redland School',        'approved', 2, NOW() - INTERVAL '7 days', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET hours_worked = EXCLUDED.hours_worked, updated_at = NOW();

SELECT setval('timesheets_id_seq', (SELECT MAX(id) FROM timesheets));

-- ============================================================
-- 9. SAFETY INCIDENTS
-- ============================================================
INSERT INTO incidents (id, project_id, title, description, incident_type, severity, status, reported_by, incident_date, location, injured_person, injury_description, treatment, witnesses, corrective_actions, created_at, updated_at) VALUES
(1, 1, 'Near miss — unsecured scaffolding board', 'A scaffolding board on Level 2 was found unsecured during morning inspection. No injury occurred but risk of falling object identified.', 'near_miss', 'medium', 'closed', 4, NOW() - INTERVAL '5 days', 'Level 2 scaffold, Block A', NULL, NULL, NULL, 'Tom Patel, Raj Singh', 'All boards re-secured and inspected. Toolbox talk delivered to scaffold gang.', NOW(), NOW()),
(2, 1, 'Minor cut — steel reinforcement', 'Operative sustained minor laceration to right hand while handling steel rebar. First aid administered on site.', 'injury', 'low', 'closed', 5, NOW() - INTERVAL '12 days', 'Foundation area, Block A', 'Operative (agency)', 'Laceration to right palm, approx 3cm', 'First aid — wound cleaned and dressed. Operative returned to work same day.', 'Tom Patel', 'Mandatory cut-resistant gloves enforced for all rebar handling. Reviewed PPE compliance.', NOW(), NOW()),
(3, 2, 'Dust exposure — inadequate ventilation', 'Operatives reported excessive dust during strip-out works on Floor 1. Ventilation fans were not operational.', 'near_miss', 'medium', 'open', 4, NOW() - INTERVAL '3 days', 'Floor 1, Clifton Office', NULL, NULL, NULL, 'Site team', 'Ventilation fans ordered and installed. RPE mandatory until resolved.', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, updated_at = NOW();

SELECT setval('incidents_id_seq', (SELECT MAX(id) FROM incidents));

-- ============================================================
-- 10. DEFECTS
-- ============================================================
INSERT INTO defects (id, project_id, title, description, status, priority, location, reported_by, assigned_to, due_date, resolved_at, created_at, updated_at) VALUES
(1, 1, 'Concrete honeycombing — Column C4', 'Honeycombing visible on Column C4 at foundation level. Area approx 300x200mm. Requires investigation and repair.', 'open', 'high', 'Foundation level, Grid C4', 3, '5', NOW() + INTERVAL '3 days', NULL, NOW(), NOW()),
(2, 1, 'Rebar cover insufficient — Beam B2', 'Rebar cover measured at 18mm against specified 25mm minimum on Beam B2. Structural engineer notified.', 'in_progress', 'high', 'Level 1, Beam B2', 3, '3', NOW() + INTERVAL '5 days', NULL, NOW(), NOW()),
(3, 2, 'Damaged plasterboard — Room 204', 'Impact damage to new plasterboard partition in Room 204 during strip-out. Panel requires replacement.', 'open', 'low', 'Floor 2, Room 204', 3, '5', NOW() + INTERVAL '7 days', NULL, NOW(), NOW()),
(4, 2, 'Door frame out of plumb — Room 201', 'New door frame in Room 201 is 8mm out of plumb. Contractor to rectify before door hanging.', 'open', 'medium', 'Floor 2, Room 201', 3, '5', NOW() + INTERVAL '5 days', NULL, NOW(), NOW()),
(5, 4, 'Snagging — window seal missing — Room 8', 'External window seal missing on Room 8 north elevation. Snagging item from practical completion.', 'resolved', 'low', 'Block B, Room 8', 3, '5', NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, updated_at = NOW();

SELECT setval('defects_id_seq', (SELECT MAX(id) FROM defects));

-- ============================================================
-- 11. PERMITS TO WORK
-- ============================================================
INSERT INTO permits (id, project_id, title, permit_type, description, status, issued_to, issued_by, valid_from, valid_until, location, risk_level, precautions, created_at, updated_at) VALUES
(1, 1, 'Hot Works — Welding Block A Level 1', 'hot_work', 'Welding of steel connections at Level 1 slab edge. Fire watch required for 1 hour post-works.', 'active', '5', 4, NOW() - INTERVAL '2 hours', NOW() + INTERVAL '6 hours', 'Level 1 slab edge, Block A', 'medium', 'Fire extinguisher on standby. Fire watch operative assigned. All combustibles cleared 3m radius.', NOW(), NOW()),
(2, 1, 'Confined Space — Drainage Inspection', 'confined_space', 'Entry into manhole MH-07 for CCTV drainage survey. Atmosphere testing required before entry.', 'completed', '5', 4, NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day', 'Site drainage, MH-07', 'high', 'Atmosphere tested — O2 19.8%, LEL 0%, H2S 0ppm. Rescue equipment on standby. Buddy system.', NOW(), NOW()),
(3, 2, 'Electrical Isolation — Floor 1 DB', 'electrical', 'Isolation of Distribution Board DB-01 for strip-out works on Floor 1.', 'active', '3', 4, NOW() - INTERVAL '1 hour', NOW() + INTERVAL '7 hours', 'Floor 1, DB-01', 'high', 'Isolation confirmed and locked off. Test for dead confirmed. Permit displayed on board.', NOW(), NOW()),
(4, 1, 'Working at Height — Scaffold Erection', 'working_at_height', 'Scaffold erection to Floors 3-6 external elevation. PASMA-qualified operatives only.', 'pending', '5', 4, NOW() + INTERVAL '1 day', NOW() + INTERVAL '3 days', 'External elevation, Floors 3-6', 'high', 'Exclusion zone below scaffold. Hard hat area enforced. Scaffold tag system in place.', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, updated_at = NOW();

SELECT setval('permits_id_seq', (SELECT MAX(id) FROM permits));

-- ============================================================
-- 12. DAILY REPORTS
-- ============================================================
INSERT INTO daily_reports (id, project_id, report_date, weather, temperature, workers_on_site, work_completed, work_planned, issues, materials_delivered, equipment_on_site, visitors, created_by, created_at, updated_at) VALUES
(1, 1, CURRENT_DATE - 1, 'Partly cloudy', 14, 22, 'Foundation pour Block A completed — 48m³ concrete placed. Rebar inspection passed.', 'Continue Block A foundations. Begin setting out for Block B.', 'Minor delay due to concrete pump breakdown — resolved within 1 hour.', 'Concrete: 48m³ (Hanson). Rebar: 2 tonnes (Celsa).', 'Concrete pump, excavator, telehandler', 'Client rep — James Harbourside (30 min site tour)', 3, NOW(), NOW()),
(2, 1, CURRENT_DATE - 2, 'Overcast', 12, 20, 'Rebar cage assembly for Block A foundations. Formwork erected.', 'Complete rebar and pour concrete Block A.', 'None.', 'Formwork: 120 panels (SGB). Rebar: 1.5 tonnes.', 'Excavator, telehandler, concrete mixer', 'None', 3, NOW(), NOW()),
(3, 2, CURRENT_DATE - 2, 'Sunny', 16, 8, 'Strip-out Floor 1 complete. Structural survey Floor 2 commenced.', 'Complete structural survey. Begin partition layout Floor 2.', 'Asbestos survey report delayed — chasing consultant.', 'Skip: 2 x 8-yard (Bristol Skips).', 'Mini-excavator, skip lorry', 'Structural engineer (Arup)', 3, NOW(), NOW()),
(4, 1, CURRENT_DATE, 'Sunny', 17, 24, 'Block A foundation pour Day 2 underway. 60% complete.', 'Complete pour and cure. Begin Block B setting out.', 'None.', 'Concrete: 35m³ so far today.', 'Concrete pump x2, excavator, telehandler', 'None', 3, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET work_completed = EXCLUDED.work_completed, updated_at = NOW();

SELECT setval('daily_reports_id_seq', (SELECT MAX(id) FROM daily_reports));

-- ============================================================
-- 13. INSPECTIONS
-- ============================================================
INSERT INTO inspections (id, project_id, title, inspection_type, description, status, inspector_id, scheduled_date, completed_date, result, findings, location, created_at, updated_at) VALUES
(1, 1, 'Foundation Rebar Inspection — Block A', 'structural', 'Pre-pour inspection of rebar cage, cover, and laps for Block A foundations.', 'passed', 4, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days', 'pass', 'All rebar correctly positioned. Cover blocks in place. Laps comply with drawings. Approved for pour.', 'Foundation level, Block A', NOW(), NOW()),
(2, 1, 'Scaffold Inspection — Levels 1-2', 'safety', 'Weekly scaffold inspection as required by NASC TG20.', 'passed', 4, NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days', 'pass', 'Scaffold in good condition. All boards secured. Toe boards in place. Guard rails correct height. Tag updated.', 'External scaffold, Levels 1-2', NOW(), NOW()),
(3, 2, 'Fire Safety Inspection — Floor 1', 'fire_safety', 'Fire safety compliance check following strip-out works.', 'failed', 4, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day', 'fail', 'Fire exit sign missing on east stairwell. Extinguisher bracket empty. Corrective action required within 48 hours.', 'Floor 1, Clifton Office', NOW(), NOW()),
(4, 1, 'Concrete Pour Inspection — Block A', 'quality', 'Inspection during and after concrete pour — slump tests, cube samples.', 'scheduled', 3, NOW() + INTERVAL '1 day', NULL, NULL, NULL, 'Foundation level, Block A', NOW(), NOW()),
(5, 3, 'Planning Pre-Application Meeting', 'regulatory', 'Pre-application meeting with Bristol City Council planning officers.', 'scheduled', 2, NOW() + INTERVAL '14 days', NULL, NULL, NULL, 'Bristol City Council offices', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, updated_at = NOW();

SELECT setval('inspections_id_seq', (SELECT MAX(id) FROM inspections));

-- ============================================================
-- 14. RFIs (Requests for Information)
-- ============================================================
INSERT INTO rfis (id, project_id, title, description, status, priority, submitted_by, assigned_to, due_date, response, responded_at, created_at, updated_at) VALUES
(1, 1, 'RFI-001: Column C4 rebar specification', 'Please confirm rebar specification and lap lengths for Column C4 as drawing REV C shows conflict with structural engineer''s notes.', 'answered', 'high', 3, 2, NOW() - INTERVAL '1 day', 'Use H16 bars at 200mm centres as per structural engineer''s note dated 14/04/2026. Drawing to be updated to REV D.', NOW() - INTERVAL '12 hours', NOW(), NOW()),
(2, 1, 'RFI-002: Waterproofing membrane specification', 'Specification calls for Type X waterproofing but supplier has discontinued. Please confirm acceptable alternative.', 'open', 'high', 3, 2, NOW() + INTERVAL '3 days', NULL, NULL, NOW(), NOW()),
(3, 2, 'RFI-003: Structural beam retention — Floor 2', 'Original drawings show beam to be removed but structural survey indicates it may be load-bearing. Awaiting structural engineer clarification.', 'open', 'urgent', 3, 2, NOW() + INTERVAL '1 day', NULL, NULL, NOW(), NOW()),
(4, 1, 'RFI-004: Window head detail — Floors 3-6', 'Window head detail not shown on architectural drawings. Please provide detail for lintels and DPC.', 'in_review', 'medium', 5, 2, NOW() + INTERVAL '7 days', NULL, NULL, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, updated_at = NOW();

SELECT setval('rfis_id_seq', (SELECT MAX(id) FROM rfis));

-- ============================================================
-- 15. OBSERVATIONS
-- ============================================================
INSERT INTO observations (id, project_id, title, description, observation_type, status, reported_by, location, action_required, action_taken, created_at, updated_at) VALUES
(1, 1, 'PPE non-compliance — operative without hard hat', 'Operative observed on Level 1 without hard hat. Immediately challenged and PPE provided.', 'safety', 'closed', 4, 'Level 1, Block A', 'Issue PPE and record in site register. Repeat offence to result in removal from site.', 'PPE issued. Verbal warning given. Recorded in site safety register.', NOW(), NOW()),
(2, 1, 'Good practice — excellent housekeeping', 'Concrete gang maintained excellent housekeeping throughout pour. Work area clean and materials well organised.', 'positive', 'closed', 3, 'Foundation area, Block A', 'None — positive observation for recognition.', 'Shared with team at morning briefing.', NOW(), NOW()),
(3, 2, 'Trailing cables — trip hazard', 'Extension cables trailing across walkway on Floor 2 creating trip hazard.', 'safety', 'open', 4, 'Floor 2 walkway, Clifton Office', 'Cables to be routed overhead or protected with cable covers immediately.', NULL, NOW(), NOW()),
(4, 1, 'Material storage — rebar stacked incorrectly', 'Rebar bundles stacked over 1.5m high without adequate support. Risk of collapse.', 'safety', 'closed', 5, 'Material compound, Block A', 'Restack rebar to max 1m height with proper bearers.', 'Rebar restacked same day. Compound layout reviewed.', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, updated_at = NOW();

SELECT setval('observations_id_seq', (SELECT MAX(id) FROM observations));

-- ============================================================
-- 16. DRAWINGS
-- ============================================================
INSERT INTO drawings (id, project_id, title, drawing_number, revision, discipline, status, file_url, file_size, uploaded_by, description, created_at, updated_at) VALUES
(1, 1, 'Site Layout Plan', 'APC-001', 'C', 'architectural', 'approved', 'https://placehold.co/800x600?text=Site+Layout', 2400000, 2, 'Overall site layout showing all blocks, access routes, and compound areas.', NOW(), NOW()),
(2, 1, 'Foundation Layout — Block A', 'STR-001', 'B', 'structural', 'approved', 'https://placehold.co/800x600?text=Foundation+Layout', 3100000, 2, 'Foundation layout plan showing pad foundations, ground beams, and pile caps.', NOW(), NOW()),
(3, 1, 'Typical Floor Plan — Floors 1-3', 'APC-010', 'D', 'architectural', 'approved', 'https://placehold.co/800x600?text=Floor+Plan', 2800000, 2, 'Typical apartment floor plan for Floors 1-3.', NOW(), NOW()),
(4, 1, 'Electrical Layout — Floor 1', 'MEP-001', 'A', 'mechanical', 'for_review', 'https://placehold.co/800x600?text=Electrical+Layout', 1900000, 2, 'First fix electrical layout for Floor 1 apartments.', NOW(), NOW()),
(5, 2, 'Existing Building Survey', 'CLF-001', 'A', 'architectural', 'approved', 'https://placehold.co/800x600?text=Existing+Survey', 4200000, 2, 'Measured survey of existing Clifton office building.', NOW(), NOW()),
(6, 2, 'Proposed Floor Plan — Floor 2', 'CLF-010', 'B', 'architectural', 'approved', 'https://placehold.co/800x600?text=Proposed+Floor+2', 2600000, 2, 'Proposed new layout for Floor 2 refurbishment.', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, updated_at = NOW();

SELECT setval('drawings_id_seq', (SELECT MAX(id) FROM drawings));

-- ============================================================
-- 17. ANNOUNCEMENTS
-- ============================================================
INSERT INTO announcements (id, company_id, title, content, priority, is_active, author_id, expires_at, created_at, updated_at) VALUES
(1, 1, 'New PPE Policy — Effective 1 May 2026', 'From 1 May 2026, all operatives must wear high-visibility vests rated EN ISO 20471 Class 2 or above on all Apex sites. Please ensure your team are aware and compliant. PPE available from site office.', 'high', true, 1, NOW() + INTERVAL '30 days', NOW(), NOW()),
(2, 1, 'Bank Holiday — Site Closure 5 May 2026', 'All Apex Construction sites will be closed on Monday 5 May 2026 (Early May Bank Holiday). Normal working resumes Tuesday 6 May. Please plan deliveries and subcontractor programmes accordingly.', 'medium', true, 1, NOW() + INTERVAL '14 days', NOW(), NOW()),
(3, 1, 'Toolbox Talk — Manual Handling', 'Mandatory toolbox talk on manual handling techniques will be delivered on all sites this week. Site managers to confirm attendance records submitted to H&S by Friday.', 'high', true, 4, NOW() + INTERVAL '7 days', NOW(), NOW()),
(4, 1, 'CortexBuild Field App — Now Live', 'The new CortexBuild Field app is now live for all site staff. Please download and log in using your company email. Training guides available from your site manager.', 'low', true, 1, NOW() + INTERVAL '60 days', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, updated_at = NOW();

SELECT setval('announcements_id_seq', (SELECT MAX(id) FROM announcements));

-- ============================================================
-- 18. ACTION PLANS
-- ============================================================
INSERT INTO action_plans (id, project_id, title, description, status, priority, due_date, assigned_to, created_by, related_incident_id, created_at, updated_at) VALUES
(1, 1, 'Scaffold Safety Improvement Plan', 'Following near-miss incident, implement enhanced scaffold inspection regime and operatives briefing.', 'in_progress', 'high', NOW() + INTERVAL '7 days', 4, 4, 1, NOW(), NOW()),
(2, 1, 'PPE Compliance Programme', 'Address repeated PPE non-compliance through enhanced monitoring, signage, and disciplinary process.', 'in_progress', 'high', NOW() + INTERVAL '14 days', 4, 4, NULL, NOW(), NOW()),
(3, 2, 'Ventilation Improvement — Strip-Out Works', 'Install adequate ventilation to all strip-out work areas to control dust exposure below WEL.', 'open', 'medium', NOW() + INTERVAL '3 days', 3, 4, 3, NOW(), NOW()),
(4, 2, 'Fire Safety Remediation — Floor 1', 'Rectify all fire safety deficiencies identified during inspection: replace missing signs, restock extinguishers.', 'open', 'urgent', NOW() + INTERVAL '2 days', 3, 4, NULL, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, updated_at = NOW();

SELECT setval('action_plans_id_seq', (SELECT MAX(id) FROM action_plans));

-- ============================================================
-- 19. ENQUIRY PIPELINES & ENQUIRIES
-- ============================================================
INSERT INTO enquiry_pipelines (id, company_id, name, description, is_active, created_at) VALUES
(1, 1, 'New Business Pipeline', 'Main pipeline for tracking all new project enquiries and tender opportunities', true, NOW())
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

SELECT setval('enquiry_pipelines_id_seq', (SELECT MAX(id) FROM enquiry_pipelines));

INSERT INTO enquiries (id, pipeline_id, company_id, title, client_name, client_email, client_phone, description, status, estimated_value, probability, source, assigned_to, follow_up_date, created_at, updated_at) VALUES
(1, 1, 1, 'Southmead Hospital — Ward Refurbishment', 'NHS Bristol Trust', 'estates@nhs-bristol.nhs.uk', '+44 117 950 5050', 'Refurbishment of 3 wards (approx 1200 sqm) at Southmead Hospital. Phased works required to maintain operational capacity.', 'qualified', 1800000.00, 65, 'referral', 2, NOW() + INTERVAL '7 days', NOW(), NOW()),
(2, 1, 1, 'Stoke Park Housing Development', 'Stoke Park Homes Ltd', 'development@stokepark.co.uk', '+44 117 880 2200', '24-unit residential development on brownfield site. Planning approved. Seeking main contractor.', 'proposal', 3200000.00, 40, 'tender_portal', 2, NOW() + INTERVAL '14 days', NOW(), NOW()),
(3, 1, 1, 'Cabot Circus Retail Fit-Out', 'Cabot Circus Management', 'projects@cabotcircus.co.uk', '+44 117 910 1000', 'Fit-out of 3 vacant retail units (approx 800 sqm total). Fast-track programme required.', 'new', 420000.00, 30, 'direct', 2, NOW() + INTERVAL '3 days', NOW(), NOW()),
(4, 1, 1, 'Long Ashton Primary School Extension', 'North Somerset Council', 'capital@n-somerset.gov.uk', '+44 1934 888 888', '4-classroom extension and new sports hall. BREEAM Very Good required.', 'won', 1450000.00, 100, 'framework', 2, NOW() - INTERVAL '5 days', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, updated_at = NOW();

SELECT setval('enquiries_id_seq', (SELECT MAX(id) FROM enquiries));

-- ============================================================
-- 20. TENDERS
-- ============================================================
INSERT INTO tenders (id, project_id, company_id, title, description, status, tender_type, submission_deadline, estimated_value, awarded_value, awarded_to, created_by, created_at, updated_at) VALUES
(1, 3, 1, 'Bath Road Industrial — Structural Steel Package', 'Supply and erect structural steel frame for Bath Road Industrial Unit. Drawings available on request.', 'open', 'subcontract', NOW() + INTERVAL '21 days', 380000.00, NULL, NULL, 2, NOW(), NOW()),
(2, 3, 1, 'Bath Road Industrial — M&E Package', 'Mechanical and electrical installation for Bath Road Industrial Unit including lighting, power, heating, and ventilation.', 'open', 'subcontract', NOW() + INTERVAL '28 days', 220000.00, NULL, NULL, 2, NOW(), NOW()),
(3, 1, 1, 'Harbourside — Curtain Walling Package', 'Supply and install curtain walling system to Floors 3-6 all elevations. Approved system required.', 'awarded', 'subcontract', NOW() - INTERVAL '30 days', 650000.00, 628000.00, 'Schuco Facades Ltd', 2, NOW(), NOW()),
(4, 1, 1, 'Harbourside — Lifts Package', 'Supply and install 3 no. passenger lifts and 1 no. goods lift. 8-person capacity minimum.', 'evaluation', 'subcontract', NOW() - INTERVAL '7 days', 280000.00, NULL, NULL, 2, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, updated_at = NOW();

SELECT setval('tenders_id_seq', (SELECT MAX(id) FROM tenders));

-- ============================================================
-- 21. INVOICES
-- ============================================================
INSERT INTO invoices (id, project_id, company_id, invoice_number, title, client_name, client_email, status, issue_date, due_date, paid_date, subtotal, tax_rate, tax_amount, total, notes, created_by, created_at, updated_at) VALUES
(1, 1, 1, 'INV-2026-001', 'Harbourside Apartments — Interim Valuation 1', 'Harbourside Developments Ltd', 'accounts@harbourside.co.uk', 'paid', CURRENT_DATE - 60, CURRENT_DATE - 30, CURRENT_DATE - 25, 350000.00, 20.00, 70000.00, 420000.00, 'Interim valuation 1 — substructure and foundations', 6, NOW(), NOW()),
(2, 1, 1, 'INV-2026-002', 'Harbourside Apartments — Interim Valuation 2', 'Harbourside Developments Ltd', 'accounts@harbourside.co.uk', 'paid', CURRENT_DATE - 30, CURRENT_DATE, CURRENT_DATE - 5, 480000.00, 20.00, 96000.00, 576000.00, 'Interim valuation 2 — superstructure Floors 1-2', 6, NOW(), NOW()),
(3, 1, 1, 'INV-2026-003', 'Harbourside Apartments — Interim Valuation 3', 'Harbourside Developments Ltd', 'accounts@harbourside.co.uk', 'sent', CURRENT_DATE, CURRENT_DATE + 30, NULL, 520000.00, 20.00, 104000.00, 624000.00, 'Interim valuation 3 — superstructure Floors 3-4', 6, NOW(), NOW()),
(4, 2, 1, 'INV-2026-004', 'Clifton Office Refurb — Interim Valuation 1', 'Clifton Property Group', 'accounts@cliftonproperty.co.uk', 'paid', CURRENT_DATE - 45, CURRENT_DATE - 15, CURRENT_DATE - 10, 160000.00, 20.00, 32000.00, 192000.00, 'Interim valuation 1 — strip-out and enabling works', 6, NOW(), NOW()),
(5, 4, 1, 'INV-2026-005', 'Redland School Extension — Final Account', 'Bristol City Council', 'payments@bristol.gov.uk', 'overdue', CURRENT_DATE - 60, CURRENT_DATE - 30, NULL, 2085000.00, 20.00, 417000.00, 2502000.00, 'Final account — all works complete. Retention of 2.5% held.', 6, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET invoice_number = EXCLUDED.invoice_number, updated_at = NOW();

SELECT setval('invoices_id_seq', (SELECT MAX(id) FROM invoices));

-- ============================================================
-- 22. EMPLOYEE CREDENTIALS
-- ============================================================
INSERT INTO employee_credentials (id, user_id, company_id, credential_type, title, issuing_body, credential_number, issue_date, expiry_date, status, created_at, updated_at) VALUES
(1,  3, 1, 'cscs',          'CSCS Gold Card — Site Manager',          'CSCS',          'CSCS-GM-123456', '2023-03-01', '2028-03-01', 'valid',   NOW(), NOW()),
(2,  4, 1, 'nebosh',        'NEBOSH National General Certificate',     'NEBOSH',        'NGC-2021-78432', '2021-06-15', '2024-06-15', 'expired', NOW(), NOW()),
(3,  4, 1, 'first_aid',     'First Aid at Work (3-day)',               'St John Ambulance', 'FAW-2024-5521', '2024-01-10', '2027-01-10', 'valid', NOW(), NOW()),
(4,  5, 1, 'cscs',          'CSCS Blue Card — Skilled Worker',         'CSCS',          'CSCS-SW-654321', '2022-07-01', '2027-07-01', 'valid',   NOW(), NOW()),
(5,  5, 1, 'plant_operator','CPCS A61 — Telehandler Operator',         'CPCS',          'CPCS-A61-88821', '2023-09-01', '2028-09-01', 'valid',   NOW(), NOW()),
(6,  3, 1, 'scaffold',      'CISRS Part 2 — Scaffolding Supervisor',   'CISRS',         'CISRS-P2-44432', '2022-04-01', '2027-04-01', 'valid',   NOW(), NOW()),
(7,  2, 1, 'cscs',          'CSCS Black Card — Project Manager',       'CSCS',          'CSCS-PM-112233', '2024-01-01', '2029-01-01', 'valid',   NOW(), NOW()),
(8,  4, 1, 'nebosh',        'NEBOSH National General Certificate',     'NEBOSH',        'NGC-2024-99123', '2024-09-01', '2027-09-01', 'valid',   NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, updated_at = NOW();

SELECT setval('employee_credentials_id_seq', (SELECT MAX(id) FROM employee_credentials));

-- ============================================================
-- 23. COMPANY FEATURE FLAGS
-- ============================================================
INSERT INTO company_feature_flags (id, company_id, feature_name, is_enabled, created_at, updated_at) VALUES
(1,  1, 'ai_photo_analysis',     true,  NOW(), NOW()),
(2,  1, 'tender_management',     true,  NOW(), NOW()),
(3,  1, 'invoice_management',    true,  NOW(), NOW()),
(4,  1, 'drawing_management',    true,  NOW(), NOW()),
(5,  1, 'advanced_analytics',    true,  NOW(), NOW()),
(6,  1, 'offline_sync',          true,  NOW(), NOW()),
(7,  1, 'push_notifications',    true,  NOW(), NOW()),
(8,  1, 'biometric_auth',        false, NOW(), NOW()),
(9,  1, 'multi_company',         false, NOW(), NOW()),
(10, 1, 'api_access',            true,  NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET is_enabled = EXCLUDED.is_enabled, updated_at = NOW();

SELECT setval('company_feature_flags_id_seq', (SELECT MAX(id) FROM company_feature_flags));

-- Done
SELECT 'Seed complete' AS status;
