-- Migration 055: Add organization_id and company_id to tables missing them
-- This enables the centralized COALESCE(organization_id, company_id) tenant filter
-- to work across ALL business tables, not just the ones that already had both columns.

-- ============================================================
-- Tables that have NEITHER organization_id NOR company_id
-- These are the core business tables that need tenant isolation.
-- ============================================================

ALTER TABLE projects ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

ALTER TABLE rfis ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE rfis ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

ALTER TABLE tenders ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

ALTER TABLE change_orders ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE change_orders ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

ALTER TABLE safety_incidents ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE safety_incidents ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

ALTER TABLE team_members ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

ALTER TABLE equipment ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

ALTER TABLE subcontractors ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE subcontractors ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

ALTER TABLE materials ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE materials ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

ALTER TABLE meetings ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

ALTER TABLE punch_list ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE punch_list ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

ALTER TABLE inspections ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

ALTER TABLE rams ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE rams ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

ALTER TABLE risk_register ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE risk_register ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

ALTER TABLE cis_returns ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE cis_returns ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

ALTER TABLE submittal_attachments ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE submittal_attachments ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

ALTER TABLE submittal_comments ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE submittal_comments ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

ALTER TABLE chat_channel_members ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE chat_channel_members ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

-- ============================================================
-- Tables that have organization_id but NOT company_id
-- These need company_id added for the COALESCE pattern.
-- ============================================================

ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
ALTER TABLE chat_channels ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
ALTER TABLE bim_clashes_detections ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

-- rag_embeddings uses organization_id only — company_id resolved via companies table lookup (see rag.js)
-- companies table IS the company entity — does not need company_id on itself
-- These are left as-is.

-- ============================================================
-- Backfill: Populate tenant columns from existing relationships
-- For tables with project_id, derive tenant from the project's users
-- ============================================================

-- Projects: backfill from the user who created them (manager → users table)
UPDATE projects p
SET organization_id = u.organization_id,
    company_id = u.company_id
FROM users u
WHERE p.manager = u.name
  AND p.organization_id IS NULL;

-- Invoices: backfill from project relationship
UPDATE invoices i
SET organization_id = p.organization_id,
    company_id = p.company_id
FROM projects p
WHERE i.project_id = p.id
  AND i.organization_id IS NULL;

-- Similarly for other project-scoped tables
UPDATE rfis r
SET organization_id = p.organization_id,
    company_id = p.company_id
FROM projects p
WHERE r.project_id = p.id
  AND r.organization_id IS NULL;

UPDATE change_orders co
SET organization_id = p.organization_id,
    company_id = p.company_id
FROM projects p
WHERE co.project_id = p.id
  AND co.organization_id IS NULL;

UPDATE safety_incidents si
SET organization_id = p.organization_id,
    company_id = p.company_id
FROM projects p
WHERE si.project_id = p.id
  AND si.organization_id IS NULL;

UPDATE daily_reports dr
SET organization_id = p.organization_id,
    company_id = p.company_id
FROM projects p
WHERE dr.project_id = p.id
  AND dr.organization_id IS NULL;

UPDATE team_members tm
SET organization_id = p.organization_id,
    company_id = p.company_id
FROM projects p
WHERE tm.project_id = p.id
  AND tm.organization_id IS NULL;

UPDATE project_tasks pt
SET organization_id = p.organization_id,
    company_id = p.company_id
FROM projects p
WHERE pt.project_id = p.id
  AND pt.organization_id IS NULL;

-- Submittal comments: derive from parent submittal
UPDATE submittal_comments sc
SET organization_id = s.organization_id,
    company_id = s.company_id
FROM submittals s
WHERE sc.submittal_id = s.id
  AND sc.organization_id IS NULL;

-- AI conversations: derive from user
UPDATE ai_conversations ac
SET company_id = u.company_id
FROM users u
WHERE ac.user_id = u.id
  AND ac.company_id IS NULL;

-- Chat channels: company_owner users have organization_id but no company_id on channels
UPDATE chat_channels cc
SET company_id = u.company_id
FROM users u
WHERE cc.created_by = u.id
  AND cc.company_id IS NULL;

-- ============================================================
-- Indexes for tenant filter performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_projects_tenant ON projects (COALESCE(organization_id, company_id));
CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON invoices (COALESCE(organization_id, company_id));
CREATE INDEX IF NOT EXISTS idx_rfis_tenant ON rfis (COALESCE(organization_id, company_id));
CREATE INDEX IF NOT EXISTS idx_tenders_tenant ON tenders (COALESCE(organization_id, company_id));
CREATE INDEX IF NOT EXISTS idx_change_orders_tenant ON change_orders (COALESCE(organization_id, company_id));
CREATE INDEX IF NOT EXISTS idx_safety_incidents_tenant ON safety_incidents (COALESCE(organization_id, company_id));
CREATE INDEX IF NOT EXISTS idx_team_members_tenant ON team_members (COALESCE(organization_id, company_id));
CREATE INDEX IF NOT EXISTS idx_daily_reports_tenant ON daily_reports (COALESCE(organization_id, company_id));
CREATE INDEX IF NOT EXISTS idx_project_tasks_tenant ON project_tasks (COALESCE(organization_id, company_id));