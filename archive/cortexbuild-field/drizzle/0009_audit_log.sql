-- ============================================================================
-- 0009_audit_log.sql
-- ============================================================================
-- Multi-tenant audit log. Every administrative-class mutation writes one
-- row here capturing who did what, against what entity, with what input
-- (redacted) and result (success/error). Phase 2.5 of docs/ROADMAP.md.
--
-- Indexed by (companyId, createdAt DESC) so the super-admin UI can
-- "show me the last 50 actions in tenant X" without a full table scan.
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_log (
  id           serial PRIMARY KEY,
  "companyId"  integer NOT NULL,
  "userId"     integer,                               -- null for system events (cron, bootstrap)
  action       varchar(96) NOT NULL,                  -- e.g. "users.revokeInvite"
  "entityType" varchar(64),                           -- e.g. "invited_user"
  "entityId"   integer,
  ip           varchar(45),                           -- IPv6 max length
  "userAgent"  text,
  "inputJson"  text,                                  -- redacted JSON of input
  "resultJson" text,                                  -- redacted JSON of result (or null on error)
  "errorCode"  varchar(64),                           -- tRPC error code if failed (NOT NULL means error)
  "errorMessage" text,
  "createdAt"  timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_audit_log_company_created
  ON audit_log ("companyId", "createdAt" DESC);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_audit_log_user_created
  ON audit_log ("userId", "createdAt" DESC);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_audit_log_entity
  ON audit_log ("entityType", "entityId");
