-- Migration: 070_add_mfa
-- Purpose: Add TOTP-based MFA (RFC 6238) support with recovery codes

BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_secret VARCHAR(64) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_recovery_codes_hash TEXT[] NULL;

-- NOTE: mfa_secret is stored in base32 format per RFC 6238.
-- At-rest encryption is deferred to follow-up (would require KMS integration).
-- Recovery codes are bcrypt-hashed individually before storage in array.

COMMIT;
