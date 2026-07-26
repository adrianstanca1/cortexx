// Admin console enhancements — feature/RBAC/AI/settings API tests.
// Offline: fakes `pg` (same pattern as admin.test.js) and drives the real
// Express `app` in-process. Proves the new /api/admin/features|access|ai|settings
// routes mount, are admin-gated, and return well-formed data.

const assert = require('assert');
const http = require('http');
const Module = require('module');
const { test } = require('node:test');

// ---- fake pg Pool -------------------------------------------------------
function fakePool() {
  return {
    query(sql, params = []) {
      const s = String(sql);
      if (/SELECT is_platform_admin FROM users WHERE id=\$1/.test(s)) {
        const uid = params[0];
        return Promise.resolve({ rows: [{ is_platform_admin: uid === 'admin1' }] });
      }
      if (/COUNT\(\*\)::int AS n/.test(s) || /COALESCE\(SUM\(amount\),0\)::float AS n/.test(s)) {
        return Promise.resolve({ rows: [{ n: 0 }] });
      }
      if (/GROUP BY plan/.test(s)) return Promise.resolve({ rows: [{ plan: 'free', n: 0 }] });
      if (/FROM feature_flags/.test(s) && /ORDER BY category/.test(s)) {
        return Promise.resolve({ rows: [
          { key: 'ai_intelligence', name: 'AI Intelligence', category: 'ai', default_on: true, description: 'x', min_plan: 'free' },
          { key: 'ai_memory', name: 'AI Memory', category: 'memory', default_on: false, description: 'y', min_plan: 'pro' },
        ] });
      }
      if (/FROM feature_flags WHERE key = ANY/.test(s)) return Promise.resolve({ rows: [{ key: params[0][0] || 'ai_intelligence' }] });
      if (/SELECT key, features FROM packages WHERE key=\$1/.test(s)) {
        const k = params[0];
        return Promise.resolve({ rows: k === 'starter' ? [{ key: 'starter', features: ['ai_intelligence'] }] : [] });
      }
      if (/FROM packages/.test(s)) return Promise.resolve({ rows: [{ key: 'starter', name: 'Starter', monthly_price: 0, features: ['ai_intelligence'], description: 'core', is_system: true }] });
      if (/FROM roles/.test(s)) return Promise.resolve({ rows: [{ key: 'owner', name: 'Owner', permissions: { '*': true }, description: 'x', is_system: true }] });
      if (/FROM workspace_features WHERE workspace_id=\$1/.test(s)) return Promise.resolve({ rows: [] });
      if (/FROM user_features/.test(s)) return Promise.resolve({ rows: [] });
      if (/FROM workspace_packages WHERE workspace_id=\$1/.test(s)) return Promise.resolve({ rows: [] });
      if (/FROM workspaces WHERE id=\$1/.test(s)) return Promise.resolve({ rows: [{ id: params[0], plan: 'pro' }] });
      if (/FROM users WHERE id=\$1/.test(s)) return Promise.resolve({ rows: [{ id: params[0], workspace_id: 'ws1', role: 'director' }] });
      if (/FROM users WHERE workspace_id=\$1/.test(s)) return Promise.resolve({ rows: [{ id: 'u1', name: 'J', email: 'j@x.co', role: 'director', is_platform_admin: false, disabled: false }] });
      if (/SELECT key FROM roles WHERE key=\$1/.test(s)) return Promise.resolve({ rows: [{ key: params[0] }] });
      if (/SELECT key, features FROM packages WHERE key=\$1/.test(s)) return Promise.resolve({ rows: [{ key: params[0], features: ['ai_intelligence'] }] });
      if (/FROM ai_config WHERE workspace_id IS NULL/.test(s)) return Promise.resolve({ rows: [] });
      if (/FROM ai_config WHERE workspace_id=\$1/.test(s)) return Promise.resolve({ rows: [] });
      if (/FROM platform_settings/.test(s)) return Promise.resolve({ rows: [{ key: 'general', value: { platform_name: 'X' }, updated_at: null, updated_by: null }] });
      if (/FROM audit_log WHERE workspace_id IS NULL AND action LIKE/.test(s)) return Promise.resolve({ rows: [] });
      if (/RETURNING/.test(s) || /INSERT INTO/.test(s) || /UPDATE users SET role/.test(s) || /UPDATE workspaces SET plan/.test(s) || /DELETE FROM/.test(s)) {
        return Promise.resolve({ rows: [{ id: 'ws1', ok: true }], rowCount: 1 });
      }
      return Promise.resolve({ rows: [] });
    },
    connect() {
      return Promise.resolve({
        query: () => Promise.resolve({ rows: [] }),
        begin: () => Promise.resolve(), commit: () => Promise.resolve(), rollback: () => Promise.resolve(), release: () => {},
      });
    },
  };
}

