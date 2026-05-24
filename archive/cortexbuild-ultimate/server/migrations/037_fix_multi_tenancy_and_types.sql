-- Migration 0006: Fix Multi-Tenancy and Type Issues
-- Run: psql "$DATABASE_URL" -f server/migrations/0006_fix_multi_tenancy_and_types.sql

-- Fix work_packages: organization_id should reference organizations, add company_id
DO $$
BEGIN
    -- Drop the incorrect foreign key constraint
    ALTER TABLE work_packages DROP CONSTRAINT IF EXISTS work_packages_organization_id_fkey;

    -- Change organization_id to reference organizations instead of users
    ALTER TABLE work_packages
        ALTER COLUMN organization_id TYPE UUID USING organization_id::UUID,
        ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

    -- Add missing indexes
    CREATE INDEX IF NOT EXISTS idx_work_packages_organization ON work_packages(organization_id);
    CREATE INDEX IF NOT EXISTS idx_work_packages_company ON work_packages(company_id);
END $$;

-- Fix tasks table: add multi-tenancy columns
DO $$
BEGIN
    ALTER TABLE tasks
        ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

    -- Convert TIMESTAMP to TIMESTAMPTZ
    ALTER TABLE tasks
        ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at::TIMESTAMPTZ,
        ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at::TIMESTAMPTZ;
END $$;

CREATE INDEX IF NOT EXISTS idx_tasks_organization ON tasks(organization_id);
CREATE INDEX IF NOT EXISTS idx_tasks_company ON tasks(company_id);

-- Fix equipment_service_logs: convert SERIAL to UUID, fix types
CREATE TABLE IF NOT EXISTS equipment_service_logs_new (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipment_id UUID REFERENCES equipment(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    type TEXT NOT NULL,
    technician TEXT,
    notes TEXT,
    next_due DATE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Copy data if table exists and has data
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'equipment_service_logs') THEN
        INSERT INTO equipment_service_logs_new (equipment_id, date, type, technician, notes, next_due, organization_id, company_id, created_at)
        SELECT equipment_id, date, type, technician, notes, next_due, organization_id, company_id, created_at
        FROM equipment_service_logs;

        DROP TABLE equipment_service_logs;

        ALTER TABLE equipment_service_logs_new RENAME TO equipment_service_logs;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_equip_service_logs_equipment ON equipment_service_logs(equipment_id);
CREATE INDEX IF NOT EXISTS idx_equip_service_logs_organization ON equipment_service_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_equip_service_logs_company ON equipment_service_logs(company_id);

-- Fix equipment_hire_logs: convert SERIAL to UUID
CREATE TABLE IF NOT EXISTS equipment_hire_logs_new (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipment_id UUID REFERENCES equipment(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    company TEXT,
    daily_rate NUMERIC(10,2),
    start_date DATE,
    end_date DATE,
    project TEXT,
    status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Completed', 'Cancelled')),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'equipment_hire_logs') THEN
        INSERT INTO equipment_hire_logs_new (equipment_id, name, company, daily_rate, start_date, end_date, project, status, organization_id, company_id, created_at)
        SELECT equipment_id, name, company, daily_rate, start_date, end_date, project, status, organization_id, company_id, created_at
        FROM equipment_hire_logs;

        DROP TABLE equipment_hire_logs;

        ALTER TABLE equipment_hire_logs_new RENAME TO equipment_hire_logs;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_equip_hire_logs_equipment ON equipment_hire_logs(equipment_id);
CREATE INDEX IF NOT EXISTS idx_equip_hire_logs_organization ON equipment_hire_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_equip_hire_logs_company ON equipment_hire_logs(company_id);

-- Fix site_permits: convert SERIAL to UUID
CREATE TABLE IF NOT EXISTS site_permits_new (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL,
    site TEXT NOT NULL,
    issued_by TEXT,
    from_date DATE NOT NULL,
    to_date DATE NOT NULL,
    status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Expired', 'Cancelled')),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'site_permits') THEN
        INSERT INTO site_permits_new (type, site, issued_by, from_date, to_date, status, organization_id, company_id, created_at)
        SELECT type, site, issued_by, from_date, to_date, status, organization_id, company_id, created_at
        FROM site_permits;

        DROP TABLE site_permits;

        ALTER TABLE site_permits_new RENAME TO site_permits;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_site_permits_organization ON site_permits(organization_id);
CREATE INDEX IF NOT EXISTS idx_site_permits_company ON site_permits(company_id);
