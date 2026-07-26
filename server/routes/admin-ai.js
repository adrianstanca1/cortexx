// Cortexx — Admin: AI control plane + Platform settings
// Mounted at /api/admin/ai and /api/admin/settings.
// Cross-tenant; every handler gated by adminAuth.
//
// AI:
//   GET  /ai/config            platform-default + per-tenant configs
//   GET  /ai/config/:ws        single tenant AI config
//   PUT  /ai/config/:ws        update tenant AI config (provider, model, memory, knowledge, agents)
//   POST /ai/test/:ws          ping the configured provider (returns ok/err + latency)
//   GET  /ai/providers         available providers + status
//   GET  /ai/usage/:ws         simple per-tenant AI usage (count of ai_log rows)
//
// Settings:
//   GET  /settings             all platform_settings
//   PUT  /settings/:key        update a setting group (audit-logged)
//   GET  /settings/audit       last N setting changes (from audit_log)
//
function psqlDate() { return "now() - interval '7 days'"; }

module.exports = function aiSettingsRoutes(pool, auth, adminAuth, wrap, bus) {
  const router = require('express').Router();
  const crypto = require('crypto');
  const { execFile } = require('child_process');

  const emit = (ws, payload) => { try { bus && bus.emit(ws, payload); } catch (_) {} };
  async function audit(actor, action, target) {
    try {
      const prev = await pool.query('SELECT hash FROM audit_log WHERE workspace_id IS NULL ORDER BY id DESC LIMIT 1');
      const prevHash = prev.rows[0]?.hash || '';
      const hash = crypto.createHash('sha256').update(prevHash + actor + action + target + Date.now()).digest('hex');
      await pool.query('INSERT INTO audit_log(workspace_id, actor, action, target, hash) VALUES($1,$2,$3,$4,$5)', [null, actor, action, target, hash]);
    } catch (e) {}
  }

  // Known providers (status reflects local reachability — best-effort).
  const PROVIDERS = [
    { key: 'ollama',    label: 'Local Ollama',      base_url_default: 'http://localhost:11434', local: true },
    { key: 'openai',    label: 'OpenAI',            base_url_default: 'https://api.openai.com/v1', local: false },
    { key: 'openrouter',label: 'OpenRouter',        base_url_default: 'https://openrouter.ai/api/v1', local: false },
  ];

  // ───────────────────────── AI control ─────────────────────────
  router.get('/ai/config', adminAuth, wrap(async (req, res) => {
    const def = await pool.query('SELECT * FROM ai_config WHERE workspace_id IS NULL');
    const tenants = await pool.query(
      `SELECT c.workspace_id, w.name AS workspace_name, c.provider, c.model, c.memory_enabled, c.knowledge_enabled, c.agents_enabled, c.updated_at
       FROM ai_config c JOIN workspaces w ON w.id = c.workspace_id ORDER BY w.name`);
    res.json({ platform_default: def.rows[0] || null, tenants: tenants.rows });
  }));

  router.get('/ai/config/:ws', adminAuth, wrap(async (req, res) => {
    const { ws } = req.params;
    let r = await pool.query('SELECT * FROM ai_config WHERE workspace_id=$1', [ws]);
    if (!r.rows[0]) {
      // fall back to platform default shape
      const def = await pool.query('SELECT * FROM ai_config WHERE workspace_id IS NULL');
      const base = def.rows[0] || { provider: 'ollama', model: 'qwen2.5-7b', base_url: null, memory_enabled: false, knowledge_enabled: false, agents_enabled: false, max_tokens: 2048, temperature: 0.7 };
      return res.json({ config: { ...base, workspace_id: ws, is_default: true } });
    }
    res.json({ config: r.rows[0] });
  }));

  router.put('/ai/config/:ws', adminAuth, wrap(async (req, res) => {
    const { ws } = req.params;
    const b = req.body || {};
    const provider = b.provider || 'ollama';
    const model = typeof b.model === 'string' ? b.model : 'qwen2.5-7b';
    const base_url = typeof b.base_url === 'string' ? b.base_url : null;
    const memory_enabled = !!b.memory_enabled;
    const knowledge_enabled = !!b.knowledge_enabled;
    const agents_enabled = !!b.agents_enabled;
    const max_tokens = intRange(b.max_tokens, 256, 8192, 2048);
    const temperature = numRange(b.temperature, 0, 2, 0.7);
    await pool.query(
      `INSERT INTO ai_config(workspace_id, provider, model, base_url, memory_enabled, knowledge_enabled, agents_enabled, max_tokens, temperature, updated_by)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (workspace_id) DO UPDATE SET
         provider=$2, model=$3, base_url=$4, memory_enabled=$5, knowledge_enabled=$6, agents_enabled=$7, max_tokens=$8, temperature=$9, updated_by=$10, updated_at=now()`,
      [ws, provider, model, base_url, memory_enabled, knowledge_enabled, agents_enabled, max_tokens, temperature, req.user.uid]);
    emit(ws, { type: 'ai', action: 'config_updated' });
    await audit(req.user.uid, 'ai.config_update', ws);
    res.json({ ok: true });
  }));

  router.get('/ai/providers', adminAuth, wrap(async (req, res) => {
    // Check local Ollama reachability (best-effort, non-blocking).
    const statuses = await Promise.all(PROVIDERS.map(async (p) => {
      let status = 'available';
      if (p.local) {
        try {
          const t0 = Date.now();
          const r = await fetch(`${p.base_url_default}/api/tags`, { signal: AbortSignal.timeout(1500) });
          status = r.ok ? `online (${Date.now() - t0}ms)` : `error ${r.status}`;
        } catch { status = 'offline'; }
      }
      return { ...p, status };
    }));
    res.json({ providers: statuses });
  }));

  router.post('/ai/test/:ws', adminAuth, wrap(async (req, res) => {
    const { ws } = req.params;
    const cfg = await pool.query('SELECT * FROM ai_config WHERE workspace_id=$1', [ws]);
    const c = cfg.rows[0] || { provider: 'ollama', model: 'qwen2.5-7b', base_url: 'http://localhost:11434' };
    const base = c.base_url || (c.provider === 'ollama' ? 'http://localhost:11434' : 'https://api.openai.com/v1');
    const t0 = Date.now();
    try {
      const r = await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(4000) });
      const ok = r.ok;
      res.json({ ok, latency_ms: Date.now() - t0, provider: c.provider, model: c.model, status: ok ? 'reachable' : `http ${r.status}` });
    } catch (e) {
      res.json({ ok: false, latency_ms: Date.now() - t0, provider: c.provider, model: c.model, error: String(e.message || e) });
    }
  }));

  router.get('/ai/usage/:ws', adminAuth, wrap(async (req, res) => {
    const { ws } = req.params;
    const r = await pool.query(
      `SELECT COUNT(*)::int AS calls, COALESCE(SUM(tokens),0)::int AS tokens
       FROM ai_log WHERE workspace_id=$1 AND at > ${psqlDate()}`, [ws]);
    res.json({ usage: r.rows[0] || { calls: 0, tokens: 0 } });
  }));

  // ───────────────────────── Platform settings ─────────────────────────
  router.get('/settings', adminAuth, wrap(async (req, res) => {
    const r = await pool.query('SELECT key, value, updated_at, updated_by FROM platform_settings ORDER BY key');
    res.json({ settings: r.rows });
  }));

  router.get('/settings/:key', adminAuth, wrap(async (req, res) => {
    const r = await pool.query('SELECT key, value, updated_at, updated_by FROM platform_settings WHERE key=$1', [req.params.key]);
    if (!r.rows[0]) return res.status(404).json({ error: 'not_found' });
    res.json({ setting: r.rows[0] });
  }));

  router.put('/settings/:key', adminAuth, wrap(async (req, res) => {
    const key = req.params.key;
    const value = req.body && req.body.value;
    if (value === undefined) return res.status(400).json({ error: 'value_required' });
    // value may be an object or scalar; store as JSONB.
    const json = (typeof value === 'object' && value !== null) ? JSON.stringify(value) : JSON.stringify({ v: value });
    await pool.query(
      `INSERT INTO platform_settings(key, value, updated_by) VALUES($1,$2,$3)
       ON CONFLICT (key) DO UPDATE SET value=$2, updated_by=$3, updated_at=now()`,
      [key, json, req.user.uid]);
    await audit(req.user.uid, `settings.update:${key}`, JSON.stringify(value).slice(0, 200));
    res.json({ ok: true });
  }));

  router.get('/settings/audit', adminAuth, wrap(async (req, res) => {
    const limit = Math.min(int(req.query.limit, 50), 200);
    const r = await pool.query(
      `SELECT id, actor, action, target, created_at FROM audit_log
       WHERE workspace_id IS NULL AND action LIKE 'settings.%' ORDER BY id DESC LIMIT $1`, [limit]);
    res.json({ audit: r.rows });
  }));

  // helpers
  function intRange(v, lo, hi, d) { let n = parseInt(v, 10); if (isNaN(n)) n = d; return Math.max(lo, Math.min(hi, n)); }
  function numRange(v, lo, hi, d) { let n = parseFloat(v); if (isNaN(n)) n = d; return Math.max(lo, Math.min(hi, n)); }

  return router;
};
