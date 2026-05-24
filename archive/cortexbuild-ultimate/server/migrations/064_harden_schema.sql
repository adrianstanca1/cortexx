
-- Migration: Schema Hardening
-- Purpose: Add missing updated_at triggers and standard audit indexes

BEGIN;

-- 1. Standardized updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 2. Apply to core tables if trigger missing
DO $$ 
DECLARE
    t text;
BEGIN
    FOR t IN 
        SELECT table_name 
        FROM information_schema.columns 
        WHERE column_name = 'updated_at' 
        AND table_schema = 'public'
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS update_%I_updated_at ON %I', t, t);
        EXECUTE format('CREATE TRIGGER update_%I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', t, t);
    END LOOP;
END $$;

-- 3. Hardening Indexes (Composite)
-- Protect against slow lookups on foreign keys without indexes
CREATE INDEX IF NOT EXISTS idx_fkey_organization_id ON projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_fkey_project_id ON rfis(project_id);

COMMIT;
