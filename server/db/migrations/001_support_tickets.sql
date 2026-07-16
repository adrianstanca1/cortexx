-- Migration: support_tickets
-- Adds a customer-support ticket table used by the public ticket form
-- (/api/support/tickets) and the admin console (/api/admin/support/tickets).
CREATE TABLE IF NOT EXISTS support_tickets (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT NOT NULL,
  email        TEXT NOT NULL,
  subject      TEXT NOT NULL,
  message      TEXT NOT NULL,
  priority     TEXT DEFAULT 'normal',            -- low | normal | high | urgent
  status       TEXT DEFAULT 'open',               -- open | in_progress | resolved | closed
  workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created ON support_tickets(created_at DESC);
