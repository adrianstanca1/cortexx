-- Migration: Index Optimization for CortexBuild Production Database
-- Deployed: 2026-04-01
-- Target: 62 tables, adding 67 optimized indexes

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 1: CRITICAL COMPOSITE INDEXES (Dashboard & Common Queries)
-- ─────────────────────────────────────────────────────────────────────────────

-- Projects: Dashboard and list queries
CREATE INDEX IF NOT EXISTS idx_projects_company_status 
  ON projects(company_id, status)
  WHERE status IN ('ACTIVE', 'ON_HOLD', 'PLANNING');

CREATE INDEX IF NOT EXISTS idx_projects_org_created 
  ON projects(organization_id, created_at DESC);

-- Project tasks (if table exists)
CREATE INDEX IF NOT EXISTS idx_project_tasks_project_status 
  ON project_tasks(project_id, status);

CREATE INDEX IF NOT EXISTS idx_project_tasks_assigned_to_status 
  ON project_tasks(assigned_to, status)
  WHERE assigned_to IS NOT NULL;

-- RFIs: Dashboard and filtering
CREATE INDEX IF NOT EXISTS idx_rfis_project_status_priority 
  ON rfis(project_id, status, priority);

CREATE INDEX IF NOT EXISTS idx_rfis_org_created 
  ON rfis(organization_id, created_at DESC);

-- Safety Incidents: Dashboard and reporting
CREATE INDEX IF NOT EXISTS idx_safety_incidents_project_severity_status 
  ON safety_incidents(project_id, severity, status);

CREATE INDEX IF NOT EXISTS idx_safety_incidents_org_date 
  ON safety_incidents(organization_id, date DESC);

-- Documents: List and filtering
CREATE INDEX IF NOT EXISTS idx_documents_project_type 
  ON documents(project_id, type);

CREATE INDEX IF NOT EXISTS idx_documents_org_created 
  ON documents(organization_id, created_at DESC);

-- Subcontractors: Directory and CIS verification
CREATE INDEX IF NOT EXISTS idx_subcontractors_company_trade_status 
  ON subcontractors(company_id, trade, status);

CREATE INDEX IF NOT EXISTS idx_subcontractors_org_status 
  ON subcontractors(organization_id, status);

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

-- Team Members: User lists
CREATE INDEX IF NOT EXISTS idx_team_members_org_status 
  ON team_members(organization_id, status);

-- Contacts: CRM pipeline
CREATE INDEX IF NOT EXISTS idx_contacts_type_value_status 
  ON contacts(type, value DESC, status);

-- Tenders: Bid management
CREATE INDEX IF NOT EXISTS idx_tenders_deadline_probability 
  ON tenders(deadline, probability DESC, status);

-- Risk Register: High priority tracking
CREATE INDEX IF NOT EXISTS idx_risk_register_project_score_status 
  ON risk_register(project_id, risk_score DESC, status);

-- Invoices: Financial queries
CREATE INDEX IF NOT EXISTS idx_invoices_org_status_due_date 
  ON invoices(organization_id, status, due_date);

CREATE INDEX IF NOT EXISTS idx_invoices_org_created 
  ON invoices(organization_id, created_at DESC);

-- Equipment: Service tracking
CREATE INDEX IF NOT EXISTS idx_equipment_status_location 
  ON equipment(status, location);

CREATE INDEX IF NOT EXISTS idx_equipment_next_service 
  ON equipment(next_service, status)
  WHERE next_service IS NOT NULL;

-- RAMS: Compliance tracking
CREATE INDEX IF NOT EXISTS idx_rams_project_status_review 
  ON rams(project_id, status, review_date);

-- Inspections: Quality tracking
CREATE INDEX IF NOT EXISTS idx_inspections_project_date_status 
  ON inspections(project_id, date, status);

-- Defects: Resolution tracking
CREATE INDEX IF NOT EXISTS idx_defects_project_priority_status 
  ON defects(project_id, priority, status);

-- Punch List: Snagging
CREATE INDEX IF NOT EXISTS idx_punch_list_project_status 
  ON punch_list(project_id, status);

