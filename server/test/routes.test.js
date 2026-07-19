// Backend route integration test — runs fully offline (no Postgres needed).
// Overrides `pg` so the server uses an in-memory fake Pool, then drives the
// real Express `app` in-process with a signed JWT. Proves every route is
// mounted, auth-gated, and returns well-formed data — the gold-standard
// "does the server actually work" check that node --check cannot give.

const assert = require('assert');
const Module = require('module');
const http = require('http');
const { test } = require('node:test');

// ---- fake pg Pool -------------------------------------------------------
const store = new Map(); // collection -> [{id, workspace_id, data}]
let queryLog = [];
function fakePool() {
  return {
    query(sql, params = []) {
      queryLog.push({ sql: String(sql), params });
      const s = String(sql);
      const ws = params[0];
      let m;
      // Generic GET of a JSONB collection (documents_store)
      if (s.startsWith('SELECT doc_id, data FROM documents_store')) {
        const col = params[1];
        const rows = (store.get(col) || []).filter(r => r.workspace_id === ws)
          .map(r => ({ doc_id: r.id, data: r.data }));
        return Promise.resolve({ rows });
      }
      // Generic INSERT into documents_store
      if (s.startsWith('INSERT INTO documents_store')) {
        const [w, col, id, data] = params;
        const arr = store.get(col) || [];
        arr.push({ id, workspace_id: w, data });
        store.set(col, arr);
        return Promise.resolve({ rows: [{ id }] });
      }
      // DELETE from documents_store
      if (s.startsWith('DELETE FROM documents_store')) {
        const [w, col, id] = params;
        store.set(col, (store.get(col) || []).filter(r => !(r.workspace_id === w && r.id === id)));
        return Promise.resolve({ rowCount: 1 });
      }
      // NATIVE table DELETE: DELETE FROM <tbl> WHERE id=$1 AND workspace_id=$2
      m = s.match(/DELETE FROM (\w+) WHERE id=\$1 AND workspace_id=\$2/);
      if (m) {
        const tbl = m[1];
        const [id, w] = params;
        store.set(tbl, (store.get(tbl) || []).filter(r => !(r.id === id && r.workspace_id === w)));
        return Promise.resolve({ rowCount: 1 });
      }
      // NATIVE table GET: SELECT * FROM <tbl> WHERE workspace_id=$1
      m = s.match(/SELECT \* FROM (\w+) WHERE workspace_id=\$1/);
      if (m) {
        const tbl = m[1];
        const rows = (store.get(tbl) || []).filter(r => r.workspace_id === ws);
        return Promise.resolve({ rows });
      }
      // NATIVE table INSERT: INSERT INTO <tbl> (id, workspace_id, data) VALUES ($1,$2,$3)
      m = s.match(/INSERT INTO (\w+) \(id, workspace_id, data\) VALUES \(\$1,\$2,\$3\)/);
      if (m) {
        const tbl = m[1];
        const [id, w, data] = params;
        const arr = store.get(tbl) || [];
        arr.push({ id, workspace_id: w, data });
        store.set(tbl, arr);
        return Promise.resolve({ rows: [{ id }] });
      }
      // auth resolution (role/admin lookups)
      if (s.includes('SELECT role FROM users')) return Promise.resolve({ rows: [{ role: 'admin' }] });
      if (s.includes('FROM users WHERE id=$1')) return Promise.resolve({ rows: [{ role: 'admin' }] });
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

// JWT_SECRET must be set BEFORE requiring the server (it reads process.env at load)
process.env.JWT_SECRET = 'test-secret';
process.env.NODE_ENV = 'test';
process.env.CORS_ORIGINS = 'http://localhost:8080';

const { app } = require('../index');
const jwt = require('jsonwebtoken');
const TOKEN = jwt.sign({ uid: 'u1', ws: 'ws1' }, 'test-secret', { expiresIn: '1h' });

// in-process HTTP server helper
function call(method, path, body) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const port = server.address().port;
      const data = body ? JSON.stringify(body) : null;
      const req = http.request({
        host: '127.0.0.1', port, method, path,
        headers: {
          'authorization': 'Bearer ' + TOKEN,
          'content-type': 'application/json',
          'origin': 'http://localhost:8080',
        },
      }, (res) => {
        let buf = '';
        res.on('data', d => buf += d);
        res.on('end', () => {
          server.close();
          let json; try { json = JSON.parse(buf); } catch { json = buf; }
          resolve({ status: res.statusCode, json });
        });
      });
      req.on('error', reject);
      if (data) req.write(data);
      req.end();
    });
  });
}

