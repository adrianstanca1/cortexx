-- Migration: 056_consolidated_schema
-- Purpose: Create all missing tables and columns that earlier migrations
--          reference but fail to create due to transaction rollback ordering.
--          This makes the migration chain idempotent for clean rebuilds.
-- Run: After migrations 000-055, or standalone on a fresh database.

-- Missing tables that some migrations reference
CREATE TABLE IF NOT EXISTS invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'project_manager',
  status TEXT NOT NULL DEFAULT 'pending',
  token TEXT UNIQUE,
  invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS progress_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID,
  company_id UUID,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  claim_date DATE,
  claimed_amount DECIMAL(12,2),
  approved_amount DECIMAL(12,2),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quality_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID,
  company_id UUID,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  scheduled_date DATE,
  completed_date DATE,
  description TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS weather_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID,
  company_id UUID,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  temperature DECIMAL(5,2),
  conditions TEXT,
  wind_speed DECIMAL(5,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID,
  company_id UUID,
  name TEXT NOT NULL,
  description TEXT,
  trigger JSONB,
  nodes JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add missing columns that some migrations reference
ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS industry TEXT DEFAULT 'Construction';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'ENTERPRISE';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Add missing columns to projects that some ALTERs reference
ALTER TABLE projects ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add missing columns to various tables
ALTER TABLE companies ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Create indexes that reference the now-existing tables/columns
CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_org_role ON users(organization_id, role) WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_company_role ON users(company_id, role) WHERE company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_organizations_name ON organizations(name);

-- Add user email unique index (needed for seed ON CONFLICT)
CREATE UNIQUE INDEX IF NOT EXISTS users_email_key ON users(email);

-- Add migration_log table for tracking
CREATE TABLE IF NOT EXISTS migration_log (
  id SERIAL PRIMARY KEY,
  migration_name TEXT NOT NULL,
  applied_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed the demo organization and company (idempotent)
INSERT INTO organizations (id, name, description)
VALUES ('00000000-0000-0000-0000-000000000001', 'CortexBuild Demo Org', 'Default local development organization')
ON CONFLICT (id) DO NOTHING;

INSERT INTO companies (id, organization_id, name, country)
VALUES ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'CortexBuild Ltd', 'UK')
ON CONFLICT (id) DO NOTHING;
