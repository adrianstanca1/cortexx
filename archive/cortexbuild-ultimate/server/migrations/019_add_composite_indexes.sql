-- Migration: Comprehensive Index Optimization
-- Purpose: Add composite, partial, and covering indexes for query performance
-- Run: docker exec -i cortexbuild-db psql -U cortexbuild -d cortexbuild < server/migrations/019_add_composite_indexes.sql
-- Or: psql -h localhost -U cortexbuild -d cortexbuild -f server/migrations/019_add_composite_indexes.sql

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 1: CRITICAL COMPOSITE INDEXES
-- These address the most common query patterns in CortexBuild
-- ─────────────────────────────────────────────────────────────────────────────

-- Projects: Filter by company + status (dashboard, project lists)
CREATE INDEX IF NOT EXISTS idx_projects_company_status 
  ON projects(company_id, status)
  WHERE status IN ('ACTIVE', 'ON_HOLD', 'PLANNING');

COMMENT ON INDEX idx_projects_company_status IS 'Composite: Company projects filtered by active status';

-- Projects: Manager dashboard - projects by manager + status
CREATE INDEX IF NOT EXISTS idx_projects_manager_status 
  ON projects(project_manager_id, status)
  WHERE project_manager_id IS NOT NULL;

COMMENT ON INDEX idx_projects_manager_status IS 'Composite: Project manager dashboard queries';

-- Tasks: Assignee + status (my tasks, team tasks)
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_status 
  ON tasks(assignee_id, status)
  WHERE assignee_id IS NOT NULL AND status NOT IN ('COMPLETED', 'CANCELLED');

COMMENT ON INDEX idx_tasks_assignee_status IS 'Composite: User task list by status';

-- Tasks: Project + status + priority (project task boards)
CREATE INDEX IF NOT EXISTS idx_tasks_project_status_priority 
  ON tasks(project_id, status, priority);

COMMENT ON INDEX idx_tasks_project_status_priority IS 'Composite: Project task board with priority ordering';

-- Tasks: Due date tracking (overdue tasks)
CREATE INDEX IF NOT EXISTS idx_tasks_due_date_status 
  ON tasks(due_date, status)
  WHERE due_date IS NOT NULL AND status NOT IN ('COMPLETED', 'CANCELLED');

COMMENT ON INDEX idx_tasks_due_date_status IS 'Composite: Overdue task tracking';

-- RFIs: Project + status + priority (RFI dashboard)
CREATE INDEX IF NOT EXISTS idx_rfis_project_status_priority 
  ON rfis(project_id, status, priority);

COMMENT ON INDEX idx_rfis_project_status_priority IS 'Composite: RFI dashboard filtering';

-- RFIs: Assigned to + status (my RFIs)
CREATE INDEX IF NOT EXISTS idx_rfis_assigned_status 
  ON rfis(assigned_to_id, status)
  WHERE assigned_to_id IS NOT NULL;

COMMENT ON INDEX idx_rfis_assigned_status IS 'Composite: User RFI assignments';

-- Safety Incidents: Project + severity + status (safety dashboard)
CREATE INDEX IF NOT EXISTS idx_safety_incidents_project_severity_status 
  ON safety_incidents(project_id, severity, status);

COMMENT ON INDEX idx_safety_incidents_project_severity_status IS 'Composite: Safety incident dashboard';

-- Safety Incidents: Reported by + status (my reports)
CREATE INDEX IF NOT EXISTS idx_safety_incidents_reporter_status 
  ON safety_incidents(reported_by_id, status);

COMMENT ON INDEX idx_safety_incidents_reporter_status IS 'Composite: User safety incident reports';

-- Documents: Project + type + discipline (document control)
CREATE INDEX IF NOT EXISTS idx_documents_project_type_discipline 
  ON documents(project_id, type, discipline)
  WHERE project_id IS NOT NULL;

COMMENT ON INDEX idx_documents_project_type_discipline IS 'Composite: Document filtering by type and discipline';

-- Documents: Uploaded by + type (user document uploads)
CREATE INDEX IF NOT EXISTS idx_documents_uploader_type 
  ON documents(uploaded_by_id, type);

COMMENT ON INDEX idx_documents_uploader_type IS 'Composite: User document uploads by type';

-- Subcontractors: Company + trade + status (subcontractor directory)
CREATE INDEX IF NOT EXISTS idx_subcontractors_company_trade_status 
  ON subcontractors(company_id, trade, status);

COMMENT ON INDEX idx_subcontractors_company_trade_status IS 'Composite: Subcontractor directory filtering';

