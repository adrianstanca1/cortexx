-- Seed data for CortexBuild Ultimate — matching actual schema

BEGIN;

-- Ensure organization and company exist
INSERT INTO organizations (id, name, slug, created_at)
VALUES ('00000000-0000-0000-0000-000000000001', 'CortexBuild Ltd', 'cortexbuild', NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO companies (id, organization_id, name, created_at)
VALUES ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'CortexBuild Ltd', NOW())
ON CONFLICT (id) DO NOTHING;

-- Insert the master project
INSERT INTO projects (
  id, organization_id, company_id, name, client, status, progress,
  budget, spent, start_date, end_date, manager, location, type,
  phase, workers, contract_value, description, created_at
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  'The Shard Phase 2 — Riverside Pavilion',
  'StancaInvest Ltd',
  'active',
  42,
  45200000,
  18700000,
  '2024-06-01',
  '2027-06-01',
  'Helena Vance',
  'London, SE1',
  'Commercial - Mixed Use',
  'Structural Frame',
  47,
  45200000,
  'A 28-storey mixed-use development on the Thames waterfront with basement excavation, reinforced concrete core, steel frame, and curtain wall glazing.',
  NOW()
);

-- Specifications (drawings linked via reference → drawn as specs in this schema)
INSERT INTO specifications (
  id, organization_id, company_id, reference, title, project_id, project,
  section, version, status, description, created_at
) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
   '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002',
   '04-00-00', 'Substructure',
   '11111111-1111-1111-1111-111111111111', 'The Shard Phase 2 — Riverside Pavilion',
   'Substructure', 'Rev P1', 'approved',
   'Basement RC retaining walls — C40/50 concrete, 500kg/m3 cementitious, waterproofing category 3 (BS 8102:2009 Type B system, Sika White Box).',
   NOW()),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
   '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002',
   '05-00-00', 'Superstructure',
   '11111111-1111-1111-1111-111111111111', 'The Shard Phase 2 — Riverside Pavilion',
   'Superstructure', 'Rev P2', 'approved',
   'Steel frame — composite beams with 130mm deep metal deck, 55mm concrete topping. Fire protection: intumescent coating to 90mins resistance.',
   NOW()),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
   '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002',
   '07-00-00', 'Envelope',
   '11111111-1111-1111-1111-111111111111', 'The Shard Phase 2 — Riverside Pavilion',
   'Envelope', 'Rev P1', 'approved',
   'Unitised curtain wall: aluminium-framed, stick-system assembly with thermal break. U-value 1.0 W/m2K.',
   NOW());

-- RFIs
INSERT INTO rfis (
  id, organization_id, company_id, number, project_id, project, subject,
  question, priority, status, submitted_by, submitted_date, due_date,
  assigned_to, response, created_at, updated_at
) VALUES
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
   '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002',
   'RFI-042', '11111111-1111-1111-1111-111111111111', 'The Shard Phase 2 — Riverside Pavilion',
   'Pile cap reinforcement — conflict with MH3 drainage',
   'Drawing SE-P402 shows 16H25 bottom bars in Pile Cap 42. Mechanical package drawing MEP-R21 shows 450x300mm drainage MH3 crossing directly through the cap.',
   'high', 'closed',
   'James Chen (CortexBuild)', '2025-04-28', '2025-05-05',
   'Helena Vance (PM)',
   'SE confirms MH3 to be relocated 2.5m east to avoid cap. Revised drainage layout to be issued by 14 May. Piling can proceed.',
   NOW(), NOW());

-- Submittals
INSERT INTO submittals (
  id, organization_id, company_id, project_id, submittal_number, title,
  description, type, trade, submitted_by_company, reviewer_name,
  status, priority, submitted_date, due_date
) VALUES
  ('cccccccc-cccc-cccc-cccc-ccccccccccc1',
   '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002',
   '11111111-1111-1111-1111-111111111111',
   'SUB-2025-089', 'Curtain wall unit shop drawings — Floors 8–14',
   'Unitised curtain wall panels for tower zone T3 (floors 8–14). Includes panel GA, fixing bracket detail, structural silicone joint, fire-stopping cavity barrier.',
   'Shop Drawing', 'Envelope — Schüco International',
   'Schüco International', 'Helena Vance',
   'under-review', 'high',
   NOW(), '2025-05-15');

