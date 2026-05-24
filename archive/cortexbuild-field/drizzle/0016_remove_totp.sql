-- Remove TOTP / 2FA from the schema.
--
-- Drops the per-user TOTP secret + verified-at columns and the
-- single-use recovery-code sidecar table. Idempotent — safe to re-apply
-- if the journal entry is partially recorded.
--
-- Sister code removal:
--   - server/_core/totp.ts (deleted)
--   - server/routers/auth.ts: enableTotp/verifyTotp/disableTotp/completeTotpLogin (deleted)
--   - app/totp.tsx (deleted)
--   - lib/super-admin-gate-decision.ts (deleted)
--   - server/_core/trpc.ts: superAdminProcedure now aliases adminProcedure
--   - server/_core/user-response.ts: totpEnrolled removed from response shape
--
-- Originally introduced by 0010_users_totp.sql (Phase 2.6).
ALTER TABLE "users" DROP COLUMN IF EXISTS "totpSecret";
ALTER TABLE "users" DROP COLUMN IF EXISTS "totpVerifiedAt";
DROP TABLE IF EXISTS "users_totp_recovery_codes";
