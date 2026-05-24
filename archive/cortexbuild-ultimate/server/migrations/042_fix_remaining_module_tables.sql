-- Migration 0009: Fix Remaining Module Tables (UUID + TIMESTAMPTZ + Multi-tenancy)
-- Run: psql "$DATABASE_URL" -f server/migrations/0009_fix_remaining_module_tables.sql
-- Fixes: email_logs, scheduled_emails, email_preferences, equipment_service_logs, equipment_hire_logs,
--        site_permits, risk_mitigation_actions, contact_interactions, safety_permits, toolbox_talks,
--        drawing_transmittals, email_templates

-- ─── Fix equipment_service_logs: UUID primary key, proper FK constraints ───────
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

-- ─── Fix equipment_hire_logs: UUID primary key ─────────────────────────────────
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

-- ─── Fix site_permits: UUID primary key ────────────────────────────────────────
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

-- ─── Fix risk_mitigation_actions: UUID, proper FK, convert risk_id to UUID ─────
CREATE TABLE IF NOT EXISTS risk_mitigation_actions_new (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    risk_id UUID REFERENCES risk_register(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    owner TEXT,
    due_date DATE,
    status TEXT DEFAULT 'Not Started' CHECK (status IN ('Not Started', 'In Progress', 'Completed', 'Overdue')),
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'risk_mitigation_actions') THEN
        INSERT INTO risk_mitigation_actions_new (risk_id, title, owner, due_date, status, progress, organization_id, company_id, created_at)
        SELECT
            CASE WHEN risk_id ~ '^[0-9a-f]{8}-' THEN risk_id::UUID ELSE NULL END,
            title, owner, due_date, status, progress, organization_id, company_id, created_at
        FROM risk_mitigation_actions;

        DROP TABLE risk_mitigation_actions;

        ALTER TABLE risk_mitigation_actions_new RENAME TO risk_mitigation_actions;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_risk_mitigation_actions_risk ON risk_mitigation_actions(risk_id);
CREATE INDEX IF NOT EXISTS idx_risk_mitigation_actions_organization ON risk_mitigation_actions(organization_id);
CREATE INDEX IF NOT EXISTS idx_risk_mitigation_actions_company ON risk_mitigation_actions(company_id);

-- ─── Fix contact_interactions: UUID, proper FK, convert contact_id to UUID ─────
CREATE TABLE IF NOT EXISTS contact_interactions_new (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('call', 'email', 'meeting')),
    date DATE NOT NULL,
    note TEXT,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contact_interactions') THEN
        INSERT INTO contact_interactions_new (contact_id, type, date, note, organization_id, company_id, created_at)
        SELECT
            CASE WHEN contact_id ~ '^[0-9a-f]{8}-' THEN contact_id::UUID ELSE NULL END,
            type, date, note, organization_id, company_id, created_at
        FROM contact_interactions;

        DROP TABLE contact_interactions;

        ALTER TABLE contact_interactions_new RENAME TO contact_interactions;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_contact_interactions_contact ON contact_interactions(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_interactions_organization ON contact_interactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_contact_interactions_company ON contact_interactions(company_id);

-- ─── Fix safety_permits: UUID primary key ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS safety_permits_new (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    permit_no TEXT NOT NULL,
    type TEXT NOT NULL,
    project TEXT,
    location TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    issued_by TEXT,
    status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Expired', 'Cancelled')),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'safety_permits') THEN
        INSERT INTO safety_permits_new (permit_no, type, project, location, start_date, end_date, issued_by, status, organization_id, company_id, created_at)
        SELECT permit_no, type, project, location, start_date, end_date, issued_by, status, organization_id, company_id, created_at
        FROM safety_permits;

        DROP TABLE safety_permits;

        ALTER TABLE safety_permits_new RENAME TO safety_permits;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_safety_permits_organization ON safety_permits(organization_id);
CREATE INDEX IF NOT EXISTS idx_safety_permits_company ON safety_permits(company_id);

-- ─── Fix toolbox_talks: UUID primary key ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS toolbox_talks_new (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    topic TEXT NOT NULL,
    location TEXT,
    presenter TEXT,
    attendees INTEGER DEFAULT 0,
    signed_off BOOLEAN DEFAULT FALSE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'toolbox_talks') THEN
        INSERT INTO toolbox_talks_new (date, topic, location, presenter, attendees, signed_off, organization_id, company_id, created_at)
        SELECT date, topic, location, presenter, attendees, signed_off, organization_id, company_id, created_at
        FROM toolbox_talks;

        DROP TABLE toolbox_talks;

        ALTER TABLE toolbox_talks_new RENAME TO toolbox_talks;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_toolbox_talks_organization ON toolbox_talks(organization_id);
CREATE INDEX IF NOT EXISTS idx_toolbox_talks_company ON toolbox_talks(company_id);

-- ─── Fix drawing_transmittals: UUID primary key ────────────────────────────────
CREATE TABLE IF NOT EXISTS drawing_transmittals_new (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project TEXT NOT NULL,
    issued_to TEXT,
    date DATE NOT NULL,
    purpose TEXT,
    status TEXT DEFAULT 'Issued' CHECK (status IN ('Issued', 'Pending', 'Received')),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'drawing_transmittals') THEN
        INSERT INTO drawing_transmittals_new (project, issued_to, date, purpose, status, organization_id, company_id, created_at)
        SELECT project, issued_to, date, purpose, status, organization_id, company_id, created_at
        FROM drawing_transmittals;

        DROP TABLE drawing_transmittals;

        ALTER TABLE drawing_transmittals_new RENAME TO drawing_transmittals;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_drawing_transmittals_organization ON drawing_transmittals(organization_id);
CREATE INDEX IF NOT EXISTS idx_drawing_transmittals_company ON drawing_transmittals(company_id);

-- ─── Fix email_templates: UUID, TIMESTAMPTZ, UUID created_by ───────────────────
CREATE TABLE IF NOT EXISTS email_templates_new (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    body TEXT,
    email_type VARCHAR(50) NOT NULL,
    description VARCHAR(255),
    variables JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'email_templates') THEN
        INSERT INTO email_templates_new (organization_id, company_id, name, subject, body, email_type, description, variables, is_active, created_by, created_at, updated_at)
        SELECT
            NULL, NULL, name, subject, body, email_type, description, variables, is_active,
            CASE
                WHEN created_by ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN created_by::UUID
                ELSE NULL
            END,
            created_at::TIMESTAMPTZ, updated_at::TIMESTAMPTZ
        FROM email_templates;

        DROP TABLE email_templates;

        ALTER TABLE email_templates_new RENAME TO email_templates;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_email_templates_type ON email_templates(email_type);
CREATE INDEX IF NOT EXISTS idx_email_templates_active ON email_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_email_templates_creator ON email_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_email_templates_organization ON email_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_company ON email_templates(company_id);

-- Note: email_logs, scheduled_emails, email_preferences already fixed in 0007
