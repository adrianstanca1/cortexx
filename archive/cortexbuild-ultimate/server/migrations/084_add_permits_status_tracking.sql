-- Migration: 084_add_permits_status_tracking
-- Purpose: Enhanced permit status tracking, renewal reminders, and notes

-- Add status enum columns if not present
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='site_permits' AND column_name='apply_date') THEN
        ALTER TABLE site_permits ADD COLUMN apply_date DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='site_permits' AND column_name='reminder_date') THEN
        ALTER TABLE site_permits ADD COLUMN reminder_date DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='site_permits' AND column_name='notes') THEN
        ALTER TABLE site_permits ADD COLUMN notes TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='site_permits' AND column_name='priority') THEN
        ALTER TABLE site_permits ADD COLUMN priority TEXT DEFAULT 'medium';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='site_permits' AND column_name='reminder_sent') THEN
        ALTER TABLE site_permits ADD COLUMN reminder_sent BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Ensure we have an index on status + dates for filtering
CREATE INDEX IF NOT EXISTS idx_site_permits_status ON site_permits(status);
CREATE INDEX IF NOT EXISTS idx_site_permits_dates ON site_permits(from_date, to_date);
