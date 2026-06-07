-- Cortexx — demo seed data
-- One workspace + login + the same projects/invoices the frontend ships with,
-- so a fresh DB is immediately explorable. Idempotent-ish: safe to run once
-- after schema.sql on an empty database.

-- Demo workspace
INSERT INTO workspaces(id, name, company, plan)
VALUES ('00000000-0000-0000-0000-000000000001', 'CortexBuild Ltd', 'CortexBuild Ltd', 'pro')
ON CONFLICT (id) DO NOTHING;

-- Demo login — email: demo@cortexbuild.app  password: demo1234
-- bcrypt hash of 'demo1234' (cost 10)
INSERT INTO users(id, workspace_id, name, email, password_hash, role, cscs, safety_score)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'Adrian Stanca', 'demo@cortexbuild.app',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  'director', 'Gold', 92
) ON CONFLICT (id) DO NOTHING;

-- Projects
INSERT INTO projects(id, workspace_id, name, client, value, pct, status, addr, due) VALUES
  ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000001','Camden Mews Refurb','J. Patterson',185000,68,'active','Camden, NW1','2026-06-19'),
  ('00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-000000000001','Hackney Loft Conversion','Eve & Mark Lin',42000,22,'active','Hackney, E8','2026-07-17'),
  ('00000000-0000-0000-0000-0000000000a3','00000000-0000-0000-0000-000000000001','Brixton Shopfront','Tonic Café Ltd',28000,90,'snagging','Brixton, SW9','2026-05-27'),
  ('00000000-0000-0000-0000-0000000000a4','00000000-0000-0000-0000-000000000001','Islington Extension','B. Khoury',96000,0,'quoting','Islington, N1',NULL),
  ('00000000-0000-0000-0000-0000000000a5','00000000-0000-0000-0000-000000000001','Streatham Reroof','Park Towers Mgmt',64000,100,'complete','Streatham, SW16','2026-03-30')
ON CONFLICT (id) DO NOTHING;

-- Invoices
INSERT INTO invoices(id, workspace_id, project_id, client, amount, status, issued, due) VALUES
  ('INV-2038','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a1','J. Patterson',37000,'paid','2026-04-02','2026-04-16'),
  ('INV-2040','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a1','J. Patterson',55000,'paid','2026-04-28','2026-05-12'),
  ('INV-2042','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a1','J. Patterson',8420,'due','2026-05-18','2026-06-01'),
  ('INV-2039','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a3','Tonic Café Ltd',3890,'overdue','2026-05-01','2026-05-08'),
  ('INV-2041','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a2','Eve & Mark Lin',1900,'due','2026-05-15','2026-06-03')
ON CONFLICT (id) DO NOTHING;

-- Receipts (lighter records live in documents_store)
INSERT INTO documents_store(workspace_id, collection, doc_id, data) VALUES
  ('00000000-0000-0000-0000-000000000001','receipts','1','{"id":1,"vendor":"Travis Perkins","amount":342.18,"date":"2026-05-21","category":"materials","projectId":"00000000-0000-0000-0000-0000000000a1","assigned":true}'),
  ('00000000-0000-0000-0000-000000000001','receipts','2','{"id":2,"vendor":"Selco","amount":89.40,"date":"2026-05-21","category":"materials","projectId":null,"assigned":false}'),
  ('00000000-0000-0000-0000-000000000001','receipts','3','{"id":3,"vendor":"B&Q","amount":24.50,"date":"2026-05-20","category":"consumables","projectId":null,"assigned":false}')
ON CONFLICT (workspace_id, collection, doc_id) DO NOTHING;

-- A live share token for the Brixton project (try: GET /api/portal/demo-brixton)
INSERT INTO portal_tokens(token, workspace_id, project_id) VALUES
  ('demo-brixton','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a3')
ON CONFLICT (token) DO NOTHING;
