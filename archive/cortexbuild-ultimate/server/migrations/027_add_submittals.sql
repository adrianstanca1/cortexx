-- Migration 027: Submittal Management tables
-- Purpose: Manage submittal workflow for shop drawings, product data, samples

CREATE TABLE IF NOT EXISTS submittals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  
  submittal_number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  
  type TEXT NOT NULL CHECK (type IN ('Shop Drawing', 'Product Data', 'Sample', 'Certificate', 'Test Report', 'Mockup', 'Manufacturer Instructions')),
  
  trade TEXT,
  
  submitted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  submitted_by_company TEXT,
  
  reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewer_name TEXT,
  
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'under-review', 'approved', 'approved-with-comments', 'rejected', 'resubmit-required', 'cancelled')),
  
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  
  submitted_date TIMESTAMPTZ DEFAULT NOW(),
  due_date TIMESTAMPTZ,
  reviewed_date TIMESTAMPTZ,
  
  revision_number INTEGER DEFAULT 1,
  parent_submittal_id UUID REFERENCES submittals(id) ON DELETE SET NULL,
  
  response_notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_submittals_org_id ON submittals(organization_id);
CREATE INDEX IF NOT EXISTS idx_submittals_company_id ON submittals(company_id);
CREATE INDEX IF NOT EXISTS idx_submittals_project_id ON submittals(project_id);
CREATE INDEX IF NOT EXISTS idx_submittals_status ON submittals(status);
CREATE INDEX IF NOT EXISTS idx_submittals_priority ON submittals(priority);
CREATE INDEX IF NOT EXISTS idx_submittals_submitted_date ON submittals(submitted_date DESC);
CREATE INDEX IF NOT EXISTS idx_submittals_due_date ON submittals(due_date);

-- Submittal attachments/files
CREATE TABLE IF NOT EXISTS submittal_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submittal_id UUID REFERENCES submittals(id) ON DELETE CASCADE,
  
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  file_type TEXT,
  
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_submittal_attachments_submittal_id ON submittal_attachments(submittal_id);

-- Submittal comments/review thread
CREATE TABLE IF NOT EXISTS submittal_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submittal_id UUID REFERENCES submittals(id) ON DELETE CASCADE,
  
  author_id UUID REFERENCES users(id) ON DELETE SET NULL,
  author_name TEXT,
  
  comment TEXT NOT NULL,
  is_review_comment BOOLEAN DEFAULT false,
  requires_response BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_submittal_comments_submittal_id ON submittal_comments(submittal_id);
CREATE INDEX IF NOT EXISTS idx_submittal_comments_created ON submittal_comments(created_at DESC);

-- Add sample submittal data
INSERT INTO submittals (organization_id, company_id, project_id, submittal_number, title, type, submitted_by_company, reviewer_name, status, priority, description, trade, due_date, revision_number)
SELECT 
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  (SELECT id FROM projects LIMIT 1),
  number, title, type, submitted_by, reviewer, status, priority, desc, trade, due_date, revision
FROM (VALUES
  ('SUB-001', 'Structural Steel Shop Drawings', 'Shop Drawing', 'Steel Fabricators Ltd', 'James Wilson', 'under-review', 'high', 'Shop drawings for main structural steel frame, Level 1-3', 'Structural', '2026-04-05', 2),
  ('SUB-002', 'HVAC Equipment Product Data', 'Product Data', 'Climate Systems Inc', 'Sarah Mitchell', 'approved-with-comments', 'medium', 'Product data sheets for rooftop HVAC units', 'HVAC', '2026-04-02', 1),
  ('SUB-003', 'Curtain Wall System Sample', 'Sample', 'Glazing Solutions Ltd', 'Michael Chen', 'pending', 'critical', 'Physical sample of curtain wall glazing system', 'Exterior', '2026-04-10', 1),
  ('SUB-004', 'Fire Safety Test Report', 'Test Report', 'Fire Protection Co', 'David Brown', 'approved', 'high', 'Fire resistance test report for structural elements', 'Fire Safety', '2026-03-30', 1)
) AS t(number, title, type, submitted_by, reviewer, status, priority, desc, trade, due_date, revision)
ON CONFLICT DO NOTHING;
