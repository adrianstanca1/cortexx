-- Migration 005: VERA feature platform, RBAC, packages, AI control, settings
-- Adds the admin-console "enhanced" surface:
--   * feature_flags     — catalog of platform capabilities (AI intelligence,
--                         memory, skills, knowledge base, agents, packages…)
--   * packages         — bundle of feature keys sold per tier
--   * workspace_features / user_features — per-tenant / per-user overrides
--   * roles            — permission catalog (system + custom)
--   * workspace_packages — package assignment per tenant
--   * user_roles       — role assignment per user
--   * ai_config        — per-tenant (or platform-default) AI provider/model/memory
--   * platform_settings— flat key/value global config (audit-logged)

-- ── Feature catalog ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feature_flags (
  key          TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  category     TEXT NOT NULL DEFAULT 'core',   -- ai | intelligence | memory | skills | knowledge | agents | packages | core
  description  TEXT,
  default_on   BOOLEAN NOT NULL DEFAULT false,
  min_plan     TEXT DEFAULT 'free'              -- free | pro | enterprise
);
INSERT INTO feature_flags (key, name, category, description, default_on, min_plan) VALUES
  ('ai_intelligence', 'AI Intelligence',          'ai',         'Conversational AI assistant across the workspace',                true,  'free'),
  ('ai_memory',      'AI Memory',                 'memory',     'Persistent conversation + entity memory for the AI',              false, 'pro'),
  ('ai_skills',      'Skills Engine',             'skills',     'Installable agent skills / tool plugins',                       false, 'pro'),
  ('knowledge_base', 'VERA Knowledge Base',       'knowledge',  'RAG over the tenant knowledge base (docs, snags, RFIs)',         false, 'pro'),
  ('agents',         'Autonomous Agents',         'agents',     'Background multi-step agents (triage, reconciliation)',         false, 'enterprise'),
  ('packages',       'Package Management',        'packages',   'Install / remove feature packages per tenant',                  true,  'free'),
  ('reports_advanced','Advanced Reports',         'core',       'P&L, revenue-by-client, tax estimate exports',                  true,  'pro'),
  ('banking_open',   'Open Banking',              'core',       'TrueLayer bank-feed auto-import',                               false, 'pro'),
  ('hmrc_cis',       'HMRC / CIS Engine',         'core',       'CIS300 + VAT submissions to HMRC',                              false, 'enterprise'),
  ('iap_subscriptions','In-App Subscriptions',    'core',       'StoreKit / Stripe subscription management',                     false, 'pro'),
  ('push_notify',    'Push Notifications',        'core',       'Web push + native APNs/FCM',                                    true,  'free')
ON CONFLICT (key) DO NOTHING;

-- ── Package catalog ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS packages (
  key           TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  monthly_price NUMERIC DEFAULT 0,
  features      JSONB NOT NULL DEFAULT '[]',       -- array of feature_flags.key
  description   TEXT,
  is_system     BOOLEAN NOT NULL DEFAULT true
);
INSERT INTO packages (key, name, monthly_price, features, description) VALUES
  ('starter',     'Starter',     0,    '["ai_intelligence","packages","push_notify"]',                                                           'Core invoicing & AI chat'),
  ('professional', 'Professional',29,   '["ai_intelligence","ai_memory","ai_skills","knowledge_base","reports_advanced","banking_open","iap_subscriptions","packages","push_notify"]', 'Full AI + reporting suite'),
  ('enterprise',  'Enterprise',  99,   '["ai_intelligence","ai_memory","ai_skills","knowledge_base","agents","reports_advanced","banking_open","hmrc_cis","iap_subscriptions","packages","push_notify"]', 'Autonomous agents + HMRC')
ON CONFLICT (key) DO NOTHING;

