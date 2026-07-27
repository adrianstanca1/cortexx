// Cortexx — Central API / credential registry (the "secret store").
//
// WHY THIS EXISTS
// ---------------
// Previously every integration router read its own env var directly at
// module-load time (STRIPE_SECRET_KEY, HMRC_GATEWAY_PASS, RESEND_API_KEY, …).
// That made credentials:
//   • invisible to any UI (no "what's connected?" view),
//   • impossible to rotate without a redeploy (read once at boot),
//   • scattered (no single source of truth, no audit trail).
//
// This module is the single source of truth. Credentials live encrypted in
// the `api_connections` table (aes-256-gcm), seeded from env on first boot,
// and can be rotated at runtime via the admin API WITHOUT a restart. Reads
// fall back to the original env var when the DB row is absent, so today's
// behaviour is fully preserved on a fresh DB.
//
// SECURITY
// --------
// • Each secret is encrypted at rest with aes-256-gcm (IV + auth tag per row).
// • The encryption key is CREDENTIAL_ENCRYPTION_KEY, or derived from
//   JWT_SECRET if unset (mirrors banking.js' "derive from JWT_SECRET"
//   convention). Never logged.
// • `api_connections` is denylisted in server/security.js so it is NOT
//   reachable through the generic /api/:collection CRUD path.
// • Every rotation is written to the immutable, hash-chained audit_log.
//
// DESIGN NOTES
// ------------
// • Singleton: init() is called once at boot (server/index.js) with the live
//   pool. Route modules call getSecret(name) at request time — if the store
//   isn't initialised yet (tests, or direct require) they fall back to the
//   env var, so behaviour is unchanged.
// • reload() re-reads the cache from the DB after any mutation so a PUT takes
//   effect immediately (hot reload — no restart needed).

'use strict';

const crypto = require('crypto');

// ── The registry: every managed integration + its env-var source ───────────
// `category` groups the admin UI. `provider` is the canonical provider id.
// `label` is human-readable. `envVar` is the legacy env fallback.
const REGISTRY = [
  { name: 'stripe_secret_key',     envVar: 'STRIPE_SECRET_KEY',        category: 'payments', provider: 'stripe',     label: 'Stripe Payments' },
  { name: 'gocardless_token',      envVar: 'GOCARDLESS_ACCESS_TOKEN',  category: 'payments', provider: 'gocardless',  label: 'GoCardless Direct Debit' },
  { name: 'resend_key',            envVar: 'RESEND_API_KEY',           category: 'email',    provider: 'resend',     label: 'Resend (email)' },
  { name: 'sendgrid_key',          envVar: 'SENDGRID_API_KEY',         category: 'email',    provider: 'sendgrid',   label: 'SendGrid (email)' },
  { name: 'hmrc_gateway_user',     envVar: 'HMRC_GATEWAY_USER',        category: 'tax',      provider: 'hmrc',       label: 'HMRC Gateway (user)' },
  { name: 'hmrc_gateway_pass',     envVar: 'HMRC_GATEWAY_PASS',        category: 'tax',      provider: 'hmrc',       label: 'HMRC Gateway (password)' },
  { name: 'truelayer_client_id',   envVar: 'TRUELAYER_CLIENT_ID',      category: 'banking',  provider: 'truelayer',  label: 'Open Banking (TrueLayer client id)' },
  { name: 'truelayer_client_secret', envVar: 'TRUELAYER_CLIENT_SECRET', category: 'banking', provider: 'truelayer', label: 'Open Banking (TrueLayer secret)' },
  { name: 'vapid_public',          envVar: 'VAPID_PUBLIC_KEY',         category: 'push',     provider: 'vapid',      label: 'Web Push VAPID (public)' },
  { name: 'vapid_private',         envVar: 'VAPID_PRIVATE_KEY',        category: 'push',     provider: 'vapid',      label: 'Web Push VAPID (private)' },
  { name: 'stripe_webhook_secret', envVar: 'STRIPE_WEBHOOK_SECRET',    category: 'payments', provider: 'stripe',     label: 'Stripe webhook secret' },
  { name: 'apple_shared_secret',   envVar: 'APPLE_SHARED_SECRET',      category: 'payments', provider: 'apple',      label: 'Apple IAP shared secret' },
  { name: 'ollama_base',           envVar: 'OLLAMA_BASE',              category: 'ai',       provider: 'ollama',     label: 'Local LLM (Ollama base URL)' },
  { name: 'openai_compat_base',    envVar: 'OPENAI_COMPAT_BASE',       category: 'ai',       provider: 'openai',     label: 'OpenAI-compatible base URL' },
  { name: 'openai_compat_key',     envVar: 'OPENAI_COMPAT_KEY',        category: 'ai',       provider: 'openai',     label: 'OpenAI-compatible API key' },
];
const REGISTRY_BY_NAME = Object.fromEntries(REGISTRY.map((r) => [r.name, r]));

