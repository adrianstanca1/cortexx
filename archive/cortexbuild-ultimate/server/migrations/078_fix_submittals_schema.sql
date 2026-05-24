-- 078_fix_submittals_schema.sql
-- Bridge migration: add missing columns/tables so the dedicated submittals route
-- (which expects the 027 schema) works with the 077 table.

-- Add missing columns to the 077 submittals table
ALTER TABLE submittals
  ADD COLUMN IF NOT EXISTS submittal_number VARCHAR(100),
  ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS priority VARCHAR(50) DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS revision_number INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS submitted_by_company TEXT,
  ADD COLUMN IF NOT EXISTS response_notes TEXT;

-- Sync submittal_number from existing number column
UPDATE submittals SET submittal_number = number WHERE submittal_number IS NULL AND number IS NOT NULL;

-- Create attachment table (027 schema, reused by dedicated route)
CREATE TABLE IF NOT EXISTS submittal_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submittal_id UUID REFERENCES submittals(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  file_type TEXT,
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_submittal_attachments_submittal_id ON submittal_attachments(submittal_id);

-- Create comment table (027 schema, reused by dedicated route)
CREATE TABLE IF NOT EXISTS submittal_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submittal_id UUID REFERENCES submittals(id) ON DELETE CASCADE,
  author_id UUID REFERENCES users(id) ON DELETE SET NULL,
  author_name TEXT,
  comment TEXT NOT NULL,
  is_review_comment BOOLEAN DEFAULT false,
  requires_response BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_submittal_comments_submittal_id ON submittal_comments(submittal_id);
CREATE INDEX IF NOT EXISTS idx_submittal_comments_created ON submittal_comments(created_at DESC);

-- Add updated_at trigger for comments
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_submittal_comments_updated_at ON submittal_comments;
CREATE TRIGGER tr_submittal_comments_updated_at
  BEFORE UPDATE ON submittal_comments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