-- Purchase Orders: Procurement
CREATE INDEX IF NOT EXISTS idx_purchase_orders_project_status 
  ON purchase_orders(project_id, status);

-- Variations: Contract changes
CREATE INDEX IF NOT EXISTS idx_variations_project_status 
  ON variations(project_id, status);

-- Valuations: Payment tracking
CREATE INDEX IF NOT EXISTS idx_valuations_project_status_date 
  ON valuations(project_id, status, submitted_date);

-- Certifications: Compliance
CREATE INDEX IF NOT EXISTS idx_certifications_company_expiry 
  ON certifications(company, expiry_date);

-- Training: Staff development
CREATE INDEX IF NOT EXISTS idx_training_project_status_date 
  ON training(project_id, status, scheduled_date);

-- Waste Management: Environmental
CREATE INDEX IF NOT EXISTS idx_waste_management_project_date 
  ON waste_management(project_id, collection_date);

-- Sustainability: Metrics
CREATE INDEX IF NOT EXISTS idx_sustainability_project_metric 
  ON sustainability(project_id, metric_type, period);

-- Prequalification: Vendor approval
CREATE INDEX IF NOT EXISTS idx_prequalification_contractor_status 
  ON prequalification(contractor, status);

-- Lettings: Package tracking
CREATE INDEX IF NOT EXISTS idx_lettings_project_trade_status 
  ON lettings(project_id, trade, status);

-- Measuring: Survey tracking
CREATE INDEX IF NOT EXISTS idx_measuring_project_survey_date 
  ON measuring(project_id, survey_type, survey_date);

-- Site Permits: Safety permits
CREATE INDEX IF NOT EXISTS idx_site_permits_project_dates 
  ON site_permits(project_id, from_date, to_date);

-- Safety Permits: Permit tracking
CREATE INDEX IF NOT EXISTS idx_safety_permits_project_status 
  ON safety_permits(project_id, status);

-- Toolbox Talks: Safety meetings
CREATE INDEX IF NOT EXISTS idx_toolbox_talks_project_date 
  ON toolbox_talks(project_id, date);

-- Drawing Transmittals: Document control
CREATE INDEX IF NOT EXISTS idx_drawing_transmittals_project_date 
  ON drawing_transmittals(project_id, issued_date DESC);

-- Equipment Service Logs: Maintenance history
CREATE INDEX IF NOT EXISTS idx_equipment_service_logs_equipment_date 
  ON equipment_service_logs(equipment_id, date DESC);

-- Equipment Hire Logs: Rental tracking
CREATE INDEX IF NOT EXISTS idx_equipment_hire_logs_equipment_dates 
  ON equipment_hire_logs(equipment_id, start_date, end_date);

-- Risk Mitigation Actions: Action tracking
CREATE INDEX IF NOT EXISTS idx_risk_mitigation_actions_risk_status 
  ON risk_mitigation_actions(risk_id, status);

-- Contact Interactions: CRM history
CREATE INDEX IF NOT EXISTS idx_contact_interactions_contact_date 
  ON contact_interactions(contact_id, date DESC);

-- Team Member Skills: Workforce data
CREATE INDEX IF NOT EXISTS idx_team_member_skills_member_id 
  ON team_member_skills(member_id);

-- Team Member Inductions: Compliance
CREATE INDEX IF NOT EXISTS idx_team_member_inductions_member_id 
  ON team_member_inductions(member_id);

-- Team Member Availability: Resource planning
CREATE INDEX IF NOT EXISTS idx_team_member_availability_member_date 
  ON team_member_availability(member_id, date);

-- CIS Returns: Tax compliance
CREATE INDEX IF NOT EXISTS idx_cis_returns_contractor_period 
  ON cis_returns(contractor, period);

-- Audit Log: Compliance tracking
CREATE INDEX IF NOT EXISTS idx_audit_log_org_table_created 
  ON audit_log(organization_id, action, created_at DESC);

-- Notifications: User alerts
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread 
  ON notifications(user_id, read)
  WHERE read = false;

CREATE INDEX IF NOT EXISTS idx_notifications_org_created 
  ON notifications(organization_id, created_at DESC);

