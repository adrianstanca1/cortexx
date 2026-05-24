-- Enhancement: Add project linkage, description, issued_to, renewal_date, and other fields to site_permits.
-- Also add a permit_inspections junction table linking safety_permits ↔ inspections.

DO $$
BEGIN
    -- Add missing columns to site_permits if not present
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='site_permits' AND column_name='permit_number') THEN
        ALTER TABLE site_permits ADD COLUMN permit_number TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='site_permits' AND column_name='description') THEN
        ALTER TABLE site_permits ADD COLUMN description TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='site_permits' AND column_name='project_id') THEN
        ALTER TABLE site_permits ADD COLUMN project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='site_permits' AND column_name='issued_to') THEN
        ALTER TABLE site_permits ADD COLUMN issued_to TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='site_permits' AND column_name='renewal_date') THEN
        ALTER TABLE site_permits ADD COLUMN renewal_date DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='site_permits' AND column_name='updated_at') THEN
        ALTER TABLE site_permits ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='site_permits' AND column_name='document_id') THEN
        ALTER TABLE site_permits ADD COLUMN document_id UUID REFERENCES documents(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Index on project_id for joins
CREATE INDEX IF NOT EXISTS idx_site_permits_project_id ON site_permits(project_id);
CREATE INDEX IF NOT EXISTS idx_site_permits_status ON site_permits(status);
CREATE INDEX IF NOT EXISTS idx_site_permits_dates ON site_permits(from_date, to_date);

-- Permit inspections junction
CREATE TABLE IF NOT EXISTS permit_inspections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    permit_id UUID NOT NULL REFERENCES site_permits(id) ON DELETE CASCADE,
    inspection_id UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_permit_inspections_permit ON permit_inspections(permit_id);
CREATE INDEX IF NOT EXISTS idx_permit_inspections_inspection ON permit_inspections(inspection_id);

-- Permit history/renewal log
CREATE TABLE IF NOT EXISTS permit_renewals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    permit_id UUID NOT NULL REFERENCES site_permits(id) ON DELETE CASCADE,
    previous_end_date DATE,
    new_end_date DATE NOT NULL,
    previous_status TEXT,
    new_status TEXT NOT NULL,
    renewed_by TEXT,
    notes TEXT,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_permit_renewals_permit ON permit_renewals(permit_id);