const origLoad = Module._load;
Module._load = function (request) {
  if (request === 'pg') return { Pool: function () { return fakePool(); } };
  return origLoad.apply(this, arguments);
};

process.env.JWT_SECRET = 'test-secret';
process.env.NODE_ENV = 'test';
process.env.CORS_ORIGINS = 'http://localhost:8080';

const { app } = require('../index');
const jwt = require('jsonwebtoken');
const ADMIN = jwt.sign({ uid: 'admin1', ws: 'ws1' }, 'test-secret', { expiresIn: '1h' });

function call(method, path, body, token = ADMIN) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const port = server.address().port;
      const data = body ? JSON.stringify(body) : null;
      const req = http.request({
        host: '127.0.0.1', port, method, path,
        headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json', origin: 'http://localhost:8080' },
      }, (res) => {
        let buf = '';
        res.on('data', d => buf += d);
        res.on('end', () => { server.close(); let json; try { json = JSON.parse(buf); } catch { json = buf; } resolve({ status: res.statusCode, json }); });
      });
      req.on('error', reject);
      if (data) req.write(data);
      req.end();
    });
  });
}

test('features: catalog, packages, tenant features, override', async () => {
  let r = await call('GET', '/api/admin/features/catalog');
  assert.strictEqual(r.status, 200);
  assert.ok(Array.isArray(r.json.features) && r.json.features.length >= 1);
  r = await call('GET', '/api/admin/features/packages');
  assert.strictEqual(r.status, 200);
  assert.ok(Array.isArray(r.json.packages));
  r = await call('GET', '/api/admin/features/tenant/ws1');
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.json.workspace, 'ws1');
  r = await call('PUT', '/api/admin/features/tenant/ws1', { overrides: { ai_memory: true } });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.json.ok, true);
});

test('access: roles, tenant users, user role, package assign', async () => {
  let r = await call('GET', '/api/admin/access/roles');
  assert.strictEqual(r.status, 200);
  assert.ok(Array.isArray(r.json.roles));
  r = await call('GET', '/api/admin/access/tenant/ws1');
  assert.strictEqual(r.status, 200);
  assert.ok(Array.isArray(r.json.users));
  r = await call('PUT', '/api/admin/access/user/u1/role', { role_key: 'owner' });
  assert.strictEqual(r.status, 200);
  r = await call('PUT', '/api/admin/access/tenant/ws1/package', { package_key: 'starter', assign: true });
  assert.strictEqual(r.status, 200);
  // invalid package rejected
  r = await call('PUT', '/api/admin/access/tenant/ws1/package', { package_key: 'nope', assign: true });
  assert.strictEqual(r.status, 404);
});

test('ai: config, providers, settings', async () => {
  let r = await call('GET', '/api/admin/ai/config');
  assert.strictEqual(r.status, 200);
  assert.ok(Array.isArray(r.json.tenants));
  r = await call('GET', '/api/admin/ai/config/ws1');
  assert.strictEqual(r.status, 200);
  assert.ok(r.json.config);
  r = await call('PUT', '/api/admin/ai/config/ws1', { provider: 'openrouter', model: 'gpt', memory_enabled: true, knowledge_enabled: false, agents_enabled: true, max_tokens: 1024, temperature: 0.5 });
  assert.strictEqual(r.status, 200);
  r = await call('GET', '/api/admin/ai/providers');
  assert.strictEqual(r.status, 200);
  assert.ok(Array.isArray(r.json.providers));
  r = await call('GET', '/api/admin/settings');
  assert.strictEqual(r.status, 200);
  assert.ok(Array.isArray(r.json.settings));
  r = await call('PUT', '/api/admin/settings/general', { value: { platform_name: 'X' } });
  assert.strictEqual(r.status, 200);
});

test('enhanced admin routes require auth', async () => {
  const r = await call('GET', '/api/admin/features/catalog', null, null);
  assert.strictEqual(r.status, 401);
});
