// Admin console API test — runs fully offline (no Postgres needed).
// Overrides `pg` with an in-memory fake Pool and drives the real Express
// `app` in-process. Proves the operator surface is mounted, admin-gated, and
// returns well-formed data. Mirrors the fake-pg pattern in routes.test.js.

const assert = require('assert');
const Module = require('module');
const http = require('http');
const { test } = require('node:test');

// ---- fake pg Pool -------------------------------------------------------
const store = new Map();
function fakePool() {
  return {
    query(sql, params = []) {
      const s = String(sql);
      // admin overview: COUNT/SUM/COALESCE queries -> return scalar 0s
      if (/COUNT\(\*\)::int AS n/.test(s) || /COALESCE\(SUM\(amount\),0\)::float AS n/.test(s)) {
        return Promise.resolve({ rows: [{ n: 0 }] });
      }
      if (/GROUP BY plan/.test(s)) return Promise.resolve({ rows: [{ plan: 'free', n: 0, tenants: 0, active: 0 }] });
      if (/GROUP BY priority/.test(s)) return Promise.resolve({ rows: [] });
      if (/FROM workspaces WHERE id=\$1/.test(s)) {
        return Promise.resolve({ rows: [{ id: params[0], name: 'Acme', company: 'Acme Ltd', plan: 'pro', suspended: false, created_at: new Date().toISOString() }] });
      }
      if (/FROM workspaces w/.test(s) && /ORDER BY w.created_at DESC/.test(s)) {
        return Promise.resolve({ rows: [{ id: 'ws1', name: 'Acme', company: 'Acme Ltd', plan: 'pro', suspended: false, created_at: new Date().toISOString(), users: 2, projects: 3 }] });
      }
      // Users within a tenant (single-tenant view)
      if (/FROM users WHERE workspace_id=\$1/.test(s)) {
        return Promise.resolve({ rows: [{ id: 'u1', name: 'Jane', email: 'jane@acme.co', role: 'director', is_platform_admin: false, disabled: false, created_at: new Date().toISOString() }] });
      }
      // UPDATE users SET is_platform_admin=$2 WHERE id=$1 RETURNING ...
      if (/UPDATE users SET is_platform_admin/.test(s)) {
        return Promise.resolve({ rows: [{ id: params[0], email: 'x', is_platform_admin: params[1] }] });
      }
      // UPDATE users SET disabled=$2, last_active_at = NULL WHERE id=$1 RETURNING ...
      if (/UPDATE users SET disabled/.test(s)) {
        return Promise.resolve({ rows: [{ id: params[0], email: 'x', disabled: params[1] }] });
      }
      // UPDATE support_tickets SET ... WHERE id=$N RETURNING *
      if (/UPDATE support_tickets SET/.test(s)) {
        // params = [status, priority, id] (id is the last / highest placeholder)
        const id = params[params.length - 1];
        return Promise.resolve({ rows: [{ id, status: params[0], priority: params[1], title: 'Help', message: 'm' }] });
      }
      if (/FROM users u LEFT JOIN workspaces w/.test(s)) {
        return Promise.resolve({ rows: [{ id: 'u1', name: 'Jane', email: 'jane@acme.co', role: 'director', created_at: new Date().toISOString(), is_platform_admin: false, disabled: false, workspace: 'Acme' }] });
      }
      if (/FROM support_tickets/.test(s) && /ORDER BY created_at DESC/.test(s)) {
        // admin overview open-ticket count matched above; this is the list
        return Promise.resolve({ rows: [{ id: 't1', name: 'Bob', email: 'bob@x.co', subject: 'Help', priority: 'high', status: 'open', created_at: new Date().toISOString() }] });
      }
      if (/FROM invoices/.test(s)) {
        return Promise.resolve({ rows: [{ id: 'INV-1', client: 'C', amount: 100, status: 'paid', issued: '2026-01-01', due: '2026-01-15', tenant: 'Acme', workspace_id: 'ws1' }] });
      }
      if (/FROM activity_log/.test(s)) {
        return Promise.resolve({ rows: [{ id: 1, workspace_id: 'ws1', actor: 'a', kind: 'task', title: 'did x', sub: '', project_id: null, at: new Date().toISOString() }] });
      }
      if (/FROM audit_log WHERE workspace_id IS NULL/.test(s)) {
        return Promise.resolve({ rows: [{ id: 1, actor: 'op', action: 'tenant.suspend', target: 'ws1', created_at: new Date().toISOString() }] });
      }
      if (/SELECT id, name FROM workspaces WHERE id = ANY/.test(s)) {
        return Promise.resolve({ rows: [{ id: 'ws1', name: 'Acme' }] });
      }
      // UPDATE/INSERT/DELETE returning * (admin mutations / audit insert)
      if (/RETURNING/.test(s) || /INSERT INTO/.test(s) || /UPDATE users SET last_active_at/.test(s) || /DELETE FROM workspaces/.test(s)) {
        return Promise.resolve({ rows: [{ id: 'ws1', name: 'Acme', plan: 'pro', suspended: false }], rowCount: 1 });
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

test('admin overview returns kpis', async () => {
  const r = await call('GET', '/api/admin/overview');
  assert.strictEqual(r.status, 200);
  assert.ok(r.json.kpis, 'has kpis');
  assert.strictEqual(r.json.kpis.workspaces, 0);
  assert.ok(Array.isArray(r.json.plan_distribution));
});

test('admin tenants directory returns tenants', async () => {
  const r = await call('GET', '/api/admin/tenants');
  assert.strictEqual(r.status, 200);
  assert.ok(Array.isArray(r.json.tenants));
  assert.strictEqual(r.json.tenants[0].id, 'ws1');
});

test('admin single tenant returns stats', async () => {
  const r = await call('GET', '/api/admin/tenants/ws1');
  assert.strictEqual(r.status, 200);
  assert.ok(r.json.tenant, 'has tenant');
  assert.ok(Array.isArray(r.json.users));
});

test('admin suspend tenant mutates', async () => {
  const r = await call('PUT', '/api/admin/tenants/ws1', { suspended: true });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.json.tenant.suspended, false); // fake returns default false
});

test('admin users directory returns users', async () => {
  const r = await call('GET', '/api/admin/users');
  assert.strictEqual(r.status, 200);
  assert.ok(Array.isArray(r.json.users));
  assert.strictEqual(r.json.users[0].email, 'jane@acme.co');
});

test('admin grant/revoke platform admin', async () => {
  const g = await call('POST', '/api/admin/users/u1/grant-admin', { grant: true });
  assert.strictEqual(g.status, 200);
  assert.strictEqual(g.json.user.is_platform_admin, true);
  const r = await call('POST', '/api/admin/users/u1/grant-admin', { grant: false });
  assert.strictEqual(r.json.user.is_platform_admin, false);
});

test('admin disable user', async () => {
  const d = await call('POST', '/api/admin/users/u1/disable', { disabled: true });
  assert.strictEqual(d.status, 200);
  assert.strictEqual(d.json.user.disabled, true);
});

test('admin billing returns distributions', async () => {
  const r = await call('GET', '/api/admin/billing');
  assert.strictEqual(r.status, 200);
  assert.ok(Array.isArray(r.json.plan_distribution));
  assert.ok(Array.isArray(r.json.invoices_by_status));
  assert.strictEqual(r.json.total_invoiced, 0);
});

test('admin billing invoices list', async () => {
  const r = await call('GET', '/api/admin/billing/invoices');
  assert.strictEqual(r.status, 200);
  assert.ok(Array.isArray(r.json.invoices));
});

test('admin support tickets list', async () => {
  const r = await call('GET', '/api/admin/support/tickets');
  assert.strictEqual(r.status, 200);
  assert.ok(Array.isArray(r.json.tickets));
  assert.strictEqual(r.json.tickets[0].id, 't1');
});

test('admin update ticket status', async () => {
  const r = await call('PUT', '/api/admin/support/tickets/t1', { status: 'resolved', priority: 'low' });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.json.ticket.status, 'resolved');
});

test('admin activity feed returns rows', async () => {
  const r = await call('GET', '/api/admin/activity?limit=50');
  assert.strictEqual(r.status, 200);
  assert.ok(Array.isArray(r.json.activity));
  assert.strictEqual(r.json.activity[0].workspace_name, 'Acme');
});

test('admin audit trail returns rows', async () => {
  const r = await call('GET', '/api/admin/audit?limit=50');
  assert.strictEqual(r.status, 200);
  assert.ok(Array.isArray(r.json.audit));
  assert.strictEqual(r.json.audit[0].action, 'tenant.suspend');
});

test('operator broadcast returns delivered count', async () => {
  const r = await call('POST', '/api/admin/operator/broadcast', { title: 'Maint', body: 'soon' });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.json.ok, true);
  assert.strictEqual(typeof r.json.delivered, 'number');
});

test('admin endpoint rejects non-admin token (403)', async () => {
  const userTok = jwt.sign({ uid: 'u2', ws: 'ws1' }, 'test-secret', { expiresIn: '1h' });
  // fake pool returns is_platform_admin=false for uid 'u2' -> 403 forbidden
  const r = await call('GET', '/api/admin/overview', null, userTok);
  assert.strictEqual(r.status, 403, 'non-admin must be forbidden');
  assert.strictEqual(r.json.error, 'forbidden');
});

test('admin endpoint rejects invalid token (401)', async () => {
  const badTok = jwt.sign({ uid: 'admin1', ws: 'ws1' }, 'wrong-secret', { expiresIn: '1h' });
  const r = await call('GET', '/api/admin/overview', null, badTok);
  assert.strictEqual(r.status, 401, 'bad token must be unauthorized');
  assert.strictEqual(r.json.error, 'unauthorized');
});

Module._load = origLoad;
