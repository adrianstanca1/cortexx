-- ============================================================================
-- 0010_users_totp.sql
-- ============================================================================
-- Phase 2.6 of docs/ROADMAP.md — TOTP 2FA for super-admin (and any user
-- who opts in). Adds two columns to `users` and a new
-- `users_totp_recovery_codes` table for single-use recovery codes.
--
-- Idempotent (IF NOT EXISTS / CREATE INDEX IF NOT EXISTS).
-- ============================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS "totpSecret" varchar(64);
--> statement-breakpoint
ALTER TABLE users ADD COLUMN IF NOT EXISTS "totpVerifiedAt" timestamp;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS users_totp_recovery_codes (
  id           serial PRIMARY KEY,
  "userId"     integer NOT NULL,
  "codeHash"   varchar(64) NOT NULL,                        -- SHA-256 hex of dash-stripped lower-cased code
  "usedAt"     timestamp,                                   -- null until consumed
  "createdAt"  timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Each (userId, codeHash) pair is unique — recovery codes can't be re-issued
-- to the same user with the same hash by accident.
CREATE UNIQUE INDEX IF NOT EXISTS uq_recovery_user_hash
  ON users_totp_recovery_codes ("userId", "codeHash");
--> statement-breakpoint

-- Most lookups are "fetch unused codes for user X" — partial index keeps it tiny.
CREATE INDEX IF NOT EXISTS idx_recovery_user_unused
  ON users_totp_recovery_codes ("userId")
  WHERE "usedAt" IS NULL;
