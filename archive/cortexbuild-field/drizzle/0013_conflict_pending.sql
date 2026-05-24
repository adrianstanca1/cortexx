-- ============================================================================
-- 0013_conflict_pending.sql
-- ============================================================================
-- Sidecar table for offline sync conflicts. When the sync-queue replayer
-- detects a write-write conflict (base row was mutated server-side while the
-- device was offline), it parks a row here instead of clobbering either side.
-- Tenant-scoped via companyId. The partial index on (companyId, userId,
-- resolvedAt) makes "what's unresolved for this user?" a hot-path index scan.
-- resolvedAt = NULL means unresolved; set by the conflict-resolution handler.
-- ============================================================================

CREATE TABLE IF NOT EXISTS "conflict_pending" (
  "id"             SERIAL PRIMARY KEY,
  "companyId"      INTEGER NOT NULL REFERENCES "companies"("id"),
  "userId"         INTEGER NOT NULL REFERENCES "users"("id"),
  "tableName"      VARCHAR(64) NOT NULL,
  "rowId"          INTEGER NOT NULL,
  "conflictFields" JSONB NOT NULL,
  "mineValues"     JSONB NOT NULL,
  "theirsValues"   JSONB NOT NULL,
  "baseUpdatedAt"  TIMESTAMP NOT NULL,
  "resolvedAt"     TIMESTAMP,
  "createdAt"      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "conflict_pending_user_unresolved_idx"
  ON "conflict_pending" ("companyId", "userId", "resolvedAt");
