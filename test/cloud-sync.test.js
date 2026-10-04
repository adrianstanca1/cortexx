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
  assert.deepEqual(h.calls.filter(c => c.method === 'POST').map(c => JSON.parse(c.body).ops.length), [1000, 5]);
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
  const uploads = h.calls.filter(c => c.method === 'POST');
  assert.equal(uploads.length, 2);
  assert.equal(JSON.parse(uploads[1].body).ops[0].id, 2);
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

const cursorKey = (ws = 'a', uid = 'user', api = 'https://construction.test') =>
  `cortexx_last_pull:${encodeURIComponent(api)}:${encodeURIComponent(ws)}:${encodeURIComponent(uid)}`;

test('pull cursors are isolated by workspace, user and API destination', async () => {
  const h = setup(async () => response({ collections: {}, at: '2026-09-28T08:00:00Z' }), {
    storage: { cortexx_last_pull: 'unsafe-global-cursor' },
  });
  assert.equal(h.cloud.status().lastPull, null);
  await h.cloud.pull();
  assert.equal(new URL(h.calls.at(-1).url).searchParams.get('since'), '');
  const saved = h.cloud.status().lastPull;
  assert.equal(h.data.get(cursorKey()), saved);
  await h.cloud.pull();
  assert.equal(new URL(h.calls.at(-1).url).searchParams.get('since'), saved);

  for (const [ws, uid] of [['b', 'user'], ['a', 'other']]) {
    h.cloud._authed({ token: token(ws, uid) });
    assert.equal(h.cloud.status().lastPull, null);
    await tick();
    assert.equal(new URL(h.calls.at(-1).url).searchParams.get('since'), '');
    assert.equal(h.data.get(cursorKey(ws, uid)), saved);
  }
  h.cloud._authed({ token: token() });
  await tick();
  assert.equal(new URL(h.calls.at(-1).url).searchParams.get('since'), saved);
  h.cloud.setApi('https://other.test');
  assert.equal(h.cloud.status().lastPull, null);
  await h.cloud.pull();
  assert.equal(new URL(h.calls.at(-1).url).searchParams.get('since'), '');
  assert.equal(h.data.get(cursorKey('a', 'user', 'https://other.test')), saved);
  h.cloud.signOut();
  assert.equal(h.cloud.status().lastPull, null);
});

test('an older overlapping pull cannot overwrite newer records or their cursor', async () => {
  const finishes = [];
  const h = setup(() => new Promise(resolve => finishes.push(resolve)));
  const older = h.cloud.pull();
  const newer = h.cloud.pull();
  finishes[1](response({ collections: { tasks: [{ id: 1, t: 'New' }] }, at: 'new', fullSnapshot: true }));
  await newer;
  finishes[0](response({ collections: { tasks: [{ id: 1, t: 'Old' }] }, at: 'old', fullSnapshot: true }));
  assert.equal(await older, null);
  assert.equal(h.backend.db.tasks.getSync(1).t, 'New');
  assert.equal(h.cloud.status().lastPull, 'new');
});

test('a pull from a signed-out session stays invalid after the same account signs back in', async () => {
  let finish;
  const h = setup(() => new Promise(resolve => { finish = resolve; }));
  const pending = h.cloud.pull();
  h.cloud.signOut();
  h.cloud._authed({ token: token() });
  finish(response({ collections: { tasks: [{ id: 1, t: 'Stale' }] }, at: 'stale' }));
  assert.equal(await pending, null);
  assert.equal(h.backend.db.tasks.getSync(1), undefined);
  assert.equal(h.cloud.status().lastPull, null);
});

test('a pull racing a local edit does not advance its cursor or erase pending work', async () => {
  let finish;
  const h = setup(() => new Promise(resolve => { finish = resolve; }));
  const pending = h.cloud.pull();
  await h.cloud.push('tasks', 'update', 1, { id: 1, t: 'Local' });
  finish(response({ collections: { tasks: [] }, at: 'unsafe', fullSnapshot: true }));
  assert.equal(await pending, null);
  assert.equal(h.cloud.status().lastPull, null);
  assert.equal(h.cloud.status().queued, 1);
});

test('an old 401 cannot expire a new session for the same account and token', async () => {
  let finish;
  let requests = 0;
  const h = setup(() => ++requests === 1
    ? new Promise(resolve => { finish = resolve; })
    : response({ collections: {}, at: 'new-session' }));
  const pending = h.cloud.pull();
  h.cloud.signOut();
  h.cloud._authed({ token: token() });
  await tick();
  finish(response({}, 401));
  await pending;
  assert.equal(h.cloud.status().authed, true);
  assert.equal(h.cloud.status().lastPull, 'new-session');
});

