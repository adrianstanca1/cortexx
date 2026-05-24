-- Migration: 059_add_tenant_columns_remaining
-- Purpose: Add organization_id (and company_id where appropriate) to the
--          remaining tables that lack direct tenant isolation. These tables
--          currently rely on FK joins for tenant scope, which the generic CRUD
--          router and tenantFilter middleware cannot use.
-- Run: After migrations 000-058.
-- Note: organizations table is skipped — it IS the root entity.

-- ─── 1. Add columns ──────────────────────────────────────────────────────────

ALTER TABLE app_settings          ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE bim4d_tasks           ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE bim_model_layers      ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE bim_processing_queue  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE document_embeddings   ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE document_versions     ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE equipment_telemetry   ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE notification_settings ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE webhook_deliveries     ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Also add company_id with FK constraint (mirrors migration 055 pattern)
ALTER TABLE app_settings          ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
ALTER TABLE bim4d_tasks           ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
ALTER TABLE bim_model_layers      ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
ALTER TABLE bim_processing_queue  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
ALTER TABLE document_embeddings   ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
ALTER TABLE document_versions     ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
ALTER TABLE equipment_telemetry   ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
ALTER TABLE notification_settings ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
ALTER TABLE webhook_deliveries     ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

-- ─── 2. Backfill from parent tables ──────────────────────────────────────────
-- Uses COALESCE on parent organization_id to handle company_owner users
-- where organization_id is NULL (falls back to company_id on the parent).
-- Also backfills company_id alongside organization_id.

-- User-derived tables: backfill from users table
UPDATE app_settings a
SET organization_id = COALESCE(u.organization_id, u.company_id),
    company_id = u.company_id
FROM users u
WHERE a.user_id = u.id
  AND a.organization_id IS NULL
  AND a.user_id IS NOT NULL;

UPDATE notification_settings n
SET organization_id = COALESCE(u.organization_id, u.company_id),
    company_id = u.company_id
FROM users u
WHERE n.user_id = u.id
  AND n.organization_id IS NULL
  AND n.user_id IS NOT NULL;

-- BIM-derived tables: backfill from bim_models
UPDATE bim4d_tasks t
SET organization_id = m.organization_id,
    company_id = m.company_id
FROM bim4d_models m
WHERE t.model_id = m.id
  AND t.organization_id IS NULL;

UPDATE bim_model_layers l
SET organization_id = m.organization_id,
    company_id = m.company_id
FROM bim_models m
WHERE l.model_id = m.id
  AND l.organization_id IS NULL;

UPDATE bim_processing_queue q
SET organization_id = m.organization_id,
    company_id = m.company_id
FROM bim_models m
WHERE q.model_id = m.id
  AND q.organization_id IS NULL;

-- Document-derived tables: backfill from documents
UPDATE document_embeddings e
SET organization_id = d.organization_id,
    company_id = d.company_id
FROM documents d
WHERE e.document_id = d.id
  AND e.organization_id IS NULL;

UPDATE document_versions v
SET organization_id = d.organization_id,
    company_id = d.company_id
FROM documents d
WHERE v.document_id = d.id
  AND v.organization_id IS NULL;

-- Equipment-derived: backfill from equipment_devices
UPDATE equipment_telemetry t
SET organization_id = ed.organization_id,
    company_id = ed.company_id
FROM equipment_devices ed
WHERE t.device_id = ed.id
  AND t.organization_id IS NULL;

-- Webhook-derived: backfill from webhooks
UPDATE webhook_deliveries wd
SET organization_id = w.organization_id,
    company_id = w.company_id
FROM webhooks w
WHERE wd.webhook_id = w.id
  AND wd.organization_id IS NULL;

-- ─── 3. Indexes for COALESCE tenant-filtered queries ───────────────────────────
-- Matches migration 055 pattern: indexes on COALESCE(organization_id, company_id)
-- so that WHERE COALESCE(organization_id, company_id) = $1 uses the index.

