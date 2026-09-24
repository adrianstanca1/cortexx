const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../lib/cloud-sync.js'), 'utf8');
const backend = fs.readFileSync(path.join(__dirname, '../lib/backend.js'), 'utf8');
const token = (ws = 'a', uid = 'user') => `header.${Buffer.from(JSON.stringify({ ws, uid })).toString('base64url')}.sig`;
const tick = () => new Promise(resolve => setImmediate(resolve));
function setup(handler, options = {}) {
  const data = new Map(Object.entries({ cortexx_token: token(), ...options.storage }));
  const events = {};
  const calls = [];
  const toasts = [];
  const ctx = {
    localStorage: { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)), removeItem: k => data.delete(k) },
    navigator: { onLine: options.online ?? false }, atob, setTimeout, clearTimeout,
    fetch: async (url, init) => { calls.push({ url, ...init }); return handler(url, init); },
    location: { origin: 'https://construction.test' },
    addEventListener: (name, fn) => { events[name] = fn; },
    cortexxToast: (...args) => toasts.push(args),
    // Reproduce the production shared-client presence: it must not turn
    // PUT/DELETE into POST/GET or mutate auth behind the adapter's back.
    CortexCore: { createApiClient: () => ({ apiGet() { throw Error('wrong transport'); }, apiPost() { throw Error('wrong transport'); }, setToken() {}, clearToken() {} }) },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(backend + '\nwindow.Backend = Backend;', ctx);
  vm.runInContext(source, ctx);
  return { cloud: ctx.cortexxCloud, backend: ctx.Backend, data, calls, events, toasts };
}
const response = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
const op = id => ({ collection: 'tasks', op: 'update', id, data: { id, t: 'Pending task' } });

test('sync preserves create/update/delete semantics with the shared client loaded', async () => {
  const h = setup(async (url, init) => response({ ok: true, applied: JSON.parse(init.body).ops.length }));
  await h.cloud.push('tasks', 'create', 1, { id: 1 });
  await h.cloud.push('tasks', 'update', 1, { id: 1, done: true });
  await h.cloud.push('tasks', 'delete', 1);
  h.events.online(); await tick();
  assert.deepEqual(JSON.parse(h.calls[0].body).ops.map(o => o.op), ['create', 'update', 'delete']);
  assert.equal(h.cloud.status().queued, 0);
});

test('partial acknowledgement and server failures retain all pending changes', async () => {
  for (const result of [response({ ok: true, applied: 1 }), response({ error: 'db' }, 500)]) {
    const h = setup(async () => result);
    await h.cloud.push('tasks', 'update', 1, { id: 1 });
    await h.cloud.push('tasks', 'delete', 2);
    h.events.online(); await tick();
    assert.equal(h.cloud.status().queued, 2);
  }
});

test('more than 1000 offline writes are chunked and none are discarded', async () => {
  const ops = Array.from({ length: 1005 }, (_, id) => op(id));
  const h = setup(async (url, init) => response({ ok: true, applied: JSON.parse(init.body).ops.length }), {
    storage: { cortexx_sync_queue: JSON.stringify(ops) },
  });
  h.events.online(); await tick();
  assert.deepEqual(h.calls.map(c => JSON.parse(c.body).ops.length), [1000, 5]);
  assert.equal(h.cloud.status().queued, 0);
});

test('concurrent flush triggers preserve changes appended while the request is pending', async () => {
  let finish;
  const h = setup(async (url, init) => {
    if (!finish) return new Promise(resolve => { finish = () => resolve(response({ ok: true, applied: 1 })); });
    return response({ ok: true, applied: JSON.parse(init.body).ops.length });
  });
  await h.cloud.push('tasks', 'delete', 1);
  h.events.online(); await tick();
  const pending = h.cloud.push('tasks', 'update', 2, { id: 2 });
  h.events.online();
  assert.equal(h.calls.length, 1);
  finish(); await pending; await tick();
  assert.equal(h.calls.length, 2);
  assert.equal(JSON.parse(h.calls[1].body).ops[0].id, 2);
  assert.equal(h.cloud.status().queued, 0);
});

test('switching accounts isolates queues and cached company records', async () => {
  const h = setup(async () => response({ error: 'offline' }, 503));
  h.backend.mergeRemote({ tasks: [{ id: 9, t: 'Company A' }] });
  await h.cloud.push('tasks', 'delete', 9);
  h.cloud.signOut();
  h.cloud._authed({ token: token('b'), user: {} });
  assert.equal(h.cloud.status().queued, 0);
  assert.equal(h.backend.db.tasks.listSync().length, 0);
  h.cloud._authed({ token: token('a'), user: {} });
  assert.equal(h.cloud.status().queued, 1);
  assert.equal(h.backend.db.tasks.getSync(9).t, 'Company A');
});

test('snapshot removes remote deletions but preserves pending edits and deletes', () => {
  const h = setup(async () => response({}));
  h.backend.mergeRemote({ tasks: [{ id: 1 }, { id: 2 }, { id: 3 }] });
  h.backend.mergeRemote({ tasks: [{ id: 2 }, { id: 3 }] }, {
    fullSnapshot: true,
    pending: [{ ...op(2), data: { id: 2, t: 'Local edit' } }, { collection: 'tasks', op: 'delete', id: 3 }],
  });
  assert.equal(h.backend.db.tasks.getSync(1), undefined);
  assert.equal(h.backend.db.tasks.getSync(2).t, 'Local edit');
  assert.equal(h.backend.db.tasks.getSync(3), undefined);
});

test('an old 401 response cannot log out a newly signed-in account', async () => {
  let finish;
  const h = setup(async url => {
    if (url.includes('/sync/bulk')) return new Promise(resolve => { finish = () => resolve(response({}, 401)); });
    return response({ collections: {} });
  });
  await h.cloud.push('tasks', 'delete', 1);
  h.events.online(); await tick();
  h.cloud._authed({ token: token('b'), user: {} });
  finish(); await tick();
  assert.equal(h.data.get('cortexx_token'), token('b'));
  assert.equal(h.cloud.status().authed, true);
});

test('legacy queue without an owner remains unassigned on the next sign-in', () => {
  const h = setup(async () => response({}), { storage: { cortexx_token: '', cortexx_sync_queue: JSON.stringify([op(1)]) } });
  h.cloud._authed({ token: token('b'), user: {} });
  assert.equal(h.cloud.status().queued, 0);
  assert.equal(JSON.parse(h.data.get('cortexx_sync_queue')).length, 1);
});