-- Timesheets: Worker + week + status (payroll processing)
CREATE INDEX IF NOT EXISTS idx_timesheets_worker_week_status 
  ON timesheets(worker_id, week, status);

COMMENT ON INDEX idx_timesheets_worker_week_status IS 'Composite: Worker timesheet lookup by week';

-- Meetings: Project + date + status (meeting schedule)
CREATE INDEX IF NOT EXISTS idx_meetings_project_date_status 
  ON meetings(project_id, date, status);

COMMENT ON INDEX idx_meetings_project_date_status IS 'Composite: Project meeting schedule';

-- Change Orders: Project + status + submitted_date (CO tracking)
CREATE INDEX IF NOT EXISTS idx_change_orders_project_status_date 
  ON change_orders(project_id, status, submitted_date);

COMMENT ON INDEX idx_change_orders_project_status_date IS 'Composite: Change order tracking by status and date';

-- Progress Claims: Project + status + claim_date (payment tracking)
CREATE INDEX IF NOT EXISTS idx_progress_claims_project_status_date 
  ON progress_claims(project_id, status, claim_date);

COMMENT ON INDEX idx_progress_claims_project_status_date IS 'Composite: Progress claim payment tracking';

-- Daily Reports: Project + date (site diary lookup)
CREATE INDEX IF NOT EXISTS idx_daily_reports_project_date 
  ON daily_reports(project_id, date DESC);

COMMENT ON INDEX idx_daily_reports_project_date IS 'Composite: Daily report lookup by date';

-- Weather Logs: Project + date (weather history)
CREATE INDEX IF NOT EXISTS idx_weather_logs_project_date 
  ON weather_logs(project_id, date DESC);

COMMENT ON INDEX idx_weather_logs_project_date IS 'Composite: Weather history by date';

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 2: PARTIAL INDEXES FOR ACTIVE DATA
-- Smaller, faster indexes for commonly-filtered active records
-- ─────────────────────────────────────────────────────────────────────────────

-- Users: By organization and role (no is_active column exists)
CREATE INDEX IF NOT EXISTS idx_users_org_role
  ON users(organization_id, role)
  WHERE organization_id IS NOT NULL;

COMMENT ON INDEX idx_users_org_role IS 'Partial: Users by organization and role';

-- Users: By company and role (company user lists)
CREATE INDEX IF NOT EXISTS idx_users_company_role
  ON users(company_id, role)
  WHERE company_id IS NOT NULL;

COMMENT ON INDEX idx_users_company_role IS 'Partial: Users by company and role';

-- Projects: Only active projects (dashboard queries)
CREATE INDEX IF NOT EXISTS idx_projects_active_company 
  ON projects(company_id, status, progress)
  WHERE status IN ('ACTIVE', 'PLANNING');

COMMENT ON INDEX idx_projects_active_company IS 'Partial: Active projects for dashboard KPIs';

-- RFIs: Only open/in_review RFIs (most common queries)
CREATE INDEX IF NOT EXISTS idx_rfis_active_project 
  ON rfis(project_id, priority, created_at DESC)
  WHERE status IN ('open', 'in_review');

COMMENT ON INDEX idx_rfis_active_project IS 'Partial: Open RFIs by priority';