CREATE INDEX IF NOT EXISTS idx_app_settings_tenant          ON app_settings(COALESCE(organization_id, company_id));
CREATE INDEX IF NOT EXISTS idx_bim4d_tasks_tenant            ON bim4d_tasks(COALESCE(organization_id, company_id));
CREATE INDEX IF NOT EXISTS idx_bim_model_layers_tenant      ON bim_model_layers(COALESCE(organization_id, company_id));
CREATE INDEX IF NOT EXISTS idx_bim_processing_queue_tenant   ON bim_processing_queue(COALESCE(organization_id, company_id));
CREATE INDEX IF NOT EXISTS idx_document_embeddings_tenant    ON document_embeddings(COALESCE(organization_id, company_id));
CREATE INDEX IF NOT EXISTS idx_document_versions_tenant      ON document_versions(COALESCE(organization_id, company_id));
CREATE INDEX IF NOT EXISTS idx_equipment_telemetry_tenant    ON equipment_telemetry(COALESCE(organization_id, company_id));
CREATE INDEX IF NOT EXISTS idx_notification_settings_tenant  ON notification_settings(COALESCE(organization_id, company_id));
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_tenant     ON webhook_deliveries(COALESCE(organization_id, company_id));

-- ─── 4. Validation: report rows still lacking tenant scope ──────────────────────
DO $$
DECLARE
  orphan_count integer;
BEGIN
  SELECT COUNT(*) INTO orphan_count FROM app_settings WHERE organization_id IS NULL AND company_id IS NULL;
  IF orphan_count > 0 THEN RAISE NOTICE 'Migration 059: % rows in app_settings still have NULL organization_id AND company_id (orphan user_id)', orphan_count; END IF;

  SELECT COUNT(*) INTO orphan_count FROM bim4d_tasks WHERE organization_id IS NULL AND company_id IS NULL;
  IF orphan_count > 0 THEN RAISE NOTICE 'Migration 059: % rows in bim4d_tasks still have NULL organization_id AND company_id (orphan model_id)', orphan_count; END IF;

  SELECT COUNT(*) INTO orphan_count FROM bim_model_layers WHERE organization_id IS NULL AND company_id IS NULL;
  IF orphan_count > 0 THEN RAISE NOTICE 'Migration 059: % rows in bim_model_layers still have NULL organization_id AND company_id', orphan_count; END IF;

  SELECT COUNT(*) INTO orphan_count FROM bim_processing_queue WHERE organization_id IS NULL AND company_id IS NULL;
  IF orphan_count > 0 THEN RAISE NOTICE 'Migration 059: % rows in bim_processing_queue still have NULL organization_id AND company_id', orphan_count; END IF;

  SELECT COUNT(*) INTO orphan_count FROM document_embeddings WHERE organization_id IS NULL AND company_id IS NULL;
  IF orphan_count > 0 THEN RAISE NOTICE 'Migration 059: % rows in document_embeddings still have NULL organization_id AND company_id', orphan_count; END IF;

  SELECT COUNT(*) INTO orphan_count FROM document_versions WHERE organization_id IS NULL AND company_id IS NULL;
  IF orphan_count > 0 THEN RAISE NOTICE 'Migration 059: % rows in document_versions still have NULL organization_id AND company_id', orphan_count; END IF;

  SELECT COUNT(*) INTO orphan_count FROM equipment_telemetry WHERE organization_id IS NULL AND company_id IS NULL;
  IF orphan_count > 0 THEN RAISE NOTICE 'Migration 059: % rows in equipment_telemetry still have NULL organization_id AND company_id', orphan_count; END IF;

  SELECT COUNT(*) INTO orphan_count FROM notification_settings WHERE organization_id IS NULL AND company_id IS NULL;
  IF orphan_count > 0 THEN RAISE NOTICE 'Migration 059: % rows in notification_settings still have NULL organization_id AND company_id (orphan user_id)', orphan_count; END IF;

  SELECT COUNT(*) INTO orphan_count FROM webhook_deliveries WHERE organization_id IS NULL AND company_id IS NULL;
  IF orphan_count > 0 THEN RAISE NOTICE 'Migration 059: % rows in webhook_deliveries still have NULL organization_id AND company_id', orphan_count; END IF;
END $$;