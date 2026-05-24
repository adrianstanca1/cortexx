-- Migration 026: Cost Management tables for budget tracking
-- Purpose: Track project budgets, cost codes, and budget vs actual analysis

CREATE TABLE IF NOT EXISTS cost_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES cost_codes(id) ON DELETE CASCADE,
  
  category TEXT CHECK (category IN ('labour', 'materials', 'equipment', 'subcontractors', 'overhead', 'contingency')),
  
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(company_id, code)
);

CREATE INDEX IF NOT EXISTS idx_cost_codes_org_id ON cost_codes(organization_id);
CREATE INDEX IF NOT EXISTS idx_cost_codes_company_id ON cost_codes(company_id);
CREATE INDEX IF NOT EXISTS idx_cost_codes_parent_id ON cost_codes(parent_id);
CREATE INDEX IF NOT EXISTS idx_cost_codes_category ON cost_codes(category);

-- Budget items table
CREATE TABLE IF NOT EXISTS budget_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  
  cost_code_id UUID REFERENCES cost_codes(id) ON DELETE SET NULL,
  
  name TEXT NOT NULL,
  description TEXT,
  
  budgeted DECIMAL(15,2) NOT NULL DEFAULT 0,
  spent DECIMAL(15,2) NOT NULL DEFAULT 0,
  committed DECIMAL(15,2) NOT NULL DEFAULT 0,
  remaining DECIMAL(15,2) GENERATED ALWAYS AS (budgeted - spent - committed) STORED,
  
  variance DECIMAL(15,2) GENERATED ALWAYS AS (budgeted - spent) STORED,
  variance_percent DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE 
      WHEN budgeted = 0 THEN 0
      ELSE ((budgeted - spent) / budgeted * 100)
    END
  ) STORED,
  
  status TEXT DEFAULT 'on-track' CHECK (status IN ('on-track', 'at-risk', 'over-budget')),
  
  start_date DATE,
  end_date DATE,
  
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_budget_items_org_id ON budget_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_budget_items_company_id ON budget_items(company_id);
CREATE INDEX IF NOT EXISTS idx_budget_items_project_id ON budget_items(project_id);
CREATE INDEX IF NOT EXISTS idx_budget_items_cost_code_id ON budget_items(cost_code_id);
CREATE INDEX IF NOT EXISTS idx_budget_items_status ON budget_items(status);

-- Cost forecasts table
CREATE TABLE IF NOT EXISTS cost_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  projected_cost DECIMAL(15,2) NOT NULL DEFAULT 0,
  actual_cost DECIMAL(15,2) DEFAULT 0,
  cumulative_cost DECIMAL(15,2) NOT NULL DEFAULT 0,
  
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(project_id, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_cost_forecasts_org_id ON cost_forecasts(organization_id);
CREATE INDEX IF NOT EXISTS idx_cost_forecasts_project_id ON cost_forecasts(project_id);

-- Add sample cost codes (standard construction cost codes)
INSERT INTO cost_codes (organization_id, company_id, code, name, category, description)
SELECT 
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  code, name, category, desc
FROM (VALUES
  ('00-0000', 'General Conditions', 'overhead', 'Project general conditions and mobilization'),
  ('01-0000', 'Sitework', 'labour', 'Site preparation and excavation'),
  ('02-0000', 'Concrete', 'materials', 'Concrete work and foundations'),
  ('03-0000', 'Masonry', 'materials', 'Masonry and brickwork'),
  ('04-0000', 'Metals', 'materials', 'Structural steel and metals'),
  ('05-0000', 'Wood & Plastics', 'materials', 'Carpentry and framing'),
  ('06-0000', 'Thermal & Moisture', 'materials', 'Insulation and waterproofing'),
  ('07-0000', 'Doors & Windows', 'materials', 'Doors, windows, and glazing'),
  ('08-0000', 'Finishes', 'labour', 'Interior finishes and trim'),
  ('09-0000', 'Specialties', 'materials', 'Special construction items'),
  ('10-0000', 'Mechanical', 'subcontractors', 'HVAC and plumbing'),
  ('11-0000', 'Electrical', 'subcontractors', 'Electrical systems'),
  ('12-0000', 'Equipment', 'equipment', 'Special equipment'),
  ('13-0000', 'Furnishings', 'materials', 'Furniture and fixtures'),
  ('14-0000', 'Conveying Systems', 'subcontractors', 'Elevators and lifts')
) AS t(code, name, category, desc)
ON CONFLICT (company_id, code) DO NOTHING;

-- Add sample budget data
INSERT INTO budget_items (organization_id, company_id, project_id, cost_code_id, name, description, budgeted, spent, committed, status)
SELECT 
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  (SELECT id FROM projects LIMIT 1),
  cc.id,
  name,
  desc,
  budgeted,
  spent,
  committed,
  status
FROM (VALUES
  ('Labour', 'Site workforce & subcontractors', 1250000, 875000, 125000, 'at-risk'),
  ('Materials', 'Concrete, steel, finishes', 850000, 620000, 85000, 'on-track'),
  ('Plant & Equipment', 'Crane hire, excavators, tools', 320000, 285000, 45000, 'over-budget'),
  ('Professional Services', 'Architects, engineers, consultants', 180000, 145000, 20000, 'on-track')
) AS t(name, desc, budgeted, spent, committed, status),
LATERAL (
  SELECT id FROM cost_codes 
  WHERE company_id = '00000000-0000-0000-0000-000000000002' 
  AND category = CASE 
    WHEN t.name = 'Labour' THEN 'labour'
    WHEN t.name = 'Materials' THEN 'materials'
    WHEN t.name = 'Plant & Equipment' THEN 'equipment'
    ELSE 'overhead'
  END
  LIMIT 1
) cc
ON CONFLICT DO NOTHING;

-- Add sample forecast data
INSERT INTO cost_forecasts (organization_id, company_id, project_id, period_start, period_end, projected_cost, actual_cost, cumulative_cost)
SELECT 
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  (SELECT id FROM projects LIMIT 1),
  period_start,
  period_end,
  projected,
  actual,
  cumulative
FROM (VALUES
  ('2026-01-01', '2026-01-31', 450000, 465000, 465000),
  ('2026-02-01', '2026-02-28', 380000, 395000, 860000),
  ('2026-03-01', '2026-03-31', 520000, 485000, 1345000),
  ('2026-04-01', '2026-04-30', 425000, NULL, 1770000),
  ('2026-05-01', '2026-05-31', 380000, NULL, 2150000),
  ('2026-06-01', '2026-06-30', 450000, NULL, 2600000)
) AS t(period_start, period_end, projected, actual, cumulative)
ON CONFLICT DO NOTHING;
