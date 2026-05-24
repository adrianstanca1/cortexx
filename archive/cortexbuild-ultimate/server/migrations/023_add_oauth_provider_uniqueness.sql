-- Migration 023: Add unique constraint to prevent same OAuth account linking to multiple users
-- Created: 2026-04-02
-- Security fix: Prevents attacker from linking their OAuth account to another user's account

-- Add unique constraint on (provider, provider_user_id) to prevent duplicate provider accounts
-- This ensures a Google/Microsoft account can only be linked to one user
DO $$
BEGIN
    -- Check if index already exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'idx_oauth_providers_unique_provider_account'
    ) THEN
        CREATE UNIQUE INDEX idx_oauth_providers_unique_provider_account
        ON oauth_providers(provider, provider_user_id);
    END IF;
END $$;

-- Add comment documenting the security constraint
COMMENT ON INDEX idx_oauth_providers_unique_provider_account IS
'Prevents same OAuth provider account from being linked to multiple users (security fix)';