test('reconnecting uploads pending edits before refreshing remote records', async () => {
  const h = setup((url, init) => init.method === 'POST'
    ? response({ ok: true, applied: JSON.parse(init.body).ops.length })
    : response({ collections: { tasks: [{ id: 2, t: 'Remote update' }] }, at: 'reconnected', fullSnapshot: true }));
  await h.cloud.push('tasks', 'delete', 1);
  h.events.online();
  await tick();
  assert.deepEqual(h.calls.map(call => call.method), ['POST', 'GET']);
  assert.equal(h.cloud.status().queued, 0);
  assert.equal(h.backend.db.tasks.getSync(2).t, 'Remote update');
  assert.equal(h.cloud.status().lastPull, 'reconnected');
});

test('an online restored session downloads changes without requiring live sync', async () => {
  const h = setup(() => response({ collections: { tasks: [{ id: 3, t: 'Updated elsewhere' }] }, at: 'restored' }), { online: true });
  await tick();
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].method, 'GET');
  assert.equal(h.backend.db.tasks.getSync(3).t, 'Updated elsewhere');
  assert.equal(h.cloud.status().lastPull, 'restored');
});

test('reconnect refresh preserves queued edits when their upload is rejected', async () => {
  const h = setup((url, init) => init.method === 'POST'
    ? response({ error: 'Temporary failure' }, 503)
    : response({ collections: { tasks: [{ id: 1, t: 'Old server value' }] }, at: 'refresh', fullSnapshot: true }));
  await h.cloud.push('tasks', 'update', 1, { id: 1, t: 'Unsynced field edit' });
  h.events.online();
  await tick();
  assert.equal(h.cloud.status().queued, 1);
  assert.equal(h.backend.db.tasks.getSync(1).t, 'Unsynced field edit');
});

test('a current-session 401 still expires authentication', async () => {
  const h = setup(() => response({}, 401));
  await h.cloud.pull();
  assert.equal(h.cloud.status().authed, false);
  assert.equal(h.data.has('cortexx_token'), false);
});


const scopedConflictKey = (ws = 'a', uid = 'user', api = 'https://construction.test') =>
  `cortexx_sync_conflicts:${encodeURIComponent(api)}:${encodeURIComponent(ws)}:${encodeURIComponent(uid)}`;

test('backend mutations queue the server revision they were based on', async () => {
  const h = setup(async () => response({}), { online: false });
  h.backend.mergeRemote({ tasks: [{ id: 77, t: 'Cloud', _syncVersion: 4 }] });
  await h.backend.db.tasks.update(77, { t: 'Edited offline' });
  const queueEntry = [...h.data.entries()].find(([key]) => key.startsWith('cortexx_sync_queue:'));
  assert.ok(queueEntry);
  const queued = JSON.parse(queueEntry[1]);
  assert.equal(queued.length, 1);
  assert.equal(queued[0].baseVersion, 4);
  assert.equal(queued[0].data._syncVersion, 5);
});

test('a stale record is quarantined while unrelated queued work continues syncing', async () => {
  let posts = 0;
  const postBatches = [];
  const h = setup(async (url, init) => {
    if (init.method === 'POST') {
      const ops = JSON.parse(init.body).ops;
      postBatches.push(ops);
      posts++;
      if (posts === 1) {
        return response({
          error: 'sync_conflict',
          conflict: {
            collection: 'tasks',
            id: '1',
            baseVersion: 0,
            currentVersion: 2,
            remote: { id: 1, t: 'Cloud current', _syncVersion: 2 },
          },
        }, 409);
      }
      return response({ ok: true, applied: ops.length, versions: ops.map(o => ({ collection: o.collection, id: String(o.id), version: 1 })) });
    }
    return response({ collections: { tasks: [{ id: 1, t: 'Cloud current', _syncVersion: 2 }] }, at: 'after-conflict', fullSnapshot: true });
  }, { online: false });

  await h.cloud.push('tasks', 'update', 1, { id: 1, t: 'Local one', _syncVersion: 1 }, { baseVersion: 0 });
  await h.cloud.push('tasks', 'update', 1, { id: 1, t: 'Local two', _syncVersion: 2 }, { baseVersion: 1 });
  await h.cloud.push('tasks', 'update', 2, { id: 2, t: 'Independent', _syncVersion: 1 }, { baseVersion: 0 });
  h.events.online();
  await tick();
  await tick();

  assert.equal(h.cloud.status().queued, 0);
  assert.equal(h.cloud.status().conflicts, 1);
  assert.equal(postBatches.length, 2);
  assert.deepEqual(postBatches[1].map(o => String(o.id)), ['2']);
  const conflict = h.cloud.conflicts()[0];
  assert.equal(conflict.key, 'tasks:1');
  assert.equal(conflict.local.t, 'Local two');
  assert.equal(conflict.remote.t, 'Cloud current');
  assert.equal(h.backend.db.tasks.getSync(1).t, 'Local two');
});