// Per-provider validation for rotation (cheap, honest shape checks).
const VALIDATORS = {
  stripe_secret_key: (v) => /^sk_(live|test)_[A-Za-z0-9_]+$/.test(v),
  gocardless_token: (v) => v.length >= 10,
  resend_key: (v) => /^re_[A-Za-z0-9]+$/.test(v),
  sendgrid_key: (v) => /^SG\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}$/.test(v),
  hmrc_gateway_user: (v) => v.length >= 3,
  hmrc_gateway_pass: (v) => v.length >= 6,
  truelayer_client_id: (v) => v.length >= 6,
  truelayer_client_secret: (v) => v.length >= 6,
  vapid_public: (v) => /^[A-Za-z0-9_-]{40,}$/.test(v),
  vapid_private: (v) => /^[A-Za-z0-9_-]{40,}$/.test(v),
  stripe_webhook_secret: (v) => v.length >= 10,
  apple_shared_secret: (v) => v.length >= 10,
  ollama_base: (v) => /^https?:\/\//.test(v),
  openai_compat_base: (v) => /^https?:\/\//.test(v),
  openai_compat_key: (v) => v.length >= 20,
  anthropic_api_key: (v) => v.startsWith('sk-ant-') || v.length >= 20,
  openai_api_key: (v) => v.startsWith('sk-') || v.length >= 20,
  gemini_api_key: (v) => v.length >= 20,
  nvidia_api_key: (v) => v.length >= 20,
  claude_api_key: (v) => v.startsWith('sk-ant-') || v.length >= 20,
  github_pat: (v) => /^gh[pousr]_/.test(v) || v.length >= 20,
  expo_token: (v) => v.length >= 20,
};

function deriveKey(encKey, jwtSecret) {
  const material = encKey || (jwtSecret ? jwtSecret + ':cortexx-secret-store' : 'cortexx-dev-fallback-key');
  return crypto.createHash('sha256').update(material).digest(); // 32 bytes → aes-256
}

