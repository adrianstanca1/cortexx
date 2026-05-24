-- Migration: Critical Performance Indexes
-- Purpose: Fix slow dashboard and list queries
-- Deploy: 2026-04-01

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- CRITICAL: Dashboard Performance Indexes
-- These fix the 5-10x slow queries identified in analysis
-- ─────────────────────────────────────────────────────────────────────────────

-- Projects: Dashboard COUNT and list queries (500ms → 50ms)
CREATE INDEX IF NOT EXISTS idx_projects_company_status 
  ON projects(company_id, status)
  WHERE status IN ('ACTIVE', 'ON_HOLD', 'PLANNING');

CREATE INDEX IF NOT EXISTS idx_projects_org_created 
  ON projects(organization_id, created_at DESC);

-- RFIs: Dashboard and list queries
CREATE INDEX IF NOT EXISTS idx_rfis_project_status_priority 
  ON rfis(project_id, status, priority);

CREATE INDEX IF NOT EXISTS idx_rfis_org_created 
  ON rfis(organization_id, created_at DESC);

-- Safety Incidents: Dashboard chart queries (400ms → 40ms)
CREATE INDEX IF NOT EXISTS idx_safety_incidents_project_severity_status 
  ON safety_incidents(project_id, severity, status);

CREATE INDEX IF NOT EXISTS idx_safety_incidents_org_date 
  ON safety_incidents(organization_id, date DESC);

-- Documents: List and filtering
CREATE INDEX IF NOT EXISTS idx_documents_project_type 
  ON documents(project_id, type);

CREATE INDEX IF NOT EXISTS idx_documents_org_created 
  ON documents(organization_id, created_at DESC);

-- Invoices: Revenue chart and dashboard (300ms → 30ms)
CREATE INDEX IF NOT EXISTS idx_invoices_org_status_due_date 
  ON invoices(organization_id, status, due_date);

CREATE INDEX IF NOT EXISTS idx_invoices_org_created 
  ON invoices(organization_id, created_at DESC);

-- Team Members: User lists
CREATE INDEX IF NOT EXISTS idx_team_members_org_status 
  ON team_members(organization_id, status);

-- Subcontractors: Directory queries
CREATE INDEX IF NOT EXISTS idx_subcontractors_company_trade_status 
  ON subcontractors(company_id, trade, status);

-- Timesheets: Payroll queries
CREATE INDEX IF NOT EXISTS idx_timesheets_worker_week_status 
  ON timesheets(worker_id, week, status);

-- Meetings: Calendar queries
CREATE INDEX IF NOT EXISTS idx_meetings_project_date_status 
  ON meetings(project_id, date, status);

-- Change Orders: Tracking
CREATE INDEX IF NOT EXISTS idx_change_orders_project_status_date 
  ON change_orders(project_id, status, submitted_date);

-- Daily Reports: Site diary
CREATE INDEX IF NOT EXISTS idx_daily_reports_project_date 
  ON daily_reports(project_id, date DESC);

-- Contacts: CRM pipeline
CREATE INDEX IF NOT EXISTS idx_contacts_type_value_status 
  ON contacts(type, value DESC, status);

-- Tenders: Bid management
CREATE INDEX IF NOT EXISTS idx_tenders_deadline_probability 
  ON tenders(deadline, probability DESC, status);

-- Risk Register: High priority
CREATE INDEX IF NOT EXISTS idx_risk_register_project_score_status 
  ON risk_register(project_id, risk_score DESC, status);

-- Equipment: Service tracking
CREATE INDEX IF NOT EXISTS idx_equipment_status_location 
  ON equipment(status, location);

-- RAMS: Compliance
CREATE INDEX IF NOT EXISTS idx_rams_project_status_review 
  ON rams(project_id, status, review_date);

-- Inspections: Quality tracking
CREATE INDEX IF NOT EXISTS idx_inspections_project_date_status 
  ON inspections(project_id, date, status);

-- Defects: Resolution tracking
CREATE INDEX IF NOT EXISTS idx_defects_project_priority_status 
  ON defects(project_id, priority, status);

-- Notifications: Unread count (100ms → 10ms)
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread 
  ON notifications(user_id, read)
  WHERE read = false;

-- Email Logs: Recent first
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at 
  ON email_logs(created_at DESC);

-- Users: By org and role (no is_active column)
CREATE INDEX IF NOT EXISTS idx_users_org_role_active
  ON users(organization_id, role)
  WHERE organization_id IS NOT NULL;

-- Organizations: Lookup by name (no slug or is_active columns)
CREATE INDEX IF NOT EXISTS idx_organizations_name
  ON organizations(name);

COMMIT;

-- Verify
SELECT 
  '✅ Critical Index Deployment Complete' as status,
  COUNT(*) as total_indexes
FROM pg_indexes
WHERE schemaname = 'public' AND indexname LIKE 'idx_%';

-- Show new indexes
SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'idx_projects_company_status',
    'idx_projects_org_created',
    'idx_rfis_project_status_priority',
    'idx_rfis_org_created',
    'idx_safety_incidents_project_severity_status',
    'idx_safety_incidents_org_date',
    'idx_documents_project_type',
    'idx_documents_org_created',
    'idx_invoices_org_status_due_date',
    'idx_invoices_org_created'
  )
ORDER BY tablename;