test('Use cloud resolves a quarantined conflict without creating another write', async () => {
  let posts = 0;
  const h = setup(async (url, init) => {
    if (init.method === 'POST') {
      posts++;
      return response({
        error: 'sync_conflict',
        conflict: {
          collection: 'tasks',
          id: '1',
          baseVersion: 0,
          currentVersion: 3,
          remote: { id: 1, t: 'Cloud choice', _syncVersion: 3 },
        },
      }, 409);
    }
    return response({ collections: {}, at: 'pulled' });
  }, { online: false });

  await h.cloud.push('tasks', 'update', 1, { id: 1, t: 'Mine', _syncVersion: 1 }, { baseVersion: 0 });
  h.events.online();
  await tick();
  assert.equal(h.cloud.status().conflicts, 1);

  assert.equal(await h.cloud.resolveConflict('tasks:1', 'cloud'), true);
  assert.equal(h.cloud.status().conflicts, 0);
  assert.equal(h.cloud.status().queued, 0);
  assert.equal(h.backend.db.tasks.getSync(1).t, 'Cloud choice');
  assert.equal(h.backend.db.tasks.getSync(1)._syncVersion, 3);
  assert.equal(posts, 1);
});

test('Keep mine rebases onto the latest cloud revision before retrying', async () => {
  let posts = 0;
  const batches = [];
  const h = setup(async (url, init) => {
    if (init.method === 'POST') {
      posts++;
      const ops = JSON.parse(init.body).ops;
      batches.push(ops);
      if (posts === 1) {
        return response({
          error: 'sync_conflict',
          conflict: {
            collection: 'tasks',
            id: '1',
            baseVersion: 0,
            currentVersion: 5,
            remote: { id: 1, t: 'Cloud v5', _syncVersion: 5 },
          },
        }, 409);
      }
      return response({ ok: true, applied: ops.length, versions: [{ collection: 'tasks', id: '1', version: 6 }] });
    }
    return response({ collections: {}, at: 'pulled' });
  }, { online: false });

  await h.cloud.push('tasks', 'update', 1, { id: 1, t: 'My offline edit', _syncVersion: 1 }, { baseVersion: 0 });
  h.events.online();
  await tick();
  assert.equal(h.cloud.status().conflicts, 1);

  assert.equal(await h.cloud.resolveConflict('tasks:1', 'mine'), true);
  assert.equal(h.cloud.status().conflicts, 0);
  assert.equal(h.cloud.status().queued, 0);
  assert.equal(posts, 2);
  assert.equal(batches[1][0].baseVersion, 5);
  assert.equal(batches[1][0].data.t, 'My offline edit');
  assert.equal(batches[1][0].data._syncVersion, 6);
  assert.equal(h.backend.db.tasks.getSync(1).t, 'My offline edit');
  assert.equal(h.backend.db.tasks.getSync(1)._syncVersion, 6);
});

test('sync conflicts stay isolated by workspace and user on shared devices', () => {
  const conflict = [{ key: 'tasks:1', collection: 'tasks', id: '1', local: { id: 1 }, remote: { id: 1 } }];
  const h = setup(async () => response({}), {
    storage: { [scopedConflictKey('a', 'user')]: JSON.stringify(conflict) },
  });
  assert.equal(h.cloud.status().conflicts, 1);
  h.cloud.signOut();
  h.cloud._authed({ token: token('b', 'user'), user: {} });
  assert.equal(h.cloud.status().conflicts, 0);
  h.cloud.signOut();
  h.cloud._authed({ token: token('a', 'other'), user: {} });
  assert.equal(h.cloud.status().conflicts, 0);
  h.cloud.signOut();
  h.cloud._authed({ token: token('a', 'user'), user: {} });
  assert.equal(h.cloud.status().conflicts, 1);
});


test('a delayed conflict response from an old session cannot leak into the next account', async () => {
  let finish;
  const h = setup(async (url, init) => {
    if (url.includes('/sync/bulk')) {
      return new Promise(resolve => {
        finish = () => resolve(response({
          error: 'sync_conflict',
          conflict: {
            collection: 'tasks',
            id: '1',
            baseVersion: 0,
            currentVersion: 2,
            remote: { id: 1, t: 'Account A cloud value', _syncVersion: 2 },
          },
        }, 409));
      });
    }
    return response({ collections: {} });
  }, { online: false });

  await h.cloud.push('tasks', 'update', 1, { id: 1, t: 'Account A offline' }, { baseVersion: 0 });
  h.events.online();
  await tick();
  h.cloud.signOut();
  h.cloud._authed({ token: token('b', 'user'), user: {} });
  finish();
  await tick();
  await tick();

  assert.equal(h.cloud.status().conflicts, 0);
  assert.equal(h.cloud.status().queued, 0);
  assert.equal(h.data.get(scopedConflictKey('b', 'user')), undefined);

  h.cloud.signOut();
  h.cloud._authed({ token: token('a', 'user'), user: {} });
  assert.equal(h.cloud.status().conflicts, 0);
  assert.equal(h.cloud.status().queued, 1);
});