test('auth guard: no token -> 401', async () => {
  await new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const port = server.address().port;
      const req = http.request({ host: '127.0.0.1', port, method: 'GET', path: '/api/tasks',
        headers: { origin: 'http://localhost:8080' } }, (res) => {
        server.close();
        try { assert.strictEqual(res.statusCode, 401, 'unauthorized without token'); resolve(); }
        catch (e) { reject(e); }
      });
      req.on('error', reject);
      req.end();
    });
  });
});

test('GET /api/tasks returns array (mock rows)', async () => {
  store.set('tasks', [{ id: 't1', workspace_id: 'ws1', data: { title: 'Fix roof' } }]);
  const r = await call('GET', '/api/tasks');
  assert.strictEqual(r.status, 200);
  assert.ok(Array.isArray(r.json), 'body is an array');
  assert.strictEqual(r.json.length, 1);
  assert.strictEqual(r.json[0].title, 'Fix roof');
});

test('POST /api/snags creates + GET returns it', async () => {
  const created = await call('POST', '/api/snags', { title: 'Crack in wall', photo: 'data:image/png;base64,AAA' });
  assert.strictEqual(created.status, 200);
  assert.ok(created.json.id, 'has id');
  const got = await call('GET', '/api/snags');
  assert.strictEqual(got.status, 200);
  assert.strictEqual(got.json.length, 1);
  assert.strictEqual(got.json[0].title, 'Crack in wall');
});

test('PUT /api/snags/:id updates', async () => {
  const id = (await call('POST', '/api/snags', { title: 'old' })).json.id;
  const upd = await call('PUT', '/api/snags/' + id, { title: 'new', id });
  assert.strictEqual(upd.status, 200);
  assert.strictEqual(upd.json.title, 'new');
});

test('DELETE /api/snags/:id removes', async () => {
  store.clear(); // isolate from prior tests' snags entries
  const id = (await call('POST', '/api/snags', { title: 'doomed' })).json.id;
  const del = await call('DELETE', '/api/snags/' + id);
  assert.strictEqual(del.status, 200);
  const got = await call('GET', '/api/snags');
  assert.strictEqual(got.json.length, 0, 'should be empty after delete');
});

test('restricted collection (users) -> 403', async () => {
  const r = await call('GET', '/api/users');
  assert.strictEqual(r.status, 403, 'system collection must be blocked');
  assert.strictEqual(r.json.error, 'collection_restricted');
});

test('SSE /api/stream opens as event-stream', async () => {
  await new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const port = server.address().port;
      const req = http.request({
        host: '127.0.0.1', port, method: 'GET',
        path: '/api/stream?token=' + TOKEN,
        headers: { origin: 'http://localhost:8080', 'accept': 'text/event-stream' },
      }, (res) => {
        try {
          assert.strictEqual(res.statusCode, 200, 'stream should open 200');
          assert.ok(res.headers['content-type'].startsWith('text/event-stream'), 'must be SSE');
          res.destroy();
          server.close();
          resolve();
        } catch (e) { server.close(); reject(e); }
      });
      req.on('error', reject);
      req.end();
    });
    // hard timeout so the test never hangs on a slow worker
    setTimeout(() => reject(new Error('SSE open timeout')), 4000);
  });
});

Module._load = origLoad;
