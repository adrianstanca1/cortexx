-- Migration: 057_add_updated_at_triggers
-- Purpose: Add updated_at columns and auto-update triggers to tables that
--          lack them. Currently, invoices/rfis/tenders have no updated_at
--          column at all, and companies/cost_forecasts have the column but
--          no trigger — so updated_at never changes after INSERT.
-- Run: After migrations 000-056.

-- ─── 1. Add updated_at column to tables that lack it ──────────────────────────
-- Existing rows get updated_at = created_at (best-effort backfill), then
-- the DEFAULT is set to NOW() for future inserts.

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
UPDATE invoices SET updated_at = created_at WHERE updated_at IS NULL;
ALTER TABLE invoices ALTER COLUMN updated_at SET DEFAULT NOW();

ALTER TABLE rfis ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
UPDATE rfis SET updated_at = created_at WHERE updated_at IS NULL;
ALTER TABLE rfis ALTER COLUMN updated_at SET DEFAULT NOW();

ALTER TABLE tenders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
UPDATE tenders SET updated_at = created_at WHERE updated_at IS NULL;
ALTER TABLE tenders ALTER COLUMN updated_at SET DEFAULT NOW();

-- ─── 2. Generic reusable trigger function ─────────────────────────────────────
-- Unlike the per-table approach in migration 022 (update_oauth_updated_at),
-- this single function is shared by all triggers — avoids function sprawl.

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── 3. Create BEFORE UPDATE triggers on all 5 tables ───────────────────────
-- DROP + CREATE for clean idempotency — if a trigger with the same name
-- existed but pointed to a different function, this replaces it correctly.

DO $$
BEGIN
    DROP TRIGGER IF EXISTS trigger_invoices_updated_at ON invoices;
    CREATE TRIGGER trigger_invoices_updated_at
        BEFORE UPDATE ON invoices
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$;

DO $$
BEGIN
    DROP TRIGGER IF EXISTS trigger_rfis_updated_at ON rfis;
    CREATE TRIGGER trigger_rfis_updated_at
        BEFORE UPDATE ON rfis
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$;

DO $$
BEGIN
    DROP TRIGGER IF EXISTS trigger_tenders_updated_at ON tenders;
    CREATE TRIGGER trigger_tenders_updated_at
        BEFORE UPDATE ON tenders
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$;

DO $$
BEGIN
    DROP TRIGGER IF EXISTS trigger_companies_updated_at ON companies;
    CREATE TRIGGER trigger_companies_updated_at
        BEFORE UPDATE ON companies
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$;

DO $$
BEGIN
    DROP TRIGGER IF EXISTS trigger_cost_forecasts_updated_at ON cost_forecasts;
    CREATE TRIGGER trigger_cost_forecasts_updated_at
        BEFORE UPDATE ON cost_forecasts
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$;