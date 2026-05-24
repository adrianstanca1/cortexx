-- Migration 0007: Fix Email Tables (UUID + TIMESTAMPTZ + Multi-tenancy)
-- Run: psql "$DATABASE_URL" -f server/migrations/0007_fix_email_tables.sql

-- Recreate email_logs with proper types
CREATE TABLE IF NOT EXISTS email_logs_new (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    recipient VARCHAR(255) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    body TEXT,
    email_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'delivered', 'failed', 'bounced')),
    error TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ
);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'email_logs') THEN
        INSERT INTO email_logs_new (organization_id, company_id, recipient, subject, body, email_type, status, error, created_by, created_at, sent_at, delivered_at)
        SELECT
            organization_id, company_id, recipient, subject, body, email_type, status, error,
            CASE WHEN created_by ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN created_by::UUID ELSE NULL END,
            created_at::TIMESTAMPTZ, sent_at::TIMESTAMPTZ, delivered_at::TIMESTAMPTZ
        FROM email_logs;

        DROP TABLE email_logs;

        ALTER TABLE email_logs_new RENAME TO email_logs;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON email_logs(recipient);
CREATE INDEX IF NOT EXISTS idx_email_logs_type ON email_logs(email_type);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_created ON email_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_organization ON email_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_company ON email_logs(company_id);

-- Recreate scheduled_emails with proper types
CREATE TABLE IF NOT EXISTS scheduled_emails_new (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    recipient VARCHAR(255) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    email_type VARCHAR(50) NOT NULL,
    data JSONB,
    scheduled_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'cancelled', 'failed')),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'scheduled_emails') THEN
        INSERT INTO scheduled_emails_new (organization_id, company_id, recipient, subject, email_type, data, scheduled_at, status, created_by, created_at)
        SELECT
            organization_id, company_id, recipient, subject, email_type, data, scheduled_at::TIMESTAMPTZ, status,
            CASE WHEN created_by ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN created_by::UUID ELSE NULL END,
            created_at::TIMESTAMPTZ
        FROM scheduled_emails;

        DROP TABLE scheduled_emails;

        ALTER TABLE scheduled_emails_new RENAME TO scheduled_emails;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_scheduled_emails_scheduled ON scheduled_emails(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_status ON scheduled_emails(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_organization ON scheduled_emails(organization_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_company ON scheduled_emails(company_id);

-- Recreate email_preferences with proper types
CREATE TABLE IF NOT EXISTS email_preferences_new (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    invoice_overdue BOOLEAN DEFAULT TRUE,
    invoice_paid BOOLEAN DEFAULT TRUE,
    project_update BOOLEAN DEFAULT TRUE,
    safety_alert BOOLEAN DEFAULT TRUE,
    rfi_response BOOLEAN DEFAULT TRUE,
    meeting_reminder BOOLEAN DEFAULT TRUE,
    deadline_reminder BOOLEAN DEFAULT TRUE,
    document_shared BOOLEAN DEFAULT FALSE,
    team_assignment BOOLEAN DEFAULT TRUE,
    weekly_summary BOOLEAN DEFAULT FALSE,
    daily_digest BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'email_preferences') THEN
        INSERT INTO email_preferences_new (organization_id, company_id, user_id, invoice_overdue, invoice_paid, project_update, safety_alert, rfi_response, meeting_reminder, deadline_reminder, document_shared, team_assignment, weekly_summary, daily_digest, created_at, updated_at)
        SELECT
            organization_id, company_id,
            CASE WHEN user_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN user_id::UUID ELSE NULL END,
            invoice_overdue, invoice_paid, project_update, safety_alert, rfi_response, meeting_reminder, deadline_reminder, document_shared, team_assignment, weekly_summary, daily_digest,
            created_at::TIMESTAMPTZ, updated_at::TIMESTAMPTZ
        FROM email_preferences;

        DROP TABLE email_preferences;

        ALTER TABLE email_preferences_new RENAME TO email_preferences;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_email_preferences_user ON email_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_email_preferences_organization ON email_preferences(organization_id);
CREATE INDEX IF NOT EXISTS idx_email_preferences_company ON email_preferences(company_id);
