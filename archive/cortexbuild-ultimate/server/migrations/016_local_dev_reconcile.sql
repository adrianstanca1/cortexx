-- Migration: 016_local_dev_reconcile
-- Purpose: make the repo SQL deterministic for local/dev by aligning tenant columns
-- and auth/profile columns across the domain tables used by the app.

ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS company TEXT NOT NULL DEFAULT 'CortexBuild Ltd';
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS avatar TEXT;
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE IF EXISTS audit_log ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS audit_log ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS email_logs ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS email_logs ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS scheduled_emails ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS scheduled_emails ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS email_preferences ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS email_preferences ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS email_templates ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS email_templates ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS custom_roles ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS custom_roles ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

DO $$
DECLARE
  tbl TEXT;
  tenant_tables TEXT[] := ARRAY[
    'projects',
    'invoices',
    'safety_incidents',
    'rfis',
    'change_orders',
    'team_members',
    'equipment',
    'subcontractors',
    'documents',
    'timesheets',
    'meetings',
    'materials',
    'punch_list',
    'inspections',
    'rams',
    'cis_returns',
    'tenders',
    'contacts',
    'risk_register',
    'purchase_orders',
    'daily_reports',
    'project_images',
    'project_tasks',
    'project_task_comments',
    'team_member_skills',
    'team_member_inductions',
    'team_member_availability',
    'equipment_service_logs',
    'equipment_hire_logs',
    'site_permits',
    'risk_mitigation_actions',
    'contact_interactions',
    'safety_permits',
    'toolbox_talks',
    'drawing_transmittals',
    'variations',
    'defects',
    'valuations',
    'specifications',
    'temp_works',
    'signage',
    'waste_management',
    'sustainability',
    'training',
    'certifications',
    'prequalification',
    'lettings',
    'measuring',
    'notifications',
    'ai_conversations'
  ];
BEGIN
  FOREACH tbl IN ARRAY tenant_tables LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL', tbl);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL', tbl);
  END LOOP;
END $$;

DO $$
DECLARE
  tbl TEXT;
  backfill_tables TEXT[] := ARRAY[
    'users',
    'projects',
    'invoices',
    'safety_incidents',
    'rfis',
    'change_orders',
    'team_members',
    'equipment',
    'subcontractors',
    'documents',
    'timesheets',
    'meetings',
    'materials',
    'punch_list',
    'inspections',
    'rams',
    'cis_returns',
    'tenders',
    'contacts',
    'risk_register',
    'purchase_orders',
    'daily_reports',
    'project_images',
    'project_tasks',
    'project_task_comments',
    'team_member_skills',
    'team_member_inductions',
    'team_member_availability',
    'equipment_service_logs',
    'equipment_hire_logs',
    'site_permits',
    'risk_mitigation_actions',
    'contact_interactions',
    'safety_permits',
    'toolbox_talks',
    'drawing_transmittals',
    'variations',
    'defects',
    'valuations',
    'specifications',
    'temp_works',
    'signage',
    'waste_management',
    'sustainability',
    'training',
    'certifications',
    'prequalification',
    'lettings',
    'measuring',
    'notifications',
    'ai_conversations',
    'audit_log',
    'email_logs',
    'scheduled_emails',
    'email_preferences',
    'email_templates',
    'custom_roles'
  ];
BEGIN
  FOREACH tbl IN ARRAY backfill_tables LOOP
    EXECUTE format(
      'UPDATE %I SET organization_id = COALESCE(organization_id, %L), company_id = COALESCE(company_id, %L)',
      tbl,
      '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000002'
    );
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_organization_id ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);
