-- CortexBuild Ultimate — Core Platform Tables with Multi-Tenancy
-- Migration 0001: Creates all core platform tables with organization_id and company_id for data isolation
-- Run: psql "$DATABASE_URL" -f server/migrations/0001_core_platform_tables.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users
CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  company_id      UUID REFERENCES companies(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  email           TEXT NOT NULL,
  password_hash   TEXT NOT NULL,
  role            TEXT NOT NULL DEFAULT 'project_manager'
                  CHECK (role IN ('super_admin','company_owner','admin','project_manager','field_worker','client')),
  phone           TEXT,
  avatar          TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (email, organization_id)
);
CREATE INDEX idx_users_organization ON users(organization_id);
CREATE INDEX idx_users_company ON users(company_id);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  company_id      UUID REFERENCES companies(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  client         TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'planning'
                 CHECK (status IN ('planning','active','on_hold','completed','archived')),
  progress       INT  DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  budget         NUMERIC(14,2) DEFAULT 0,
  spent          NUMERIC(14,2) DEFAULT 0,
  start_date     DATE,
  end_date       DATE,
  manager        TEXT,
  location       TEXT,
  type           TEXT,
  phase          TEXT,
  workers        INT DEFAULT 0,
  contract_value NUMERIC(14,2) DEFAULT 0,
  description    TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_projects_organization ON projects(organization_id);
CREATE INDEX idx_projects_company ON projects(company_id);

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  company_id      UUID REFERENCES companies(id) ON DELETE CASCADE,
  number         TEXT NOT NULL,
  client         TEXT NOT NULL,
  project_id     UUID REFERENCES projects(id) ON DELETE SET NULL,
  project        TEXT,
  amount         NUMERIC(14,2) DEFAULT 0,
  vat            NUMERIC(14,2) DEFAULT 0,
  cis_deduction  NUMERIC(14,2) DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft','sent','paid','overdue','disputed')),
  issue_date     DATE,
  due_date       DATE,
  description    TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_invoices_organization ON invoices(organization_id);
CREATE INDEX idx_invoices_company ON invoices(company_id);

-- Safety Incidents
CREATE TABLE IF NOT EXISTS safety_incidents (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID REFERENCES organizations(id) ON DELETE CASCADE,
  company_id          UUID REFERENCES companies(id) ON DELETE CASCADE,
  type                TEXT NOT NULL DEFAULT 'incident'
                      CHECK (type IN ('incident','near-miss','hazard','inspection','toolbox-talk','mewp-check')),
  title               TEXT NOT NULL,
  severity            TEXT NOT NULL DEFAULT 'minor'
                      CHECK (severity IN ('minor','moderate','serious','fatal')),
  status              TEXT NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open','investigating','resolved','closed')),
  project_id          UUID,
  project             TEXT,
  reported_by         TEXT,
  reported_by_name    TEXT,
  date                DATE DEFAULT CURRENT_DATE,
  location            TEXT,
  description         TEXT,
  root_cause          TEXT,
  corrective_actions  TEXT[],
  injured_party       TEXT,
  immediate_actions   TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_safety_incidents_organization ON safety_incidents(organization_id);
CREATE INDEX idx_safety_incidents_company ON safety_incidents(company_id);

-- RFIs
CREATE TABLE IF NOT EXISTS rfis (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  company_id      UUID REFERENCES companies(id) ON DELETE CASCADE,
  number         TEXT NOT NULL,
  project_id     UUID,
  project        TEXT,
  subject        TEXT NOT NULL,
  question       TEXT,
  priority       TEXT NOT NULL DEFAULT 'medium'
                 CHECK (priority IN ('low','medium','high','critical')),
  status         TEXT NOT NULL DEFAULT 'open'
                 CHECK (status IN ('open','answered','closed','pending')),
  submitted_by   TEXT,
  submitted_date DATE DEFAULT CURRENT_DATE,
  due_date       DATE,
  assigned_to    TEXT,
  response       TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_rfis_organization ON rfis(organization_id);
CREATE INDEX idx_rfis_company ON rfis(company_id);

-- Change Orders
CREATE TABLE IF NOT EXISTS change_orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  company_id      UUID REFERENCES companies(id) ON DELETE CASCADE,
  number          TEXT NOT NULL,
  project_id      UUID,
  project         TEXT,
  title           TEXT NOT NULL,
  description     TEXT,
  amount          NUMERIC(14,2) DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','pending','approved','rejected')),
  submitted_date  DATE DEFAULT CURRENT_DATE,
  approved_date   DATE,
  reason          TEXT,
  schedule_impact INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_change_orders_organization ON change_orders(organization_id);
CREATE INDEX idx_change_orders_company ON change_orders(company_id);

-- Team Members
CREATE TABLE IF NOT EXISTS team_members (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID REFERENCES organizations(id) ON DELETE CASCADE,
  company_id       UUID REFERENCES companies(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  role             TEXT,
  trade            TEXT,
  email            TEXT,
  phone            TEXT,
  status           TEXT NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active','on_site','off_site','leave','inactive')),
  cis_status       TEXT NOT NULL DEFAULT 'net'
                   CHECK (cis_status IN ('gross','net','unverified')),
  utr_number       TEXT,
  ni_number        TEXT,
  hours_this_week  NUMERIC(5,1) DEFAULT 0,
  rams_completed   BOOLEAN DEFAULT false,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_team_members_organization ON team_members(organization_id);
CREATE INDEX idx_team_members_company ON team_members(company_id);

-- Equipment / Plant
CREATE TABLE IF NOT EXISTS equipment (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  company_id      UUID REFERENCES companies(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  type         TEXT,
  registration TEXT,
  status       TEXT NOT NULL DEFAULT 'available'
               CHECK (status IN ('available','on_site','maintenance','hired_out')),
  location     TEXT,
  next_service DATE,
  daily_rate   NUMERIC(10,2) DEFAULT 0,
  hire_period  TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_equipment_organization ON equipment(organization_id);
CREATE INDEX idx_equipment_company ON equipment(company_id);

-- Subcontractors
CREATE TABLE IF NOT EXISTS subcontractors (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID REFERENCES organizations(id) ON DELETE CASCADE,
  company_id        UUID REFERENCES companies(id) ON DELETE CASCADE,
  company           TEXT NOT NULL,
  trade             TEXT,
  contact           TEXT,
  email             TEXT,
  phone             TEXT,
  status            TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','inactive','pending')),
  cis_verified      BOOLEAN DEFAULT false,
  insurance_expiry  DATE,
  rams_approved     BOOLEAN DEFAULT false,
  current_project   TEXT,
  contract_value    NUMERIC(14,2) DEFAULT 0,
  rating            NUMERIC(2,1) DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_subcontractors_organization ON subcontractors(organization_id);
CREATE INDEX idx_subcontractors_company ON subcontractors(company_id);

-- Documents
CREATE TABLE IF NOT EXISTS documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  company_id      UUID REFERENCES companies(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  type          TEXT,
  project_id    UUID,
  project       TEXT,
  uploaded_by   TEXT,
  version       TEXT DEFAULT '1.0',
  size          TEXT,
  status        TEXT NOT NULL DEFAULT 'current'
                CHECK (status IN ('current','superseded','draft','for-review')),
  category      TEXT NOT NULL DEFAULT 'REPORTS'
                CHECK (category IN ('PLANS','DRAWINGS','PERMITS','RAMS','CONTRACTS','REPORTS','SPECS','PHOTOS')),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_documents_organization ON documents(organization_id);
CREATE INDEX idx_documents_company ON documents(company_id);

-- Timesheets
CREATE TABLE IF NOT EXISTS timesheets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  company_id      UUID REFERENCES companies(id) ON DELETE CASCADE,
  worker_id       UUID,
  worker          TEXT,
  project_id      UUID,
  project         TEXT,
  week            DATE,
  regular_hours   NUMERIC(5,1) DEFAULT 0,
  overtime_hours  NUMERIC(5,1) DEFAULT 0,
  daywork_hours   NUMERIC(5,1) DEFAULT 0,
  total_pay       NUMERIC(10,2) DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','submitted','approved','paid')),
  cis_deduction   NUMERIC(10,2) DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_timesheets_organization ON timesheets(organization_id);
CREATE INDEX idx_timesheets_company ON timesheets(company_id);

-- Meetings
CREATE TABLE IF NOT EXISTS meetings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  company_id      UUID REFERENCES companies(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  meeting_type  TEXT DEFAULT 'Site Progress',
  project_id    UUID,
  project       TEXT,
  date          DATE,
  time          TEXT,
  location      TEXT,
  attendees     TEXT,
  agenda        TEXT,
  minutes       TEXT,
  actions       TEXT,
  status        TEXT DEFAULT 'Scheduled',
  link          TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_meetings_organization ON meetings(organization_id);
CREATE INDEX idx_meetings_company ON meetings(company_id);

-- Materials
CREATE TABLE IF NOT EXISTS materials (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  company_id      UUID REFERENCES companies(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  category      TEXT,
  quantity      NUMERIC(12,2) DEFAULT 0,
  unit          TEXT DEFAULT 'nr',
  unit_cost     NUMERIC(12,2) DEFAULT 0,
  total_cost    NUMERIC(14,2) DEFAULT 0,
  supplier      TEXT,
  project_id    UUID,
  project       TEXT,
  status        TEXT NOT NULL DEFAULT 'ordered'
                CHECK (status IN ('ordered','delivered','on_site','used')),
  delivery_date DATE,
  po_number     TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_materials_organization ON materials(organization_id);
CREATE INDEX idx_materials_company ON materials(company_id);

-- Punch List
CREATE TABLE IF NOT EXISTS punch_list (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  company_id      UUID REFERENCES companies(id) ON DELETE CASCADE,
  project_id  UUID,
  project     TEXT,
  location    TEXT,
  description TEXT NOT NULL,
  assigned_to TEXT,
  priority    TEXT NOT NULL DEFAULT 'medium'
              CHECK (priority IN ('low','medium','high','critical')),
  status      TEXT NOT NULL DEFAULT 'open'
              CHECK (status IN ('open','in_progress','completed','rejected')),
  due_date    DATE,
  photos      INT DEFAULT 0,
  trade       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_punch_list_organization ON punch_list(organization_id);
CREATE INDEX idx_punch_list_company ON punch_list(company_id);

-- Inspections
CREATE TABLE IF NOT EXISTS inspections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  company_id      UUID REFERENCES companies(id) ON DELETE CASCADE,
  type            TEXT NOT NULL,
  project_id      UUID,
  project         TEXT,
  inspector       TEXT,
  date            DATE DEFAULT CURRENT_DATE,
  status          TEXT NOT NULL DEFAULT 'scheduled'
                  CHECK (status IN ('scheduled','passed','failed','conditional')),
  score           INT CHECK (score BETWEEN 0 AND 100),
  items           JSONB DEFAULT '[]',
  next_inspection DATE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_inspections_organization ON inspections(organization_id);
CREATE INDEX idx_inspections_company ON inspections(company_id);

-- RAMS
CREATE TABLE IF NOT EXISTS rams (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID REFERENCES organizations(id) ON DELETE CASCADE,
  company_id       UUID REFERENCES companies(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  project_id       UUID,
  project          TEXT,
  activity         TEXT,
  version          TEXT DEFAULT '1.0',
  status           TEXT NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','review','approved','expired')),
  created_by       TEXT,
  approved_by      TEXT,
  review_date      DATE,
  hazards          JSONB DEFAULT '[]',
  method_statement JSONB DEFAULT '[]',
  ppe              JSONB DEFAULT '[]',
  signatures       INT DEFAULT 0,
  required         INT DEFAULT 1,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_rams_organization ON rams(organization_id);
CREATE INDEX idx_rams_company ON rams(company_id);

-- CIS Returns
CREATE TABLE IF NOT EXISTS cis_returns (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID REFERENCES organizations(id) ON DELETE CASCADE,
  company_id            UUID REFERENCES companies(id) ON DELETE CASCADE,
  contractor            TEXT NOT NULL,
  utr                   TEXT,
  period                TEXT,
  gross_payment         NUMERIC(14,2) DEFAULT 0,
  materials_cost        NUMERIC(14,2) DEFAULT 0,
  labour_net            NUMERIC(14,2) DEFAULT 0,
  cis_deduction         NUMERIC(14,2) DEFAULT 0,
  status                TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','submitted','verified')),
  verification_status   TEXT NOT NULL DEFAULT 'net'
                        CHECK (verification_status IN ('gross','net','unverified')),
  created_at            TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_cis_returns_organization ON cis_returns(organization_id);
CREATE INDEX idx_cis_returns_company ON cis_returns(company_id);

-- Tenders
CREATE TABLE IF NOT EXISTS tenders (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  company_id      UUID REFERENCES companies(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  client       TEXT,
  value        NUMERIC(14,2) DEFAULT 0,
  deadline     DATE,
  status       TEXT NOT NULL DEFAULT 'drafting'
               CHECK (status IN ('drafting','submitted','shortlisted','won','lost')),
  probability  INT DEFAULT 50 CHECK (probability BETWEEN 0 AND 100),
  type         TEXT,
  location     TEXT,
  ai_score     INT CHECK (ai_score BETWEEN 0 AND 100),
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_tenders_organization ON tenders(organization_id);
CREATE INDEX idx_tenders_company ON tenders(company_id);

-- Contacts (CRM)
CREATE TABLE IF NOT EXISTS contacts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  company_id      UUID REFERENCES companies(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  company      TEXT,
  role         TEXT,
  email        TEXT,
  phone        TEXT,
  type         TEXT NOT NULL DEFAULT 'client'
               CHECK (type IN ('client','prospect','supplier','subcontractor','consultant')),
  value        NUMERIC(14,2) DEFAULT 0,
  last_contact DATE,
  status       TEXT NOT NULL DEFAULT 'active'
               CHECK (status IN ('active','dormant','lost')),
  projects     INT DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_contacts_organization ON contacts(organization_id);
CREATE INDEX idx_contacts_company ON contacts(company_id);

-- Risk Register
CREATE TABLE IF NOT EXISTS risk_register (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  company_id      UUID REFERENCES companies(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  project_id   UUID,
  project      TEXT,
  category     TEXT,
  likelihood   INT DEFAULT 3 CHECK (likelihood BETWEEN 1 AND 5),
  impact       INT DEFAULT 3 CHECK (impact BETWEEN 1 AND 5),
  risk_score   INT GENERATED ALWAYS AS (likelihood * impact) STORED,
  owner        TEXT,
  status       TEXT NOT NULL DEFAULT 'open'
               CHECK (status IN ('open','mitigated','closed','monitoring')),
  mitigation   TEXT,
  review_date  DATE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_risk_register_organization ON risk_register(organization_id);
CREATE INDEX idx_risk_register_company ON risk_register(company_id);

-- Purchase Orders
CREATE TABLE IF NOT EXISTS purchase_orders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  company_id      UUID REFERENCES companies(id) ON DELETE CASCADE,
  number        TEXT NOT NULL,
  supplier      TEXT,
  project_id    UUID,
  project       TEXT,
  amount        NUMERIC(14,2) DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft','sent','confirmed','delivered','cancelled')),
  order_date    DATE DEFAULT CURRENT_DATE,
  delivery_date DATE,
  items         JSONB DEFAULT '[]',
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_purchase_orders_organization ON purchase_orders(organization_id);
CREATE INDEX idx_purchase_orders_company ON purchase_orders(company_id);

-- Daily Reports
CREATE TABLE IF NOT EXISTS daily_reports (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID REFERENCES organizations(id) ON DELETE CASCADE,
  company_id       UUID REFERENCES companies(id) ON DELETE CASCADE,
  project_id       UUID,
  project          TEXT,
  date             DATE DEFAULT CURRENT_DATE,
  prepared_by      TEXT,
  weather          TEXT DEFAULT 'Sunny',
  temperature      TEXT,
  workers_on_site  INT DEFAULT 0,
  activities       JSONB DEFAULT '[]',
  materials        JSONB DEFAULT '[]',
  equipment        JSONB DEFAULT '[]',
  issues           JSONB DEFAULT '[]',
  photos           INT DEFAULT 0,
  progress         INT DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_daily_reports_organization ON daily_reports(organization_id);
CREATE INDEX idx_daily_reports_company ON daily_reports(company_id);
