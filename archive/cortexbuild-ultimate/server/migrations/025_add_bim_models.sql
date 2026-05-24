-- Migration 025: BIM Models table for 3D model storage
-- Purpose: Store BIM/IFC models with versioning and clash detection

CREATE TABLE IF NOT EXISTS bim_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  description TEXT,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  
  format TEXT NOT NULL CHECK (format IN ('IFC', 'OBJ', 'GLTF', 'FBX', 'RVT')),
  version TEXT DEFAULT 'v1.0',
  
  status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'ready', 'error', 'archived')),
  
  elements_count INTEGER DEFAULT 0,
  floors_count INTEGER DEFAULT 0,
  
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  processed_at TIMESTAMPTZ,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_bim_models_org_id ON bim_models(organization_id);
CREATE INDEX IF NOT EXISTS idx_bim_models_company_id ON bim_models(company_id);
CREATE INDEX IF NOT EXISTS idx_bim_models_project_id ON bim_models(project_id);
CREATE INDEX IF NOT EXISTS idx_bim_models_status ON bim_models(status);
CREATE INDEX IF NOT EXISTS idx_bim_models_created_at ON bim_models(created_at DESC);

-- Clash detection results table
CREATE TABLE IF NOT EXISTS bim_clashes_detections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  model_id UUID REFERENCES bim_models(id) ON DELETE CASCADE,
  
  clash_type TEXT NOT NULL CHECK (clash_type IN ('hard', 'soft', 'clearance')),
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'major', 'minor')),
  
  element_a_id TEXT,
  element_b_id TEXT,
  element_a_name TEXT,
  element_b_name TEXT,
  
  location_x DECIMAL(10,3),
  location_y DECIMAL(10,3),
  location_z DECIMAL(10,3),
  
  description TEXT,
  screenshot_path TEXT,
  
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'ignored', 'false_positive')),
  
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bim_clashes_org_id ON bim_clashes_detections(organization_id);
CREATE INDEX IF NOT EXISTS idx_bim_clashes_model_id ON bim_clashes_detections(model_id);
CREATE INDEX IF NOT EXISTS idx_bim_clashes_status ON bim_clashes_detections(status);
CREATE INDEX IF NOT EXISTS idx_bim_clashes_severity ON bim_clashes_detections(severity);

-- Model layers/elements table for layer visibility controls
CREATE TABLE IF NOT EXISTS bim_model_layers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID REFERENCES bim_models(id) ON DELETE CASCADE,
  
  layer_name TEXT NOT NULL,
  layer_type TEXT,
  element_count INTEGER DEFAULT 0,
  
  is_visible BOOLEAN DEFAULT true,
  color_hex TEXT,
  
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(model_id, layer_name)
);

CREATE INDEX IF NOT EXISTS idx_bim_layers_model_id ON bim_model_layers(model_id);

-- Add sample data for testing
INSERT INTO bim_models (id, organization_id, company_id, name, file_name, file_path, file_size, format, version, status, elements_count, floors_count)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  'Main Building Structure',
  'main-building.ifc',
  '/uploads/bim/main-building.ifc',
  25600000,
  'IFC',
  'v2.1',
  'ready',
  12450,
  5
) ON CONFLICT (id) DO NOTHING;

INSERT INTO bim_clashes_detections (id, organization_id, model_id, clash_type, severity, element_a_name, element_b_name, location_x, location_y, location_z, description, status)
VALUES 
(
  '22222222-2222-2222-2222-222222222222',
  '00000000-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111',
  'hard',
  'critical',
  'HVAC_Duct_001',
  'Structural_Beam_045',
  125.5,
  45.2,
  12.8,
  'HVAC duct intersects with structural beam',
  'open'
),
(
  '33333333-3333-3333-3333-333333333333',
  '00000000-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111',
  'clearance',
  'major',
  'Electrical_Conduit_023',
  'HVAC_Duct_007',
  89.1,
  23.7,
  8.4,
  'Insufficient clearance between conduit and ductwork',
  'open'
) ON CONFLICT (id) DO NOTHING;