function encrypt(plain, key) {
  if (plain == null || plain === '') return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

function decrypt(payload, key) {
  if (!payload) return '';
  const parts = String(payload).split(':');
  if (parts.length !== 3) return '';
  try {
    const iv = Buffer.from(parts[0], 'base64');
    const tag = Buffer.from(parts[1], 'base64');
    const data = Buffer.from(parts[2], 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    return ''; // corrupt/tampered — treat as missing, never throw at read time
  }
}

function maskSecret(value) {
  if (!value) return null;
  const s = String(value);
  if (s.length <= 8) return '••••';
  return s.slice(0, 6) + '…' + s.slice(-4);
}

class SecretStore {
  constructor({ pool, env, jwtSecret, encryptionKey }) {
    this.pool = pool;
    this.env = env || process.env;
    this.key = deriveKey(encryptionKey, jwtSecret);
    this.cache = new Map(); // name -> row
  }

  async ensureTable() {
    await this.pool.query(`CREATE TABLE IF NOT EXISTS api_connections (
      name TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      provider TEXT NOT NULL,
      encrypted_secret TEXT,
      config JSONB DEFAULT '{}'::jsonb,
      status TEXT DEFAULT 'untested',
      last_tested_at TIMESTAMPTZ,
      last_error TEXT,
      updated_by TEXT,
      updated_at TIMESTAMPTZ DEFAULT now()
    )`);
  }

  // Idempotent boot seeding: copy env credentials into the encrypted store
  // the first time, so the admin UI immediately reflects the real state.
  async seedFromEnv() {
    for (const def of REGISTRY) {
      const secret = this.env[def.envVar] || '';
      const exists = await this.pool.query('SELECT name FROM api_connections WHERE name=$1', [def.name]);
      if (!exists.rows.length) {
        await this.pool.query(
          `INSERT INTO api_connections(name, category, provider, encrypted_secret, status)
           VALUES($1,$2,$3,$4,$5)
           ON CONFLICT(name) DO NOTHING`,
          [def.name, def.category, def.provider, secret ? encrypt(secret, this.key) : null, secret ? 'active' : 'inactive']
        );
      } else if (secret) {
        // Backfill an empty DB row from env (first boot) without clobbering a
        // value an operator already rotated in the DB.
        await this.pool.query(
          `UPDATE api_connections SET encrypted_secret=$2, status='active', updated_at=now()
           WHERE name=$1 AND encrypted_secret IS NULL`,
          [def.name, encrypt(secret, this.key)]
        );
      }
    }
    await this.reload();
  }

  async reload() {
    const r = await this.pool.query(
      'SELECT name, category, provider, encrypted_secret, config, status, last_tested_at, last_error, updated_by, updated_at FROM api_connections'
    );
    this.cache.clear();
    for (const row of r.rows) this.cache.set(row.name, row);
  }

  // Resolve a secret: DB value first, env fallback second. Never throws.
  getSecret(name) {
    const row = this.cache.get(name);
    if (row && row.encrypted_secret) return decrypt(row.encrypted_secret, this.key);
    const def = REGISTRY_BY_NAME[name];
    return def ? (this.env[def.envVar] || '') : '';
  }

  getConfig(name) {
    const row = this.cache.get(name);
    return row && row.config ? row.config : {};
  }

  hasSecret(name) {
    const row = this.cache.get(name);
    if (row && row.encrypted_secret) return true;
    const def = REGISTRY_BY_NAME[name];
    return !!(def && this.env[def.envVar]);
  }

  isRegistered(name) {
    return !!REGISTRY_BY_NAME[name] || this.cache.has(name);
  }

  async setSecret(name, value, actor) {
    const def = REGISTRY_BY_NAME[name];
    const enc = value ? encrypt(value, this.key) : null;
    // UPSERT: create the row on first rotation, then update thereafter.
    // A connection may be rotated before its row exists in the DB (the row is
    // only seeded on boot when an env var is present). Without the INSERT leg,
    // a bare UPDATE would match 0 rows and the secret would silently not persist.
    await this.pool.query(
      `INSERT INTO api_connections (name, category, provider, encrypted_secret, status, updated_by, updated_at)
       VALUES ($1, $4, $5, $2, COALESCE($3,'active'), $6, now())
       ON CONFLICT (name) DO UPDATE
         SET encrypted_secret = EXCLUDED.encrypted_secret,
             status = CASE WHEN EXCLUDED.encrypted_secret IS NULL THEN 'inactive' ELSE COALESCE(api_connections.status,'active') END,
             updated_by = EXCLUDED.updated_by,
             updated_at = now()`,
      [name, enc, value ? 'active' : 'inactive', def ? def.category : 'other', def ? def.provider : 'manual', actor || 'system']
    );
    await this.reload();
  }

  async setStatus(name, status, error) {
    await this.pool.query(
      `UPDATE api_connections SET status=$2, last_tested_at=now(), last_error=$3 WHERE name=$1`,
      [name, status, error || null]
    );
    await this.reload();
  }

  async setConfig(name, config) {
    await this.pool.query(
      `UPDATE api_connections SET config=$2, updated_at=now() WHERE name=$1`,
      [name, JSON.stringify(config || {})]
    );
    await this.reload();
  }

  list() {
    const out = [];
    const seen = new Set();
    // Registry order first (so the UI shows every known integration even if
    // the DB row hasn't been created yet).
    for (const def of REGISTRY) {
      seen.add(def.name);
      const row = this.cache.get(def.name);
      out.push({
        name: def.name,
        label: def.label,
        category: def.category,
        provider: def.provider,
        status: row ? row.status : (this.env[def.envVar] ? 'active' : 'inactive'),
        hasSecret: this.hasSecret(def.name),
        config: row ? row.config : {},
        last_tested_at: row ? row.last_tested_at : null,
        last_error: row ? row.last_error : null,
        updated_by: row ? row.updated_by : null,
        updated_at: row ? row.updated_at : null,
      });
    }
    // Any DB rows not in the static registry (future-proofing).
    for (const [name, row] of this.cache) {
      if (seen.has(name)) continue;
      out.push({
        name, label: name, category: row.category, provider: row.provider,
        status: row.status, hasSecret: !!row.encrypted_secret, config: row.config,
        last_tested_at: row.last_tested_at, last_error: row.last_error,
        updated_by: row.updated_by, updated_at: row.updated_at,
      });
    }
    return out;
  }

  detail(name) {
    const def = REGISTRY_BY_NAME[name];
    const row = this.cache.get(name);
    const secret = row && row.encrypted_secret ? decrypt(row.encrypted_secret, this.key) : (def ? this.env[def.envVar] || '' : '');
    return {
      name,
      label: def ? def.label : name,
      category: def ? def.category : (row ? row.category : 'other'),
      provider: def ? def.provider : (row ? row.provider : 'unknown'),
      status: row ? row.status : (def && this.env[def.envVar] ? 'active' : 'inactive'),
      hasSecret: this.hasSecret(name),
      secretPreview: maskSecret(secret),
      config: row ? row.config : {},
      last_tested_at: row ? row.last_tested_at : null,
      last_error: row ? row.last_error : null,
      updated_by: row ? row.updated_by : null,
      updated_at: row ? row.updated_at : null,
    };
  }
}

// ── Singleton wiring ────────────────────────────────────────────────────────
let _store = null;

function init(opts) {
  _store = new SecretStore(opts);
  return _store;
}

function store() {
  return _store;
}

// Attach a DB pool to the live store so setSecret/reload can persist.
// Idempotent — safe to call from both boot and route-mount time. Creates a
// minimal store if one hasn't been built yet (e.g. when index.js is required
// as a module by a test rather than run directly).
function setStorePool(pool) {
  if (_store) { _store.pool = pool; return _store; }
  _store = new SecretStore({ pool });
  return _store;
}

// Public accessor used by integration routers. Falls back to env if the store
// hasn't been initialised (tests / direct require) so behaviour is unchanged.
function getSecret(name) {
  if (_store) return _store.getSecret(name);
  const def = REGISTRY_BY_NAME[name];
  return def ? (process.env[def.envVar] || '') : '';
}

function hasSecret(name) {
  if (_store) return _store.hasSecret(name);
  const def = REGISTRY_BY_NAME[name];
  return !!(def && process.env[def.envVar]);
}

// Boot-facing helpers expected by server/index.js. They build/attach the
// singleton store (idempotent) and run the table-ensure + env-seed steps.
// (The class methods are ensureTable()/seedFromEnv(); these wrappers keep
//  the boot call site stable and accept a pool directly.)
async function ensureApiConnectionsTable(pool) {
  const s = setStorePool(pool);
  await s.ensureTable();
}
async function syncEnvToRegistry(pool) {
  const s = setStorePool(pool);
  await s.seedFromEnv();
}

module.exports = {
  REGISTRY,
  REGISTRY_BY_NAME,
  VALIDATORS,
  SecretStore,
  init,
  store,
  setStorePool,
  ensureApiConnectionsTable,
  syncEnvToRegistry,
  getSecret,
  hasSecret,
  encrypt,
  decrypt,
  maskSecret,
  deriveKey,
};