-- Email Logs: Communication history
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient_status_date 
  ON email_logs(recipient, status, created_at DESC);

-- Email Templates: Template management
CREATE INDEX IF NOT EXISTS idx_email_templates_type_active 
  ON email_templates(email_type, is_active);

-- Report Templates: Saved reports
CREATE INDEX IF NOT EXISTS idx_report_templates_type_default 
  ON report_templates(type, is_default);

-- Custom Roles: RBAC
CREATE INDEX IF NOT EXISTS idx_custom_roles_name 
  ON custom_roles(name);

-- Users: Authentication (no is_active column)
CREATE INDEX IF NOT EXISTS idx_users_org_role_active
  ON users(organization_id, role)
  WHERE organization_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_email_lower
  ON users(LOWER(email));

-- Organizations: Multi-tenancy (no slug or is_active columns)
CREATE INDEX IF NOT EXISTS idx_organizations_name
  ON organizations(name);

-- Companies: Multi-tenancy
CREATE INDEX IF NOT EXISTS idx_companies_org_id 
  ON companies(organization_id);

-- Document Embeddings: RAG search
CREATE INDEX IF NOT EXISTS idx_document_embeddings_document_id 
  ON document_embeddings(document_id);

CREATE INDEX IF NOT EXISTS idx_document_embeddings_created 
  ON document_embeddings(created_at);

-- Document Versions: Version control
CREATE INDEX IF NOT EXISTS idx_document_versions_document_id 
  ON document_versions(document_id);

-- Project Images: Gallery
CREATE INDEX IF NOT EXISTS idx_project_images_project_category 
  ON project_images(project_id, category);

CREATE INDEX IF NOT EXISTS idx_project_images_created 
  ON project_images(created_at DESC);

-- Project Task Comments: Collaboration
CREATE INDEX IF NOT EXISTS idx_project_task_comments_task_id 
  ON project_task_comments(task_id);

