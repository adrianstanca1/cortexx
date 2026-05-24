-- Webhooks table for external integrations (Slack, Zapier, custom HTTP callbacks)
CREATE TABLE IF NOT EXISTS webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID,
    company_id UUID,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    secret TEXT, -- HMAC signing secret
    events TEXT[] NOT NULL, -- e.g. {'project.created', 'invoice.paid', 'rfi.overdue'}
    active BOOLEAN DEFAULT true,
    headers JSONB DEFAULT '{}', -- custom headers (e.g. Authorization)
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_triggered_at TIMESTAMPTZ,
    last_status_code INTEGER,
    last_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_webhooks_org ON webhooks(organization_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_company ON webhooks(company_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_active ON webhooks(active) WHERE active = true;

-- Webhook delivery log (audit trail)
CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
    event TEXT NOT NULL,
    payload JSONB NOT NULL,
    response_status INTEGER,
    response_body TEXT,
    response_time_ms INTEGER,
    success BOOLEAN DEFAULT false,
    attempted_at TIMESTAMPTZ DEFAULT NOW(),
    next_retry_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook ON webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_attempted ON webhook_deliveries(attempted_at DESC);

DO $$
DECLARE
    demo_org_id UUID := '00000000-0000-0000-0000-000000000001';
    demo_company_id UUID := '00000000-0000-0000-0000-000000000002';
BEGIN
    -- Seed demo webhooks
    INSERT INTO webhooks (organization_id, company_id, name, url, events, active, headers) VALUES
        (demo_org_id, demo_company_id, 'Slack Notifications', 'https://hooks.slack.com/services/example', ARRAY['project.created', 'project.updated', 'invoice.paid', 'safety.incident'], true, '{"Content-Type": "application/json"}'::jsonb),
        (demo_org_id, demo_company_id, 'Zapier Backup', 'https://hooks.zapier.com/hooks/catch/example', ARRAY['invoice.created', 'invoice.updated', 'rfi.created', 'rfi.updated'], true, '{}'::jsonb)
    ON CONFLICT DO NOTHING;
END $$;