-- Punch List
INSERT INTO punch_list (
  id, organization_id, company_id, project_id, project, location, description,
  assigned_to, priority, status, due_date, trade, created_at
) VALUES
  ('dddddddd-dddd-dddd-dddd-ddddddddddd1',
   '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002',
   '11111111-1111-1111-1111-111111111111', 'The Shard Phase 2 — Riverside Pavilion',
   'Level 12, gridline D-E / 3-4',
   'Level 12 facade panel F-12-87: visible mastic smear on inner pane, 200mm stain. Requires clean with proprietary glass cleaner and squeegee.',
   'Lucas Facades Ltd', 'medium', 'open', '2025-05-20', 'Finishes', NOW()),
  ('dddddddd-dddd-dddd-dddd-ddddddddddd2',
   '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002',
   '11111111-1111-1111-1111-111111111111', 'The Shard Phase 2 — Riverside Pavilion',
   'Level 3, Plant Deck North',
   'VRF pipework insulation incomplete on run L3-V1 to VRF-03. Armaflex class O foam insulation, 25mm wall, to be sleeved through fire-rated wall.',
   'Hoare Lea', 'high', 'open', '2025-05-12', 'Mechanical', NOW());

-- Inspections
INSERT INTO inspections (
  id, organization_id, company_id, type, project_id, project, inspector,
  date, status, score, items, created_at
) VALUES
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1',
   '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002',
   'Structural — Column splice bolt inspection',
   '11111111-1111-1111-1111-111111111111', 'The Shard Phase 2 — Riverside Pavilion',
   'Sarah Whitmore (CSM Inspections)', '2025-05-06', 'passed', 98,
   '[{"item": "Bolt preload", "result": "Pass"}]'::jsonb,
   NOW());

-- Daily Reports
INSERT INTO daily_reports (
  id, organization_id, company_id, project_id, project, date, prepared_by,
  weather, temperature, workers_on_site, activities, materials, equipment,
  issues, progress, created_at
) VALUES
  ('ffffffff-ffff-ffff-ffff-fffffffffff1',
   '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002',
   '11111111-1111-1111-1111-111111111111', 'The Shard Phase 2 — Riverside Pavilion',
   '2025-05-09', 'Michael O''Brien',
   'Clear, 18°C, light WSW wind 8mph', '18°C', 47,
   '[{"trade": "Piling", "desc": "CFA bored piles Ch39-41 (3No. completed)"}]'::jsonb,
   '[{"item": "C40/50 concrete 20m3 (Hanson)"}]'::jsonb,
   '[{"equipment": "Bauer BG 28 piling rig"}]'::jsonb,
   '[{"issue": "Visitor walked through exclusion zone", "severity": "low"}]'::jsonb,
   42, NOW());

-- Change Orders
INSERT INTO change_orders (
  id, organization_id, company_id, number, project_id, project, title,
  description, amount, status, submitted_date, reason, schedule_impact, created_at
) VALUES
  ('22222222-2222-2222-2222-222222222222',
   '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002',
   'CO-2025-014', '11111111-1111-1111-1111-111111111111',
   'The Shard Phase 2 — Riverside Pavilion',
   'Additional dewatering wells (cofferdam extension)',
   '4No. additional deepwell pumps to maintain cofferdam drawdown during extended sheet pile installation in Zone C (poorly graded sand lens).',
   187500,
   'pending',
   '2025-05-10',
   'Unexpected sand lens from GI borehole BH-07 not fully characterised. Ground risk per JCT Schedule 2 para 2.13.',
   12, NOW());

COMMIT;
