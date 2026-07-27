// Central API registry API test — runs fully offline (no Postgres needed).
// Overrides `pg` with an in-memory fake Pool and drives the real Express `app`
// in-process. Proves the operator surface is mounted, admin-gated, masks
// secrets, and accepts rotations. Mirrors the fake-pg pattern in admin.test.js.

const assert = require('assert');
const Module = require('module');
const http = require('http');
const { test } = require('node:test');

const store = new Map();
function fakePool() {
  return {
    query(sql, params = []) {
      const s = String(sql);
      // SELECT ... FROM api_connections ... — list + reload both read here.
      // Return whatever we've stored (upserted via the INSERT branch below).
      if (/FROM api_connections/.test(s)) {
        const rows = [...store.values()].map(v => ({
          name: v.name, category: v.category, provider: v.provider,
          encrypted_secret: v.encrypted_secret, config: v.config || {},
          status: v.status || 'unknown', last_tested_at: null,
          last_error: v.last_error || null, updated_by: v.updated_by || null,
          updated_at: v.updated_at || new Date().toISOString(),
        }));
        return Promise.resolve({ rows });
      }
      // INSERT / UPSERT paths
      if (/INSERT INTO api_connections/.test(s) || /ON CONFLICT/.test(s)) {
        const name = params[0];
        store.set(name, {
          name, category: params[3], provider: params[4],
          encrypted_secret: params[1], config: {},
          status: params[2] || 'unknown', last_error: null,
          updated_by: params[5] || null, updated_at: new Date().toISOString(),
        });
        return Promise.resolve({ rows: [{ name }], rowCount: 1 });
      }
      // adminAuth: resolve platform-admin flag — true only for the admin uid
      if (s.includes('SELECT is_platform_admin FROM users WHERE id=$1')) {
        const uid = params[0];
        return Promise.resolve({ rows: [{ is_platform_admin: uid === 'admin1' }] });
      }
      return Promise.resolve({ rows: [] });
    },
    end() { return Promise.resolve(); },
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
const NONADMIN = jwt.sign({ uid: 'user2', ws: 'ws1' }, 'test-secret', { expiresIn: '1h' });

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

test('registry: 401 without token, 403 for non-admin', async () => {
  const noTok = await call('GET', '/api/admin/connections', null, '');
  assert.strictEqual(noTok.status, 401);
  const notAdmin = await call('GET', '/api/admin/connections', null, NONADMIN);
  assert.strictEqual(notAdmin.status, 403);
});

test('registry: GET lists seeded connections without leaking secrets', async () => {
  const r = await call('GET', '/api/admin/connections');
  assert.strictEqual(r.status, 200);
  assert.ok(Array.isArray(r.json.connections));
  // every connection must NOT contain a raw secret field
  for (const c of r.json.connections) {
    assert.ok(!('encrypted_secret' in c), 'raw encrypted_secret must not leak');
    assert.ok(!('secret' in c), 'raw secret must not leak');
  }
});

test('registry: PUT rotates a secret and masks it on read', async () => {
  const put = await call('PUT', '/api/admin/connections/stripe_secret_key', { secret: 'sk_test_' + 'x'.repeat(20), provider: 'stripe', category: 'payments', emailProvider: 'resend' });
  assert.strictEqual(put.status, 200);
  assert.strictEqual(put.json.ok, true);
  assert.ok(put.json.connection.hasSecret === true || put.json.connection.status !== undefined);
  // the saved connection must never echo the secret back
  assert.ok(!('encrypted_secret' in put.json.connection));
  assert.ok(!('secret' in put.json.connection));
  // emailProvider switch echoed
  const list = await call('GET', '/api/admin/connections');
  assert.strictEqual(list.json.emailProvider, 'resend');
});

test('registry: invalid secret format rejected for known validators', async () => {
  // resend_key validator requires a re_... prefix; a garbage value should 400
  const put = await call('PUT', '/api/admin/connections/resend_key', { secret: 'bad' });
  assert.strictEqual(put.status, 400);
  assert.ok(/format/i.test(put.json.error || ''));
});