-- Tasks: Only active tasks (task boards)
CREATE INDEX IF NOT EXISTS idx_tasks_active_project 
  ON tasks(project_id, priority, due_date)
  WHERE status IN ('NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'REVIEW');

COMMENT ON INDEX idx_tasks_active_project IS 'Partial: Active tasks by priority and due date';

-- Safety Incidents: Only reported/under_review (active incidents)
CREATE INDEX IF NOT EXISTS idx_safety_incidents_active 
  ON safety_incidents(project_id, severity, occurrence_date DESC)
  WHERE status IN ('reported', 'under_review');

COMMENT ON INDEX idx_safety_incidents_active IS 'Partial: Active safety incidents';

-- Documents: Only latest revisions (current documents)
CREATE INDEX IF NOT EXISTS idx_documents_current_revision 
  ON documents(project_id, type, created_at DESC)
  WHERE project_id IS NOT NULL;

COMMENT ON INDEX idx_documents_current_revision IS 'Partial: Current document revisions';

-- Subcontractors: Only active subcontractors
CREATE INDEX IF NOT EXISTS idx_subcontractors_active 
  ON subcontractors(company_id, trade, cis_verified)
  WHERE status = 'active';

COMMENT ON INDEX idx_subcontractors_active IS 'Partial: Active subcontractors with CIS status';

-- Equipment: Only active equipment (equipment dashboard)
CREATE INDEX IF NOT EXISTS idx_equipment_active_location 
  ON equipment(status, location)
  WHERE status IN ('active', 'in_use');

COMMENT ON INDEX idx_equipment_active_location IS 'Partial: Active equipment by location';

-- Invitations table does not exist — skipping invitation indexes
-- Sessions table does not exist (using Redis) — skipping session indexes

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 3: COVERING INDEXES FOR DASHBOARD QUERIES
-- Avoid table lookups by including commonly-selected columns
-- ─────────────────────────────────────────────────────────────────────────────

-- Projects dashboard KPIs - cover all needed columns
CREATE INDEX IF NOT EXISTS idx_projects_dashboard_covering 
  ON projects(company_id, status)
  INCLUDE (name, code, budget, spent, progress, start_date, end_date)
  WHERE status IN ('ACTIVE', 'PLANNING', 'ON_HOLD');

COMMENT ON INDEX idx_projects_dashboard_covering IS 'Covering: Project dashboard KPIs without heap lookup';

-- Task list view - cover display columns
CREATE INDEX IF NOT EXISTS idx_tasks_list_covering 
  ON tasks(project_id, status, priority, due_date DESC)
  INCLUDE (title, assignee_id, percent_complete, created_at)
  WHERE status NOT IN ('CANCELLED');

COMMENT ON INDEX idx_tasks_list_covering IS 'Covering: Task list display columns';

-- RFI list view - cover display columns
CREATE INDEX IF NOT EXISTS idx_rfis_list_covering 
  ON rfis(project_id, status, priority, created_at DESC)
  INCLUDE (rfi_number, subject, submitted_by, assigned_to_id, due_date);

COMMENT ON INDEX idx_rfis_list_covering IS 'Covering: RFI list display columns';

-- Document list view - cover display columns
CREATE INDEX IF NOT EXISTS idx_documents_list_covering 
  ON documents(project_id, type, created_at DESC)
  INCLUDE (title, uploaded_by_id, revision, file_size, mime_type);

COMMENT ON INDEX idx_documents_list_covering IS 'Covering: Document list display columns';

-- Safety incident list - cover display columns
CREATE INDEX IF NOT EXISTS idx_safety_incidents_list_covering 
  ON safety_incidents(project_id, severity, occurrence_date DESC)
  INCLUDE (incident_number, title, status, reported_by_id, location);

COMMENT ON INDEX idx_safety_incidents_list_covering IS 'Covering: Safety incident list display columns';

-- Subcontractor list - cover display columns
CREATE INDEX IF NOT EXISTS idx_subcontractors_list_covering 
  ON subcontractors(company_id, trade, status)
  INCLUDE (company, contact, email, phone, cis_verified, insurance_expiry);

COMMENT ON INDEX idx_subcontractors_list_covering IS 'Covering: Subcontractor directory display columns';

-- Timesheet list - cover display columns
CREATE INDEX IF NOT EXISTS idx_timesheets_list_covering 
  ON timesheets(worker_id, week DESC, status)
  INCLUDE (project_id, regular_hours, overtime_hours, total_pay, cis_deduction);

COMMENT ON INDEX idx_timesheets_list_covering IS 'Covering: Timesheet list display columns';

-- Meeting list - cover display columns
CREATE INDEX IF NOT EXISTS idx_meetings_list_covering 
  ON meetings(project_id, date DESC, status)
  INCLUDE (title, meeting_type, time, location, attendees);

COMMENT ON INDEX idx_meetings_list_covering IS 'Covering: Meeting schedule display columns';

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 4: DATE RANGE INDEXES FOR CALENDAR & REPORTING
-- Optimize date-based queries for calendar and reports
-- ─────────────────────────────────────────────────────────────────────────────

-- Calendar: All date-based events (combined view)
CREATE INDEX IF NOT EXISTS idx_meetings_calendar_range 
  ON meetings(date, status)
  WHERE date >= CURRENT_DATE - INTERVAL '30 days';

COMMENT ON INDEX idx_meetings_calendar_range IS 'Date range: Meeting calendar queries';

-- Calendar: Project milestones
CREATE INDEX IF NOT EXISTS idx_milestones_calendar_range 
  ON milestones(target_date, status)
  WHERE target_date >= CURRENT_DATE - INTERVAL '30 days';

COMMENT ON INDEX idx_milestones_calendar_range IS 'Date range: Milestone calendar queries';

-- Calendar: Task due dates
CREATE INDEX IF NOT EXISTS idx_tasks_calendar_range 
  ON tasks(due_date, status)
  WHERE due_date >= CURRENT_DATE - INTERVAL '30 days' 
    AND due_date IS NOT NULL;

COMMENT ON INDEX idx_tasks_calendar_range IS 'Date range: Task due date calendar';

-- Reporting: Financial data by quarter
CREATE INDEX IF NOT EXISTS idx_progress_claims_quarterly 
  ON progress_claims(project_id, claim_date DESC)
  WHERE status IN ('submitted', 'approved', 'paid');

COMMENT ON INDEX idx_progress_claims_quarterly IS 'Date range: Quarterly financial reporting';

-- Reporting: Cost items by category and date
CREATE INDEX IF NOT EXISTS idx_cost_items_project_category_date 
  ON cost_items(project_id, category, created_at DESC);

COMMENT ON INDEX idx_cost_items_project_category_date IS 'Date range: Cost reporting by category';

-- Reporting: Change orders by date range
CREATE INDEX IF NOT EXISTS idx_change_orders_date_range 
  ON change_orders(project_id, submitted_date DESC)
  WHERE submitted_date IS NOT NULL;

COMMENT ON INDEX idx_change_orders_date_range IS 'Date range: Change order history reporting';

-- Audit log: Recent activity (last 90 days hot data)
CREATE INDEX IF NOT EXISTS idx_audit_log_recent_activity 
  ON audit_log(organization_id, action, created_at DESC)
  WHERE created_at >= CURRENT_DATE - INTERVAL '90 days';

COMMENT ON INDEX idx_audit_log_recent_activity IS 'Date range: Recent audit trail for compliance';

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 5: FULL-TEXT SEARCH INDEXES
-- Enable fast text search across multiple columns
-- ─────────────────────────────────────────────────────────────────────────────

-- Projects: Searchable fields
ALTER TABLE projects ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(code, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(type, '')), 'D') ||
    setweight(to_tsvector('english', coalesce(city, '')), 'D')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_projects_search_vector 
  ON projects USING GIN (search_vector);

