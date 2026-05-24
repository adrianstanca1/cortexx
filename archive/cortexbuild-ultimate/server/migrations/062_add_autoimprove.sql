-- Migration: 062_add_autoimprove.sql
-- Autoimprove continuous optimization: schedules + recommendations tables

CREATE TABLE IF NOT EXISTS autoimprove_schedules (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID,
  company_id       UUID,
  frequency_hours  INT DEFAULT 24,
  budget_threshold NUMERIC DEFAULT 5.0,     -- % variance before alert
  safety_threshold INT DEFAULT 3,            -- incidents before alert
  defect_threshold INT DEFAULT 10,          -- open defects before alert
  enabled          BOOLEAN DEFAULT true,
  last_run_at      TIMESTAMPTZ,
  next_run_at      TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS autoimprove_recommendations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID,
  company_id       UUID,
  project_id       UUID,
  type             TEXT NOT NULL,  -- budget_variance | schedule_slip | safety_trend | defect_rate | resource_optimization
  severity         TEXT DEFAULT 'medium',  -- low | medium | high
  recommendation   TEXT NOT NULL,
  auto_actions     JSONB,           -- [{action: 'create_change_order', params: {...}}]
  status           TEXT DEFAULT 'pending',  -- pending | accepted | dismissed | completed
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  resolved_at      TIMESTAMPTZ,
  resolved_by      UUID
);

CREATE INDEX IF NOT EXISTS idx_autoimprove_schedules_org ON autoimprove_schedules(COALESCE(organization_id, company_id));
CREATE INDEX IF NOT EXISTS idx_autoimprove_recommendations_org ON autoimprove_recommendations(COALESCE(organization_id, company_id));
CREATE INDEX IF NOT EXISTS idx_autoimprove_recommendations_status ON autoimprove_recommendations(status) WHERE status = 'pending';
