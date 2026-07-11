-- Cortexx — PostgreSQL schema
-- Covers all core entities. Multi-tenant via workspace_id.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Tenancy & auth ──────────────────────────────────────────
CREATE TABLE workspaces (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  company     TEXT,
  plan        TEXT DEFAULT 'free',
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id  UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT DEFAULT 'director',
  cscs          TEXT,
  safety_score  INT DEFAULT 90,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ── Core construction entities ──────────────────────────────
CREATE TABLE projects (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  client       TEXT,
  value        NUMERIC DEFAULT 0,
  pct          INT DEFAULT 0,
  status       TEXT DEFAULT 'quoting',
  addr         TEXT,
  team         INT DEFAULT 0,
  due          DATE,
  margin       NUMERIC DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE tasks (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id   UUID REFERENCES projects(id) ON DELETE SET NULL,
  title        TEXT NOT NULL,
  assignee     TEXT,
  due          DATE,
  prio         TEXT DEFAULT 'med',
  done         BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE team_members (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id  UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  role          TEXT,
  color         TEXT,
  site          TEXT,
  hours         NUMERIC DEFAULT 0,
  status        TEXT DEFAULT 'off',
  cscs          TEXT,
  phone         TEXT,
  email         TEXT,
  day_rate      NUMERIC,
  certificates  JSONB DEFAULT '[]',
  qualifications JSONB DEFAULT '[]',
  skills        JSONB DEFAULT '[]',
  meta          JSONB DEFAULT '{}'
);

CREATE TABLE invoices (
  id           TEXT PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id   UUID REFERENCES projects(id) ON DELETE SET NULL,
  client       TEXT,
  amount       NUMERIC,
  status       TEXT DEFAULT 'due',
  issued       DATE,
  due          DATE,
  paid         DATE
);

CREATE TABLE quotes (
  id           TEXT PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id   UUID REFERENCES projects(id) ON DELETE SET NULL,
  client       TEXT,
  title        TEXT,
  total        NUMERIC,
  status       TEXT DEFAULT 'draft',
  issued       DATE,
  valid_until  DATE,
  items        JSONB DEFAULT '[]'
);

-- ── Generic JSON store for the 30+ remaining tables ─────────
-- Rather than 40 DDL blocks, lighter tables persist as documents
-- keyed by (workspace, collection). The API exposes them as REST
-- collections identical to the frontend's Backend.db.* tables.
CREATE TABLE documents_store (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  collection   TEXT NOT NULL,         -- e.g. 'snags','rfis','permits','timesheets'
  doc_id       TEXT NOT NULL,         -- original record id
  data         JSONB NOT NULL,
  updated_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, collection, doc_id)
);
CREATE INDEX idx_docstore_lookup ON documents_store(workspace_id, collection);

-- ── AI conversation memory ──────────────────────────────────
CREATE TABLE ai_history (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_msg     TEXT,
  ai_reply     TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- ── Audit trail (immutable) ─────────────────────────────────
CREATE TABLE audit_log (
  id           BIGSERIAL PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  actor        TEXT,
  action       TEXT,
  target       TEXT,
  hash         TEXT,            -- chain hash of prev + this row
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- ── Photo blobs (or store keys to S3) ───────────────────────
CREATE TABLE photos (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id   UUID REFERENCES projects(id) ON DELETE SET NULL,
  name         TEXT,
  storage_key  TEXT,            -- S3/R2 key, or NULL if inline
  inline_data  BYTEA,           -- small photos only
  mime         TEXT,
  size_bytes   INT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- ── Client portal (public, token-scoped) ────────────────────
-- A share token grants read-only access to ONE project. The standalone
-- portal.html resolves a project by token; clients can message + approve.
CREATE TABLE portal_tokens (
  token        TEXT PRIMARY KEY,            -- short opaque share token
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id   UUID REFERENCES projects(id) ON DELETE CASCADE,
  revoked      BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_portal_tokens_project ON portal_tokens(project_id);

CREATE TABLE portal_messages (
  id           BIGSERIAL PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id   UUID REFERENCES projects(id) ON DELETE CASCADE,
  client       TEXT,
  body         TEXT,
  kind         TEXT DEFAULT 'message',      -- 'message' | 'approval'
  direction    TEXT DEFAULT 'in',           -- 'in' (client→contractor) | 'out' (reply)
  read         BOOLEAN DEFAULT false,
  replied      BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_portal_msgs_ws ON portal_messages(workspace_id, created_at DESC);

-- ── Passwordless auth (magic links) ─────────────────────────
CREATE TABLE magic_links (
  token        TEXT PRIMARY KEY,
  email        TEXT NOT NULL,
  workspace_id UUID,
  expires_at   TIMESTAMPTZ NOT NULL,
  used         BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_magic_email ON magic_links(email);

-- ── Site map annotations (offline map markup, synced) ──────
CREATE TABLE site_maps (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id   UUID REFERENCES projects(id) ON DELETE CASCADE,
  marks        JSONB DEFAULT '[]',          -- [{type:'pin'|'draw'|'text', lat,lng,...}]
  center       JSONB,                        -- {lat,lng,zoom} last view
  updated_at   TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX idx_site_maps_project ON site_maps(workspace_id, project_id);

-- ── Sync bookkeeping (last-write-wins clock per record) ─────
CREATE TABLE sync_log (
  id           BIGSERIAL PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  collection   TEXT,
  doc_id       TEXT,
  op           TEXT,                        -- 'create' | 'update' | 'delete'
  at           TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_sync_ws_at ON sync_log(workspace_id, at);

-- ════════════════════════════════════════════════════════════
-- ── v1.3 sync gap closure: high-traffic collections ────────
-- All carry a `data JSONB` column so they can store any extra
-- fields the frontend invents (forward-compatible) without
-- schema churn. Hot fields are promoted to typed columns for
-- indexing.
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS receipts (
  id           TEXT PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id   UUID REFERENCES projects(id) ON DELETE SET NULL,
  vendor       TEXT, amount NUMERIC(12,2), date DATE, category TEXT,
  assigned     BOOLEAN DEFAULT false,
  data         JSONB, updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_receipts_ws ON receipts(workspace_id, date DESC);

CREATE TABLE IF NOT EXISTS cis_subs (
  id           TEXT PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  name         TEXT NOT NULL, utr TEXT, verify_ref TEXT, verified BOOLEAN DEFAULT false,
  net_rate     NUMERIC(5,4) DEFAULT 0.20, gross_payment BOOLEAN DEFAULT false,
  trading_name TEXT, materials_pct NUMERIC(5,4) DEFAULT 0.20,
  data         JSONB, updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cis_payments (
  id           TEXT PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  sub_id       TEXT REFERENCES cis_subs(id) ON DELETE CASCADE,
  date         DATE NOT NULL, amount NUMERIC(12,2), labour NUMERIC(12,2), materials NUMERIC(12,2),
  data         JSONB, updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cis_pay_ws_date ON cis_payments(workspace_id, date);

CREATE TABLE IF NOT EXISTS timesheets (
  id           TEXT PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id   UUID REFERENCES projects(id) ON DELETE SET NULL,
  user_id      TEXT, date DATE, hours NUMERIC(5,2), notes TEXT,
  data         JSONB, updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS diary_entries (
  id           TEXT PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id   UUID REFERENCES projects(id) ON DELETE CASCADE,
  date DATE, weather TEXT, body TEXT, author TEXT,
  data         JSONB, updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS snags (
  id           TEXT PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id   UUID REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT, status TEXT, severity TEXT, assignee TEXT,
  data         JSONB, updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS change_orders (
  id           TEXT PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id   UUID REFERENCES projects(id) ON DELETE CASCADE,
  number TEXT, title TEXT, amount NUMERIC(12,2), status TEXT,
  data         JSONB, updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rfis (
  id           TEXT PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id   UUID REFERENCES projects(id) ON DELETE CASCADE,
  subject TEXT, status TEXT, raised_by TEXT, due DATE,
  data         JSONB, updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subs (
  id           TEXT PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT, trade TEXT, contact TEXT, phone TEXT, rating NUMERIC(3,1),
  insured BOOLEAN, cscs BOOLEAN, jobs_done INTEGER,
  data         JSONB, updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS materials (
  id           TEXT PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id   UUID REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT, supplier TEXT, qty NUMERIC(10,2), unit TEXT, status TEXT,
  data         JSONB, updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS documents_meta (
  id           TEXT PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id   UUID REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT, kind TEXT, size INTEGER, url TEXT, mime TEXT,
  data         JSONB, updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS equipment (
  id           TEXT PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT, kind TEXT, status TEXT, project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  data         JSONB, updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id           TEXT PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      TEXT, title TEXT, body TEXT, kind TEXT, read BOOLEAN DEFAULT false,
  data         JSONB, created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifs_user ON notifications(workspace_id, user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS activity_log (
  id           BIGSERIAL PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  actor        TEXT, kind TEXT, title TEXT, sub TEXT, project_id UUID,
  data         JSONB, at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_activity_ws_at ON activity_log(workspace_id, at DESC);

-- ════════════════════════════════════════════════════════════
-- ── Integration tables (also auto-created by their route modules,
--    declared here so a fresh `npm run migrate` sets them up with
--    proper FKs and indexes up-front). ───────────────────────
-- ════════════════════════════════════════════════════════════

-- Web Push / native push subscriptions (routes/push.js)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         SERIAL PRIMARY KEY,
  endpoint   TEXT UNIQUE NOT NULL,
  platform   TEXT,
  sub        JSONB NOT NULL,
  user_id    TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Open Banking connections, tokens encrypted at rest (routes/banking.js)
CREATE TABLE IF NOT EXISTS bank_connections (
  id           TEXT PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      TEXT,
  provider     TEXT,
  bank_name    TEXT,
  access_enc   TEXT,
  refresh_enc  TEXT,
  expires_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bank_conn_ws ON bank_connections(workspace_id);

-- In-app subscription entitlements (routes/iap.js)
CREATE TABLE IF NOT EXISTS iap_entitlements (
  id           SERIAL PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      TEXT,
  source       TEXT,                 -- 'apple' | 'stripe'
  plan         TEXT,
  product_id   TEXT,
  external_id  TEXT,
  status       TEXT,
  expires_at   TIMESTAMPTZ,
  raw          JSONB,
  updated_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_iap_ws ON iap_entitlements(workspace_id, status);

-- HMRC CIS300 submissions audit (routes/hmrc.js)
CREATE TABLE IF NOT EXISTS hmrc_submissions (
  id             SERIAL PRIMARY KEY,
  workspace_id   UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id        TEXT,
  class_name     TEXT,
  correlation_id TEXT,
  period_end     DATE,
  status         TEXT,
  poll_interval  INT,
  next_poll_at   TIMESTAMPTZ,
  request_xml    TEXT,
  response_xml   TEXT,
  errors         JSONB,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hmrc_ws ON hmrc_submissions(workspace_id, created_at DESC);