-- ── Per-tenant + per-user feature overrides ─────────────────
CREATE TABLE IF NOT EXISTS workspace_features (
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  feature_key  TEXT NOT NULL REFERENCES feature_flags(key) ON DELETE CASCADE,
  enabled      BOOLEAN NOT NULL,
  PRIMARY KEY (workspace_id, feature_key)
);
CREATE TABLE IF NOT EXISTS user_features (
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feature_key  TEXT NOT NULL REFERENCES feature_flags(key) ON DELETE CASCADE,
  enabled      BOOLEAN NOT NULL,
  PRIMARY KEY (user_id, feature_key)
);

-- ── Role catalog + assignments ───────────────────────────────
CREATE TABLE IF NOT EXISTS roles (
  key         TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  permissions JSONB NOT NULL DEFAULT '{}',         -- permission -> bool
  description TEXT,
  is_system   BOOLEAN NOT NULL DEFAULT true
);
INSERT INTO roles (key, name, permissions, description) VALUES
  ('owner',   'Owner',        '{"*":true}',                                                              'Full tenant control', true),
  ('admin',   'Admin',        '{"projects":true,"invoices":true,"clients":true,"team":true,"settings":true,"users":true,"ai":true}', 'Tenant administration', true),
  ('manager', 'Manager',      '{"projects":true,"invoices":true,"clients":true,"team":true,"settings":false,"users":false,"ai":true}', 'Operations manager', true),
  ('member',  'Member',       '{"projects":true,"invoices":true,"clients":true,"team":false,"settings":false,"users":false,"ai":true}', 'Standard user', true),
  ('viewer',  'Viewer',       '{"projects":true,"invoices":false,"clients":true,"team":false,"settings":false,"users":false,"ai":false}', 'Read-only', true)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS workspace_packages (
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  package_key  TEXT NOT NULL REFERENCES packages(key) ON DELETE CASCADE,
  assigned_at  TIMESTAMPTZ DEFAULT now(),
  assigned_by  TEXT,
  PRIMARY KEY (workspace_id, package_key)
);
CREATE TABLE IF NOT EXISTS user_roles (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_key   TEXT NOT NULL REFERENCES roles(key) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_key)
);

-- ── AI configuration (per-tenant; workspace_id NULL = platform default) ──
CREATE TABLE IF NOT EXISTS ai_config (
  workspace_id    UUID REFERENCES workspaces(id) ON DELETE CASCADE,  -- NULL = platform-wide default
  provider        TEXT DEFAULT 'ollama',                              -- ollama | openai | openrouter
  model           TEXT DEFAULT 'qwen2.5-7b',
  base_url        TEXT,
  memory_enabled  BOOLEAN NOT NULL DEFAULT false,
  knowledge_enabled BOOLEAN NOT NULL DEFAULT false,
  agents_enabled  BOOLEAN NOT NULL DEFAULT false,
  max_tokens      INT DEFAULT 2048,
  temperature     NUMERIC(3,2) DEFAULT 0.7,
  updated_at      TIMESTAMPTZ DEFAULT now(),
  updated_by      TEXT,
  PRIMARY KEY (workspace_id)
);

-- ── Global platform settings (flat K/V, audit-logged on write) ──
CREATE TABLE IF NOT EXISTS platform_settings (
  key   TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by TEXT
);
INSERT INTO platform_settings (key, value) VALUES
  ('general',        '{"platform_name":"CortexBuild Pro","support_email":"support@cortexbuildpro.com","maintenance_mode":false,"signups_open":true}'),
  ('ai_defaults',    '{"provider":"ollama","model":"qwen2.5-7b","memory_enabled":false,"knowledge_enabled":false,"agents_enabled":false}'),
  ('branding',       '{"primary_color":"#ffb000","logo_url":null,"custom_css":null}')
ON CONFLICT (key) DO NOTHING;

-- Seed: every existing workspace inherits its plan's starter features as overrides
-- (idempotent — only inserts where missing).
INSERT INTO workspace_features (workspace_id, feature_key, enabled)
SELECT w.id, f.key, f.default_on
FROM workspaces w
CROSS JOIN feature_flags f
WHERE NOT EXISTS (
  SELECT 1 FROM workspace_features wf WHERE wf.workspace_id = w.id AND wf.feature_key = f.key
) ON CONFLICT DO NOTHING;
