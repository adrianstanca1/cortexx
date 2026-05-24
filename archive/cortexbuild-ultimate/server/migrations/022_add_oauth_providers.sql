-- Migration 022: Add OAuth providers table for social login support
-- Created: 2026-04-02

-- OAuth providers table for linking external accounts (Google, etc.)
CREATE TABLE IF NOT EXISTS oauth_providers (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL, -- 'google', 'microsoft', etc.
    provider_user_id VARCHAR(255) NOT NULL, -- External provider's user ID
    access_token TEXT, -- Encrypted access token
    refresh_token TEXT, -- Encrypted refresh token
    email VARCHAR(255), -- Email from provider
    scope TEXT, -- Granted scopes (comma-separated)
    token_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    -- Ensure one provider per user
    UNIQUE(user_id, provider),
    -- Prevent same provider account from linking to multiple users (security)
    UNIQUE(provider, provider_user_id)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_oauth_providers_user_id ON oauth_providers(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_providers_provider ON oauth_providers(provider);
CREATE INDEX IF NOT EXISTS idx_oauth_providers_provider_user_id ON oauth_providers(provider, provider_user_id);

-- Add token management functions
CREATE OR REPLACE FUNCTION update_oauth_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER trigger_oauth_updated_at
    BEFORE UPDATE ON oauth_providers
    FOR EACH ROW
    EXECUTE FUNCTION update_oauth_updated_at();

-- Add comment for documentation
COMMENT ON TABLE oauth_providers IS 'Links external OAuth providers (Google, Microsoft) to local users';