COMMENT ON INDEX idx_projects_search_vector IS 'Full-text search: Projects name, description, code, type';

-- RFIs: Searchable fields
ALTER TABLE rfis ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(subject, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(question, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(response, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(rfi_number, '')), 'C')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_rfis_search_vector 
  ON rfis USING GIN (search_vector);

COMMENT ON INDEX idx_rfis_search_vector IS 'Full-text search: RFI subject, question, response';

-- Documents: Searchable fields
ALTER TABLE documents ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(number, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(type, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(discipline, '')), 'D')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_documents_search_vector 
  ON documents USING GIN (search_vector);

COMMENT ON INDEX idx_documents_search_vector IS 'Full-text search: Documents title, number, type';

-- Safety Incidents: Searchable fields
ALTER TABLE safety_incidents ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(incident_number, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(location, '')), 'D')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_safety_incidents_search_vector 
  ON safety_incidents USING GIN (search_vector);

COMMENT ON INDEX idx_safety_incidents_search_vector IS 'Full-text search: Safety incidents title, description';

-- Tasks: Searchable fields
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(code, '')), 'C')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_tasks_search_vector 
  ON tasks USING GIN (search_vector);

COMMENT ON INDEX idx_tasks_search_vector IS 'Full-text search: Tasks title, description';