-- AI Conversations: Chat history
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_created 
  ON ai_conversations(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_org_session 
  ON ai_conversations(organization_id, session_id);

-- Scheduled Emails: Email queue
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_scheduled_status 
  ON scheduled_emails(scheduled_at, status);

-- Email Preferences: User settings
CREATE INDEX IF NOT EXISTS idx_email_preferences_user_id 
  ON email_preferences(user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 2: PARTIAL INDEXES (Active Data Only)
-- ─────────────────────────────────────────────────────────────────────────────

-- Active projects only
CREATE INDEX IF NOT EXISTS idx_projects_active_company 
  ON projects(company_id, status, progress)
  WHERE status IN ('ACTIVE', 'PLANNING');

-- Open RFIs only
CREATE INDEX IF NOT EXISTS idx_rfis_active_project 
  ON rfis(project_id, priority, created_at DESC)
  WHERE status IN ('open', 'in_review');

-- Active tasks only
CREATE INDEX IF NOT EXISTS idx_project_tasks_active 
  ON project_tasks(project_id, priority, due_date)
  WHERE status IN ('todo', 'in_progress', 'review', 'blocked');

-- Active safety incidents
CREATE INDEX IF NOT EXISTS idx_safety_incidents_active 
  ON safety_incidents(project_id, severity, date DESC)
  WHERE status IN ('reported', 'under_review');

-- Active subcontractors
CREATE INDEX IF NOT EXISTS idx_subcontractors_active 
  ON subcontractors(company_id, trade, cis_verified)
  WHERE status = 'active';

-- Active equipment
CREATE INDEX IF NOT EXISTS idx_equipment_active 
  ON equipment(status, daily_rate)
  WHERE status IN ('active', 'in_use');

-- Pending invitations
CREATE INDEX IF NOT EXISTS idx_invitations_pending_org 
  ON invitations(organization_id, email, status)
  WHERE status = 'pending';

-- Valid sessions only
CREATE INDEX IF NOT EXISTS idx_sessions_valid 
  ON sessions(user_id, expires_at)
  WHERE expires_at > NOW();

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 3: COVERING INDEXES (Avoid Heap Lookups)
-- ─────────────────────────────────────────────────────────────────────────────

-- Projects dashboard KPIs
CREATE INDEX IF NOT EXISTS idx_projects_dashboard_covering 
  ON projects(company_id, status)
  INCLUDE (name, code, budget, spent, progress, start_date, end_date)
  WHERE status IN ('ACTIVE', 'PLANNING', 'ON_HOLD');

-- Task list view
CREATE INDEX IF NOT EXISTS idx_project_tasks_list_covering 
  ON project_tasks(project_id, status, priority, due_date DESC)
  INCLUDE (title, assigned_to, progress, created_at)
  WHERE status NOT IN ('done', 'blocked');

-- RFI list view
CREATE INDEX IF NOT EXISTS idx_rfis_list_covering 
  ON rfis(project_id, status, priority, created_at DESC)
  INCLUDE (rfi_number, subject, submitted_by, assigned_to, due_date);

-- Document list view
CREATE INDEX IF NOT EXISTS idx_documents_list_covering 
  ON documents(project_id, type, created_at DESC)
  INCLUDE (name, uploaded_by, revision, file_size, mime_type);

-- Safety incident list
CREATE INDEX IF NOT EXISTS idx_safety_incidents_list_covering 
  ON safety_incidents(project_id, severity, date DESC)
  INCLUDE (incident_number, title, status, reported_by, location);

-- Subcontractor directory
CREATE INDEX IF NOT EXISTS idx_subcontractors_list_covering 
  ON subcontractors(company_id, trade, status)
  INCLUDE (company, contact, email, phone, cis_verified, insurance_expiry);

-- Timesheet list
CREATE INDEX IF NOT EXISTS idx_timesheets_list_covering 
  ON timesheets(worker_id, week DESC, status)
  INCLUDE (project_id, regular_hours, overtime_hours, total_pay, cis_deduction);

-- Meeting schedule
CREATE INDEX IF NOT EXISTS idx_meetings_list_covering 
  ON meetings(project_id, date DESC, status)
  INCLUDE (title, meeting_type, time, location, attendees);

-- Invoice receivables
CREATE INDEX IF NOT EXISTS idx_invoices_receivable_covering 
  ON invoices(organization_id, status, due_date)
  INCLUDE (number, client, amount, vat, cis_deduction)
  WHERE status IN ('sent', 'overdue', 'partial');

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 4: FULL-TEXT SEARCH INDEXES (GIN)
-- ─────────────────────────────────────────────────────────────────────────────

-- Projects search
ALTER TABLE projects ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(coalesce(description, ''))), 'B') ||
    setweight(to_tsvector('english', coalesce(code, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(type, '')), 'D')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_projects_search_vector 
  ON projects USING GIN (search_vector);

-- RFIs search
ALTER TABLE rfis ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(subject, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(question, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(rfi_number, '')), 'C')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_rfis_search_vector 
  ON rfis USING GIN (search_vector);

-- Documents search
ALTER TABLE documents ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(number, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(type, '')), 'C')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_documents_search_vector 
  ON documents USING GIN (search_vector);

-- Safety incidents search
ALTER TABLE safety_incidents ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(incident_number, '')), 'C')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_safety_incidents_search_vector 
  ON safety_incidents USING GIN (search_vector);

-- Contacts search
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(company, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(email, '')), 'C')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_contacts_search_vector 
  ON contacts USING GIN (search_vector);

-- Team members search
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(role, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(trade, '')), 'C')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_team_members_search_vector 
  ON team_members USING GIN (search_vector);

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 5: JSON GIN INDEXES
-- ─────────────────────────────────────────────────────────────────────────────

-- User permissions (if JSONB)
CREATE INDEX IF NOT EXISTS idx_user_permissions_gin 
  ON users USING GIN (permissions jsonb_path_ops);

-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFICATION
-- ─────────────────────────────────────────────────────────────────────────────

COMMIT;

-- Show summary
SELECT 
  'Index Migration Complete' as status,
  COUNT(*) as total_indexes,
  COUNT(*) FILTER (WHERE indexname LIKE 'idx_%') as new_indexes
FROM pg_indexes
WHERE schemaname = 'public';
