-- Migration: 061_add_autoresearch.sql
-- Autoresearch deep research job queue + results tables

CREATE TABLE IF NOT EXISTS autoresearch_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID,
  company_id      UUID,
  user_id         UUID NOT NULL,
  session_id      TEXT,
  query           TEXT NOT NULL,
  depth           TEXT DEFAULT 'medium' CHECK (depth IN ('shallow', 'medium', 'deep')),
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  error_message   TEXT
);

CREATE TABLE IF NOT EXISTS autoresearch_results (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          UUID NOT NULL REFERENCES autoresearch_jobs(id) ON DELETE CASCADE,
  finding         JSONB NOT NULL,
  data_gap        TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for polling
CREATE INDEX IF NOT EXISTS idx_autoresearch_jobs_status ON autoresearch_jobs(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_autoresearch_jobs_org ON autoresearch_jobs(COALESCE(organization_id, company_id));
CREATE INDEX IF NOT EXISTS idx_autoresearch_results_job ON autoresearch_results(job_id);