-- Subcontractors: Searchable fields
ALTER TABLE subcontractors ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(company, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(trade, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(contact, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(email, '')), 'D')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_subcontractors_search_vector 
  ON subcontractors USING GIN (search_vector);

COMMENT ON INDEX idx_subcontractors_search_vector IS 'Full-text search: Subcontractors company, trade, contact';

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 6: JSON COLUMN INDEXES (GIN)
-- For querying JSON/JSONB columns
-- ─────────────────────────────────────────────────────────────────────────────

-- users.permissions column does not exist — skipping JSON index
-- workflows table does not exist — skipping workflow JSON indexes

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 7: ADDITIONAL OPTIMIZATION INDEXES
-- Specialized indexes for specific query patterns
-- ─────────────────────────────────────────────────────────────────────────────

-- Equipment: Service due tracking
CREATE INDEX IF NOT EXISTS idx_equipment_service_due 
  ON equipment(next_service, status)
  WHERE next_service IS NOT NULL AND status = 'active';

COMMENT ON INDEX idx_equipment_service_due IS 'Equipment service due date tracking';

-- Equipment: Hire availability
CREATE INDEX IF NOT EXISTS idx_equipment_hire_availability 
  ON equipment(status, daily_rate, hire_period)
  WHERE status = 'available';

COMMENT ON INDEX idx_equipment_hire_availability IS 'Equipment hire availability search';

-- Risk Register: High priority risks
CREATE INDEX IF NOT EXISTS idx_risk_register_high_priority 
  ON risk_register(project_id, status, review_date)
  WHERE risk_score >= 15 OR status IN ('open', 'mitigating');

COMMENT ON INDEX idx_risk_register_high_priority IS 'High priority risk tracking';

-- Quality Checks: Upcoming inspections
CREATE INDEX IF NOT EXISTS idx_quality_checks_upcoming 
  ON quality_checks(project_id, scheduled_date, status)
  WHERE scheduled_date >= CURRENT_DATE AND status = 'scheduled';

COMMENT ON INDEX idx_quality_checks_upcoming IS 'Upcoming quality inspection schedule';

-- Defects: Open defects by priority
CREATE INDEX IF NOT EXISTS idx_defects_open_priority 
  ON defects(project_id, priority, status, created_at DESC)
  WHERE status IN ('identified', 'in_progress', 'review');

COMMENT ON INDEX idx_defects_open_priority IS 'Open defects by priority for resolution tracking';

-- Drawings: By discipline and revision
CREATE INDEX IF NOT EXISTS idx_drawings_discipline_revision 
  ON drawings(project_id, discipline, revision DESC);

COMMENT ON INDEX idx_drawings_discipline_revision IS 'Drawing revisions by discipline';

-- Progress Claims: By status and amount (payment processing)
CREATE INDEX IF NOT EXISTS idx_progress_claims_payment_queue 
  ON progress_claims(status, claimed_amount DESC, claim_date)
  WHERE status IN ('submitted', 'approved');

COMMENT ON INDEX idx_progress_claims_payment_queue IS 'Payment processing queue by amount';

-- Invoices: By status and due date (accounts receivable)
CREATE INDEX IF NOT EXISTS idx_invoices_receivable 
  ON invoices(status, due_date, amount DESC)
  WHERE status IN ('sent', 'overdue', 'partial');

COMMENT ON INDEX idx_invoices_receivable IS 'Accounts receivable tracking';

-- Tenders: By deadline and probability (bid management)
CREATE INDEX IF NOT EXISTS idx_tenders_bid_queue 
  ON tenders(deadline, probability DESC, status)
  WHERE status IN ('open', 'submitted');

COMMENT ON INDEX idx_tenders_bid_queue IS 'Bid management by deadline and win probability';

-- Contacts: By type and value (CRM pipeline)
CREATE INDEX IF NOT EXISTS idx_contacts_pipeline 
  ON contacts(type, value DESC, status, last_contact DESC);

COMMENT ON INDEX idx_contacts_pipeline IS 'CRM pipeline by contact type and value';

-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFICATION QUERIES
-- Run these after migration to verify indexes were created
-- ─────────────────────────────────────────────────────────────────────────────

-- Count new indexes created
-- SELECT COUNT(*) FROM pg_indexes 
-- WHERE tablename IN (
--   'projects', 'tasks', 'rfis', 'safety_incidents', 'documents',
--   'subcontractors', 'timesheets', 'meetings', 'change_orders',
--   'progress_claims', 'daily_reports', 'weather_logs', 'equipment',
--   'risk_register', 'quality_checks', 'defects', 'drawings',
--   'invoices', 'tenders', 'contacts', 'users', 'invitations',
--   'sessions', 'audit_log', 'workflows'
-- )
-- AND indexname LIKE 'idx_%';

-- Check index sizes (uncomment to use)
-- SELECT 
--   tablename,
--   indexname,
--   pg_size_pretty(pg_relation_size(indexrelid)) as index_size
-- FROM pg_stat_user_indexes
-- WHERE indexname LIKE 'idx_%'
-- ORDER BY pg_relation_size(indexrelid) DESC
-- LIMIT 20;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- POST-MIGRATION: ANALYZE TABLES
-- Update statistics for query planner
-- ─────────────────────────────────────────────────────────────────────────────

-- Run ANALYZE on all modified tables
ANALYZE projects;
ANALYZE tasks;
ANALYZE rfis;
ANALYZE safety_incidents;
ANALYZE documents;
ANALYZE subcontractors;
ANALYZE timesheets;
ANALYZE meetings;
ANALYZE change_orders;
ANALYZE progress_claims;
ANALYZE daily_reports;
ANALYZE weather_logs;
ANALYZE equipment;
ANALYZE risk_register;
ANALYZE quality_checks;
ANALYZE defects;
ANALYZE drawings;
ANALYZE invoices;
ANALYZE tenders;
ANALYZE contacts;
ANALYZE users;
ANALYZE invitations;
ANALYZE sessions;
ANALYZE audit_log;
ANALYZE workflows;
