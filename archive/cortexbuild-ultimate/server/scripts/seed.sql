-- CortexBuild Ultimate — Seed Data
-- Passwords: CortexBuild2024! (bcrypt hash)

-- Users
-- organization_id: NULL for company_owner (uses company_id instead), set for other roles
-- company_id: references the seeded company (00000000-0000-0000-0000-000000000002)
INSERT INTO users (name, email, password_hash, role, organization_id, company_id, phone) VALUES
('Adrian Stanca',    'adrian@cortexbuild.co.uk', '$2b$10$a/iZ20htsbJ9IC1jNsk9/.PKWdPIxEwDNmS/FPN2HFseU8cN/sNDK', 'company_owner', NULL, '00000000-0000-0000-0000-000000000002', '07700 900123'),
('James Harrington', 'admin@cortexbuild.co.uk',  '$2b$10$a/iZ20htsbJ9IC1jNsk9/.PKWdPIxEwDNmS/FPN2HFseU8cN/sNDK', 'admin',         '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '07700 900456')
ON CONFLICT (email) DO NOTHING;

-- Projects
INSERT INTO projects (name, client, status, progress, budget, spent, start_date, end_date, manager, location, type, phase, workers, contract_value, description) VALUES
('Canary Wharf Office Complex',    'Meridian Properties',   'active',    68, 4200000, 2856000, '2025-06-01', '2026-08-31', 'James Harrington', 'London, E14',        'Commercial',   'Structural', 42, 4350000, '14-storey mixed-use office development in the heart of Canary Wharf.'),
('Manchester City Apartments',     'Northern Living Ltd',   'active',    34, 2800000,  952000, '2025-09-15', '2026-12-20', 'Sarah Mitchell',   'Manchester, M1',     'Residential',  'Foundation', 28, 2950000, '120-unit residential apartment block in Manchester city centre.'),
('Birmingham Road Bridge',         'West Midlands Council', 'active',    89, 1600000, 1424000, '2025-03-01', '2026-03-30', 'Tom Bradley',      'Birmingham, B1',     'Civil',        'Finishing',  18, 1650000, 'Replacement of ageing road bridge on the A45 corridor.'),
('Leeds Warehouse Extension',      'Nordic Logistics UK',   'on_hold',   22,  890000,  195800, '2025-11-01', '2026-07-15', 'Adrian Stanca',    'Leeds, LS1',         'Industrial',   'Design',      0,  925000, '5,000m² warehouse extension with mezzanine and loading bays.'),
('Bristol Riverside Development',  'Avon Homes Ltd',        'planning',   5, 3100000,   62000, '2026-02-01', '2027-06-30', 'Lisa Kendall',     'Bristol, BS1',       'Residential',  'Planning',    0, 3250000, 'Luxury riverside apartments and commercial units.')
ON CONFLICT DO NOTHING;

-- Invoices
INSERT INTO invoices (number, client, project, amount, vat, cis_deduction, status, issue_date, due_date, description) VALUES
('CB-0042', 'Meridian Properties',   'Canary Wharf Office Complex',   185000, 37000,  36000, 'paid',    '2026-01-15', '2026-02-14', 'Progress claim #4 — Structural steelwork floors 3-7'),
('CB-0043', 'Northern Living Ltd',   'Manchester City Apartments',     98500, 19700,  19200, 'sent',    '2026-02-01', '2026-03-02', 'Progress claim #2 — Foundation works complete'),
('CB-0044', 'West Midlands Council', 'Birmingham Road Bridge',         45000,  9000,   8750, 'overdue', '2026-01-20', '2026-02-19', 'Final account — abutment works'),
('CB-0045', 'Nordic Logistics UK',   'Leeds Warehouse Extension',      22000,  4400,   4250, 'draft',   '2026-03-01', '2026-03-31', 'Mobilisation and preliminary works'),
('CB-0046', 'Avon Homes Ltd',        'Bristol Riverside Development',  12500,  2500,   2400, 'sent',    '2026-03-10', '2026-04-09', 'Design and planning fees — Stage 1')
ON CONFLICT DO NOTHING;

-- Team Members
INSERT INTO team_members (name, role, trade, email, phone, status, cis_status, utr_number, ni_number, hours_this_week, rams_completed) VALUES
('James Harrington', 'Project Manager',   'Management',      'j.harrington@cortexbuild.co.uk', '07700 900201', 'on_site',  'gross', '1234567890', 'AB123456A', 42.0, true),
('Sarah Mitchell',   'Site Manager',      'Management',      's.mitchell@cortexbuild.co.uk',   '07700 900202', 'on_site',  'gross', '9876543210', 'CD789012B', 40.0, true),
('Tom Bradley',      'Site Supervisor',   'Civil',           't.bradley@cortexbuild.co.uk',    '07700 900203', 'on_site',  'net',   '1122334455', 'EF345678C', 44.0, true),
('Mark Davies',      'Electrician',       'Electrical',      'm.davies@cortexbuild.co.uk',     '07700 900204', 'active',   'net',   '5544332211', 'GH901234D', 38.5, true),
('Kevin Walsh',      'Plant Operator',    'Plant Operation', 'k.walsh@cortexbuild.co.uk',      '07700 900205', 'off_site', 'net',   '6677889900', 'IJ567890E', 36.0, false)
ON CONFLICT DO NOTHING;

-- Safety Incidents
INSERT INTO safety_incidents (type, title, severity, status, project, reported_by_name, date, location, description, immediate_actions) VALUES
('near-miss',    'Unsecured scaffolding board on Level 3', 'moderate', 'investigating', 'Canary Wharf Office Complex', 'James Harrington', '2026-03-18', 'Level 3, Grid B4', 'Scaffolding board found unsecured during morning inspection. No injuries.', 'Area cordoned off, board secured immediately. Scaffolding team briefed.'),
('incident',     'Minor hand laceration — angle grinder',  'minor',    'resolved',      'Birmingham Road Bridge',      'Tom Bradley',      '2026-03-15', 'Abutment A, West Side', 'Operative sustained minor laceration to left hand whilst using angle grinder without gloves.', 'First aid administered. PPE policy reinforced.'),
('toolbox-talk', 'Working at Height — Weekly Briefing',    'minor',    'closed',        'Canary Wharf Office Complex', 'Sarah Mitchell',   '2026-03-17', 'Site Canteen',          'Weekly toolbox talk on working at height procedures, harness inspection, and exclusion zones.', 'All operatives attended. Signed attendance register completed.')
ON CONFLICT DO NOTHING;

-- RFIs
INSERT INTO rfis (number, project, subject, question, priority, status, submitted_by, submitted_date, due_date, assigned_to) VALUES
('RFI-0031', 'Canary Wharf Office Complex',  'Column splice detail — Grid C4',      'Can the column splice on Grid C4 Level 5 be relocated 200mm to avoid clash with services? Please confirm structural implication.', 'high',   'open',     'James Harrington', '2026-03-10', '2026-03-24', 'Structural Engineer'),
('RFI-0032', 'Manchester City Apartments',   'Foundation depth — Block B',          'Unexpectedly soft ground encountered at -3.5m on Block B. Do we proceed to -4.5m or install ground improvement?',               'critical','open',     'Sarah Mitchell',   '2026-03-14', '2026-03-21', 'Geotechnical Engineer'),
('RFI-0033', 'Birmingham Road Bridge',       'Parapet waterproofing specification', 'The parapet spec calls for Type A membrane but supplier has discontinued it. Can Type B (BS 8102 compliant) be substituted?',      'medium', 'answered', 'Tom Bradley',      '2026-03-05', '2026-03-19', 'Design Engineer')
ON CONFLICT DO NOTHING;

-- Change Orders
INSERT INTO change_orders (number, project, title, description, amount, status, submitted_date, reason, schedule_impact) VALUES
('CO-0018', 'Canary Wharf Office Complex',  'Additional RC cores — floors 8-10',     'Client requested two additional reinforced concrete cores on floors 8-10 to accommodate new lift shafts.',       95000, 'approved', '2026-02-20', 'Client variation',       14),
('CO-0019', 'Manchester City Apartments',   'Ground investigation — additional bore', 'Three additional boreholes required following discovery of soft ground strata during foundation works.',            18500, 'pending',  '2026-03-15', 'Unforeseen ground conditions', 7),
('CO-0020', 'Birmingham Road Bridge',       'Temporary traffic management extension', 'TM scheme required for 3 additional weeks due to utility diversions running late. LA approval obtained.',           12000, 'pending',  '2026-03-18', 'Third party delay',       21)
ON CONFLICT DO NOTHING;

-- Equipment
INSERT INTO equipment (name, type, registration, status, location, next_service, daily_rate) VALUES
('Liebherr 130 EC-B Tower Crane',  'Tower Crane',    'TC-001',   'on_site',    'Canary Wharf Office Complex', '2026-06-01', 1850.00),
('JCB 3CX Backhoe Loader',         'Plant',          'BL-KX22',  'on_site',    'Manchester City Apartments',  '2026-04-15',  285.00),
('Kubota SVL75 Compact Track Loader','Plant',         'CTL-KU55', 'maintenance','CortexBuild Yard, Leeds',     '2026-03-28',  220.00),
('MEWP — Genie Z-62/40',           'MEWP',           'GZ-062',   'available',  'CortexBuild Yard, Leeds',     '2026-05-10',  195.00),
('Hilti TE 3000 Breaker',          'Powered Tool',   'HT-3001',  'on_site',    'Birmingham Road Bridge',      '2026-07-01',   45.00)
ON CONFLICT DO NOTHING;

-- Subcontractors
INSERT INTO subcontractors (company, trade, contact, email, phone, status, cis_verified, insurance_expiry, rams_approved, current_project, contract_value, rating) VALUES
('Peak Steel Erectors Ltd',      'Structural Steelwork', 'Gary Peak',     'gary@peaksteel.co.uk',       '07811 234567', 'active',  true,  '2026-12-31', true,  'Canary Wharf Office Complex', 520000, 4.8),
('Northern Groundworks Ltd',     'Groundworks',          'Diane North',   'diane@northernground.co.uk', '07922 345678', 'active',  true,  '2026-09-30', true,  'Manchester City Apartments',  380000, 4.5),
('Apex Electrical Services',     'Electrical',           'Ravi Sharma',   'ravi@apexelec.co.uk',        '07533 456789', 'active',  true,  '2026-11-15', false, 'Canary Wharf Office Complex', 215000, 4.2),
('Midland Civil Contractors Ltd','Civil Engineering',    'Steve Crane',   'steve@midlandcivil.co.uk',   '07644 567890', 'active',  false, '2026-08-31', true,  'Birmingham Road Bridge',      190000, 4.0),
('Bristol Plastering Co.',       'Plastering',           'Colin White',   'colin@bristolplaster.co.uk', '07755 678901', 'pending', false, '2026-06-30', false, NULL,                            45000, 3.5)
ON CONFLICT DO NOTHING;

-- Documents
INSERT INTO documents (name, type, project, uploaded_by, version, size, status, category) VALUES
('Structural GA Drawings — Package 1', 'PDF', 'Canary Wharf Office Complex',  'James Harrington', '3.2', '8.4 MB',  'current',    'DRAWINGS'),
('Construction Phase Plan',            'PDF', 'Manchester City Apartments',   'Sarah Mitchell',   '1.1', '2.1 MB',  'current',    'RAMS'),
('Building Control Approval — Phase 1','PDF', 'Birmingham Road Bridge',       'Tom Bradley',      '1.0', '1.5 MB',  'current',    'PERMITS'),
('Specification — Structural Works',   'PDF', 'Canary Wharf Office Complex',  'James Harrington', '2.0', '4.7 MB',  'current',    'SPECS'),
('Site Investigation Report',          'PDF', 'Bristol Riverside Development','Adrian Stanca',    '1.0', '12.3 MB', 'current',    'REPORTS')
ON CONFLICT DO NOTHING;

-- Timesheets
INSERT INTO timesheets (worker, project, week, regular_hours, overtime_hours, daywork_hours, total_pay, status, cis_deduction) VALUES
('James Harrington', 'Canary Wharf Office Complex', '2026-03-17', 40.0, 2.0, 0.0, 1420.00, 'approved', 0),
('Tom Bradley',      'Birmingham Road Bridge',       '2026-03-17', 40.0, 4.0, 0.0, 1188.00, 'submitted', 237.60),
('Kevin Walsh',      'Manchester City Apartments',   '2026-03-17', 37.5, 0.0, 4.0, 1050.00, 'draft',    210.00)
ON CONFLICT DO NOTHING;

-- Meetings
INSERT INTO meetings (title, meeting_type, project, date, time, location, attendees, agenda, status) VALUES
('Weekly Progress Meeting — Canary Wharf', 'Site Progress',      'Canary Wharf Office Complex', '2026-03-25', '09:00', 'Site Office', 'James Harrington, Sarah Mitchell, Peak Steel Rep', 'Programme review; Steel erection progress; Level 8 pour date', 'Scheduled'),
('Design Review — Foundation Details',      'Design Review',      'Manchester City Apartments',  '2026-03-22', '14:00', 'CortexBuild HQ, Leeds', 'Sarah Mitchell, Structural Engineer, Client Rep', 'Review RFI-0032; Ground improvement options; Revised programme', 'Scheduled'),
('Client Update — Birmingham Bridge',       'Client Update',      'Birmingham Road Bridge',      '2026-03-19', '10:30', 'Teams Meeting', 'Tom Bradley, WM Council PM, Design Engineer', 'Progress update; Parapet spec; Practical completion date', 'Completed')
ON CONFLICT DO NOTHING;

-- Materials
INSERT INTO materials (name, category, quantity, unit, unit_cost, total_cost, supplier, project, status, delivery_date, po_number) VALUES
('Ready Mix Concrete C35/45',    'Concrete', 480,  'm³',    125.00, 60000.00, 'Hanson UK',          'Canary Wharf Office Complex', 'on_site',  '2026-03-20', 'PO-0891'),
('Structural Steel — S355',      'Steel',    42.5, 'tonnes', 1850.00, 78625.00, 'British Steel Ltd',  'Canary Wharf Office Complex', 'delivered','2026-03-15', 'PO-0892'),
('Thermal Insulation Board 150mm','Insulation',320, 'm²',    18.50,  5920.00, 'Kingspan Ltd',       'Manchester City Apartments',  'ordered',  '2026-04-05', 'PO-0893')
ON CONFLICT DO NOTHING;

-- Punch List
INSERT INTO punch_list (project, location, description, assigned_to, priority, status, due_date, trade) VALUES
('Birmingham Road Bridge',  'North Abutment, West Face',  'Concrete honeycombing on abutment face — requires cut and fill',   'Tom Bradley',     'high',   'in_progress', '2026-03-25', 'Concrete Repair'),
('Birmingham Road Bridge',  'Parapet — full length',       'Sealant joint to parapet kerb not completed — 45m remaining',      'Tom Bradley',     'medium', 'open',        '2026-03-28', 'Waterproofing'),
('Canary Wharf Office Complex','Level 2 plant room',      'Fire stopping around service penetrations — 6 locations',         'Apex Electrical', 'critical','open',        '2026-03-22', 'Fire Stopping')
ON CONFLICT DO NOTHING;

-- Inspections
INSERT INTO inspections (type, project, inspector, date, status, score, next_inspection) VALUES
('Health & Safety',    'Canary Wharf Office Complex', 'HSE Inspector',    '2026-03-12', 'passed',      88, '2026-06-12'),
('Structural',         'Birmingham Road Bridge',      'Building Control', '2026-03-10', 'conditional', 74, '2026-03-31'),
('Fire Safety',        'Manchester City Apartments',  'Sarah Mitchell',   '2026-03-18', 'scheduled',   NULL, '2026-03-25')
ON CONFLICT DO NOTHING;

-- RAMS
INSERT INTO rams (title, project, activity, version, status, created_by, review_date, signatures, required) VALUES
('Steelwork Erection — Floors 1-5',   'Canary Wharf Office Complex', 'Structural steelwork erection using tower crane',    '2.1', 'approved', 'James Harrington', '2026-06-01', 6, 6),
('Foundation Works — Block B',         'Manchester City Apartments',  'Excavation and concrete foundation works >2m depth', '1.0', 'review',   'Sarah Mitchell',   '2026-04-15', 2, 5)
ON CONFLICT DO NOTHING;

-- CIS Returns
INSERT INTO cis_returns (contractor, utr, period, gross_payment, materials_cost, labour_net, cis_deduction, status, verification_status) VALUES
('Peak Steel Erectors Ltd',   '1234567890', '2026-02', 145000, 42000, 103000, 20600, 'submitted', 'net'),
('Northern Groundworks Ltd',  '9876543210', '2026-02',  98500, 28000,  70500, 14100, 'submitted', 'net'),
('Apex Electrical Services',  '5544332211', '2026-02',  67000, 15000,  52000,     0, 'pending',   'gross')
ON CONFLICT DO NOTHING;

-- Tenders
INSERT INTO tenders (title, client, value, deadline, status, probability, type, location, ai_score, notes) VALUES
('Southwark Council Depot Refurbishment', 'London Borough of Southwark', 2800000, '2026-04-30', 'drafting',    65, 'Refurbishment', 'London, SE1',     78, 'Strong existing relationship with client. Competitive market.'),
('M62 Junction 26 Motorway Works',        'National Highways',           8500000, '2026-05-15', 'submitted',   35, 'Civil',         'Yorkshire',       62, 'Large PQQ submission completed. Awaiting shortlist decision.'),
('Sheffield University Lab Extension',    'University of Sheffield',     3200000, '2026-03-31', 'shortlisted', 55, 'Commercial',    'Sheffield, S10',  85, 'Site visit completed. Strong technical submission.')
ON CONFLICT DO NOTHING;

-- Contacts (CRM)
INSERT INTO contacts (name, company, role, email, phone, type, value, last_contact, status, projects) VALUES
('David Meridian',  'Meridian Properties',   'Development Director', 'd.meridian@meridianprop.co.uk', '020 7123 4567', 'client',        4350000, '2026-03-18', 'active',  1),
('Diane North',     'Northern Living Ltd',    'MD',                  'diane@northernliving.co.uk',    '0161 234 5678', 'client',        2950000, '2026-03-14', 'active',  1),
('Gary Peak',       'Peak Steel Erectors',   'Director',            'gary@peaksteel.co.uk',          '07811 234567', 'subcontractor',  520000, '2026-03-16', 'active',  1),
('Claire Thompson', 'Barratt Developments',  'Procurement Manager', 'c.thompson@barratt.co.uk',      '020 8456 7890', 'prospect',      6500000, '2026-02-28', 'active',  0),
('Ravi Sharma',     'Apex Electrical',       'Director',            'ravi@apexelec.co.uk',           '07533 456789', 'subcontractor',  215000, '2026-03-12', 'active',  1)
ON CONFLICT DO NOTHING;

-- Risk Register
INSERT INTO risk_register (title, project, category, likelihood, impact, owner, status, mitigation, review_date) VALUES
('Programme delay due to steel delivery lead times', 'Canary Wharf Office Complex', 'Programme',    3, 4, 'James Harrington', 'monitoring', 'Early procurement with British Steel. 4-week float maintained in programme.', '2026-04-01'),
('Ground contamination — Block B excavation',        'Manchester City Apartments',  'Environmental',2, 5, 'Sarah Mitchell',   'open',       'Watching brief with environmental consultant. Contingency budget allocated.', '2026-03-28'),
('CIS compliance — subcontractor verification gap',  'Multiple',                    'Legal',        2, 4, 'Adrian Stanca',    'mitigated',  'All subcontractors verified via HMRC CIS online before mobilisation.',        '2026-06-01')
ON CONFLICT DO NOTHING;

-- Purchase Orders
INSERT INTO purchase_orders (number, supplier, project, amount, status, order_date, delivery_date, notes) VALUES
('PO-0891', 'Hanson UK',         'Canary Wharf Office Complex', 60000.00, 'confirmed',  '2026-03-01', '2026-03-20', 'Ready mix concrete C35/45 — 480m³. Call-off order.'),
('PO-0892', 'British Steel Ltd', 'Canary Wharf Office Complex', 78625.00, 'delivered',  '2026-02-15', '2026-03-15', 'Structural steel S355 — 42.5t. Includes delivery to site.'),
('PO-0893', 'Kingspan Ltd',      'Manchester City Apartments',   5920.00, 'sent',       '2026-03-10', '2026-04-05', 'Thermal insulation boards 150mm — 320m².')
ON CONFLICT DO NOTHING;

-- Daily Reports
INSERT INTO daily_reports (project, date, prepared_by, weather, temperature, workers_on_site, activities, issues, progress) VALUES
('Canary Wharf Office Complex', '2026-03-20', 'James Harrington', 'Cloudy', '9°C', 38,
 '["Steelwork erection Level 8 continued — 4 columns and 3 beams erected","Concrete pour Level 7 slab — 120m² completed","Rebar fixing Level 8 commenced"]',
 '["Minor delay to crane lift due to gusting winds 09:00-10:30. Resumed 10:45."]', 70),
('Birmingham Road Bridge',      '2026-03-20', 'Tom Bradley',      'Sunny',  '11°C', 16,
 '["Parapet formwork striking — full length","Waterproofing membrane application — 60m completed","Drainage channel installation — 40m completed"]',
 '[]', 91),
('Manchester City Apartments',  '2026-03-20', 'Sarah Mitchell',   'Rainy',  '7°C',  22,
 '["Pile cap excavation Block C commenced","Blinding concrete poured Block B pile caps — 12 no.","Site drainage maintained throughout"]',
 '["Heavy rain from 13:00 slowed excavation progress. 1.5 hours lost."]', 36)
ON CONFLICT DO NOTHING;
