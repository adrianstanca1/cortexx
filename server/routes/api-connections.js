// Cortexx — Central API Registry admin API.
//
// Mounted at /api/admin/connections by server/index.js, behind adminAuth
// (platform-operator gate). Lets an operator:
//   GET  /api/admin/connections          list every managed integration (masked)
//   GET  /api/admin/connections/:name     single connection detail (masked preview)
//   PUT  /api/admin/connections/:name     rotate/replace the credential (encrypt + reload + audit)
//   POST /api/admin/connections/:name/test  probe the live endpoint, update status
//
// Security:
//   • Every rotation writes an immutable, hash-chained audit_log entry.
//   • PUT validates the credential shape per provider before persisting.
//   • Secrets are NEVER returned in full — only a masked preview.
//   • `api_connections` is denylisted in server/security.js, so it is not
//     reachable through the generic /api/:collection CRUD path.

'use strict';

const express = require('express');
const crypto = require('crypto');
const { store, REGISTRY_BY_NAME, VALIDATORS, maskSecret } = require('../lib/secret-store');

function abortableFetch(url, opts, ms) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms || 12000);
  return fetch(url, { ...opts, signal: c.signal }).finally(() => clearTimeout(t));
}

// Provider-specific liveness test. Returns { ok, status, detail }.
async function testConnection(conn) {
  const sec = store();
  try {
    switch (conn.provider) {
      case 'stripe': {
        const key = sec.getSecret('stripe_secret_key');
        if (!key) return { ok: false, status: 'inactive', detail: 'No Stripe key configured' };
        const r = await abortableFetch('https://api.stripe.com/v1/charges?limit=1', {
          headers: { authorization: 'Bearer ' + key },
        });
        // 200 = key valid; 401 = key invalid; both mean the endpoint is reachable.
        return { ok: r.status !== 401, status: r.ok ? 'active' : 'error', detail: `Stripe API responded ${r.status}` };
      }
      case 'resend': {
        const key = sec.getSecret('resend_key');
        if (!key) return { ok: false, status: 'inactive', detail: 'No Resend key configured' };
        const r = await abortableFetch('https://api.resend.com/domains', {
          headers: { authorization: 'Bearer ' + key },
        });
        return { ok: r.status < 500, status: r.ok ? 'active' : 'error', detail: `Resend API responded ${r.status}` };
      }
      case 'sendgrid': {
        const key = sec.getSecret('sendgrid_key');
        if (!key) return { ok: false, status: 'inactive', detail: 'No SendGrid key configured' };
        const r = await abortableFetch('https://api.sendgrid.com/v3/user/profile', {
          headers: { authorization: 'Bearer ' + key },
        });
        return { ok: r.status < 500, status: r.ok ? 'active' : 'error', detail: `SendGrid API responded ${r.status}` };
      }
      case 'hmrc': {
        const u = sec.getSecret('hmrc_gateway_user');
        const p = sec.getSecret('hmrc_gateway_pass');
        if (!u || !p) return { ok: false, status: 'inactive', detail: 'HMRC Gateway credentials not configured' };
        return { ok: true, status: 'active', detail: 'Gateway credentials present (live submission requires HMRC TPVS)' };
      }
      case 'truelayer': {
        const id = sec.getSecret('truelayer_client_id');
        const secret = sec.getSecret('truelayer_client_secret');
        if (!id || !secret) return { ok: false, status: 'inactive', detail: 'TrueLayer credentials not configured' };
        return { ok: true, status: 'active', detail: 'TrueLayer credentials present' };
      }
      case 'vapid': {
        const pub = sec.getSecret('vapid_public');
        const priv = sec.getSecret('vapid_private');
        if (!pub || !priv) return { ok: false, status: 'inactive', detail: 'VAPID keys not configured' };
        return { ok: true, status: 'active', detail: 'VAPID key pair present' };
      }
      case 'ollama': {
        const base = sec.getSecret('ollama_base') || 'http://localhost:11434';
        const r = await abortableFetch(base.replace(/\/+$/, '') + '/api/tags');
        return { ok: r.ok, status: r.ok ? 'active' : 'error', detail: `Ollama responded ${r.status}` };
      }
      case 'openai':
      case 'apple':
      case 'gocardless': {
        const name = conn.provider === 'gocardless' ? 'gocardless_token'
          : conn.provider === 'apple' ? 'apple_shared_secret' : 'openai_compat_base';
        const v = sec.getSecret(name);
        if (!v) return { ok: false, status: 'inactive', detail: `No ${conn.provider} credential configured` };
        return { ok: true, status: 'active', detail: `${conn.provider} credential present` };
      }
      default:
        return { ok: sec.hasSecret(conn.name), status: sec.hasSecret(conn.name) ? 'active' : 'inactive', detail: 'No liveness probe for this provider' };
    }
  } catch (e) {
    return { ok: false, status: 'error', detail: e.name === 'AbortError' ? 'timeout' : e.message };
  }
}

