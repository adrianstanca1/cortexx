-- Migration 065: Notification Infrastructure
-- Adds tables for push subscriptions, notification preferences, and Slack integration

-- Push subscriptions for Web Push notifications
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, endpoint)
);

-- User notification preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    email_on BOOLEAN DEFAULT true,
    push_on BOOLEAN DEFAULT true,
    slack_on BOOLEAN DEFAULT false,
    notification_types JSONB DEFAULT '{"invoice": true, "safety": true, "rfi": true, "project": true, "team": true}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Slack webhook integrations per organization/company
CREATE TABLE IF NOT EXISTS slack_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_url TEXT NOT NULL,
    organization_id UUID,
    company_id UUID,
    project_id UUID,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON notification_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_slack_integrations_org_company ON slack_integrations(organization_id, company_id);

-- Comments
COMMENT ON TABLE push_subscriptions IS 'Web Push notification subscriptions per user';
COMMENT ON TABLE notification_preferences IS 'User notification channel preferences';
COMMENT ON TABLE slack_integrations IS 'Slack webhook configurations per organization/company';