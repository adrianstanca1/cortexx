-- Migration 024: Add company settings columns to companies table
-- Purpose: Store company-level settings (CIS, VAT, UTR, address, etc.)

ALTER TABLE companies
ADD COLUMN IF NOT EXISTS registered_address TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'UK',
ADD COLUMN IF NOT EXISTS postal_code TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS website TEXT,
ADD COLUMN IF NOT EXISTS companies_house_number TEXT,
ADD COLUMN IF NOT EXISTS vat_number TEXT,
ADD COLUMN IF NOT EXISTS utr_number TEXT,
ADD COLUMN IF NOT EXISTS hmrc_office TEXT,
ADD COLUMN IF NOT EXISTS cis_contractor BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS cis_subcontractor BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS insurance_expiry DATE,
ADD COLUMN IF NOT EXISTS tax_reference TEXT;

-- Add index for organization_id lookups
CREATE INDEX IF NOT EXISTS idx_companies_organization_id ON companies(organization_id);

-- Update existing default company with placeholder data
UPDATE companies 
SET 
  name = 'CortexBuild Ltd',
  registered_address = '14 Irongate House, Cannon Street',
  city = 'London',
  postal_code = 'EC4N 6AP',
  country = 'UK',
  phone = '+44 20 7946 0958',
  email = 'admin@cortexbuild.co.uk',
  website = 'www.cortexbuild.co.uk',
  companies_house_number = '12345678',
  vat_number = 'GB123456789',
  utr_number = '1234567890',
  hmrc_office = 'London',
  cis_contractor = true,
  cis_subcontractor = false
WHERE id = '00000000-0000-0000-0000-000000000002';
