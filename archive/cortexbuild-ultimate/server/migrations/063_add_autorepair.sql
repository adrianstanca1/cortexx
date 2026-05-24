-- Migration: 063_add_autorepair.sql
-- Autorepair self-healing infrastructure monitoring tables

CREATE TABLE IF NOT EXISTS autorepair_incidents (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID,
  company_id       UUID,
  type             TEXT NOT NULL,  -- ollama_down | rag_embedding_failed | intent_misclassify | container_unhealthy | cache_corrupt
  severity         TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status           TEXT DEFAULT 'open' CHECK (status IN ('open', 'diagnosing', 'repairing', 'resolved', 'failed')),
  detected_at      TIMESTAMPTZ DEFAULT NOW(),
  diagnosed_at     TIMESTAMPTZ,
  resolved_at      TIMESTAMPTZ,
  diagnosis        JSONB,
  error_context   JSONB,
  resolution_notes TEXT
);

CREATE TABLE IF NOT EXISTS autorepair_actions_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id   UUID REFERENCES autorepair_incidents(id) ON DELETE CASCADE,
  action        TEXT NOT NULL,
  dry_run       BOOLEAN DEFAULT false,
  status        TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  executed_at   TIMESTAMPTZ,
  result        JSONB,
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS autorepair_confirmations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id   UUID REFERENCES autorepair_incidents(id) ON DELETE CASCADE,
  action        TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  expires_at    TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '15 minutes'),
  confirmed_by  UUID,
  status        TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired'))
);

CREATE INDEX IF NOT EXISTS idx_autorepair_incidents_status ON autorepair_incidents(status) WHERE status IN ('open', 'diagnosing');
CREATE INDEX IF NOT EXISTS idx_autorepair_incidents_org ON autorepair_incidents(COALESCE(organization_id, company_id));
CREATE INDEX IF NOT EXISTS idx_autorepair_confirmations_expires ON autorepair_confirmations(expires_at) WHERE status = 'pending';