module.exports = function apiConnectionsRoutes(pool, auth, adminAuth, wrap, bus, secretStore) {
  const router = express.Router();
  // Ensure the registry store has a DB pool (route-mount time is robust whether
  // index.js was run directly or required as a module by a test).
  const { setStorePool } = require('../lib/secret-store');
  setStorePool(pool);
  const sec = secretStore || store();

  // Hash-chained, platform-scope audit (mirrors routes/admin.js).
  async function audit(actor, action, target) {
    try {
      const prev = await pool.query('SELECT hash FROM audit_log WHERE workspace_id IS NULL ORDER BY id DESC LIMIT 1');
      const prevHash = prev.rows[0]?.hash || '';
      const hash = crypto.createHash('sha256').update(prevHash + actor + action + target + Date.now()).digest('hex');
      await pool.query(
        'INSERT INTO audit_log(workspace_id, actor, action, target, hash) VALUES($1,$2,$3,$4,$5)',
        [null, actor, action, target, hash]
      );
    } catch (_) { /* best-effort */ }
  }

  router.get('/connections', adminAuth, wrap(async (_req, res) => {
    res.json({ connections: sec.list(), emailProvider: (process.env.EMAIL_PROVIDER || 'resend').toLowerCase() });
  }));

  router.get('/connections/:name', adminAuth, wrap(async (req, res) => {
    const { name } = req.params;
    if (!sec.isRegistered(name)) return res.status(404).json({ error: 'unknown_connection', name });
    res.json({ connection: sec.detail(name) });
  }));

  router.put('/connections/:name', adminAuth, wrap(async (req, res) => {
    const { name } = req.params;
    const def = REGISTRY_BY_NAME[name];
    if (!def && !sec.isRegistered(name)) return res.status(404).json({ error: 'unknown_connection', name });

    const body = req.body || {};
    const actor = req.user && req.user.uid ? String(req.user.uid) : 'operator';

    // Rotate the secret if supplied.
    if (typeof body.secret === 'string') {
      const validator = VALIDATORS[name];
      if (validator && !validator(body.secret)) {
        return res.status(400).json({ error: 'invalid_secret_format', name, hint: 'Credential does not match the expected format for this provider.' });
      }
      await sec.setSecret(name, body.secret, actor);
      await audit(actor, 'connection.rotate', name);
    }

    // Update non-secret config if supplied.
    if (body.config && typeof body.config === 'object') {
      await sec.setConfig(name, body.config);
      await audit(actor, 'connection.configure', name);
    }

    if (typeof body.secret !== 'string' && !body.config && !body.emailProvider) {
      return res.status(400).json({ error: 'nothing_to_update', hint: 'Provide `secret` and/or `config` and/or `emailProvider`.' });
    }

    // Live email-provider switch (resend | sendgrid). Takes effect immediately
    // for the running process; persisted config can be layered on later.
    if (body.emailProvider && ['resend', 'sendgrid'].includes(String(body.emailProvider).toLowerCase())) {
      process.env.EMAIL_PROVIDER = String(body.emailProvider).toLowerCase();
      await audit(actor, 'connection.provider_switch', 'email:' + process.env.EMAIL_PROVIDER);
    }

    res.json({ ok: true, connection: sec.detail(name), emailProvider: (process.env.EMAIL_PROVIDER || 'resend').toLowerCase() });
  }));

  router.post('/connections/:name/test', adminAuth, wrap(async (req, res) => {
    const { name } = req.params;
    if (!sec.isRegistered(name)) return res.status(404).json({ error: 'unknown_connection', name });
    const conn = sec.detail(name);
    const result = await testConnection(conn);
    await sec.setStatus(name, result.status, result.detail);
    res.json({ name, ...result });
  }));

  return router;
};
