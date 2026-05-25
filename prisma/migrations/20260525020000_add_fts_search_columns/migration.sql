-- Add Postgres full-text-search columns + GIN indexes to the 8 models
-- the global /search page hits. Each column is a generated tsvector
-- over the text-bearing fields of the row, so writes don't need any
-- code change — Postgres rebuilds the vector on row update.
--
-- The IDX columns use idx_fts_<model> as the conventional name so the
-- search route can target them explicitly via raw SQL when needed.

-- Project
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "searchVector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("name", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("address", '')), 'B') ||
    setweight(to_tsvector('english', coalesce("postcode", '')), 'B') ||
    setweight(to_tsvector('english', coalesce("clientName", '')), 'C')
  ) STORED;
CREATE INDEX IF NOT EXISTS "idx_fts_project" ON "Project" USING GIN ("searchVector");

-- Task
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "searchVector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("description", '')), 'B') ||
    setweight(to_tsvector('english', coalesce("category", '')), 'C')
  ) STORED;
CREATE INDEX IF NOT EXISTS "idx_fts_task" ON "Task" USING GIN ("searchVector");

-- Invoice
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "searchVector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("number", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("clientName", '')), 'B') ||
    setweight(to_tsvector('english', coalesce("notes", '')), 'C')
  ) STORED;
CREATE INDEX IF NOT EXISTS "idx_fts_invoice" ON "Invoice" USING GIN ("searchVector");

-- Document
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "searchVector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("name", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("type", '')), 'C')
  ) STORED;
CREATE INDEX IF NOT EXISTS "idx_fts_document" ON "Document" USING GIN ("searchVector");

-- Snag
ALTER TABLE "Snag" ADD COLUMN IF NOT EXISTS "searchVector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("description", '')), 'B') ||
    setweight(to_tsvector('english', coalesce("location", '')), 'C')
  ) STORED;
CREATE INDEX IF NOT EXISTS "idx_fts_snag" ON "Snag" USING GIN ("searchVector");

-- Rfi
ALTER TABLE "Rfi" ADD COLUMN IF NOT EXISTS "searchVector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("number", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("subject", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("body", '')), 'B') ||
    setweight(to_tsvector('english', coalesce("response", '')), 'B') ||
    setweight(to_tsvector('english', coalesce("assignee", '')), 'C')
  ) STORED;
CREATE INDEX IF NOT EXISTS "idx_fts_rfi" ON "Rfi" USING GIN ("searchVector");

-- Customer
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "searchVector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("name", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("contactName", '')), 'B') ||
    setweight(to_tsvector('english', coalesce("contactEmail", '')), 'B') ||
    setweight(to_tsvector('english', coalesce("notes", '')), 'C')
  ) STORED;
CREATE INDEX IF NOT EXISTS "idx_fts_customer" ON "Customer" USING GIN ("searchVector");

-- Subcontractor
ALTER TABLE "Subcontractor" ADD COLUMN IF NOT EXISTS "searchVector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("name", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("trade", '')), 'B') ||
    setweight(to_tsvector('english', coalesce("contactName", '')), 'B') ||
    setweight(to_tsvector('english', coalesce("notes", '')), 'C')
  ) STORED;
CREATE INDEX IF NOT EXISTS "idx_fts_subcontractor" ON "Subcontractor" USING GIN ("searchVector");
